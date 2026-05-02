/**
 * Update Item Handler
 *
 * Updates an existing exam item.
 * Designed for AWS Lambda deployment.
 */

import { ExamItem } from '../types/item.js';
import { ApiResponse, Errors, successResponse, HttpStatus } from '../types/api.js';
import { HandlerContext } from '../context.js';
import { validateItemId, updateItemRequestSchema, UpdateItemRequest } from '../validation/item.js';

export type UpdateItemResponse = ApiResponse<ExamItem>;

export async function updateItemHandler(
  id: unknown,
  body: unknown,
  ctx: HandlerContext
): Promise<UpdateItemResponse> {
  const { storage, logger } = ctx;

  // Validate ID parameter
  const idValidation = validateItemId(id);
  if (!idValidation.success) {
    logger.warn('Invalid item ID provided', { id, error: idValidation.error });
    return Errors.badRequest(idValidation.error);
  }

  const validId = idValidation.data;

  // Validate request body using Zod
  const bodyValidation = updateItemRequestSchema.safeParse(body);
  if (!bodyValidation.success) {
    const errors = bodyValidation.error.issues.map((issue) => {
      const path = issue.path.join('.');
      return path ? `${path}: ${issue.message}` : issue.message;
    });

    logger.warn('Invalid update item request', { errors });
    return {
      statusCode: HttpStatus.BAD_REQUEST,
      body: { error: 'Validation failed', details: errors },
    };
  }

  const validData: UpdateItemRequest = bodyValidation.data;

  // Check if at least one field is provided
  if (Object.keys(validData).length === 0) {
    logger.warn('Empty update request', { itemId: validId });
    return Errors.badRequest('At least one field must be provided for update');
  }

  try {
    logger.debug('Updating item', { itemId: validId });
    const item = await storage.updateItem(validId, validData);

    if (!item) {
      logger.info('Item not found for update', { itemId: validId });
      return Errors.notFound('Item');
    }

    logger.info('Item updated successfully', { itemId: validId });
    return successResponse(item);
  } catch (error) {
    logger.error('Error updating item', error as Error, { itemId: validId });
    return Errors.internal();
  }
}
