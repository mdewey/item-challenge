/**
 * Create Version Handler
 *
 * Creates a new version (snapshot) of an exam item.
 * Designed for AWS Lambda deployment.
 */

import { ExamItem } from '../types/item.js';
import { ApiResponse, Errors, successResponse, HttpStatus } from '../types/api.js';
import { HandlerContext } from '../context.js';
import { validateItemId } from '../validation/item.js';

export type CreateVersionResponse = ApiResponse<ExamItem>;

export async function createVersionHandler(
  id: unknown,
  ctx: HandlerContext
): Promise<CreateVersionResponse> {
  const { storage, logger } = ctx;

  // Validate ID parameter
  const validation = validateItemId(id);
  if (!validation.success) {
    logger.warn('Invalid item ID provided', { id, error: validation.error });
    return Errors.badRequest(validation.error);
  }

  const validId = validation.data;

  try {
    logger.debug('Creating version for item', { itemId: validId });
    const item = await storage.createVersion(validId);

    if (!item) {
      logger.info('Item not found for versioning', { itemId: validId });
      return Errors.notFound('Item');
    }

    logger.info('Version created successfully', {
      itemId: validId,
      version: item.metadata.version,
    });
    return successResponse(item, HttpStatus.CREATED);
  } catch (error) {
    logger.error('Error creating version', error as Error, { itemId: validId });
    return Errors.internal();
  }
}
