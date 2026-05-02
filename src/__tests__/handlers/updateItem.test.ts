/**
 * Update Item Handler Tests
 */

import { describe, it, expect, vi, Mock } from 'vitest';
import { updateItemHandler } from '../../handlers/updateItem.js';
import { HttpStatus } from '../../types/api.js';
import {
  TEST_UUID,
  NOT_FOUND_ITEM_ID,
  createMockStorage,
  createMockLogger,
  createTestContext,
  createMockItem,
  ValidationErrorBody,
} from '../helpers/testUtils.js';

describe('updateItemHandler', () => {
  // ============================================
  // ID Validation
  // ============================================
  describe('ID validation', () => {
    it('should return 400 for invalid UUID format', async () => {
      const ctx = createTestContext();
      const result = await updateItemHandler('not-a-uuid', { subject: 'Math' }, ctx);

      expect(result.statusCode).toBe(HttpStatus.BAD_REQUEST);
      expect(result.body).toEqual({
        error: 'Invalid item ID format - must be a valid UUID',
      });
    });

    it('should return 400 for empty string ID', async () => {
      const ctx = createTestContext();
      const result = await updateItemHandler('', { subject: 'Math' }, ctx);

      expect(result.statusCode).toBe(HttpStatus.BAD_REQUEST);
      expect(result.body).toEqual({
        error: 'Invalid item ID format - must be a valid UUID',
      });
    });

    it('should return 400 for non-string ID', async () => {
      const ctx = createTestContext();
      const result = await updateItemHandler(123, { subject: 'Math' }, ctx);

      expect(result.statusCode).toBe(HttpStatus.BAD_REQUEST);
      expect(result.body).toEqual({
        error: 'Expected string, received number',
      });
    });
  });

  // ============================================
  // Body Validation
  // ============================================
  describe('body validation', () => {
    it('should return 400 for empty update body', async () => {
      const ctx = createTestContext();
      const result = await updateItemHandler(TEST_UUID, {}, ctx);

      expect(result.statusCode).toBe(HttpStatus.BAD_REQUEST);
      expect(result.body).toEqual({
        error: 'At least one field must be provided for update',
      });
    });

    it('should return 400 for invalid itemType', async () => {
      const ctx = createTestContext();
      const result = await updateItemHandler(TEST_UUID, { itemType: 'invalid' }, ctx);

      expect(result.statusCode).toBe(HttpStatus.BAD_REQUEST);
      const body = result.body as ValidationErrorBody;
      expect(body.error).toBe('Validation failed');
      expect(body.details).toContain(
        "itemType: Invalid enum value. Expected 'multiple-choice' | 'free-response' | 'essay', received 'invalid'"
      );
    });

    it('should return 400 for invalid securityLevel', async () => {
      const ctx = createTestContext();
      const result = await updateItemHandler(TEST_UUID, { securityLevel: 'top-secret' }, ctx);

      expect(result.statusCode).toBe(HttpStatus.BAD_REQUEST);
      const body = result.body as ValidationErrorBody;
      expect(body.error).toBe('Validation failed');
      expect(body.details).toContain(
        "securityLevel: Invalid enum value. Expected 'standard' | 'secure' | 'highly-secure', received 'top-secret'"
      );
    });

    it('should return 400 for invalid difficulty (out of range)', async () => {
      const ctx = createTestContext();
      const result = await updateItemHandler(TEST_UUID, { difficulty: 10 }, ctx);

      expect(result.statusCode).toBe(HttpStatus.BAD_REQUEST);
      const body = result.body as ValidationErrorBody;
      expect(body.error).toBe('Validation failed');
      expect(body.details).toContain('difficulty: Number must be less than or equal to 5');
    });

    it('should return 400 for invalid difficulty (non-integer)', async () => {
      const ctx = createTestContext();
      const result = await updateItemHandler(TEST_UUID, { difficulty: 3.5 }, ctx);

      expect(result.statusCode).toBe(HttpStatus.BAD_REQUEST);
      const body = result.body as ValidationErrorBody;
      expect(body.error).toBe('Validation failed');
      expect(body.details).toContain('difficulty: Expected integer, received float');
    });

    it('should return 400 for empty subject string', async () => {
      const ctx = createTestContext();
      const result = await updateItemHandler(TEST_UUID, { subject: '' }, ctx);

      expect(result.statusCode).toBe(HttpStatus.BAD_REQUEST);
      const body = result.body as ValidationErrorBody;
      expect(body.error).toBe('Validation failed');
      expect(body.details).toContain('subject: String must contain at least 1 character(s)');
    });

    it('should return all validation errors at once', async () => {
      const ctx = createTestContext();
      const result = await updateItemHandler(
        TEST_UUID,
        {
          itemType: 'invalid',
          difficulty: 100,
          securityLevel: 'top-secret',
        },
        ctx
      );

      expect(result.statusCode).toBe(HttpStatus.BAD_REQUEST);
      const body = result.body as ValidationErrorBody;
      expect(body.error).toBe('Validation failed');
      expect(body.details.length).toBe(3);
    });
  });

  // ============================================
  // Partial Content Updates
  // ============================================
  describe('partial content updates', () => {
    it('should allow partial content update', async () => {
      const existingItem = createMockItem();
      const updatedItem = {
        ...existingItem,
        content: {
          ...existingItem.content,
          question: 'Updated question?',
        },
        metadata: {
          ...existingItem.metadata,
          lastModified: Date.now(),
          version: 2,
        },
      };

      const ctx = createTestContext({
        updateItem: vi.fn().mockResolvedValue(updatedItem),
      });

      const result = await updateItemHandler(
        TEST_UUID,
        {
          content: { question: 'Updated question?' },
        },
        ctx
      );

      expect(result.statusCode).toBe(HttpStatus.OK);
      expect(result.body).toEqual(updatedItem);
    });

    it('should allow partial metadata update', async () => {
      const existingItem = createMockItem();
      const updatedItem = {
        ...existingItem,
        metadata: {
          ...existingItem.metadata,
          status: 'review' as const,
          lastModified: Date.now(),
          version: 2,
        },
      };

      const ctx = createTestContext({
        updateItem: vi.fn().mockResolvedValue(updatedItem),
      });

      const result = await updateItemHandler(
        TEST_UUID,
        {
          metadata: { status: 'review' },
        },
        ctx
      );

      expect(result.statusCode).toBe(HttpStatus.OK);
      expect(result.body).toEqual(updatedItem);
    });
  });

  // ============================================
  // Successful Updates
  // ============================================
  describe('successful updates', () => {
    it('should update subject successfully', async () => {
      const existingItem = createMockItem();
      const updatedItem = {
        ...existingItem,
        subject: 'AP Chemistry',
        metadata: {
          ...existingItem.metadata,
          lastModified: Date.now(),
          version: 2,
        },
      };

      const ctx = createTestContext({
        updateItem: vi.fn().mockResolvedValue(updatedItem),
      });

      const result = await updateItemHandler(TEST_UUID, { subject: 'AP Chemistry' }, ctx);

      expect(result.statusCode).toBe(HttpStatus.OK);
      expect(result.body).toEqual(updatedItem);
      expect(ctx.storage.updateItem).toHaveBeenCalledWith(TEST_UUID, { subject: 'AP Chemistry' });
    });

    it('should update difficulty successfully', async () => {
      const existingItem = createMockItem();
      const updatedItem = {
        ...existingItem,
        difficulty: 5,
        metadata: {
          ...existingItem.metadata,
          lastModified: Date.now(),
          version: 2,
        },
      };

      const ctx = createTestContext({
        updateItem: vi.fn().mockResolvedValue(updatedItem),
      });

      const result = await updateItemHandler(TEST_UUID, { difficulty: 5 }, ctx);

      expect(result.statusCode).toBe(HttpStatus.OK);
      expect(result.body).toEqual(updatedItem);
    });

    it('should update multiple fields successfully', async () => {
      const existingItem = createMockItem();
      const updatedItem = {
        ...existingItem,
        subject: 'AP Physics',
        difficulty: 4,
        itemType: 'essay' as const,
        metadata: {
          ...existingItem.metadata,
          lastModified: Date.now(),
          version: 2,
        },
      };

      const ctx = createTestContext({
        updateItem: vi.fn().mockResolvedValue(updatedItem),
      });

      const result = await updateItemHandler(
        TEST_UUID,
        {
          subject: 'AP Physics',
          difficulty: 4,
          itemType: 'essay',
        },
        ctx
      );

      expect(result.statusCode).toBe(HttpStatus.OK);
      expect(result.body).toEqual(updatedItem);
    });
  });

  // ============================================
  // Not Found
  // ============================================
  describe('item not found', () => {
    it('should return 404 when item does not exist', async () => {
      const ctx = createTestContext({
        updateItem: vi.fn().mockResolvedValue(null),
      });

      const result = await updateItemHandler(NOT_FOUND_ITEM_ID, { subject: 'Math' }, ctx);

      expect(result.statusCode).toBe(HttpStatus.NOT_FOUND);
      expect(result.body).toEqual({ error: 'Item not found' });
    });
  });

  // ============================================
  // Error Handling
  // ============================================
  describe('error handling', () => {
    it('should return 500 when storage throws an error', async () => {
      const ctx = createTestContext({
        updateItem: vi.fn().mockRejectedValue(new Error('Database error')),
      });

      const result = await updateItemHandler(TEST_UUID, { subject: 'Math' }, ctx);

      expect(result.statusCode).toBe(HttpStatus.INTERNAL_ERROR);
      expect(result.body).toEqual({ error: 'Internal server error' });
    });

    it('should log error details when storage fails', async () => {
      const mockLogger = createMockLogger();
      const mockStorage = createMockStorage();
      const dbError = new Error('Connection timeout');
      (mockStorage.updateItem as Mock).mockRejectedValue(dbError);

      const ctx = {
        requestId: 'test-request',
        storage: mockStorage,
        logger: mockLogger,
      };

      await updateItemHandler(TEST_UUID, { subject: 'Math' }, ctx);

      expect(mockLogger.error).toHaveBeenCalledWith('Error updating item', dbError, {
        itemId: TEST_UUID,
      });
    });
  });

  // ============================================
  // Logging
  // ============================================
  describe('logging', () => {
    it('should log debug message when updating item', async () => {
      const mockLogger = createMockLogger();
      const mockStorage = createMockStorage();
      (mockStorage.updateItem as Mock).mockResolvedValue(createMockItem());

      const ctx = {
        requestId: 'test-request',
        storage: mockStorage,
        logger: mockLogger,
      };

      await updateItemHandler(TEST_UUID, { subject: 'Math' }, ctx);

      expect(mockLogger.debug).toHaveBeenCalledWith('Updating item', { itemId: TEST_UUID });
    });

    it('should log info message on successful update', async () => {
      const mockLogger = createMockLogger();
      const mockStorage = createMockStorage();
      (mockStorage.updateItem as Mock).mockResolvedValue(createMockItem());

      const ctx = {
        requestId: 'test-request',
        storage: mockStorage,
        logger: mockLogger,
      };

      await updateItemHandler(TEST_UUID, { subject: 'Math' }, ctx);

      expect(mockLogger.info).toHaveBeenCalledWith('Item updated successfully', {
        itemId: TEST_UUID,
      });
    });

    it('should log warning on invalid ID', async () => {
      const mockLogger = createMockLogger();
      const ctx = {
        requestId: 'test-request',
        storage: createMockStorage(),
        logger: mockLogger,
      };

      await updateItemHandler('bad-id', { subject: 'Math' }, ctx);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Invalid item ID provided',
        expect.objectContaining({ id: 'bad-id' })
      );
    });

    it('should log warning on empty update', async () => {
      const mockLogger = createMockLogger();
      const ctx = {
        requestId: 'test-request',
        storage: createMockStorage(),
        logger: mockLogger,
      };

      await updateItemHandler(TEST_UUID, {}, ctx);

      expect(mockLogger.warn).toHaveBeenCalledWith('Empty update request', { itemId: TEST_UUID });
    });
  });
});
