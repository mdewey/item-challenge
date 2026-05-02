/**
 * AWS Lambda Entry Point
 *
 * Exports the Hono app as a Lambda handler.
 * Deploy with API Gateway (REST or HTTP) or Lambda Function URLs.
 */

import { handle } from 'hono/aws-lambda';
import { app } from './app.js';

// Export for Lambda
export const handler = handle(app);
