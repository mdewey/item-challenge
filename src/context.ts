/**
 * Handler Context
 *
 * Dependency injection container for handlers.
 * Provides access to storage, logging, and other shared services.
 */

import { ItemStorage } from './storage/interface.js';
import { createStorage } from './storage/index.js';
import { Logger, createLogger } from './utils/logger.js';

export interface HandlerContext {
  storage: ItemStorage;
  logger: Logger;
  requestId: string;
}

/**
 * Creates a context for a single request
 */
export function createHandlerContext(
  requestId: string,
  overrides: Partial<Omit<HandlerContext, 'requestId'>> = {}
): HandlerContext {
  return {
    requestId,
    storage: overrides.storage ?? getDefaultStorage(),
    logger: overrides.logger ?? createLogger({ requestId }),
  };
}

// Lazy-initialized default storage (singleton)
let defaultStorage: ItemStorage | null = null;

function getDefaultStorage(): ItemStorage {
  defaultStorage ??= createStorage();
  return defaultStorage;
}

/**
 * Reset default storage (useful for testing)
 */
export function resetDefaultStorage(): void {
  defaultStorage = null;
}
