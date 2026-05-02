# Approach & Decision Log

A living document capturing the technical decisions and rationale as we build this exam item management system.

---

## Project Setup

**Date:** May 2, 2026

Cloned the starter repo from `ascott1/item-challenge`. The scaffold includes:

- TypeScript + Node.js
- Vitest for testing
- In-memory storage with DynamoDB option
- Basic handler examples

---

## Handler Architecture

### Decision: Separate Handler Files

**Approach:** Each API endpoint gets its own handler file (e.g., `getItem.ts`, `createItem.ts`) instead of one monolithic `handlers.ts`.

**Why:**

- Better separation of concerns
- Easier to test in isolation
- Maps cleanly to Lambda functions (one handler per function)
- Easier code reviews

---

## Shared API Types

### Decision: Create `types/api.ts` for Common Response Types

**Approach:** Abstracted common patterns into reusable types and helpers:

```typescript
// Generic response wrapper
interface ApiResponse<T> {
  statusCode: number;
  body: T | ApiError;
}

// Pre-built error helpers
Errors.notFound('Item')    // → { statusCode: 404, body: { error: 'Item not found' } }
Errors.badRequest('...')   // → { statusCode: 400, body: { error: '...' } }
successResponse(item)      // → { statusCode: 200, body: item }
```

**Why:**

- Consistent error shapes across all endpoints
- Less boilerplate in handlers
- Type safety ensures all responses follow the same contract
- Easier to add fields (like `details`) globally later

---

## Testing Strategy

### Decision: Vitest with vi.hoisted() for Mocking

**Approach:** Used Vitest's `vi.hoisted()` to handle ESM module mocking.

```typescript
const mockStorage = vi.hoisted(() => ({
  getItem: vi.fn(),
  // ...
}));

vi.mock('../storage/index.js', () => ({
  createStorage: () => mockStorage,
}));
```

**Why:**

- Vitest was already configured in the project
- `vi.hoisted()` solves the ESM hoisting problem where mocks need to be defined before imports
- Allows test-by-test control of mock behavior
- Jest-compatible API for familiarity

### Test Coverage for `getItemHandler`

- ✅ Success case (200 with item)
- ✅ Not found (404)
- ✅ Invalid ID validation (400 for empty/null/non-UUID)
- ✅ Storage errors (500 + logging)

### Test Pattern

All handlers follow the same coverage pattern:

- ID/input validation (400 cases)
- Success cases (200/201)
- Not found (404)
- Storage errors (500)
- Logging behavior

---

## Routing

### Decision: Hono Framework

**Approach:** Replaced the manual if/else routing with Hono.

**Options Considered:**

| Framework      | Verdict                           |
| -------------- | --------------------------------- |
| Manual if/else | ❌ Doesn't scale, hard to maintain |
| Express        | ❌ Heavier, callback-style         |
| Fastify        | ❌ More setup required             |
| **Hono**       | ✅ Chosen                          |

**Why Hono:**

- Ultra-lightweight (~14kb)
- Built for serverless/Lambda
- Clean, modern API
- Built-in middleware (cors, logger)
- Works with Lambda, Cloudflare Workers, Node, Bun, Deno
- Great TypeScript support

```typescript
// All 6 endpoints wired up
app.get('/api/items/:id', ...)      // getItemHandler
app.post('/api/items', ...)         // createItemHandler
app.put('/api/items/:id', ...)      // updateItemHandler
app.get('/api/items', ...)          // listItemsHandler
app.post('/api/items/:id/versions', ...) // createVersionHandler
app.get('/api/items/:id/audit', ...) // getAuditTrailHandler
```

---

## Logging

### Decision: Structured Logger Utility

**Approach:** Created `utils/logger.ts` with environment-aware logging.

```typescript
// Dev: readable format
[2026-05-02T16:25:00Z] INFO: Item retrieved successfully {"itemId":"abc123"}

// Prod: JSON for CloudWatch parsing
{"timestamp":"2026-05-02T16:25:00Z","level":"info","message":"Item retrieved successfully","itemId":"abc123"}
```

**Features:**

