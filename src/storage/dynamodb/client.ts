/**
 * DynamoDB Client Factory
 *
 * Creates and configures the DynamoDB Document Client.
 * Supports both AWS DynamoDB and DynamoDB Local for development.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

export interface DynamoDBConfig {
  region: string;
  endpoint?: string;
  tableName: string;
}

/**
 * Get DynamoDB configuration from environment variables
 */
export function getConfig(): DynamoDBConfig {
  return {
    region: process.env.AWS_REGION ?? 'us-east-2',
    endpoint: process.env.DYNAMODB_ENDPOINT,
    tableName: process.env.DYNAMODB_TABLE_NAME ?? 'ExamItems',
  };
}

/**
 * Create a configured DynamoDB Document Client
 */
export function createDynamoDBClient(config: DynamoDBConfig): DynamoDBDocumentClient {
  const dynamoClient = new DynamoDBClient({
    region: config.region,
    ...(config.endpoint && { endpoint: config.endpoint }),
  });

  return DynamoDBDocumentClient.from(dynamoClient);
}
