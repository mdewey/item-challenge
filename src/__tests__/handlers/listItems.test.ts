/**
 * List Items Handler Tests
 */

import { describe, it, expect, vi, Mock } from 'vitest';
import { listItemsHandler } from '../../handlers/listItems.js';
import { HttpStatus } from '../../types/api.js';
import {
  createMockStorage,
  createMockLogger,
  createTestContext,
  createMockItem,
  ValidationErrorBody,
} from '../helpers/testUtils.js';

describe('listItemsHandler', () => {
  // ============================================
  // Query Validation
  // ============================================
  describe('query validation', () => {
    it('should return 400 for invalid limit (non-numeric)', async () => {
      const ctx = createTestContext();
      const result = await listItemsHandler({ limit: 'abc' }, ctx);

      expect(result.statusCode).toBe(HttpStatus.BAD_REQUEST);
      const body = result.body as ValidationErrorBody;
      expect(body.error).toBe('Validation failed');
    });

    it('should return 400 for limit less than 1', async () => {
      const ctx = createTestContext();
      const result = await listItemsHandler({ limit: '0' }, ctx);

      expect(result.statusCode).toBe(HttpStatus.BAD_REQUEST);
      const body = result.body as ValidationErrorBody;
      expect(body.error).toBe('Validation failed');
      expect(body.details).toContain('limit: Number must be greater than or equal to 1');
    });

    it('should return 400 for limit greater than 100', async () => {
      const ctx = createTestContext();
      const result = await listItemsHandler({ limit: '101' }, ctx);

      expect(result.statusCode).toBe(HttpStatus.BAD_REQUEST);
      const body = result.body as ValidationErrorBody;
      expect(body.error).toBe('Validation failed');
      expect(body.details).toContain('limit: Number must be less than or equal to 100');
    });

    it('should return 400 for negative offset', async () => {
      const ctx = createTestContext();
      const result = await listItemsHandler({ offset: '-1' }, ctx);

      expect(result.statusCode).toBe(HttpStatus.BAD_REQUEST);
      const body = result.body as ValidationErrorBody;
      expect(body.error).toBe('Validation failed');
      expect(body.details).toContain('offset: Number must be greater than or equal to 0');
    });

    it('should return 400 for invalid status', async () => {
      const ctx = createTestContext();
      const result = await listItemsHandler({ status: 'invalid' }, ctx);

      expect(result.statusCode).toBe(HttpStatus.BAD_REQUEST);
      const body = result.body as ValidationErrorBody;
      expect(body.error).toBe('Validation failed');
    });

    it('should return 400 for empty subject', async () => {
      const ctx = createTestContext();
      const result = await listItemsHandler({ subject: '' }, ctx);

      expect(result.statusCode).toBe(HttpStatus.BAD_REQUEST);
      const body = result.body as ValidationErrorBody;
      expect(body.error).toBe('Validation failed');
    });
  });

  // ============================================
  // Default Behavior
  // ============================================
  describe('default behavior', () => {
    it('should use default limit of 10', async () => {
      const ctx = createTestContext({
        listItems: vi.fn().mockResolvedValue({ items: [], total: 0 }),
      });

      const result = await listItemsHandler({}, ctx);

      expect(result.statusCode).toBe(HttpStatus.OK);
      expect(ctx.storage.listItems).toHaveBeenCalledWith(expect.objectContaining({ limit: 10 }));
    });

    it('should use default offset of 0', async () => {
      const ctx = createTestContext({
        listItems: vi.fn().mockResolvedValue({ items: [], total: 0 }),
      });

      const result = await listItemsHandler({}, ctx);

      expect(result.statusCode).toBe(HttpStatus.OK);
      expect(ctx.storage.listItems).toHaveBeenCalledWith(expect.objectContaining({ offset: 0 }));
    });

    it('should return empty list when no items exist', async () => {
      const ctx = createTestContext({
        listItems: vi.fn().mockResolvedValue({ items: [], total: 0 }),
      });

      const result = await listItemsHandler({}, ctx);

      expect(result.statusCode).toBe(HttpStatus.OK);
      expect(result.body).toEqual({
        items: [],
        total: 0,
        limit: 10,
        offset: 0,
      });
    });
  });

  // ============================================
  // Pagination
  // ============================================
  describe('pagination', () => {
    it('should respect custom limit', async () => {
      const items = [createMockItem(), createMockItem()];
      const ctx = createTestContext({
        listItems: vi.fn().mockResolvedValue({ items, total: 50 }),
      });

      const result = await listItemsHandler({ limit: '25' }, ctx);

      expect(result.statusCode).toBe(HttpStatus.OK);
      expect(ctx.storage.listItems).toHaveBeenCalledWith(expect.objectContaining({ limit: 25 }));
      expect(result.body).toMatchObject({ limit: 25 });
    });

    it('should respect custom offset', async () => {
      const ctx = createTestContext({
        listItems: vi.fn().mockResolvedValue({ items: [], total: 50 }),
      });

      const result = await listItemsHandler({ offset: '20' }, ctx);

      expect(result.statusCode).toBe(HttpStatus.OK);
      expect(ctx.storage.listItems).toHaveBeenCalledWith(expect.objectContaining({ offset: 20 }));
      expect(result.body).toMatchObject({ offset: 20 });
    });

    it('should return total count for pagination', async () => {
      const items = [createMockItem()];
      const ctx = createTestContext({
        listItems: vi.fn().mockResolvedValue({ items, total: 100 }),
      });

      const result = await listItemsHandler({ limit: '10', offset: '50' }, ctx);

      expect(result.statusCode).toBe(HttpStatus.OK);
      expect(result.body).toMatchObject({
        items,
        total: 100,
        limit: 10,
        offset: 50,
      });
    });
  });

  // ============================================
  // Filtering
  // ============================================
  describe('filtering', () => {
    it('should filter by subject', async () => {
      const items = [createMockItem({ subject: 'AP Biology' })];
      const ctx = createTestContext({
        listItems: vi.fn().mockResolvedValue({ items, total: 1 }),
      });

      const result = await listItemsHandler({ subject: 'AP Biology' }, ctx);

      expect(result.statusCode).toBe(HttpStatus.OK);
      expect(ctx.storage.listItems).toHaveBeenCalledWith(
        expect.objectContaining({ subject: 'AP Biology' })
      );
    });

    it('should filter by status', async () => {
      const items = [createMockItem()];
      const ctx = createTestContext({
        listItems: vi.fn().mockResolvedValue({ items, total: 1 }),
      });

      const result = await listItemsHandler({ status: 'draft' }, ctx);

      expect(result.statusCode).toBe(HttpStatus.OK);
      expect(ctx.storage.listItems).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'draft' })
      );
    });

    it('should filter by both subject and status', async () => {
      const items = [createMockItem({ subject: 'AP Chemistry' })];
      const ctx = createTestContext({
        listItems: vi.fn().mockResolvedValue({ items, total: 1 }),
      });

      const result = await listItemsHandler({ subject: 'AP Chemistry', status: 'approved' }, ctx);

      expect(result.statusCode).toBe(HttpStatus.OK);
      expect(ctx.storage.listItems).toHaveBeenCalledWith(
        expect.objectContaining({ subject: 'AP Chemistry', status: 'approved' })
      );
    });

    it('should combine filters with pagination', async () => {
      const ctx = createTestContext({
        listItems: vi.fn().mockResolvedValue({ items: [], total: 0 }),
      });

      const result = await listItemsHandler(
        {
          subject: 'AP Physics',
          status: 'review',
          limit: '5',
          offset: '10',
        },
        ctx
      );

      expect(result.statusCode).toBe(HttpStatus.OK);
      expect(ctx.storage.listItems).toHaveBeenCalledWith({
        subject: 'AP Physics',
        status: 'review',
        limit: 5,
        offset: 10,
      });
    });
  });

  // ============================================
  // Successful Response
  // ============================================
  describe('successful response', () => {
    it('should return items with metadata', async () => {
      const items = [
        createMockItem({ id: '1', subject: 'AP Biology' }),
        createMockItem({ id: '2', subject: 'AP Chemistry' }),
      ];
      const ctx = createTestContext({
        listItems: vi.fn().mockResolvedValue({ items, total: 2 }),
      });

      const result = await listItemsHandler({}, ctx);

      expect(result.statusCode).toBe(HttpStatus.OK);
      expect(result.body).toEqual({
        items,
        total: 2,
        limit: 10,
        offset: 0,
      });
    });
  });

  // ============================================
  // Error Handling
  // ============================================
  describe('error handling', () => {
    it('should return 500 when storage throws an error', async () => {
      const ctx = createTestContext({
        listItems: vi.fn().mockRejectedValue(new Error('Database error')),
      });

      const result = await listItemsHandler({}, ctx);

      expect(result.statusCode).toBe(HttpStatus.INTERNAL_ERROR);
      expect(result.body).toEqual({ error: 'Internal server error' });
    });

    it('should log error details when storage fails', async () => {
      const mockLogger = createMockLogger();
      const mockStorage = createMockStorage();
      const dbError = new Error('Connection timeout');
      (mockStorage.listItems as Mock).mockRejectedValue(dbError);

      const ctx = {
        requestId: 'test-request',
        storage: mockStorage,
        logger: mockLogger,
      };

      await listItemsHandler({ subject: 'AP Math' }, ctx);

      expect(mockLogger.error).toHaveBeenCalledWith('Error listing items', dbError, {
        subject: 'AP Math',
        status: undefined,
      });
    });
  });

  // ============================================
  // Logging
  // ============================================
  describe('logging', () => {
    it('should log debug message when listing items', async () => {
      const mockLogger = createMockLogger();
      const mockStorage = createMockStorage();
      (mockStorage.listItems as Mock).mockResolvedValue({ items: [], total: 0 });

      const ctx = {
        requestId: 'test-request',
        storage: mockStorage,
        logger: mockLogger,
      };

      await listItemsHandler({ subject: 'AP Biology', limit: '5' }, ctx);

      expect(mockLogger.debug).toHaveBeenCalledWith('Listing items', {
        limit: 5,
        offset: 0,
        subject: 'AP Biology',
        status: undefined,
      });
    });

    it('should log info message on successful list', async () => {
      const mockLogger = createMockLogger();
      const mockStorage = createMockStorage();
      const items = [createMockItem(), createMockItem()];
      (mockStorage.listItems as Mock).mockResolvedValue({ items, total: 50 });

      const ctx = {
        requestId: 'test-request',
        storage: mockStorage,
        logger: mockLogger,
      };

      await listItemsHandler({}, ctx);

      expect(mockLogger.info).toHaveBeenCalledWith('Items listed successfully', {
        total: 50,
        returned: 2,
      });
    });

    it('should log warning on invalid query', async () => {
      const mockLogger = createMockLogger();
      const ctx = {
        requestId: 'test-request',
        storage: createMockStorage(),
        logger: mockLogger,
      };

      await listItemsHandler({ limit: 'bad' }, ctx);

      expect(mockLogger.warn).toHaveBeenCalled();
      const [message, context] = (mockLogger.warn as Mock).mock.calls[0] as [
        string,
        { errors: string[] },
      ];
      expect(message).toBe('Invalid list items query');
      expect(Array.isArray(context.errors)).toBe(true);
    });
  });
});
