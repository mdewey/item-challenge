/**
 * DynamoDB Storage Implementation
 *
 * Main storage class implementing ItemStorage interface.
 * Uses single-table design with composite keys for efficient access patterns.
 *
 * For DynamoDB Local:
 * - Download from: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/DynamoDBLocal.html
 * - Run: java -Djava.library.path=./DynamoDBLocal_lib -jar DynamoDBLocal.jar -sharedDb
 * - Set DYNAMODB_ENDPOINT=http://localhost:8000
 */

import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  QueryCommand,
  ScanCommand,
  TransactWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import { randomUUID } from 'crypto';
import {
  ExamItem,
  CreateItemRequest,
  UpdateItemRequest,
  ListItemsQuery,
} from '../../types/item.js';
import { ItemStorage } from '../interface.js';
import { Logger, createLogger } from '../../utils/logger.js';
import { DynamoDBRecord, INDEXES } from './types.js';
import { createDynamoDBClient, getConfig, DynamoDBConfig } from './client.js';
import * as keys from './keys.js';

export class DynamoDBStorage implements ItemStorage {
  private client: DynamoDBDocumentClient;
  private tableName: string;
  private logger: Logger;

  constructor(logger?: Logger, config?: DynamoDBConfig) {
    const cfg = config ?? getConfig();

    this.client = createDynamoDBClient(cfg);
    this.tableName = cfg.tableName;
    this.logger = logger ?? createLogger({ layer: 'dynamodb' });

    this.logger.debug('DynamoDB storage initialized', {
      table: this.tableName,
      region: cfg.region,
      endpoint: cfg.endpoint ?? 'AWS default',
    });
  }

  // ---------------------------------------------------------------------------
  // CRUD Operations
  // ---------------------------------------------------------------------------

  async createItem(data: CreateItemRequest): Promise<ExamItem> {
    const now = Date.now();
    const id = randomUUID();
    const startTime = Date.now();

    this.logger.debug('Creating item', { id, subject: data.subject, status: data.metadata.status });

    const item: ExamItem = {
      id,
      ...data,
      metadata: {
        ...data.metadata,
        created: now,
        lastModified: now,
        version: 1,
      },
    };

    const record = keys.buildRecord(item, keys.skCurrent());

    try {
      await this.client.send(
        new PutCommand({
          TableName: this.tableName,
          Item: record,
          ConditionExpression: 'attribute_not_exists(pk)',
        })
      );

      this.logger.info('Item created', { id, durationMs: Date.now() - startTime });
      return item;
    } catch (error) {
      this.logger.error('Failed to create item', error as Error, { id });
      throw error;
    }
  }

  async getItem(id: string): Promise<ExamItem | null> {
    const startTime = Date.now();
    this.logger.debug('Getting item', { id, pk: keys.pk(id), sk: 'CURRENT' });

    try {
      const result = await this.client.send(
        new GetCommand({
          TableName: this.tableName,
          Key: {
            pk: keys.pk(id),
            sk: keys.skCurrent(),
          },
        })
      );

      const found = !!result.Item;
      this.logger.debug('GetItem result', { id, found, durationMs: Date.now() - startTime });

      if (!result.Item) return null;
      return keys.toExamItem(result.Item as DynamoDBRecord);
    } catch (error) {
      this.logger.error('Failed to get item', error as Error, { id });
      throw error;
    }
  }

  async updateItem(id: string, data: UpdateItemRequest): Promise<ExamItem | null> {
    const startTime = Date.now();
    this.logger.debug('Updating item', { id, fields: Object.keys(data) });

    const existing = await this.getItem(id);
    if (!existing) {
      this.logger.debug('Update skipped - item not found', { id });
      return null;
    }

    const previousVersion = existing.metadata.version;
    const updated: ExamItem = {
      ...existing,
      ...data,
      content: data.content ? { ...existing.content, ...data.content } : existing.content,
      metadata: {
        ...existing.metadata,
        ...(data.metadata ?? {}),
        lastModified: Date.now(),
        version: existing.metadata.version + 1,
      },
    };

    const record = keys.buildRecord(updated, keys.skCurrent());

    try {
      await this.client.send(
        new PutCommand({
          TableName: this.tableName,
          Item: record,
          // Optimistic locking: only update if version hasn't changed
          ConditionExpression: 'attribute_exists(pk) AND #metadata.#version = :expectedVersion',
          ExpressionAttributeNames: {
            '#metadata': 'metadata',
            '#version': 'version',
          },
          ExpressionAttributeValues: {
            ':expectedVersion': previousVersion,
          },
        })
      );

      this.logger.info('Item updated', {
        id,
        version: `${previousVersion} → ${updated.metadata.version}`,
        durationMs: Date.now() - startTime,
      });
      return updated;
    } catch (error) {
      // Handle optimistic locking failure
      if (error instanceof ConditionalCheckFailedException) {
        this.logger.warn('Update conflict - item was modified by another request', {
          id,
          expectedVersion: previousVersion,
        });
        throw new Error(`Concurrent modification detected for item ${id}`, { cause: error });
      }
      this.logger.error('Failed to update item', error as Error, { id });
      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // List Items with GSI Queries
  // ---------------------------------------------------------------------------

  async listItems(query: ListItemsQuery): Promise<{ items: ExamItem[]; total: number }> {
    const limit = query.limit ?? 10;
    const startTime = Date.now();

    this.logger.debug('Listing items', { query, limit });

    let result: { items: ExamItem[]; total: number };
    let indexUsed: string;

    if (query.subject) {
      indexUsed = INDEXES.SUBJECT;
      result = await this.listBySubject(query.subject, query.status, limit);
    } else if (query.status) {
      indexUsed = INDEXES.STATUS;
      result = await this.listByStatus(query.status, limit);
    } else {
      indexUsed = 'fallback';
      result = await this.listAll(limit);
    }

    this.logger.info('List items complete', {
      index: indexUsed,
      count: result.total,
      durationMs: Date.now() - startTime,
    });

    return result;
  }

  private async listBySubject(
    subject: string,
    status: string | undefined,
    limit: number
  ): Promise<{ items: ExamItem[]; total: number }> {
    const result = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: INDEXES.SUBJECT,
        KeyConditionExpression: status
          ? 'subject = :subject AND begins_with(gsi1sk, :statusPrefix)'
          : 'subject = :subject',
        ExpressionAttributeValues: {
          ':subject': subject,
          ...(status && { ':statusPrefix': `${status}#` }),
        },
        Limit: limit,
      })
    );

