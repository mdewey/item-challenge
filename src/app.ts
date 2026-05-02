/**
 * Hono Application
 *
 * Configures routes and middleware. Shared between local dev server and Lambda.
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { swaggerUI } from '@hono/swagger-ui';
import { randomUUID } from 'crypto';
import { getItemHandler } from './handlers/getItem.js';
import { createItemHandler } from './handlers/createItem.js';
import { updateItemHandler } from './handlers/updateItem.js';
import { listItemsHandler } from './handlers/listItems.js';
import { createVersionHandler } from './handlers/createVersion.js';
import { createHandlerContext } from './context.js';
import { logger as appLogger } from './utils/logger.js';
import { openApiSpec } from './openapi.js';

// Define context variables for type safety
type Variables = {
  requestId: string;
};

export const app = new Hono<{ Variables: Variables }>();

// Middleware
app.use('*', logger());
app.use('*', cors());

// Request ID middleware - adds unique ID for tracing
app.use('*', async (c, next) => {
  const requestId = c.req.header('x-request-id') ?? randomUUID();
  c.set('requestId', requestId);
  c.header('x-request-id', requestId);
  await next();
});

// Routes
app.get('/api/items/:id', async (c) => {
  const ctx = createHandlerContext(c.get('requestId'));
  const result = await getItemHandler(c.req.param('id'), ctx);
  return c.json(result.body, result.statusCode as 200 | 400 | 404 | 500);
});

app.post('/api/items', async (c) => {
  const ctx = createHandlerContext(c.get('requestId'));
  const body: unknown = await c.req.json();
  const result = await createItemHandler(body, ctx);
  return c.json(result.body, result.statusCode as 200 | 201 | 400 | 404 | 500);
});

app.put('/api/items/:id', async (c) => {
  const ctx = createHandlerContext(c.get('requestId'));
  const body: unknown = await c.req.json();
  const result = await updateItemHandler(c.req.param('id'), body, ctx);
  return c.json(result.body, result.statusCode as 200 | 400 | 404 | 500);
});

app.get('/api/items', async (c) => {
  const ctx = createHandlerContext(c.get('requestId'));
  const query = c.req.query();
  const result = await listItemsHandler(query, ctx);
  return c.json(result.body, result.statusCode as 200 | 400 | 500);
});

app.post('/api/items/:id/versions', async (c) => {
  const ctx = createHandlerContext(c.get('requestId'));
  const result = await createVersionHandler(c.req.param('id'), ctx);
  return c.json(result.body, result.statusCode as 201 | 400 | 404 | 500);
});

// TODO: Add more routes as handlers are implemented
// app.get('/api/items/:id/audit', async (c) => { ... });

// Health check
app.get('/health', (c) => c.json({ status: 'ok' }));

// OpenAPI spec endpoint
app.get('/openapi.json', (c) => c.json(openApiSpec));

// Swagger UI
app.get('/docs', swaggerUI({ url: '/openapi.json' }));

// 404 handler
app.notFound((c) => {
  return c.json({ error: 'Route not found' }, 404);
});

// Error handler
app.onError((err, c) => {
  const requestId = c.get('requestId') || 'unknown';
  appLogger.error('Unhandled server error', err, { requestId });
  return c.json({ error: 'Internal server error' }, 500);
});