- `debug`, `info`, `warn`, `error` levels
- Context object for structured data
- Request ID propagation
- Error serialization with stack traces

**Why:**

- CloudWatch/DataDog can parse JSON logs
- Request IDs enable distributed tracing
- Consistent format across all handlers
- Easy to swap for Winston/Pino later

---

## Dependency Injection

### Decision: Handler Context Pattern

**Approach:** Handlers receive a `HandlerContext` with all dependencies instead of importing them directly.

```typescript
// Before: global singleton (hard to test)
const storage = createStorage();
export async function getItemHandler(id: string) { ... }

// After: injected via context
export async function getItemHandler(id: string, ctx: HandlerContext) {
  const { storage, logger } = ctx;
  // ...
}
```

**Context shape:**

```typescript
interface HandlerContext {
  storage: ItemStorage;
  logger: Logger;
  requestId: string;
}
```

**Why:**

- **Testability**: Pass mock storage/logger directly, no module mocking needed
- **Flexibility**: Easy to swap implementations (memory → DynamoDB)
- **Traceability**: Request ID flows through all operations
- **Lambda-ready**: Context can be enriched with Lambda event data

### Test Improvement

Tests now use simple factory functions instead of `vi.hoisted()` / `vi.mock()`:

```typescript
// Clean, explicit test setup
const ctx = createTestContext({
  getItem: vi.fn().mockResolvedValue(mockItem),
});
const result = await getItemHandler('test-id', ctx);
```

---

## Request Tracing

### Decision: X-Request-ID Header

**Approach:** Middleware generates/propagates request ID through the entire request lifecycle.

```typescript
app.use('*', async (c, next) => {
  const requestId = c.req.header('x-request-id') || randomUUID();
  c.set('requestId', requestId);
  c.header('x-request-id', requestId);
  await next();
});
```

**Why:**

- Correlate logs across services
- Debug distributed systems
- Respect incoming request IDs (for upstream tracing)
- Return ID in response for client debugging

---

## Input Validation

### Decision: Zod Schema Validation

**Approach:** Centralized validation schemas in `src/validation/item.ts` using Zod, with typed helper functions that return discriminated unions.

```typescript
// Schema definition with UUID validation
export const itemIdSchema = z.string().uuid('Invalid item ID format - must be a valid UUID');

// Helper returns discriminated union
export function validateItemId(id: unknown): ValidationResult<string> {
  if (id === undefined) return { success: false, error: 'Item ID is required' };
  if (typeof id !== 'string') return { success: false, error: 'Item ID must be a string' };
  const result = itemIdSchema.safeParse(id);
  if (!result.success) return { success: false, error: result.error.errors[0].message };
  return { success: true, data: result.data };
}
```

**Why:**

- **Type-safe**: Zod infers TypeScript types from schemas
- **Consistent errors**: Custom messages for each validation failure
- **Composable**: Reuse schemas in handlers and tests
- **Unknown input**: Handlers accept `unknown` for type-safe validation
- **Discriminated unions**: Clean pattern matching with `success` flag

**Usage in handlers:**

```typescript
export async function getItemHandler(id: unknown, ctx: HandlerContext): Promise<ApiResponse<ExamItem>> {
  const validation = validateItemId(id);
  if (!validation.success) {
    ctx.logger.warn('Invalid item ID provided', { id, error: validation.error });
    return Errors.badRequest(validation.error);
  }
  const validId = validation.data; // typed as string
  // ...
}
```

**Available schemas:**

- `itemIdSchema` - UUID validation for item IDs
- `createItemRequestSchema` - Full validation for POST /api/items
- `updateItemRequestSchema` - Partial validation for PUT /api/items/:id
- `listItemsQuerySchema` - Query params for GET /api/items (limit, offset, subject, status)
- Enums: `itemTypeSchema`, `securityLevelSchema`, `itemStatusSchema`

---

## API Documentation

### Decision: Static OpenAPI Spec

**Approach:** Maintain a complete, static OpenAPI 3.1 spec in `src/openapi.ts` served at `/openapi.json` and `/docs`.

**Options Considered:**

