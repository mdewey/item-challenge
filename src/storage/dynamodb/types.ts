/**
 * DynamoDB Record Types
 *
 * Defines the shape of records stored in DynamoDB using the single-table design.
 */

import { ExamItem } from '../../types/item.js';

/**
 * DynamoDB record shape with single-table design keys.
 *
 * Schema:
 *   PK: "ITEM#<uuid>"
 *   SK: "CURRENT" (latest version) or "VERSION#00001" (historical)
 *
 * GSI1 (SubjectIndex): Query by subject, filter by status
 *   PK: subject
 *   SK: status#id
 *
 * GSI2 (StatusIndex): Query by status, filter by subject
 *   PK: status
 *   SK: subject#id
 */
export interface DynamoDBRecord extends ExamItem {
  /** Partition key: ITEM#<id> */
  pk: string;

  /** Sort key: CURRENT or VERSION#<nnnnn> */
  sk: string;

  /** GSI1 hash key (same as item.subject) */
  subject: string;

  /** GSI1 sort key: status#id for SubjectIndex */
  gsi1sk: string;

  /** GSI2 hash key (denormalized from metadata.status) */
  status: string;

  /** GSI2 sort key: subject#id for StatusIndex */
  gsi2sk: string;
}

/** Index names matching Terraform configuration */
export const INDEXES = {
  SUBJECT: 'SubjectIndex',
  STATUS: 'StatusIndex',
} as const;
