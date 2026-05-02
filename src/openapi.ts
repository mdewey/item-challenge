/**
 * OpenAPI Specification
 *
 * Static API documentation for the Item Challenge API.
 * Served via Swagger UI at /docs
 */

export const openApiSpec = {
  openapi: '3.1.0',
  info: {
    title: 'Item Challenge API',
    description: 'RESTful API for managing exam items for the College Board.',
    version: '1.0.0',
  },
  servers: [{ url: 'http://localhost:3000', description: 'Local development' }],
  paths: {
    '/health': {
      get: {
        summary: 'Health check',
        tags: ['System'],
        responses: {
          200: {
            description: 'OK',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { status: { type: 'string', example: 'ok' } },
                },
              },
            },
          },
        },
      },
    },
    '/api/items': {
      get: {
        summary: 'List items',
        description: 'Returns a paginated list of exam items with optional filtering.',
        tags: ['Items'],
        parameters: [
          {
            name: 'subject',
            in: 'query',
            description: 'Filter by subject',
            schema: { type: 'string' },
          },
          {
            name: 'status',
            in: 'query',
            description: 'Filter by status',
            schema: { type: 'string', enum: ['draft', 'review', 'approved', 'archived'] },
          },
          {
            name: 'limit',
            in: 'query',
            description: 'Max items to return (1-100)',
            schema: { type: 'integer', minimum: 1, maximum: 100, default: 10 },
          },
          {
            name: 'offset',
            in: 'query',
            description: 'Number of items to skip',
            schema: { type: 'integer', minimum: 0, default: 0 },
          },
        ],
        responses: {
          200: {
            description: 'List of items',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ListItemsResponse' } },
            },
          },
          400: {
            description: 'Invalid query parameters',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ValidationError' } },
            },
          },
        },
      },
      post: {
        summary: 'Create item',
        description: 'Creates a new exam item.',
        tags: ['Items'],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/CreateItemRequest' } },
          },
        },
        responses: {
          201: {
            description: 'Item created',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ExamItem' } } },
          },
          400: {
            description: 'Validation error',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ValidationError' } },
            },
          },
        },
      },
    },
    '/api/items/{id}': {
      get: {
        summary: 'Get item by ID',
        description: 'Retrieves a single exam item by its UUID.',
        tags: ['Items'],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: 'Item UUID',
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          200: {
            description: 'Item found',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ExamItem' } } },
          },
          400: {
            description: 'Invalid ID format',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
          404: {
            description: 'Item not found',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
        },
      },
      put: {
        summary: 'Update item',
        description: 'Updates an existing exam item. Only provided fields are updated.',
        tags: ['Items'],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: 'Item UUID',
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/UpdateItemRequest' } },
          },
        },
        responses: {
          200: {
            description: 'Item updated',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ExamItem' } } },
          },
          400: {
            description: 'Validation error or empty update',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
          404: {
            description: 'Item not found',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
        },
      },
    },
    '/api/items/{id}/versions': {
      post: {
        summary: 'Create version',
        description:
          'Creates a new version snapshot of an exam item. Increments the version number and adds to audit trail.',
        tags: ['Versioning'],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: 'Item UUID',
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          201: {
            description: 'Version created',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ExamItem' } } },
          },
          400: {
            description: 'Invalid ID format',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
          404: {
            description: 'Item not found',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
        },
      },
    },
    '/api/items/{id}/audit': {
      get: {
        summary: 'Get audit trail',
        description: 'Retrieves the version history (audit trail) for an exam item.',
        tags: ['Versioning'],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: 'Item UUID',
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          200: {
            description: 'Audit trail',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/AuditTrailResponse' } },
            },
          },
          400: {
            description: 'Invalid ID format',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
          404: {
            description: 'Item not found',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      ExamItem: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          subject: { type: 'string', example: 'AP Biology' },
          itemType: { type: 'string', enum: ['multiple-choice', 'free-response', 'essay'] },
          difficulty: { type: 'integer', minimum: 1, maximum: 5 },
          content: { $ref: '#/components/schemas/ItemContent' },
          metadata: { $ref: '#/components/schemas/ItemMetadata' },
          securityLevel: { type: 'string', enum: ['standard', 'secure', 'highly-secure'] },
        },
      },
      ItemContent: {
        type: 'object',
        properties: {
          question: { type: 'string' },
          options: { type: 'array', items: { type: 'string' } },
          correctAnswer: { type: 'string' },
          explanation: { type: 'string' },
        },
        required: ['question', 'correctAnswer', 'explanation'],
      },
      ItemMetadata: {
        type: 'object',
        properties: {
          author: { type: 'string' },
          created: { type: 'integer', description: 'Unix timestamp' },
          lastModified: { type: 'integer', description: 'Unix timestamp' },
          version: { type: 'integer' },
          status: { type: 'string', enum: ['draft', 'review', 'approved', 'archived'] },
          tags: { type: 'array', items: { type: 'string' } },
        },
      },
      CreateItemRequest: {
        type: 'object',
        required: ['subject', 'itemType', 'difficulty', 'content', 'metadata', 'securityLevel'],
        properties: {
          subject: { type: 'string', minLength: 1 },
          itemType: { type: 'string', enum: ['multiple-choice', 'free-response', 'essay'] },
          difficulty: { type: 'integer', minimum: 1, maximum: 5 },
          content: { $ref: '#/components/schemas/ItemContent' },
          metadata: {
            type: 'object',
            required: ['author', 'status'],
            properties: {
              author: { type: 'string', minLength: 1 },
              status: { type: 'string', enum: ['draft', 'review', 'approved', 'archived'] },
              tags: { type: 'array', items: { type: 'string' }, default: [] },
            },
          },
          securityLevel: { type: 'string', enum: ['standard', 'secure', 'highly-secure'] },
        },
      },
      UpdateItemRequest: {
        type: 'object',
        description: 'All fields optional. At least one must be provided.',
        properties: {
          subject: { type: 'string', minLength: 1 },
          itemType: { type: 'string', enum: ['multiple-choice', 'free-response', 'essay'] },
          difficulty: { type: 'integer', minimum: 1, maximum: 5 },
          content: {
            type: 'object',
            properties: {
              question: { type: 'string' },
              options: { type: 'array', items: { type: 'string' } },
              correctAnswer: { type: 'string' },
              explanation: { type: 'string' },
            },
          },
          metadata: {
            type: 'object',
            properties: {
              author: { type: 'string' },
              status: { type: 'string', enum: ['draft', 'review', 'approved', 'archived'] },
              tags: { type: 'array', items: { type: 'string' } },
            },
          },
          securityLevel: { type: 'string', enum: ['standard', 'secure', 'highly-secure'] },
        },
      },
      ListItemsResponse: {
        type: 'object',
        properties: {
          items: { type: 'array', items: { $ref: '#/components/schemas/ExamItem' } },
          total: { type: 'integer', description: 'Total items matching filter' },
          limit: { type: 'integer' },
          offset: { type: 'integer' },
        },
      },
      AuditTrailResponse: {
        type: 'object',
        properties: {
          itemId: { type: 'string', format: 'uuid' },
          versions: { type: 'array', items: { $ref: '#/components/schemas/ExamItem' } },
          total: { type: 'integer' },
        },
      },
      Error: {
        type: 'object',
        properties: {
          error: { type: 'string' },
        },
      },
      ValidationError: {
        type: 'object',
        properties: {
          error: { type: 'string', example: 'Validation failed' },
          details: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  },
  tags: [
    { name: 'Items', description: 'CRUD operations for exam items' },
    { name: 'Versioning', description: 'Version management and audit trail' },
    { name: 'System', description: 'Health and status endpoints' },
  ],
};
