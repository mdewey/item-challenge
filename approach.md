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

## Next Steps

- [ ] Create remaining handlers (createItem, updateItem, listItems, createVersion, getAuditTrail)
- [x] Add Zod validation
- [ ] Wire up all routes in server.ts
- [ ] Infrastructure as Code (CDK)
- [ ] Complete ARCHITECTURE.md