| Approach          | Verdict                 |
| ----------------- | ----------------------- |
| zod-to-openapi    | ❌ Too complex for scope |
| Hand-written spec | ✅ Chosen                |
| No documentation  | ❌ API needs docs        |

**Why static over auto-generated:**

- **Control**: Full control over documentation quality
- **Maintainability**: Easy to read and update
- **No coupling**: Schema changes don't require OpenAPI decorator updates
- **Complete**: All 6 endpoints with request/response schemas

**Spec includes:**

- All 6 API endpoints + health check
- Component schemas: `ExamItem`, `CreateItemRequest`, `UpdateItemRequest`, `ListItemsResponse`, `AuditTrailResponse`
- Error schemas: `Error`, `ValidationError`
- Tags for grouping: Items, Versioning, System
- Full parameter documentation (path, query)

**Trade-off accepted:** Manual sync between Zod schemas and OpenAPI. For a small API, this is manageable.

---

## Infrastructure

### Decision: Terraform over CDK

**Approach:** AWS infrastructure defined in `terraform/` using HCL.

**Options Considered:**

| Tool      | Verdict                                      |
| --------- | -------------------------------------------- |
| AWS CDK   | ❌ Adds TypeScript complexity, longer deploys |
| Terraform | ✅ Chosen                                     |
| SAM       | ❌ AWS-specific, less flexible                |
| Pulumi    | ❌ Overkill for this scope                    |

**Why Terraform:**

- **Industry standard**: Most teams use Terraform
- **Declarative**: Easy to review infrastructure changes
- **State management**: Clear view of what's deployed
- **Portable**: Skills transfer to any cloud

**Resources defined:**

- Lambda function with Node.js 20 runtime
- API Gateway HTTP API (v2)
- DynamoDB table with composite key + 2 GSIs
- IAM roles and policies (least privilege)
- CloudWatch log group with retention

---

## DynamoDB Schema Design

### Decision: Single Table with Composite Key

**Approach:** Store items and their version history in one table using a composite primary key (PK + SK).

**Table Structure:**

```
PK (Partition Key)     SK (Sort Key)        Data
──────────────────────────────────────────────────────
ITEM#<uuid>            CURRENT              Current item state
ITEM#<uuid>            VERSION#00001        Snapshot at version 1
ITEM#<uuid>            VERSION#00002        Snapshot at version 2
```

**Why composite key:**

- `getItem(id)` → Single read: `PK = ITEM#id, SK = CURRENT`
- `getAuditTrail(id)` → Query: `PK = ITEM#id, SK begins_with VERSION#`
- Versions are naturally sorted (zero-padded for lexicographic order)
- No separate versions table needed

**GSI Strategy:**

| GSI          | PK      | SK         | Purpose                                      |
| ------------ | ------- | ---------- | -------------------------------------------- |
| SubjectIndex | subject | status#id  | List by subject, optionally filter by status |
| StatusIndex  | status  | subject#id | List by status alone                         |

**Access patterns mapped:**

| Handler Query                  | DynamoDB Operation                           |
| ------------------------------ | -------------------------------------------- |
| `getItem(id)`                  | GetItem: `PK=ITEM#id, SK=CURRENT`            |
| `updateItem(id)`               | UpdateItem + PutItem (version record)        |
| `createVersion(id)`            | UpdateItem + PutItem (version record)        |
| `getAuditTrail(id)`            | Query: `PK=ITEM#id, SK begins_with VERSION#` |
| `listItems({subject})`         | Query SubjectIndex                           |
| `listItems({status})`          | Query StatusIndex                            |
| `listItems({subject, status})` | Query SubjectIndex with SK prefix            |

**GSI Consistency:**

- GSIs are **eventually consistent** (milliseconds lag)
- Main table supports strong consistency for `getItem`
- Acceptable for item management (not real-time critical)

**Write amplification:**

- Each write to main table auto-updates both GSIs
- 1 item write = 3 WCUs (main + GSI1 + GSI2)
- Acceptable for low-write item bank (~hundreds of writes/day)

**Scale analysis:**

- Item bank: ~50K-200K items (not millions)
- Hot partition risk: None (largest partition ~5K items)
- DynamoDB handles 3,000 RCU per partition

