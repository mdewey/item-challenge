/**
 * Get Item Handler Tests
 *
 * Tests for the getItemHandler function.
 * Uses dependency injection for clean, isolated testing.
 */

import { describe, expect, it, vi } from 'vitest';
import { getItemHandler } from '../handlers/getItem.js';
import { HandlerContext } from '../context.js';
import { ItemStorage } from '../storage/interface.js';

// Valid UUID for testing
const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const VALID_UUID_2 = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

// Create mock storage - no module mocking needed with DI!
function createMockStorage(): ItemStorage {
  return {
    getItem: vi.fn(),
    createItem: vi.fn(),
    updateItem: vi.fn(),
    listItems: vi.fn(),
    createVersion: vi.fn(),
    getAuditTrail: vi.fn(),
  };
}

// Create mock logger that suppresses output in tests
function createMockLogger() {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

// Create test context with mocks
function createTestContext(storage?: Partial<ItemStorage>): HandlerContext {
  const mockStorage = createMockStorage();
  return {
    requestId: 'test-request-id',
    storage: { ...mockStorage, ...storage } as ItemStorage,
    logger: createMockLogger(),
  };
}

describe('getItemHandler', () => {
  describe('successful retrieval', () => {
    it('should return 200 with the item when found', async () => {
      const mockItem = {
        id: VALID_UUID,
        subject: 'AP Biology',
        itemType: 'multiple-choice',
        difficulty: 3,
        content: {
          question: 'What is photosynthesis?',
          options: ['A', 'B', 'C', 'D'],
          correctAnswer: 'A',
          explanation: 'Photosynthesis is the process...',
        },
        metadata: {
          author: 'test-author',
          created: 1234567890,
          lastModified: 1234567890,
          version: 1,
          status: 'draft',
          tags: ['biology'],
        },
        securityLevel: 'standard',
      };

      const ctx = createTestContext({
        getItem: vi.fn().mockResolvedValue(mockItem),
      });

      const result = await getItemHandler(VALID_UUID, ctx);

      expect(result.statusCode).toBe(200);
      expect(result.body).toEqual(mockItem);
      expect(ctx.storage.getItem).toHaveBeenCalledWith(VALID_UUID);
      expect(ctx.storage.getItem).toHaveBeenCalledTimes(1);
    });
  });

  describe('item not found', () => {
    it('should return 404 when item does not exist', async () => {
      const ctx = createTestContext({
        getItem: vi.fn().mockResolvedValue(null),
      });

      const result = await getItemHandler(VALID_UUID_2, ctx);

      expect(result.statusCode).toBe(404);
      expect(result.body).toEqual({ error: 'Item not found' });
      expect(ctx.storage.getItem).toHaveBeenCalledWith(VALID_UUID_2);
    });

    it('should log when item is not found', async () => {
      const ctx = createTestContext({
        getItem: vi.fn().mockResolvedValue(null),
      });

      await getItemHandler(VALID_UUID_2, ctx);

      expect(ctx.logger.info).toHaveBeenCalledWith('Item not found', { itemId: VALID_UUID_2 });
    });
  });

  describe('input validation (Zod)', () => {
    it('should return 400 for empty string ID', async () => {
      const ctx = createTestContext();

      const result = await getItemHandler('', ctx);

      expect(result.statusCode).toBe(400);
      expect(result.body).toEqual({ error: 'Invalid item ID format - must be a valid UUID' });
      expect(ctx.storage.getItem).not.toHaveBeenCalled();
    });

    it('should return 400 for invalid UUID format', async () => {
      const ctx = createTestContext();

      const result = await getItemHandler('not-a-valid-uuid', ctx);

      expect(result.statusCode).toBe(400);
      expect(result.body).toEqual({ error: 'Invalid item ID format - must be a valid UUID' });
      expect(ctx.storage.getItem).not.toHaveBeenCalled();
    });

    it('should return 400 for null ID', async () => {
      const ctx = createTestContext();

      const result = await getItemHandler(null, ctx);

      expect(result.statusCode).toBe(400);
      expect(result.body).toEqual({ error: 'Expected string, received null' });
      expect(ctx.storage.getItem).not.toHaveBeenCalled();
    });

    it('should return 400 for undefined ID', async () => {
      const ctx = createTestContext();

      const result = await getItemHandler(undefined, ctx);

      expect(result.statusCode).toBe(400);
      expect(result.body).toEqual({ error: 'Required' });
      expect(ctx.storage.getItem).not.toHaveBeenCalled();
    });

    it('should return 400 for number ID', async () => {
      const ctx = createTestContext();

      const result = await getItemHandler(12345, ctx);

      expect(result.statusCode).toBe(400);
      expect(result.body).toEqual({ error: 'Expected string, received number' });
      expect(ctx.storage.getItem).not.toHaveBeenCalled();
    });

    it('should log warning with validation error', async () => {
      const ctx = createTestContext();

      await getItemHandler('bad-id', ctx);

      expect(ctx.logger.warn).toHaveBeenCalledWith('Invalid item ID provided', {
        id: 'bad-id',
        error: 'Invalid item ID format - must be a valid UUID',
      });
    });
  });

  describe('error handling', () => {
    it('should return 500 when storage throws an error', async () => {
      const ctx = createTestContext({
        getItem: vi.fn().mockRejectedValue(new Error('Database connection failed')),
      });

      const result = await getItemHandler(VALID_UUID, ctx);

      expect(result.statusCode).toBe(500);
      expect(result.body).toEqual({ error: 'Internal server error' });
    });

    it('should log the error when storage fails', async () => {
      const testError = new Error('Database connection failed');
      const ctx = createTestContext({
        getItem: vi.fn().mockRejectedValue(testError),
      });

      await getItemHandler(VALID_UUID, ctx);

      expect(ctx.logger.error).toHaveBeenCalledWith('Error getting item', testError, {
        itemId: VALID_UUID,
      });
    });
  });
});