    const items = (result.Items ?? []).map((r) => keys.toExamItem(r as DynamoDBRecord));
    return { items, total: result.Count ?? 0 };
  }

  private async listByStatus(
    status: string,
    limit: number
  ): Promise<{ items: ExamItem[]; total: number }> {
    const result = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: INDEXES.STATUS,
        KeyConditionExpression: '#status = :status',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: { ':status': status },
        Limit: limit,
      })
    );

    const items = (result.Items ?? []).map((r) => keys.toExamItem(r as DynamoDBRecord));
    return { items, total: result.Count ?? 0 };
  }

  private async listAll(limit: number): Promise<{ items: ExamItem[]; total: number }> {
    // Use Scan for unfiltered listing (expensive - consider requiring filters in production)
    this.logger.warn(
      'Using Scan for unfiltered listItems - consider requiring subject or status filter'
    );

    const result = await this.client.send(
      new ScanCommand({
        TableName: this.tableName,
        // Only return CURRENT items, not VERSION# snapshots
        FilterExpression: 'sk = :current',
        ExpressionAttributeValues: { ':current': 'CURRENT' },
        Limit: limit,
      })
    );

    const items = (result.Items ?? []).map((r) => keys.toExamItem(r as DynamoDBRecord));
    return { items, total: result.Count ?? 0 };
  }

  // ---------------------------------------------------------------------------
  // Versioning & Audit Trail
  // ---------------------------------------------------------------------------

  async createVersion(id: string): Promise<ExamItem | null> {
    const startTime = Date.now();
    this.logger.debug('Creating version snapshot', { id });

    const existing = await this.getItem(id);
    if (!existing) {
      this.logger.debug('Version creation skipped - item not found', { id });
      return null;
    }

    const currentVersion = existing.metadata.version;
    const newVersion = currentVersion + 1;

    const snapshotRecord = keys.buildRecord(existing, keys.skVersion(currentVersion));

    const updatedItem: ExamItem = {
      ...existing,
      metadata: {
        ...existing.metadata,
        lastModified: Date.now(),
        version: newVersion,
      },
    };
    const currentRecord = keys.buildRecord(updatedItem, keys.skCurrent());

    try {
      await this.client.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Put: {
                TableName: this.tableName,
                Item: snapshotRecord,
                ConditionExpression: 'attribute_not_exists(pk)',
              },
            },
            {
              Put: {
                TableName: this.tableName,
                Item: currentRecord,
                // Optimistic locking: ensure version hasn't changed since we read it
                ConditionExpression: '#metadata.#version = :expectedVersion',
                ExpressionAttributeNames: {
                  '#metadata': 'metadata',
                  '#version': 'version',
                },
                ExpressionAttributeValues: {
                  ':expectedVersion': currentVersion,
                },
              },
            },
          ],
        })
      );

      this.logger.info('Version created', {
        id,
        snapshotVersion: currentVersion,
        newVersion,
        durationMs: Date.now() - startTime,
      });
      return updatedItem;
    } catch (error) {
      this.logger.error('Failed to create version', error as Error, { id, currentVersion });
      throw error;
    }
  }

  async getAuditTrail(id: string): Promise<ExamItem[]> {
    const startTime = Date.now();
    this.logger.debug('Getting audit trail', { id });

    try {
      const result = await this.client.send(
        new QueryCommand({
          TableName: this.tableName,
          KeyConditionExpression: 'pk = :pk AND begins_with(sk, :versionPrefix)',
          ExpressionAttributeValues: {
            ':pk': keys.pk(id),
            ':versionPrefix': keys.VERSION_QUERY_PREFIX,
          },
          ScanIndexForward: true,
        })
      );

      const versions = (result.Items ?? []).map((r) => keys.toExamItem(r as DynamoDBRecord));

      this.logger.info('Audit trail retrieved', {
        id,
        versionCount: versions.length,
        durationMs: Date.now() - startTime,
      });

      return versions;
    } catch (error) {
      this.logger.error('Failed to get audit trail', error as Error, { id });
      throw error;
    }
  }
}

// Re-export types and utilities for convenience
export type { DynamoDBRecord } from './types.js';
export { INDEXES } from './types.js';
export type { DynamoDBConfig } from './client.js';
export * as keys from './keys.js';
