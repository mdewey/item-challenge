/**
 * Local Development Server
 *
 * A Hono-based HTTP server for testing your handlers locally.
 * Run with: pnpm dev
 */

import 'dotenv/config';
import { serve } from '@hono/node-server';
import { app } from './app.js';

const PORT = Number(process.env.PORT) || 3000;
const STORAGE = process.env.USE_DYNAMODB === 'true' ? 'DynamoDB' : 'Memory';

serve({ fetch: app.fetch, port: PORT }, () => {
  console.log(`\n🚀 Server running at http://localhost:${PORT}`);
  console.log(`\nStorage: ${STORAGE}`);
  console.log(`\nEndpoints:`);
  console.log(`  GET    http://localhost:${PORT}/api/items`);
  console.log(`  POST   http://localhost:${PORT}/api/items`);
  console.log(`  GET    http://localhost:${PORT}/api/items/:id`);
  console.log(`  PUT    http://localhost:${PORT}/api/items/:id`);
  console.log(`  POST   http://localhost:${PORT}/api/items/:id/versions`);
  console.log(`  GET    http://localhost:${PORT}/api/items/:id/audit`);
  console.log(`\nDocs:    http://localhost:${PORT}/docs`);
  console.log(`\nPress Ctrl+C to stop\n`);
});
