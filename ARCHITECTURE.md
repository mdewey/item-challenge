# Architecture Documentation

## Overview

This is a serverless exam item management API built with TypeScript, deployed to AWS Lambda behind API Gateway, with DynamoDB for persistence.

## Data Model

### ExamItem Schema

```typescript
{
  id: string,              // UUID, partition key
  subject: string,         // e.g., "AP Biology" - indexed for queries
  itemType: string,        // "multiple-choice" | "free-response" | "essay"
  difficulty: number,      // 1-5
  content: {
    question: string,
    options?: string[],    // For multiple choice
    correctAnswer: string,
    explanation: string
  },
  metadata: {
    author: string,
    created: number,       // Unix timestamp (ms)
    lastModified: number,
    version: number,       // Incremented on each update
    status: string,        // "draft" | "review" | "approved" | "archived"
    tags: string[]
  },
  securityLevel: string    // "standard" | "secure" | "highly-secure"
}
```

### DynamoDB Design

**Table: `{project}-items-{env}`**

| Key Type           | Attribute | Purpose                          |
| ------------------ | --------- | -------------------------------- |
| Partition Key      | `id`      | UUID - ensures even distribution |
| GSI: subject-index | `subject` | Query items by subject area      |
| GSI: status-index  | `status`  | Query items by workflow status   |

**Access Patterns:**

- Get item by ID → Direct lookup via partition key
- List items by subject → Query `subject-index`
- List items by status → Query `status-index`
- Pagination → Use `Limit` and `ExclusiveStartKey`

**Versioning Strategy:**
For audit trail, store versions in a separate table or use a composite sort key (`id#version`). Current implementation uses in-memory storage; DynamoDB implementation would add a `version` sort key.

## Infrastructure

### Components (Terraform)

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   API Gateway   │────▶│     Lambda      │────▶│    DynamoDB     │
│   (HTTP API)    │     │   (Node 20)     │     │  (On-Demand)    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌─────────────────┐
                        │   CloudWatch    │
                        │     Logs        │
                        └─────────────────┘
```

### Design Choices

| Choice                      | Rationale                                                             |
| --------------------------- | --------------------------------------------------------------------- |
| **HTTP API** (not REST API) | Lower latency, lower cost, sufficient for this use case               |
| **Single Lambda**           | Simpler deployment; Hono routes internally. Can split later if needed |
| **On-demand DynamoDB**      | Auto-scales, no capacity planning needed for variable workloads       |
| **Node.js 20**              | LTS, native ESM support, good cold start times                        |
| **esbuild bundling**        | Fast builds, tree-shaking, single file output                         |

### IAM Permissions (Least Privilege)

Lambda role has only:

- `AWSLambdaBasicExecutionRole` (CloudWatch Logs)
- DynamoDB: `GetItem`, `PutItem`, `UpdateItem`, `DeleteItem`, `Query`, `Scan` on items table + indexes

## Application Architecture

```
src/
├── app.ts          # Hono routes + middleware (shared)
├── lambda.ts       # Lambda entry point
├── server.ts       # Local dev server
├── handlers/       # Business logic (pure functions)
│   └── getItem.ts  # Handler returns { statusCode, body }
├── storage/        # Data access layer
│   ├── interface.ts
│   ├── memory.ts   # In-memory (local dev)
│   └── dynamodb.ts # DynamoDB (production)
├── validation/     # Zod schemas
└── types/          # TypeScript interfaces
```

**Key Pattern:** Handlers are pure functions that take input + context, return response. No direct HTTP framework coupling - testable in isolation.

## Scalability & Performance

### Lambda

- **Memory:** 256MB default (configurable)
- **Timeout:** 10s (API calls should be <1s)
- **Cold starts:** Mitigated by small bundle size (~100KB), ESM

### DynamoDB

- **On-demand billing:** Scales to thousands of requests/sec automatically
- **Point-in-time recovery:** Enabled in production
- **Encryption:** Server-side encryption enabled

### API Gateway

- **Throttling:** Default 10,000 req/sec (configurable)
- **Caching:** Not implemented; add if read-heavy workload emerges

## Security

| Layer          | Implementation                                    |
| -------------- | ------------------------------------------------- |
| **Transport**  | HTTPS enforced by API Gateway                     |
| **Validation** | Zod schemas validate all input                    |
| **IAM**        | Least-privilege Lambda role                       |
| **Encryption** | DynamoDB server-side encryption                   |
| **Logging**    | Request IDs for tracing, no sensitive data logged |
| **CORS**       | Configured in Hono middleware                     |

**Not Implemented (would add for production):**

- Authentication (Cognito, API keys, or JWT)
- Rate limiting per client
- WAF rules
- VPC isolation for DynamoDB

## Trade-offs

| Decision          | Trade-off                                                |
| ----------------- | -------------------------------------------------------- |
| Single Lambda     | Simpler, but all endpoints share cold starts and memory  |
| In-memory storage | Fast local dev, but DynamoDB implementation not complete |
| No auth           | Faster to build, but not production-ready                |
| Static OpenAPI    | Simple, but docs can drift from implementation           |

## Future Improvements

1. **Complete DynamoDB storage** - Implement the interface for production use
2. **Add authentication** - API Gateway authorizer with Cognito or JWT
3. **Versioning table** - Separate table for audit trail with TTL
4. **CI/CD pipeline** - GitHub Actions → Terraform Cloud or AWS CodePipeline
5. **Monitoring** - CloudWatch alarms, X-Ray tracing
6. **Multi-region** - Global tables for disaster recovery
