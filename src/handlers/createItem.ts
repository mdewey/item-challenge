/**
 * Create Item Handler
 *
 * Creates a new exam item.
 * Designed for AWS Lambda deployment.
 */

import { ExamItem } from '../types/item.js';
import { ApiResponse, Errors, successResponse, HttpStatus } from '../types/api.js';
import { HandlerContext } from '../context.js';
import { createItemRequestSchema, CreateItemRequest } from '../validation/item.js';

export type CreateItemResponse = ApiResponse<ExamItem>;

export async function createItemHandler(
  body: unknown,
  ctx: HandlerContext
): Promise<CreateItemResponse> {
  const { storage, logger } = ctx;

  // Validate request body using Zod
  const validation = createItemRequestSchema.safeParse(body);
  if (!validation.success) {
    const errors = validation.error.issues.map((issue) => {
      const path = issue.path.join('.');
      return path ? `${path}: ${issue.message}` : issue.message;
    });

    logger.warn('Invalid create item request', { errors });
    return {
      statusCode: HttpStatus.BAD_REQUEST,
      body: { error: 'Validation failed', details: errors },
    };
  }

  const validData: CreateItemRequest = validation.data;

  try {
    logger.debug('Creating item', { subject: validData.subject, itemType: validData.itemType });
    const item = await storage.createItem(validData);

    logger.info('Item created successfully', { itemId: item.id });
    return successResponse(item, HttpStatus.CREATED);
  } catch (error) {
    logger.error('Error creating item', error as Error, { subject: validData.subject });
    return Errors.internal();
  }
}
