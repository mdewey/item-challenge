/**
 * DynamoDB Storage - Re-export from modular implementation
 *
 * Module structure:
 *   dynamodb/
 *   ├── index.ts   - Main DynamoDBStorage class
 *   ├── types.ts   - DynamoDBRecord interface & index constants
 *   ├── keys.ts    - Key generation helpers (pk, sk, GSI keys)
 *   └── client.ts  - DynamoDB client factory & config
 */

export {
  DynamoDBStorage,
  DynamoDBRecord,
  INDEXES,
  DynamoDBConfig,
  keys,
} from './dynamodb/index.js';
