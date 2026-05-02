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
    description: 'RESTful API for managing exam items.',
    version: '1.0.0',
  },
  servers: [{ url: 'http://localhost:3000', description: 'Local development' }],
  paths: {
    '/health': {
      get: {
        summary: 'Health check',
        responses: { 200: { description: 'OK' } },
      },
    },
    '/api/items/{id}': {
      get: {
        summary: 'Get item by ID',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          200: { description: 'Item found' },
          404: { description: 'Not found' },
        },
      },
      put: {
        summary: 'Update item',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          200: { description: 'Updated' },
          404: { description: 'Not found' },
        },
      },
    },
    '/api/items': {
      get: {
        summary: 'List items',
        parameters: [
          { name: 'subject', in: 'query', schema: { type: 'string' } },
          {
            name: 'status',
            in: 'query',
            schema: { type: 'string', enum: ['draft', 'review', 'approved', 'archived'] },
          },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 10 } },
          { name: 'offset', in: 'query', schema: { type: 'integer', default: 0 } },
        ],
        responses: { 200: { description: 'List of items' } },
      },
      post: {
        summary: 'Create item',
        responses: {
          201: { description: 'Created' },
          400: { description: 'Validation error' },
        },
      },
    },
  },
};
