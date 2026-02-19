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
import { handleListPendingApprovals, handleApproveAction, handleDenyAction } from '@/routes/dashboard';
import { expireStaleApprovals } from '@/services/approval.service';
import { errorResponse } from '@/utils/responses';
import { initEncryption } from '@/services/encryption.service';

// Type for route handlers
type RouteHandler = (req?: Request) => Promise<Response>;
type ParamRouteHandler = (req: Request, params: Record<string, string>) => Promise<Response>;

// CORS: Add Access-Control headers for requests from frontend dev servers on localhost
function addCorsHeaders(res: Response, origin: string | null): Response {
  const headers = new Headers(res.headers);
  if (origin && /^http:\/\/localhost(:\d+)?$/.test(origin)) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    headers.set('Access-Control-Allow-Credentials', 'true');
  }
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

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
  const origin = req.headers.get('Origin');

  // Handle CORS preflight — return 204 immediately with CORS headers
  if (req.method === 'OPTIONS') {
    const preflightRes = new Response(null, { status: 204 });
    return addCorsHeaders(preflightRes, origin);
  }

  try {
    const url = new URL(req.url);
    const method = req.method;
    const pathname = url.pathname;
    const routeKey = `${method} ${pathname}`;

    // Check if route exists (exact match)
    const handler = routes[routeKey];

    if (handler) {
      // Route exists - call the handler with request
      const res = await handler(req);
      return addCorsHeaders(res, origin);
    }

    // Try parameterized routes for /services
    // Pattern: /services, /services/:id, /services/:id/credentials
    if (pathname === '/services') {
      if (method === 'GET') return addCorsHeaders(await handleListServices(req), origin);
      if (method === 'POST') return addCorsHeaders(await handleCreateService(req), origin);
    }

    // Match /services/:id
    const serviceMatch = pathname.match(/^\/services\/(\d+)$/);
    if (serviceMatch) {
      const params = { id: serviceMatch[1] };
      if (method === 'GET') return addCorsHeaders(await handleGetService(req, params), origin);
      if (method === 'PUT') return addCorsHeaders(await handleUpdateService(req, params), origin);
      if (method === 'DELETE') return addCorsHeaders(await handleDeleteService(req, params), origin);
    }

    // Match /services/:id/credentials
    const credMatch = pathname.match(/^\/services\/(\d+)\/credentials$/);
    if (credMatch) {
      const params = { id: credMatch[1] };
      if (method === 'POST') return addCorsHeaders(await handleUpsertCredentials(req, params), origin);
    }

    // Try parameterized routes for /agents
    // Pattern: /agents, /agents/:id, /agents/:id/services
    if (pathname === '/agents') {
      if (method === 'GET') return addCorsHeaders(await handleListAgents(req), origin);
      if (method === 'POST') return addCorsHeaders(await handleCreateAgent(req), origin);
    }

    // Match /agents/:id
    const agentMatch = pathname.match(/^\/agents\/(\d+)$/);
    if (agentMatch) {
      const params = { id: agentMatch[1] };
      if (method === 'GET') return addCorsHeaders(await handleGetAgent(req, params), origin);
      if (method === 'PUT') return addCorsHeaders(await handleUpdateAgent(req, params), origin);
      if (method === 'DELETE') return addCorsHeaders(await handleDeleteAgent(req, params), origin);
    }

    // Match /agents/:id/services
    const agentServicesMatch = pathname.match(/^\/agents\/(\d+)\/services$/);
    if (agentServicesMatch) {
      const params = { id: agentServicesMatch[1] };
      if (method === 'PUT') return addCorsHeaders(await handleUpdateAgentServices(req, params), origin);
    }

    // Proxy endpoint (agent-facing)
    if (pathname === '/proxy') {
      if (method === 'POST') return addCorsHeaders(await handleProxy(req), origin);
    }

    // GET /status/:actionId — agent polls for approval status
    const statusMatch = pathname.match(/^\/status\/([0-9a-f-]{36})$/);
    if (statusMatch && method === 'GET') {
      const res = await handleApprovalStatus(req, { actionId: statusMatch[1] as string });
      return addCorsHeaders(res, origin);
    }

    // POST /proxy/execute/:actionId — agent executes approved request
    const executeMatch = pathname.match(/^\/proxy\/execute\/([0-9a-f-]{36})$/);
    if (executeMatch && method === 'POST') {
      const res = await handleProxyExecute(req, { actionId: executeMatch[1] as string });
      return addCorsHeaders(res, origin);
    }

    // GET /approvals/pending — dashboard lists pending actions for authenticated user
    if (pathname === '/approvals/pending' && method === 'GET') {
      const res = await handleListPendingApprovals(req);
      return addCorsHeaders(res, origin);
    }

    // PATCH /approvals/:actionId/approve — dashboard approves a pending action
    const approveMatch = pathname.match(/^\/approvals\/([0-9a-f-]{36})\/approve$/);
    if (approveMatch && method === 'PATCH') {
      const res = await handleApproveAction(req, { actionId: approveMatch[1] });
      return addCorsHeaders(res, origin);
    }

    // PATCH /approvals/:actionId/deny — dashboard denies a pending action
    const denyMatch = pathname.match(/^\/approvals\/([0-9a-f-]{36})\/deny$/);
    if (denyMatch && method === 'PATCH') {
      const res = await handleDenyAction(req, { actionId: denyMatch[1] });
      return addCorsHeaders(res, origin);
    }

    // Check if path exists but with wrong method
    const pathExists = Object.keys(routes).some((key) => key.endsWith(pathname));
    if (pathExists) {
      return addCorsHeaders(errorResponse('Method not allowed', 405), origin);
    }

    // Route not found
    return addCorsHeaders(errorResponse('Not found', 404), origin);
  } catch (error) {
    console.error('Request handler error:', error);
    return addCorsHeaders(errorResponse('Internal server error', 500), origin);
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
