/**
 * Get Audit Trail Handler Tests
 */

import { describe, it, expect, vi, Mock } from 'vitest';
import { getAuditTrailHandler, AuditTrailResponse } from '../../handlers/getAuditTrail.js';
import { HttpStatus } from '../../types/api.js';
import {
  TEST_UUID,
  NOT_FOUND_ITEM_ID,
  createMockStorage,
  createMockLogger,
  createTestContext,
  createMockItem,
} from '../helpers/testUtils.js';

describe('getAuditTrailHandler', () => {
  // ============================================
  // ID Validation
  // ============================================
  describe('ID validation', () => {
    it('should return 400 for invalid UUID format', async () => {
      const ctx = createTestContext();
      const result = await getAuditTrailHandler('not-a-uuid', ctx);

      expect(result.statusCode).toBe(HttpStatus.BAD_REQUEST);
      expect(result.body).toEqual({
        error: 'Invalid item ID format - must be a valid UUID',
      });
    });

    it('should return 400 for empty string ID', async () => {
      const ctx = createTestContext();
      const result = await getAuditTrailHandler('', ctx);

      expect(result.statusCode).toBe(HttpStatus.BAD_REQUEST);
      expect(result.body).toEqual({
        error: 'Invalid item ID format - must be a valid UUID',
      });
    });

    it('should return 400 for non-string ID', async () => {
      const ctx = createTestContext();
      const result = await getAuditTrailHandler(123, ctx);

      expect(result.statusCode).toBe(HttpStatus.BAD_REQUEST);
      expect(result.body).toEqual({
        error: 'Expected string, received number',
      });
    });
  });

  // ============================================
  // Successful Retrieval
  // ============================================
  describe('successful retrieval', () => {
    it('should return audit trail with versions', async () => {
      const version1 = createMockItem({ metadata: { ...createMockItem().metadata, version: 1 } });
      const version2 = createMockItem({ metadata: { ...createMockItem().metadata, version: 2 } });
      const versions = [version1, version2];

      const ctx = createTestContext({
        getAuditTrail: vi.fn().mockResolvedValue(versions),
      });

      const result = await getAuditTrailHandler(TEST_UUID, ctx);

      expect(result.statusCode).toBe(HttpStatus.OK);
      expect(result.body).toEqual({
        itemId: TEST_UUID,
        versions,
        total: 2,
      });
    });

    it('should return empty versions for item with no history', async () => {
      const item = createMockItem();
      const ctx = createTestContext({
        getAuditTrail: vi.fn().mockResolvedValue([]),
        getItem: vi.fn().mockResolvedValue(item),
      });

      const result = await getAuditTrailHandler(TEST_UUID, ctx);

      expect(result.statusCode).toBe(HttpStatus.OK);
      const body = result.body as AuditTrailResponse;
      expect(body.versions).toEqual([]);
      expect(body.total).toBe(0);
    });

    it('should call storage.getAuditTrail with correct ID', async () => {
      const ctx = createTestContext({
        getAuditTrail: vi.fn().mockResolvedValue([createMockItem()]),
      });

      await getAuditTrailHandler(TEST_UUID, ctx);

      expect(ctx.storage.getAuditTrail).toHaveBeenCalledWith(TEST_UUID);
    });
  });

  // ============================================
  // Not Found
  // ============================================
  describe('item not found', () => {
    it('should return 404 when item does not exist', async () => {
      const ctx = createTestContext({
        getAuditTrail: vi.fn().mockResolvedValue([]),
        getItem: vi.fn().mockResolvedValue(null),
      });

      const result = await getAuditTrailHandler(NOT_FOUND_ITEM_ID, ctx);

      expect(result.statusCode).toBe(HttpStatus.NOT_FOUND);
      expect(result.body).toEqual({ error: 'Item not found' });
    });

    it('should check item existence when audit trail is empty', async () => {
      const ctx = createTestContext({
        getAuditTrail: vi.fn().mockResolvedValue([]),
        getItem: vi.fn().mockResolvedValue(null),
      });

      await getAuditTrailHandler(TEST_UUID, ctx);

      expect(ctx.storage.getItem).toHaveBeenCalledWith(TEST_UUID);
    });
  });

  // ============================================
  // Error Handling
  // ============================================
  describe('error handling', () => {
    it('should return 500 when storage throws an error', async () => {
      const ctx = createTestContext({
        getAuditTrail: vi.fn().mockRejectedValue(new Error('Database error')),
      });

      const result = await getAuditTrailHandler(TEST_UUID, ctx);

      expect(result.statusCode).toBe(HttpStatus.INTERNAL_ERROR);
      expect(result.body).toEqual({ error: 'Internal server error' });
    });

    it('should log error details when storage fails', async () => {
      const mockLogger = createMockLogger();
      const mockStorage = createMockStorage();
      const dbError = new Error('Connection timeout');
      (mockStorage.getAuditTrail as Mock).mockRejectedValue(dbError);

      const ctx = {
        requestId: 'test-request',
        storage: mockStorage,
        logger: mockLogger,
      };

      await getAuditTrailHandler(TEST_UUID, ctx);

      expect(mockLogger.error).toHaveBeenCalledWith('Error fetching audit trail', dbError, {
        itemId: TEST_UUID,
      });
    });
  });

  // ============================================
  // Logging
  // ============================================
  describe('logging', () => {
    it('should log debug message when fetching audit trail', async () => {
      const mockLogger = createMockLogger();
      const mockStorage = createMockStorage();
      (mockStorage.getAuditTrail as Mock).mockResolvedValue([createMockItem()]);

      const ctx = {
        requestId: 'test-request',
        storage: mockStorage,
        logger: mockLogger,
      };

      await getAuditTrailHandler(TEST_UUID, ctx);

      expect(mockLogger.debug).toHaveBeenCalledWith('Fetching audit trail', { itemId: TEST_UUID });
    });

    it('should log info message on successful retrieval', async () => {
      const mockLogger = createMockLogger();
      const mockStorage = createMockStorage();
      const versions = [createMockItem(), createMockItem()];
      (mockStorage.getAuditTrail as Mock).mockResolvedValue(versions);

      const ctx = {
        requestId: 'test-request',
        storage: mockStorage,
        logger: mockLogger,
      };

      await getAuditTrailHandler(TEST_UUID, ctx);

      expect(mockLogger.info).toHaveBeenCalledWith('Audit trail retrieved successfully', {
        itemId: TEST_UUID,
        versions: 2,
      });
    });

    it('should log info message when item not found', async () => {
      const mockLogger = createMockLogger();
      const mockStorage = createMockStorage();
      (mockStorage.getAuditTrail as Mock).mockResolvedValue([]);
      (mockStorage.getItem as Mock).mockResolvedValue(null);

      const ctx = {
        requestId: 'test-request',
        storage: mockStorage,
        logger: mockLogger,
      };

      await getAuditTrailHandler(NOT_FOUND_ITEM_ID, ctx);

      expect(mockLogger.info).toHaveBeenCalledWith('Item not found', {
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

      await getAuditTrailHandler('bad-id', ctx);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Invalid item ID provided',
        expect.objectContaining({ id: 'bad-id' })
      );
    });
  });
});
