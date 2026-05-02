/**
 * List Items Handler
 *
 * Lists exam items with optional filtering and pagination.
 * Designed for AWS Lambda deployment.
 */

import { ExamItem, ListItemsQuery } from '../types/item.js';
import { ApiResponse, Errors, successResponse, HttpStatus } from '../types/api.js';
import { HandlerContext } from '../context.js';
import { listItemsQuerySchema } from '../validation/item.js';

// Response type for list endpoint
export interface ListItemsResponse {
  items: ExamItem[];
  total: number;
  limit: number;
  offset: number;
}

export type ListItemsHandlerResponse = ApiResponse<ListItemsResponse>;

export async function listItemsHandler(
  query: Record<string, string | undefined>,
  ctx: HandlerContext
): Promise<ListItemsHandlerResponse> {
  const { storage, logger } = ctx;

  // Validate query parameters
  const validation = listItemsQuerySchema.safeParse(query);
  if (!validation.success) {
    const errors = validation.error.issues.map((issue) => {
      const path = issue.path.join('.');
      return path ? `${path}: ${issue.message}` : issue.message;
    });

    logger.warn('Invalid list items query', { errors });
    return {
      statusCode: HttpStatus.BAD_REQUEST,
      body: { error: 'Validation failed', details: errors },
    };
  }

  const { limit, offset, subject, status } = validation.data;

  const storageQuery: ListItemsQuery = {
    limit,
    offset,
    subject,
    status,
  };

  try {
    logger.debug('Listing items', { limit, offset, subject, status });
    const result = await storage.listItems(storageQuery);

    logger.info('Items listed successfully', {
      total: result.total,
      returned: result.items.length,
    });
    return successResponse({
      items: result.items,
      total: result.total,
      limit,
      offset,
    });
  } catch (error) {
    logger.error('Error listing items', error as Error, { subject, status });
    return Errors.internal();
  }
}
