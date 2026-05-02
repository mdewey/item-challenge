/**
 * Get Audit Trail Handler
 *
 * Retrieves the version history (audit trail) of an exam item.
 * Designed for AWS Lambda deployment.
 */

import { ExamItem } from '../types/item.js';
import { ApiResponse, Errors, successResponse } from '../types/api.js';
import { HandlerContext } from '../context.js';
import { validateItemId } from '../validation/item.js';

export interface AuditTrailResponse {
  itemId: string;
  versions: ExamItem[];
  total: number;
}

export type GetAuditTrailHandlerResponse = ApiResponse<AuditTrailResponse>;

export async function getAuditTrailHandler(
  id: unknown,
  ctx: HandlerContext
): Promise<GetAuditTrailHandlerResponse> {
  const { storage, logger } = ctx;

  // Validate ID parameter
  const validation = validateItemId(id);
  if (!validation.success) {
    logger.warn('Invalid item ID provided', { id, error: validation.error });
    return Errors.badRequest(validation.error);
  }

  const validId = validation.data;

  try {
    logger.debug('Fetching audit trail', { itemId: validId });
    const versions = await storage.getAuditTrail(validId);

    // Empty audit trail means item doesn't exist or has no history
    if (versions.length === 0) {
      // Check if item exists
      const item = await storage.getItem(validId);
      if (!item) {
        logger.info('Item not found', { itemId: validId });
        return Errors.notFound('Item');
      }
    }

    logger.info('Audit trail retrieved successfully', {
      itemId: validId,
      versions: versions.length,
    });
    return successResponse({
      itemId: validId,
      versions,
      total: versions.length,
    });
  } catch (error) {
    logger.error('Error fetching audit trail', error as Error, { itemId: validId });
    return Errors.internal();
  }
}