**Implementation scope:**

The `DynamoDBStorage` class is intentionally **not implemented**. The Terraform schema + `ItemStorage` interface demonstrate production-readiness:

- **Interface proves swappability**: `MemoryStorage` implements `ItemStorage`, a future `DynamoDBStorage` would too
- **Schema design complete**: Terraform defines composite keys, GSIs, and access patterns
- **Tests run fast**: 104 unit tests against in-memory storage complete in seconds
- **No added value**: The actual implementation is ~100 lines of AWS SDK boilerplate

The implementation would be straightforward:

```typescript
async getItem(id: string): Promise<ExamItem | null> {
  const result = await docClient.get({
    TableName: TABLE_NAME,
    Key: { pk: `ITEM#${id}`, sk: 'CURRENT' }
  });
  return result.Item as ExamItem ?? null;
}
```

Adding it would require LocalStack setup for meaningful testing, which adds complexity without demonstrating additional skills.

---

## CI/CD Pipeline

### Decision: GitHub Actions with Branch Protection

**Approach:** Three-job pipeline in `.github/workflows/ci.yml`:

1. **Lint & Test** - ESLint, Prettier check, Vitest with coverage
2. **Build Lambda** - esbuild bundle, artifact upload
3. **Validate Terraform** - `terraform fmt -check`, `terraform validate`

**Triggers:**

- Push to `main` or `solution/**` branches
- Pull requests targeting `main`

**Branch protection rules:**

- All three checks must pass before merge
- Conversations must be resolved
- Linear history enforced (no merge commits)

**Why this setup:**

- **Fast feedback**: Parallel jobs complete in ~30 seconds
- **Quality gate**: Can't merge broken code
- **Artifacts**: Lambda bundle ready for deployment
- **IaC validation**: Catch Terraform errors before apply

---

## Code Quality

### Decision: Format on Commit

**Approach:** Husky + lint-staged auto-formats on every commit.

```json
"lint-staged": {
  "src/**/*.ts": ["prettier --write", "eslint --fix"],
  "terraform/*.tf": ["terraform fmt"]
}
```

**Why:**

- **Consistency**: No formatting debates in PRs
- **Zero friction**: Happens automatically
- **CI match**: Local format matches CI check
- **Terraform too**: HCL files stay formatted

---

## Git Workflow

### Decision: Fork-Based Development

**Approach:** Work on a fork (`mdewey/item-challenge`) with upstream tracking.

```bash
git remote -v
# origin    git@github.com:mdewey/item-challenge.git (push)
# upstream  git@github.com:ascott1/item-challenge.git (fetch)
```

**Why:**

- **Clean separation**: Original repo untouched
- **PR ready**: Can open PR from fork to upstream
- **Standard pattern**: How most open source works

---

## Shared Test Utilities

### Decision: Centralized Test Helpers

**Approach:** Created `src/__tests__/helpers/testUtils.ts` with shared mocks, fixtures, and type helpers.

```typescript
// Semantic aliases for readability
export const EXISTING_ITEM_ID = TEST_UUID;
export const NOT_FOUND_ITEM_ID = TEST_UUID_2;

