/**
 * In-Memory Storage Implementation
 *
 * This is a simple in-memory storage for local development and testing.
 * Data is lost when the server restarts.
 */

import { randomUUID } from 'crypto';
import { ExamItem, CreateItemRequest, UpdateItemRequest, ListItemsQuery } from '../types/item.js';
import { ItemStorage } from './interface.js';

export class MemoryStorage implements ItemStorage {
  private items: Map<string, ExamItem> = new Map();
  private versions: Map<string, ExamItem[]> = new Map();

  async createItem(data: CreateItemRequest): Promise<ExamItem> {
    const now = Date.now();
    const item: ExamItem = {
      id: randomUUID(),
      ...data,
      metadata: {
        ...data.metadata,
        created: now,
        lastModified: now,
        version: 1,
      },
    };

    this.items.set(item.id, item);
    // Explicit versioning: no auto-history on create
    // Call createVersion() to snapshot before major changes

    return item;
  }

  async getItem(id: string): Promise<ExamItem | null> {
    return this.items.get(id) ?? null;
  }

  async updateItem(id: string, data: UpdateItemRequest): Promise<ExamItem | null> {
    const item = this.items.get(id);
    if (!item) return null;

    const updated: ExamItem = {
      ...item,
      ...data,
      content: data.content ? { ...item.content, ...data.content } : item.content,
      metadata: {
        ...item.metadata,
        ...(data.metadata ?? {}),
        lastModified: Date.now(),
        version: item.metadata.version + 1,
      },
    };

    this.items.set(id, updated);
    // Explicit versioning: no auto-history on update
    // Call createVersion() to snapshot before major changes

    return updated;
  }

  async listItems(query: ListItemsQuery): Promise<{ items: ExamItem[]; total: number }> {
    let items = Array.from(this.items.values());

    // Filter by subject
    if (query.subject) {
      items = items.filter((item) => item.subject === query.subject);
    }

    // Filter by status
    if (query.status) {
      items = items.filter((item) => item.metadata.status === query.status);
    }

    const total = items.length;

    // Pagination
    const offset = query.offset ?? 0;
    const limit = query.limit ?? 10;
    items = items.slice(offset, offset + limit);

    return { items, total };
  }

  async createVersion(id: string): Promise<ExamItem | null> {
    const item = this.items.get(id);
    if (!item) return null;

    // Snapshot current state BEFORE incrementing version
    const history = this.versions.get(id) ?? [];
    history.push({ ...item });
    this.versions.set(id, history);

    // Increment version on current item
    const newVersion: ExamItem = {
      ...item,
      metadata: {
        ...item.metadata,
        version: item.metadata.version + 1,
        lastModified: Date.now(),
      },
    };

    this.items.set(id, newVersion);

    return newVersion;
  }

  async getAuditTrail(id: string): Promise<ExamItem[]> {
    return this.versions.get(id) ?? [];
  }
}
