// Main Bun HTTP server entry point

import { env } from '@/config/env';
import { healthHandler, readyHandler } from '@/routes/health';
import { handleRegister, handleLogin, handleRefresh, handleMe } from '@/routes/auth';
import { errorResponse } from '@/utils/responses';
import { initEncryption } from '@/services/encryption.service';

// Type for route handlers
type RouteHandler = (req?: Request) => Promise<Response>;

// Define routes with their handlers
const routes: Record<string, RouteHandler> = {
  'GET /health': healthHandler,
  'GET /ready': readyHandler,
  'POST /auth/register': handleRegister,
  'POST /auth/login': handleLogin,
  'POST /auth/refresh': handleRefresh,
  'GET /auth/me': handleMe,
};

// Main fetch handler for routing
async function handleRequest(req: Request): Promise<Response> {
  try {
    const url = new URL(req.url);
    const method = req.method;
    const pathname = url.pathname;
    const routeKey = `${method} ${pathname}`;

    // Check if route exists
    const handler = routes[routeKey];

    if (handler) {
      // Route exists - call the handler with request
      return await handler(req);
    }

    // Check if path exists but with wrong method
    const pathExists = Object.keys(routes).some((key) => key.endsWith(pathname));
    if (pathExists) {
      return errorResponse('Method not allowed', 405);
    }

    // Route not found
    return errorResponse('Not found', 404);
  } catch (error) {
    console.error('Request handler error:', error);
    return errorResponse('Internal server error', 500);
  }
}

// Global error handler
function handleError(error: Error): Response {
  console.error('Server error:', error);
  return errorResponse(error.message || 'Internal server error', 500);
}

// Initialize encryption before starting server
initEncryption();

// Start the server
const server = Bun.serve({
  port: env.PORT,
  fetch: handleRequest,
  error: handleError,
});

console.log(`Server running on port ${server.port}`);
