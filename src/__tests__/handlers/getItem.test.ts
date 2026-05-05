/**
 * Get Item Handler Tests
 *
 * Tests for the getItemHandler function.
 * Uses dependency injection for clean, isolated testing.
 */

import { describe, expect, it, vi } from 'vitest';
import { getItemHandler } from '../../handlers/getItem.js';
import { TEST_UUID, TEST_UUID_2, createTestContext, createMockItem } from '../helpers/testUtils.js';

describe('getItemHandler', () => {
  describe('successful retrieval', () => {
    it('should return 200 with the item when found', async () => {
      const mockItem = createMockItem();

      const ctx = createTestContext({
        getItem: vi.fn().mockResolvedValue(mockItem),
      });

      const result = await getItemHandler(TEST_UUID, ctx);

      expect(result.statusCode).toBe(200);
      expect(result.body).toEqual(mockItem);
      expect(ctx.storage.getItem).toHaveBeenCalledWith(TEST_UUID);
      expect(ctx.storage.getItem).toHaveBeenCalledTimes(1);
    });
  });

  describe('item not found', () => {
    it('should return 404 when item does not exist', async () => {
      const ctx = createTestContext({
        getItem: vi.fn().mockResolvedValue(null),
      });

      const result = await getItemHandler(TEST_UUID_2, ctx);

      expect(result.statusCode).toBe(404);
      expect(result.body).toEqual({ error: 'Item not found' });
      expect(ctx.storage.getItem).toHaveBeenCalledWith(TEST_UUID_2);
    });

    it('should log when item is not found', async () => {
      const ctx = createTestContext({
        getItem: vi.fn().mockResolvedValue(null),
      });

      await getItemHandler(TEST_UUID_2, ctx);

      expect(ctx.logger.info).toHaveBeenCalledWith('Item not found', { itemId: TEST_UUID_2 });
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

      const result = await getItemHandler(TEST_UUID, ctx);

      expect(result.statusCode).toBe(500);
      expect(result.body).toEqual({ error: 'Internal server error' });
    });

    it('should log the error when storage fails', async () => {
      const testError = new Error('Database connection failed');
      const ctx = createTestContext({
        getItem: vi.fn().mockRejectedValue(testError),
      });

      await getItemHandler(TEST_UUID, ctx);

      expect(ctx.logger.error).toHaveBeenCalledWith('Error getting item', testError, {
        itemId: TEST_UUID,
      });
    });
  });
});
