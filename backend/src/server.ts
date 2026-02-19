// Main Bun HTTP server entry point

import { env } from '@/config/env';
import { healthHandler, readyHandler } from '@/routes/health';
import { handleRegister, handleLogin, handleRefresh, handleMe } from '@/routes/auth';
import {
  handleCreateService,
  handleListServices,
  handleGetService,
  handleUpdateService,
  handleDeleteService,
  handleUpsertCredentials,
} from '@/routes/services';
import {
  handleCreateAgent,
  handleListAgents,
  handleGetAgent,
  handleUpdateAgent,
  handleDeleteAgent,
  handleUpdateAgentServices,
} from '@/routes/agents';
import { handleProxy, handleProxyExecute } from '@/routes/proxy';
import { handleApprovalStatus } from '@/routes/approval';
import { expireStaleApprovals } from '@/services/approval.service';
import { errorResponse } from '@/utils/responses';
import { initEncryption } from '@/services/encryption.service';

// Type for route handlers
type RouteHandler = (req?: Request) => Promise<Response>;
type ParamRouteHandler = (req: Request, params: Record<string, string>) => Promise<Response>;

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

    // Check if route exists (exact match)
    const handler = routes[routeKey];

    if (handler) {
      // Route exists - call the handler with request
      return await handler(req);
    }

    // Try parameterized routes for /services
    // Pattern: /services, /services/:id, /services/:id/credentials
    if (pathname === '/services') {
      if (method === 'GET') return await handleListServices(req);
      if (method === 'POST') return await handleCreateService(req);
    }

    // Match /services/:id
    const serviceMatch = pathname.match(/^\/services\/(\d+)$/);
    if (serviceMatch) {
      const params = { id: serviceMatch[1] };
      if (method === 'GET') return await handleGetService(req, params);
      if (method === 'PUT') return await handleUpdateService(req, params);
      if (method === 'DELETE') return await handleDeleteService(req, params);
    }

    // Match /services/:id/credentials
    const credMatch = pathname.match(/^\/services\/(\d+)\/credentials$/);
    if (credMatch) {
      const params = { id: credMatch[1] };
      if (method === 'POST') return await handleUpsertCredentials(req, params);
    }

    // Try parameterized routes for /agents
    // Pattern: /agents, /agents/:id, /agents/:id/services
    if (pathname === '/agents') {
      if (method === 'GET') return await handleListAgents(req);
      if (method === 'POST') return await handleCreateAgent(req);
    }

    // Match /agents/:id
    const agentMatch = pathname.match(/^\/agents\/(\d+)$/);
    if (agentMatch) {
      const params = { id: agentMatch[1] };
      if (method === 'GET') return await handleGetAgent(req, params);
      if (method === 'PUT') return await handleUpdateAgent(req, params);
      if (method === 'DELETE') return await handleDeleteAgent(req, params);
    }

    // Match /agents/:id/services
    const agentServicesMatch = pathname.match(/^\/agents\/(\d+)\/services$/);
    if (agentServicesMatch) {
      const params = { id: agentServicesMatch[1] };
      if (method === 'PUT') return await handleUpdateAgentServices(req, params);
    }

    // Proxy endpoint (agent-facing)
    if (pathname === '/proxy') {
      if (method === 'POST') return await handleProxy(req);
    }

    // GET /status/:actionId — agent polls for approval status
    const statusMatch = pathname.match(/^\/status\/([0-9a-f-]{36})$/);
    if (statusMatch && method === 'GET') {
      return await handleApprovalStatus(req, { actionId: statusMatch[1] as string });
    }

    // POST /proxy/execute/:actionId — agent executes approved request
    const executeMatch = pathname.match(/^\/proxy\/execute\/([0-9a-f-]{36})$/);
    if (executeMatch && method === 'POST') {
      return await handleProxyExecute(req, { actionId: executeMatch[1] as string });
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

// TTL cleanup: expire approved requests that haven't been executed within the TTL window
// Runs every 5 minutes — prevents stale APPROVED entries accumulating in the queue
setInterval(() => {
  expireStaleApprovals().catch((err) => {
    console.error('Approval TTL cleanup error:', err);
  });
}, 5 * 60 * 1000); // Every 5 minutes

// Start the server
const server = Bun.serve({
  port: env.PORT,
  fetch: handleRequest,
  error: handleError,
});

console.log(`Server running on port ${server.port}`);
