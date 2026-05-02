/**
 * Shared API Types
 *
 * Common types for API requests and responses across all handlers.
 */

/**
 * Standard error response body
 */
export interface ApiError {
  error: string;
  details?: string;
}

/**
 * Generic API response wrapper
 * T = success body type
 */
export interface ApiResponse<T> {
  statusCode: number;
  body: T | ApiError;
}

/**
 * Pagination parameters for list endpoints
 */
export interface PaginationParams {
  limit?: number;
  offset?: number;
}

/**
 * Paginated response wrapper
 */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

/**
 * HTTP Status codes as constants for consistency
 */
export const HttpStatus = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_ERROR: 500,
} as const;

/**
 * Helper to create success response
 */
export function successResponse<T>(body: T, statusCode = HttpStatus.OK): ApiResponse<T> {
  return { statusCode, body };
}

/**
 * Helper to create error response
 */
export function errorResponse(
  error: string,
  statusCode: number,
  details?: string
): ApiResponse<never> {
  return {
    statusCode,
    body: details ? { error, details } : { error },
  };
}

/**
 * Common error responses
 */
export const Errors = {
  notFound: (resource = 'Resource') => errorResponse(`${resource} not found`, HttpStatus.NOT_FOUND),
  badRequest: (message: string) => errorResponse(message, HttpStatus.BAD_REQUEST),
  internal: () => errorResponse('Internal server error', HttpStatus.INTERNAL_ERROR),
  unauthorized: () => errorResponse('Unauthorized', HttpStatus.UNAUTHORIZED),
  forbidden: () => errorResponse('Forbidden', HttpStatus.FORBIDDEN),
};
