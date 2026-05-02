/**
 * Local Development Server
 *
 * A Hono-based HTTP server for testing your handlers locally.
 * Run with: pnpm dev
 */

import { serve } from '@hono/node-server';
import { app } from './app.js';

const PORT = Number(process.env.PORT) || 3000;

serve({ fetch: app.fetch, port: PORT }, () => {
  console.log(`\n🚀 Server running at http://localhost:${PORT}`);
  console.log(`\nEndpoints:`);
  console.log(`  GET    http://localhost:${PORT}/api/items/:id`);
  console.log(`\nPress Ctrl+C to stop\n`);
});
