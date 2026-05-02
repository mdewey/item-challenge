/**
 * Item Validation Schemas
 *
 * Zod schemas for validating item-related requests.
 */

import { z } from 'zod';

// ============================================
// Primitive schemas
// ============================================

export const itemIdSchema = z.string().uuid('Invalid item ID format - must be a valid UUID');

export const itemTypeSchema = z.enum(['multiple-choice', 'free-response', 'essay']);

export const securityLevelSchema = z.enum(['standard', 'secure', 'highly-secure']);

export const itemStatusSchema = z.enum(['draft', 'review', 'approved', 'archived']);

export const difficultySchema = z.number().int().min(1).max(5);

// ============================================
// Composite schemas
// ============================================

export const itemContentSchema = z.object({
  question: z.string().min(1),
  options: z.array(z.string()).optional(),
  correctAnswer: z.string().min(1),
  explanation: z.string().min(1),
});

export const itemMetadataSchema = z.object({
  author: z.string().min(1),
  status: itemStatusSchema,
  tags: z.array(z.string()).default([]),
});

// ============================================
// Request schemas
// ============================================

export const createItemRequestSchema = z.object({
  subject: z.string().min(1),
  itemType: itemTypeSchema,
  difficulty: difficultySchema,
  content: itemContentSchema,
  metadata: itemMetadataSchema,
  securityLevel: securityLevelSchema,
});

export const updateItemRequestSchema = z.object({
  subject: z.string().min(1).optional(),
  itemType: itemTypeSchema.optional(),
  difficulty: difficultySchema.optional(),
  content: itemContentSchema.partial().optional(),
  metadata: itemMetadataSchema.partial().optional(),
  securityLevel: securityLevelSchema.optional(),
});

export const listItemsQuerySchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 10))
    .pipe(z.number().int().min(1).max(100)),
  offset: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 0))
    .pipe(z.number().int().min(0)),
  subject: z.string().min(1).optional(),
  status: itemStatusSchema.optional(),
});

// ============================================
// Helpers
// ============================================

export function validateItemId(
  id: unknown
): { success: true; data: string } | { success: false; error: string } {
  const result = itemIdSchema.safeParse(id);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error.issues[0].message };
}

// ============================================
// Type exports
// ============================================

export type ItemType = z.infer<typeof itemTypeSchema>;
export type SecurityLevel = z.infer<typeof securityLevelSchema>;
export type ItemStatus = z.infer<typeof itemStatusSchema>;
export type ItemContent = z.infer<typeof itemContentSchema>;
export type ItemMetadata = z.infer<typeof itemMetadataSchema>;
export type CreateItemRequest = z.infer<typeof createItemRequestSchema>;
export type UpdateItemRequest = z.infer<typeof updateItemRequestSchema>;
export type ListItemsQueryParams = z.infer<typeof listItemsQuerySchema>;
