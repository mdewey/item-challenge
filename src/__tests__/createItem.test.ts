/**
 * Create Item Handler Tests
 *
 * Tests for the createItemHandler function.
 * Uses dependency injection for clean, isolated testing.
 */

import { describe, expect, it, vi } from 'vitest';
import { createItemHandler } from '../handlers/createItem.js';
import {
  TEST_UUID,
  createTestContext,
  validCreateItemRequest,
  ValidationErrorBody,
} from './helpers/testUtils.js';

describe('createItemHandler', () => {
  describe('successful creation', () => {
    it('should return 201 with the created item', async () => {
      const createdItem = {
        id: TEST_UUID,
        ...validCreateItemRequest,
        metadata: {
          ...validCreateItemRequest.metadata,
          created: Date.now(),
          lastModified: Date.now(),
          version: 1,
        },
      };

      const ctx = createTestContext({
        createItem: vi.fn().mockResolvedValue(createdItem),
      });

      const result = await createItemHandler(validCreateItemRequest, ctx);

      expect(result.statusCode).toBe(201);
      expect(result.body).toEqual(createdItem);
      expect(ctx.storage.createItem).toHaveBeenCalledWith(validCreateItemRequest);
      expect(ctx.storage.createItem).toHaveBeenCalledTimes(1);
    });

    it('should log successful creation', async () => {
      const createdItem = {
        id: TEST_UUID,
        ...validCreateItemRequest,
        metadata: {
          ...validCreateItemRequest.metadata,
          created: Date.now(),
          lastModified: Date.now(),
          version: 1,
        },
      };

      const ctx = createTestContext({
        createItem: vi.fn().mockResolvedValue(createdItem),
      });

      await createItemHandler(validCreateItemRequest, ctx);

      expect(ctx.logger.info).toHaveBeenCalledWith('Item created successfully', {
        itemId: TEST_UUID,
      });
    });

    it('should accept request with minimal metadata (tags defaults to empty)', async () => {
      const minimalRequest = {
        ...validCreateItemRequest,
        metadata: {
          author: 'test-author',
          status: 'draft' as const,
          // tags omitted - should default to []
        },
      };

      const createdItem = {
        id: TEST_UUID,
        ...minimalRequest,
        metadata: {
          ...minimalRequest.metadata,
          tags: [],
          created: Date.now(),
          lastModified: Date.now(),
          version: 1,
        },
      };

      const ctx = createTestContext({
        createItem: vi.fn().mockResolvedValue(createdItem),
      });

      const result = await createItemHandler(minimalRequest, ctx);

      expect(result.statusCode).toBe(201);
    });
  });

  describe('validation errors', () => {
    it('should return 400 when subject is missing', async () => {
      const invalidRequest = { ...validCreateItemRequest };
      delete (invalidRequest as Record<string, unknown>).subject;

      const ctx = createTestContext();
      const result = await createItemHandler(invalidRequest, ctx);

      expect(result.statusCode).toBe(400);
      expect(result.body).toHaveProperty('error', 'Validation failed');
      expect((result.body as ValidationErrorBody).details.some((d) => d.includes('subject'))).toBe(
        true
      );
    });

    it('should return 400 when subject is empty string', async () => {
      const invalidRequest = { ...validCreateItemRequest, subject: '' };

      const ctx = createTestContext();
      const result = await createItemHandler(invalidRequest, ctx);

      expect(result.statusCode).toBe(400);
      expect(result.body).toHaveProperty('error', 'Validation failed');
    });

    it('should return 400 for invalid itemType', async () => {
      const invalidRequest = { ...validCreateItemRequest, itemType: 'invalid-type' };

      const ctx = createTestContext();
      const result = await createItemHandler(invalidRequest, ctx);

      expect(result.statusCode).toBe(400);
      expect((result.body as ValidationErrorBody).details.some((d) => d.includes('itemType'))).toBe(
        true
      );
    });

    it('should return 400 for invalid difficulty (below range)', async () => {
      const invalidRequest = { ...validCreateItemRequest, difficulty: 0 };

      const ctx = createTestContext();
      const result = await createItemHandler(invalidRequest, ctx);

      expect(result.statusCode).toBe(400);
      expect(
        (result.body as ValidationErrorBody).details.some((d) => d.includes('difficulty'))
      ).toBe(true);
    });

    it('should return 400 for invalid difficulty (above range)', async () => {
      const invalidRequest = { ...validCreateItemRequest, difficulty: 6 };

      const ctx = createTestContext();
      const result = await createItemHandler(invalidRequest, ctx);

      expect(result.statusCode).toBe(400);
      expect(
        (result.body as ValidationErrorBody).details.some((d) => d.includes('difficulty'))
      ).toBe(true);
    });

    it('should return 400 for invalid securityLevel', async () => {
      const invalidRequest = { ...validCreateItemRequest, securityLevel: 'top-secret' };

      const ctx = createTestContext();
      const result = await createItemHandler(invalidRequest, ctx);

      expect(result.statusCode).toBe(400);
      expect(
        (result.body as ValidationErrorBody).details.some((d) => d.includes('securityLevel'))
      ).toBe(true);
    });

    it('should return 400 when content.question is missing', async () => {
      const invalidRequest = {
        ...validCreateItemRequest,
        content: {
          ...validCreateItemRequest.content,
          question: undefined as unknown as string,
        },
      };

      const ctx = createTestContext();
      const result = await createItemHandler(invalidRequest, ctx);

      expect(result.statusCode).toBe(400);
    });

    it('should return 400 when metadata.author is missing', async () => {
      const invalidRequest = {
        ...validCreateItemRequest,
        metadata: {
          status: 'draft' as const,
          tags: [],
        },
      };

      const ctx = createTestContext();
      const result = await createItemHandler(invalidRequest, ctx);

      expect(result.statusCode).toBe(400);
      expect((result.body as ValidationErrorBody).details.some((d) => d.includes('author'))).toBe(
        true
      );
    });

    it('should return 400 for invalid metadata.status', async () => {
      const invalidRequest = {
        ...validCreateItemRequest,
        metadata: {
          ...validCreateItemRequest.metadata,
          status: 'invalid-status',
        },
      };

      const ctx = createTestContext();
      const result = await createItemHandler(invalidRequest, ctx);

      expect(result.statusCode).toBe(400);
      expect((result.body as ValidationErrorBody).details.some((d) => d.includes('status'))).toBe(
        true
      );
    });

    it('should return 400 when body is null', async () => {
      const ctx = createTestContext();
      const result = await createItemHandler(null, ctx);

      expect(result.statusCode).toBe(400);
    });

    it('should return 400 when body is not an object', async () => {
      const ctx = createTestContext();
      const result = await createItemHandler('not an object', ctx);

      expect(result.statusCode).toBe(400);
    });

    it('should log validation errors', async () => {
      const invalidRequest = { ...validCreateItemRequest, itemType: 'invalid' };

      const ctx = createTestContext();
      await createItemHandler(invalidRequest, ctx);

      expect(ctx.logger.warn).toHaveBeenCalled();
      const [message, context] = (ctx.logger.warn as ReturnType<typeof vi.fn>).mock.calls[0] as [
        string,
        { errors: string[] },
      ];
      expect(message).toBe('Invalid create item request');
      expect(context.errors.some((e) => e.includes('itemType'))).toBe(true);
    });

    it('should return all validation errors at once', async () => {
      const invalidRequest = {
        // Missing subject, invalid itemType, invalid difficulty
        itemType: 'invalid',
        difficulty: 10,
        content: {
          question: 'Test?',
          correctAnswer: 'A',
          explanation: 'Because',
        },
        metadata: {
          author: 'test',
          status: 'draft' as const,
          tags: [],
        },
        securityLevel: 'standard' as const,
      };

      const ctx = createTestContext();
      const result = await createItemHandler(invalidRequest, ctx);

      expect(result.statusCode).toBe(400);
      const body = result.body as ValidationErrorBody;
      expect(body.error).toBe('Validation failed');
      expect(body.details.length).toBeGreaterThan(1);
      expect(body.details.some((d) => d.includes('subject'))).toBe(true);
      expect(body.details.some((d) => d.includes('itemType'))).toBe(true);
      expect(body.details.some((d) => d.includes('difficulty'))).toBe(true);
    });
  });

  describe('storage errors', () => {
    it('should return 500 when storage throws an error', async () => {
      const ctx = createTestContext({
        createItem: vi.fn().mockRejectedValue(new Error('Database connection failed')),
      });

      const result = await createItemHandler(validCreateItemRequest, ctx);

      expect(result.statusCode).toBe(500);
      expect(result.body).toEqual({ error: 'Internal server error' });
    });

    it('should log storage errors', async () => {
      const error = new Error('Database connection failed');
      const ctx = createTestContext({
        createItem: vi.fn().mockRejectedValue(error),
      });

      await createItemHandler(validCreateItemRequest, ctx);

      expect(ctx.logger.error).toHaveBeenCalledWith('Error creating item', error, {
        subject: 'AP Biology',
      });
    });
  });
});
