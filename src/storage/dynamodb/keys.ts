/**
 * DynamoDB Key Generation Helpers
 *
 * Centralized key generation for single-table design.
 * These functions encode the schema conventions used throughout the storage layer.
 */

import { ExamItem } from '../../types/item.js';
import { DynamoDBRecord } from './types.js';

// ---------------------------------------------------------------------------
// Key Prefixes (Schema Constants)
// ---------------------------------------------------------------------------

const ITEM_PREFIX = 'ITEM#';
const VERSION_PREFIX = 'VERSION#';
const CURRENT_SK = 'CURRENT';

// ---------------------------------------------------------------------------
// Key Generation Functions
// ---------------------------------------------------------------------------

/** Generate partition key: ITEM#<id> */
export function pk(id: string): string {
  return `${ITEM_PREFIX}${id}`;
}

/** Sort key for current (latest) version */
export function skCurrent(): string {
  return CURRENT_SK;
}

/** Sort key for historical version: VERSION#00001 */
export function skVersion(version: number): string {
  return `${VERSION_PREFIX}${version.toString().padStart(5, '0')}`;
}

/** GSI1 sort key: status#id (enables filtering by status within subject) */
export function gsi1sk(status: string, id: string): string {
  return `${status}#${id}`;
}

/** GSI2 sort key: subject#id (enables filtering by subject within status) */
export function gsi2sk(subject: string, id: string): string {
  return `${subject}#${id}`;
}

// ---------------------------------------------------------------------------
// Record Transformation
// ---------------------------------------------------------------------------

/** Convert DynamoDB record to ExamItem (strip DDB keys) */
export function toExamItem(record: DynamoDBRecord): ExamItem {
  const { pk: _pk, sk: _sk, gsi1sk: _gsi1sk, gsi2sk: _gsi2sk, status: _status, ...item } = record;
  return item;
}

/**
 * Build a DynamoDB record with appropriate keys.
 *
 * IMPORTANT: GSI keys are only added for CURRENT records, not VERSION# snapshots.
 * This prevents historical versions from appearing in SubjectIndex/StatusIndex queries.
 */
export function buildRecord(item: ExamItem, sortKey: string): DynamoDBRecord {
  const baseRecord = {
    ...item,
    pk: pk(item.id),
    sk: sortKey,
  };

  // Only add GSI keys for CURRENT records (not VERSION# snapshots)
  if (sortKey === CURRENT_SK) {
    return {
      ...baseRecord,
      subject: item.subject,
      gsi1sk: gsi1sk(item.metadata.status, item.id),
      status: item.metadata.status,
      gsi2sk: gsi2sk(item.subject, item.id),
    };
  }

  // VERSION# records: no GSI keys (won't appear in index queries)
  return baseRecord as DynamoDBRecord;
}

/** Version prefix for query expressions */
export const VERSION_QUERY_PREFIX = VERSION_PREFIX;
