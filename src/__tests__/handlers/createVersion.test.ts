/**
 * Create Version Handler Tests
 */

import { describe, it, expect, vi, Mock } from 'vitest';
import { createVersionHandler } from '../../handlers/createVersion.js';
import { HttpStatus } from '../../types/api.js';
import {
  TEST_UUID,
  NOT_FOUND_ITEM_ID,
  createMockStorage,
  createMockLogger,
  createTestContext,
  createMockItem,
} from '../helpers/testUtils.js';

describe('createVersionHandler', () => {
  // ============================================
  // ID Validation
  // ============================================
  describe('ID validation', () => {
    it('should return 400 for invalid UUID format', async () => {
      const ctx = createTestContext();
      const result = await createVersionHandler('not-a-uuid', ctx);

      expect(result.statusCode).toBe(HttpStatus.BAD_REQUEST);
      expect(result.body).toEqual({
        error: 'Invalid item ID format - must be a valid UUID',
      });
    });

    it('should return 400 for empty string ID', async () => {
      const ctx = createTestContext();
      const result = await createVersionHandler('', ctx);

      expect(result.statusCode).toBe(HttpStatus.BAD_REQUEST);
      expect(result.body).toEqual({
        error: 'Invalid item ID format - must be a valid UUID',
      });
    });

    it('should return 400 for non-string ID', async () => {
      const ctx = createTestContext();
      const result = await createVersionHandler(123, ctx);

      expect(result.statusCode).toBe(HttpStatus.BAD_REQUEST);
      expect(result.body).toEqual({
        error: 'Expected string, received number',
      });
    });

    it('should return 400 for null ID', async () => {
      const ctx = createTestContext();
      const result = await createVersionHandler(null, ctx);

      expect(result.statusCode).toBe(HttpStatus.BAD_REQUEST);
    });
  });

  // ============================================
  // Successful Version Creation
  // ============================================
  describe('successful version creation', () => {
    it('should return 201 with versioned item', async () => {
      const versionedItem = createMockItem({
        metadata: {
          author: 'test-author',
          created: 1234567890,
          lastModified: Date.now(),
          version: 2,
          status: 'draft',
          tags: ['biology'],
        },
      });

      const ctx = createTestContext({
        createVersion: vi.fn().mockResolvedValue(versionedItem),
      });

      const result = await createVersionHandler(TEST_UUID, ctx);

      expect(result.statusCode).toBe(HttpStatus.CREATED);
      expect(result.body).toEqual(versionedItem);
    });

    it('should call storage.createVersion with correct ID', async () => {
      const versionedItem = createMockItem();
      const ctx = createTestContext({
        createVersion: vi.fn().mockResolvedValue(versionedItem),
      });

      await createVersionHandler(TEST_UUID, ctx);

      expect(ctx.storage.createVersion).toHaveBeenCalledWith(TEST_UUID);
    });

    it('should increment version number', async () => {
      const versionedItem = createMockItem({
        metadata: {
          author: 'test-author',
          created: 1234567890,
          lastModified: Date.now(),
          version: 3,
          status: 'draft',
          tags: ['biology'],
        },
      });

      const ctx = createTestContext({
        createVersion: vi.fn().mockResolvedValue(versionedItem),
      });

      const result = await createVersionHandler(TEST_UUID, ctx);

      expect(result.statusCode).toBe(HttpStatus.CREATED);
      expect((result.body as typeof versionedItem).metadata.version).toBe(3);
    });
  });

  // ============================================
  // Not Found
  // ============================================
  describe('item not found', () => {
    it('should return 404 when item does not exist', async () => {
      const ctx = createTestContext({
        createVersion: vi.fn().mockResolvedValue(null),
      });

      const result = await createVersionHandler(NOT_FOUND_ITEM_ID, ctx);

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
        createVersion: vi.fn().mockRejectedValue(new Error('Database error')),
      });

      const result = await createVersionHandler(TEST_UUID, ctx);

      expect(result.statusCode).toBe(HttpStatus.INTERNAL_ERROR);
      expect(result.body).toEqual({ error: 'Internal server error' });
    });

    it('should log error details when storage fails', async () => {
      const mockLogger = createMockLogger();
      const mockStorage = createMockStorage();
      const dbError = new Error('Connection timeout');
      (mockStorage.createVersion as Mock).mockRejectedValue(dbError);

      const ctx = {
        requestId: 'test-request',
        storage: mockStorage,
        logger: mockLogger,
      };

      await createVersionHandler(TEST_UUID, ctx);

      expect(mockLogger.error).toHaveBeenCalledWith('Error creating version', dbError, {
        itemId: TEST_UUID,
      });
    });
  });

  // ============================================
  // Logging
  // ============================================
  describe('logging', () => {
    it('should log debug message when creating version', async () => {
      const mockLogger = createMockLogger();
      const mockStorage = createMockStorage();
      (mockStorage.createVersion as Mock).mockResolvedValue(createMockItem());

      const ctx = {
        requestId: 'test-request',
        storage: mockStorage,
        logger: mockLogger,
      };

      await createVersionHandler(TEST_UUID, ctx);

      expect(mockLogger.debug).toHaveBeenCalledWith('Creating version for item', {
        itemId: TEST_UUID,
      });
    });

    it('should log info message on successful version creation', async () => {
      const mockLogger = createMockLogger();
      const mockStorage = createMockStorage();
      const versionedItem = createMockItem({
        metadata: {
          author: 'test-author',
          created: 1234567890,
          lastModified: Date.now(),
          version: 2,
          status: 'draft',
          tags: ['biology'],
        },
      });
      (mockStorage.createVersion as Mock).mockResolvedValue(versionedItem);

      const ctx = {
        requestId: 'test-request',
        storage: mockStorage,
        logger: mockLogger,
      };

      await createVersionHandler(TEST_UUID, ctx);

      expect(mockLogger.info).toHaveBeenCalledWith('Version created successfully', {
        itemId: TEST_UUID,
        version: 2,
      });
    });

    it('should log info message when item not found', async () => {
      const mockLogger = createMockLogger();
      const mockStorage = createMockStorage();
      (mockStorage.createVersion as Mock).mockResolvedValue(null);

      const ctx = {
        requestId: 'test-request',
        storage: mockStorage,
        logger: mockLogger,
      };

      await createVersionHandler(NOT_FOUND_ITEM_ID, ctx);

      expect(mockLogger.info).toHaveBeenCalledWith('Item not found for versioning', {
        itemId: NOT_FOUND_ITEM_ID,
      });
    });

    it('should log warning on invalid ID', async () => {
      const mockLogger = createMockLogger();
      const ctx = {
        requestId: 'test-request',
        storage: createMockStorage(),
        logger: mockLogger,
      };

      await createVersionHandler('bad-id', ctx);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Invalid item ID provided',
        expect.objectContaining({ id: 'bad-id' })
      );
    });
  });
});
