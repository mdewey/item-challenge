/**
 * Get Item Handler
 *
 * Retrieves a single exam item by ID.
 * Designed for AWS Lambda deployment.
 */

import { ExamItem } from '../types/item.js';
import { ApiResponse, Errors, successResponse } from '../types/api.js';
import { HandlerContext } from '../context.js';
import { validateItemId } from '../validation/item.js';

export type GetItemResponse = ApiResponse<ExamItem>;

export async function getItemHandler(
  id: unknown, // Accept unknown to let Zod validate
  ctx: HandlerContext
): Promise<GetItemResponse> {
  const { storage, logger } = ctx;

  // Validate ID parameter using Zod
  const validation = validateItemId(id);
  if (!validation.success) {
    logger.warn('Invalid item ID provided', { id, error: validation.error });
    return Errors.badRequest(validation.error);
  }

  const validId = validation.data;

  try {
    logger.debug('Fetching item', { itemId: validId });
    const item = await storage.getItem(validId);

    if (!item) {
      logger.info('Item not found', { itemId: validId });
      return Errors.notFound('Item');
    }

    logger.info('Item retrieved successfully', { itemId: validId });
    return successResponse(item);
  } catch (error) {
    logger.error('Error getting item', error as Error, { itemId: validId });
    return Errors.internal();
  }
}
