// Main Bun HTTP server entry point

import { env } from '@/config/env';
import { healthHandler, readyHandler } from '@/routes/health';
import { errorResponse } from '@/utils/responses';

// Define routes with their handlers
const routes = {
  'GET /health': healthHandler,
  'GET /ready': readyHandler,
} as const;

// Main fetch handler for routing
async function handleRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const method = req.method;
  const pathname = url.pathname;
  const routeKey = `${method} ${pathname}` as keyof typeof routes;

  // Check if route exists
  const handler = routes[routeKey];

  if (handler) {
    // Route exists - call the handler
    return await handler();
  }

  // Check if path exists but with wrong method
  const pathExists = Object.keys(routes).some((key) => key.endsWith(pathname));
  if (pathExists) {
    return errorResponse('Method not allowed', 405);
  }

  // Route not found
  return errorResponse('Not found', 404);
}

// Global error handler
function handleError(error: Error): Response {
  console.error('Server error:', error);
  return errorResponse(error.message || 'Internal server error', 500);
}

// Start the server
const server = Bun.serve({
  port: env.PORT,
  fetch: handleRequest,
  error: handleError,
});

console.log(`Server running on port ${server.port}`);
