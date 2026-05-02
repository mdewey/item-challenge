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
- ✅ Invalid ID validation (400 for empty/null/whitespace)
- ✅ Storage errors (500 + logging)

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
app.get('/api/items/:id', async (c) => {
  const result = await getItemHandler(c.req.param('id'));
  return c.json(result.body, result.statusCode);
});
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
- Enums: `itemTypeSchema`, `securityLevelSchema`, `statusSchema`

---

## API Documentation

### Decision: Static OpenAPI Spec

**Approach:** Maintain a simple, static OpenAPI 3.0 spec in `src/openapi.ts` served at `/openapi.json` and `/docs`.

**Options Considered:**

| Approach          | Verdict                 |
| ----------------- | ----------------------- |
| zod-to-openapi    | ❌ Too complex for scope |
| Hand-written spec | ✅ Chosen                |
| No documentation  | ❌ API needs docs        |

**Why static over auto-generated:**

- **Simplicity**: ~60 lines vs complex decorator chains
- **Maintainability**: Easy to read and update
- **No coupling**: Schema changes don't require OpenAPI decorator updates
- **Take-home scope**: Auto-generation is overkill for 5 endpoints

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
- DynamoDB table with GSI for status queries
- IAM roles and policies (least privilege)
- CloudWatch log group with retention

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

## Next Steps

### Immediate (Handler Implementation)

- [ ] POST /api/items (createItem)
- [ ] PUT /api/items/:id (updateItem)
- [ ] GET /api/items (listItems)

### Future Enhancements

- [ ] Integration tests using `app.request()`
- [ ] POST /api/items/:id/versions (versioning)
- [ ] GET /api/items/:id/audit (audit trail)
- [ ] DynamoDB storage implementation
- [ ] Deployment automation (GitHub Actions → AWS)

### Completed

- [x] GET /api/items/:id handler with tests
- [x] Zod validation schemas
- [x] Terraform infrastructure
- [x] CI/CD pipeline
- [x] Format on commit
- [x] Branch protection
- [x] ARCHITECTURE.md documentation
