# Code Walkthrough

A guided tour through the key implementation decisions, organized to reflect the challenge requirements.

---

## Quick Start

```bash
pnpm install && pnpm dev     # Start local server
pnpm test                    # Run 104 tests
cd terraform && terraform plan   # Validate infrastructure
```

---

## 1. API Endpoints

**File:** [src/app.ts](src/app.ts)

All 6 required endpoints wired up with Hono (ultra-lightweight serverless framework):

```
POST   /api/items              → createItemHandler
GET    /api/items/:id          → getItemHandler
PUT    /api/items/:id          → updateItemHandler
GET    /api/items              → listItemsHandler
POST   /api/items/:id/versions → createVersionHandler
GET    /api/items/:id/audit    → getAuditTrailHandler
```

**Bonus:** OpenAPI spec at `/docs` for interactive testing.

---

## 2. Handler Pattern

**Example:** [src/handlers/getItem.ts](src/handlers/getItem.ts)

Each handler follows the same structure:

```typescript
export async function getItemHandler(
  id: unknown,                    // Raw input (unknown for type safety)
  ctx: HandlerContext             // Injected dependencies
): Promise<ApiResponse<ExamItem>> {
  
  // 1. Validate input
  const validation = validateItemId(id);
  if (!validation.success) {
    return Errors.badRequest(validation.error);
  }

  // 2. Business logic
  const item = await ctx.storage.getItem(validation.data);
  if (!item) {
    return Errors.notFound('Item');
  }

  // 3. Return typed response
  return successResponse(item);
}
```

**Key decisions:**

- **Dependency injection** via `HandlerContext` (testable without mocking modules)
- **Validation first** with Zod schemas
- **Typed responses** ensure consistent error shapes

---

## 3. Input Validation

**File:** [src/validation/item.ts](src/validation/item.ts)

Zod schemas enforce the data contract:

```typescript
export const createItemRequestSchema = z.object({
  subject: z.string().min(1),
  itemType: itemTypeSchema,          // "multiple-choice" | "free-response" | "essay"
  difficulty: z.number().int().min(1).max(5),
  content: contentSchema,
  metadata: metadataInputSchema,
  securityLevel: securityLevelSchema,
});
```

Validation returns discriminated unions for clean error handling:

```typescript
const validation = createItemRequestSchema.safeParse(body);
if (!validation.success) {
  return Errors.badRequest(validation.error.issues);
}
// validation.data is fully typed
```

---

## 4. Storage Abstraction

**Interface:** [src/storage/interface.ts](src/storage/interface.ts)

```typescript
export interface ItemStorage {
  createItem(item: Omit<ExamItem, 'id'>): Promise<ExamItem>;
  getItem(id: string): Promise<ExamItem | null>;
  updateItem(id: string, updates: Partial<ExamItem>): Promise<ExamItem | null>;
  listItems(query: ListItemsQuery): Promise<{ items: ExamItem[]; total: number }>;
  createVersion(id: string): Promise<ExamItem | null>;
  getAuditTrail(id: string): Promise<ExamItem[]>;
}
```

**Implementations:**

- [src/storage/memory.ts](src/storage/memory.ts) — In-memory for local dev/testing
- [src/storage/dynamodb/index.ts](src/storage/dynamodb/index.ts) — Production DynamoDB

The storage factory ([src/storage/index.ts](src/storage/index.ts)) selects based on `USE_DYNAMODB` env var.

---

## 5. DynamoDB Schema Design

**Files:**

- [terraform/dynamodb.tf](terraform/dynamodb.tf) — Table definition
- [src/storage/dynamodb/keys.ts](src/storage/dynamodb/keys.ts) — Key generation

**Single-table design with composite key:**

| PK (Partition) | SK (Sort)       | Purpose             |
| -------------- | --------------- | ------------------- |
| `ITEM#<uuid>`  | `CURRENT`       | Latest item state   |
| `ITEM#<uuid>`  | `VERSION#00001` | Historical snapshot |

**Two GSIs for query patterns:**

| Index        | Partition Key | Sort Key     | Query Pattern            |
| ------------ | ------------- | ------------ | ------------------------ |
| SubjectIndex | `subject`     | `status#id`  | List by subject + status |
| StatusIndex  | `status`      | `subject#id` | List by status + subject |

**Versioning strategy:** Explicit — only `createVersion()` creates audit snapshots. Updates increment version but don't create history (keeps audit trail meaningful, not cluttered with typo fixes).

---

## 6. Infrastructure (Terraform)

**Directory:** [terraform/](terraform/)

```
terraform/
├── main.tf          # Provider, locals
├── lambda.tf        # Lambda + IAM
├── api_gateway.tf   # HTTP API routes
├── dynamodb.tf      # Table + GSIs
├── variables.tf     # Environment config
└── outputs.tf       # API URL, table name
```

**Key choices:**

- **HTTP API** (not REST API) — Lower latency, lower cost
- **Single Lambda** — Hono routes internally; simpler deployment
- **On-demand DynamoDB** — Auto-scales, no capacity planning
- **Least-privilege IAM** — Lambda only gets required DynamoDB actions

**Validate:**

```bash
cd terraform
terraform init
terraform plan -var="environment=dev"
```

---

## 7. Testing

**Run:** `pnpm test`

```
104 tests passing
- Handler tests (getItem, createItem, updateItem, listItems, createVersion, getAuditTrail)
- Validation tests (all Zod schemas)
- Storage tests (MemoryStorage, DynamoDBStorage)
```

**Pattern:** Tests use a simple factory instead of module mocking:

```typescript
const ctx = createTestContext({
  storage: { getItem: vi.fn().mockResolvedValue(mockItem) }
});
const result = await getItemHandler('test-id', ctx);
expect(result.statusCode).toBe(200);
```

---

## 8. Local Development

```bash
# Start server
pnpm dev

# Server shows:
# 🚀 Server running at http://localhost:3000
# Storage: Memory (or DynamoDB if configured)
# 
# Endpoints:
#   GET    http://localhost:3000/api/items
#   POST   http://localhost:3000/api/items
#   ...
#
# Docs:    http://localhost:3000/docs
```

**Test with cURL:**

```bash
# Create an item
curl -X POST http://localhost:3000/api/items \
  -H "Content-Type: application/json" \
  -d @samples/sample-item.json

# Get item
curl http://localhost:3000/api/items/{id}

# List items
curl "http://localhost:3000/api/items?subject=AP%20Biology&limit=10"
```

---

## Key Files Summary

| File                                                 | Purpose                       |
| ---------------------------------------------------- | ----------------------------- |
| [src/app.ts](src/app.ts)                             | Route definitions, middleware |
| [src/handlers/*.ts](src/handlers/)                   | Business logic (6 endpoints)  |
| [src/validation/item.ts](src/validation/item.ts)     | Zod schemas                   |
| [src/storage/interface.ts](src/storage/interface.ts) | Storage contract              |
| [src/storage/dynamodb/](src/storage/dynamodb/)       | DynamoDB implementation       |
| [terraform/*.tf](terraform/)                         | AWS infrastructure            |
| [ARCHITECTURE.md](ARCHITECTURE.md)                   | Design decisions              |
| [approach.md](approach.md)                           | Decision log                  |

---

## What's Intentionally Omitted

- **Authentication** — Would add JWT authorizer in production (documented in ARCHITECTURE.md)
- **Rate limiting** — API Gateway provides this out of the box
- **Actual deployment** — Challenge only asked for valid IaC, not deployed infrastructure
