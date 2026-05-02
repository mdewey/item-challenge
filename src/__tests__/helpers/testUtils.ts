/**
 * Shared Test Utilities
 *
 * Common mocks, fixtures, and helpers for handler tests.
 */

import { vi } from 'vitest';
import { HandlerContext } from '../../context.js';
import { ItemStorage } from '../../storage/interface.js';
import { ExamItem } from '../../types/item.js';

// ============================================
// Test Constants
// ============================================

// Base UUIDs
export const TEST_UUID = '550e8400-e29b-41d4-a716-446655440000';
export const TEST_UUID_2 = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
export const TEST_REQUEST_ID = 'test-request-id';

// Semantic aliases for readability
export const EXISTING_ITEM_ID = TEST_UUID;
export const CREATED_ITEM_ID = TEST_UUID;
export const NOT_FOUND_ITEM_ID = TEST_UUID_2;

// ============================================
// Mock Factories
// ============================================

/**
 * Create a mock storage with all methods stubbed
 */
export function createMockStorage(): ItemStorage {
  return {
    getItem: vi.fn(),
    createItem: vi.fn(),
    updateItem: vi.fn(),
    listItems: vi.fn(),
    createVersion: vi.fn(),
    getAuditTrail: vi.fn(),
  };
}

/**
 * Create a mock logger that suppresses output in tests
 */
export function createMockLogger() {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

/**
 * Create a test context with mocks, optionally overriding storage methods
 */
export function createTestContext(storage?: Partial<ItemStorage>): HandlerContext {
  const mockStorage = createMockStorage();
  return {
    requestId: TEST_REQUEST_ID,
    storage: { ...mockStorage, ...storage } as ItemStorage,
    logger: createMockLogger(),
  };
}

// ============================================
// Test Fixtures
// ============================================

/**
 * Valid create item request for testing
 */
export const validCreateItemRequest = {
  subject: 'AP Biology',
  itemType: 'multiple-choice' as const,
  difficulty: 3,
  content: {
    question: 'What is photosynthesis?',
    options: ['A', 'B', 'C', 'D'],
    correctAnswer: 'A',
    explanation: 'Photosynthesis is the process by which plants convert light to energy.',
  },
  metadata: {
    author: 'test-author',
    status: 'draft' as const,
    tags: ['biology', 'photosynthesis'],
  },
  securityLevel: 'standard' as const,
};

/**
 * Create a mock exam item with optional overrides
 */
export function createMockItem(overrides?: Partial<ExamItem>): ExamItem {
  return {
    id: TEST_UUID,
    subject: 'AP Biology',
    itemType: 'multiple-choice',
    difficulty: 3,
    content: {
      question: 'What is photosynthesis?',
      options: ['A', 'B', 'C', 'D'],
      correctAnswer: 'A',
      explanation: 'Photosynthesis is the process by which plants convert light to energy.',
    },
    metadata: {
      author: 'test-author',
      created: 1234567890,
      lastModified: 1234567890,
      version: 1,
      status: 'draft',
      tags: ['biology'],
    },
    securityLevel: 'standard',
    ...overrides,
  };
}

// ============================================
// Type Helpers
// ============================================

/**
 * Type for validation error response body
 */
export type ValidationErrorBody = {
  error: string;
  details: string[];
};