// Factory functions
export function createMockStorage(): ItemStorage { ... }
export function createMockLogger() { ... }
export function createTestContext(storage?: Partial<ItemStorage>): HandlerContext { ... }
export function createMockItem(overrides?: Partial<ExamItem>): ExamItem { ... }
```

**Why:**

- **DRY**: Same mocks used across all handler tests
- **Readable**: `NOT_FOUND_ITEM_ID` is clearer than a raw UUID
- **Flexible**: `createTestContext({ getItem: vi.fn().mockResolvedValue(item) })`
- **Type-safe**: All helpers return properly typed objects

---

## Test Statistics

**Total:** 104 tests across 7 test files

| Handler          | Tests |
| ---------------- | ----- |
| getItem          | 11    |
| createItem       | 18    |
| updateItem       | 22    |
| listItems        | 22    |
| createVersion    | 14    |
| getAuditTrail    | 14    |
| example (sanity) | 3     |

**Coverage areas:**

- Input validation (ID format, body schema)
- Success cases
- Not found (404)
- Storage errors (500)
- Logging behavior
- Partial updates
- Pagination and filtering

---

## API Testing

### Decision: Postman Collection

**Approach:** Created `postman/item-challenge-api.postman_collection.json` for manual API testing.

**Features:**

- All 6 endpoints + health check
- Auto-captures `itemId` from create response
- Test scripts that validate responses
- Error case folder (404, 400, invalid UUID)
- Configurable `baseUrl` variable

**Why:**

- **Quick validation**: Test endpoints without writing code
- **Shareable**: Other developers can import and use
- **Documented**: Collection serves as API examples
- **CI-ready**: Can run with Newman for integration tests

## Next Steps

### Future Enhancements

- [ ] Integration tests using `app.request()`
- [ ] DynamoDB storage class implementation (schema designed, Terraform ready)
- [ ] Deployment automation (GitHub Actions → AWS)
- [ ] Rate limiting / throttling

### Production Readiness (Beyond Scope)

The following would be added for a production deployment:

#### 1. Observability

- **AWS X-Ray tracing** - End-to-end request tracing across Lambda → DynamoDB
- **Structured logging** - JSON logs with correlation IDs, not console.log
- **CloudWatch dashboards** - Latency percentiles (p50, p95, p99), error rates
- **Alarms** - Alert on error rate > 1%, latency p99 > 1s

```typescript
// Example: Structured log format
logger.info({ 
  requestId: ctx.requestId,
  itemId: id,
  action: 'getItem',
  durationMs: 42
});
```

#### 2. Error Taxonomy

- **Centralized error codes** - `ITEM_NOT_FOUND`, `VALIDATION_FAILED`, `CONFLICT`
- **Consistent error shape** - All errors return same structure
- **Error catalog** - Document all error codes for API consumers

```typescript
// Example: Standardized error response
{
  "error": {
    "code": "ITEM_NOT_FOUND",
    "message": "Item with ID xyz does not exist",
    "requestId": "abc-123"
  }
}
```

#### 3. Cost Analysis

Estimated monthly cost for expected load (~1000 items, 10K requests/day):

| Resource    | Estimate       | Notes                           |
| ----------- | -------------- | ------------------------------- |
| Lambda      | ~$1-5/month    | 300K invocations, 256MB, <100ms |
| API Gateway | ~$3/month      | 300K requests @ $1/million      |
| DynamoDB    | ~$5-10/month   | On-demand, <1KB items           |
| CloudWatch  | ~$2/month      | Logs + basic metrics            |
| **Total**   | **~$15/month** | Scales linearly with traffic    |

At SAT scale (millions of requests), costs would be ~$500-1000/month.

#### 4. Runbook Hints

**What to monitor:**

- Lambda error rate and duration
- DynamoDB consumed capacity (throttling risk)
- API Gateway 4xx/5xx rates

**Common issues:**

- Cold starts → Enable provisioned concurrency for consistent latency
- Throttling → Check DynamoDB capacity, consider provisioned mode
- Timeouts → Check for missing GSI on query patterns

**Debugging in prod:**

- Use X-Ray trace ID from error response
- Query CloudWatch Logs Insights by requestId
- Check DynamoDB consumed capacity in CloudWatch

### Completed

- [x] GET /api/items/:id handler with tests (11 tests)
- [x] POST /api/items handler with tests (18 tests)
- [x] PUT /api/items/:id handler with tests (22 tests)
- [x] GET /api/items handler with tests (22 tests)
- [x] POST /api/items/:id/versions handler with tests (14 tests)
- [x] GET /api/items/:id/audit handler with tests (14 tests)
- [x] Zod validation schemas
- [x] Terraform infrastructure
- [x] CI/CD pipeline
- [x] Format on commit
- [x] Branch protection
- [x] ARCHITECTURE.md documentation
- [x] Shared test utilities (`testUtils.ts`)
- [x] Postman collection for manual testing
- [x] OpenAPI spec with all endpoints and schemas
- [x] DynamoDB schema design (composite PK/SK + 2 GSIs)

---
