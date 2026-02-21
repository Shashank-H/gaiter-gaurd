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
import { logger } from '@/utils/logger';

// Type for route handlers
type RouteHandler = (req: Request) => Response | Promise<Response>;
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
  const startTime = Date.now();
  const origin = req.headers.get('Origin');
  const url = new URL(req.url);
  const method = req.method;
  const pathname = url.pathname;

  // Handle CORS preflight — return 204 immediately with CORS headers
  if (method === 'OPTIONS') {
    const preflightRes = new Response(null, { status: 204 });
    return addCorsHeaders(preflightRes, origin);
  }

  let response: Response;

  try {
    const routeKey = `${method} ${pathname}`;

    // Check if route exists (exact match)
    const handler = routes[routeKey];

    if (handler) {
      // Route exists - call the handler with request
      response = await handler(req);
    } else {
      // Try parameterized routes for /services
      // Pattern: /services, /services/:id, /services/:id/credentials
      if (pathname === '/services') {
        if (method === 'GET') response = await handleListServices(req);
        else if (method === 'POST') response = await handleCreateService(req);
      }

      // Match /services/:id
      const serviceMatch = pathname.match(/^\/services\/(\d+)$/);
      if (serviceMatch && !response!) {
        const params = { id: serviceMatch[1] as string };
        if (method === 'GET') response = await handleGetService(req, params);
        else if (method === 'PUT') response = await handleUpdateService(req, params);
        else if (method === 'DELETE') response = await handleDeleteService(req, params);
      }

      // Match /services/:id/credentials
      const credMatch = pathname.match(/^\/services\/(\d+)\/credentials$/);
      if (credMatch && !response!) {
        const params = { id: credMatch[1] as string };
        if (method === 'POST') response = await handleUpsertCredentials(req, params);
      }

      // Try parameterized routes for /agents
      // Pattern: /agents, /agents/:id, /agents/:id/services
      if (pathname === '/agents' && !response!) {
        if (method === 'GET') response = await handleListAgents(req);
        else if (method === 'POST') response = await handleCreateAgent(req);
      }

      // Match /agents/:id
      const agentMatch = pathname.match(/^\/agents\/(\d+)$/);
      if (agentMatch && !response!) {
        const params = { id: agentMatch[1] as string };
        if (method === 'GET') response = await handleGetAgent(req, params);
        else if (method === 'PUT') response = await handleUpdateAgent(req, params);
        else if (method === 'DELETE') response = await handleDeleteAgent(req, params);
      }

      // Match /agents/:id/services
      const agentServicesMatch = pathname.match(/^\/agents\/(\d+)\/services$/);
      if (agentServicesMatch && !response!) {
        const params = { id: agentServicesMatch[1] as string };
        if (method === 'PUT') response = await handleUpdateAgentServices(req, params);
      }

      // Proxy endpoint (agent-facing)
      if (pathname === '/proxy' && !response!) {
        if (method === 'POST') response = await handleProxy(req);
      }

      // GET /status/:actionId — agent polls for approval status
      const statusMatch = pathname.match(/^\/status\/([0-9a-f-]{36})$/);
      if (statusMatch && method === 'GET' && !response!) {
        response = await handleApprovalStatus(req, { actionId: statusMatch[1] as string });
      }

      // POST /proxy/execute/:actionId — agent executes approved request
      const executeMatch = pathname.match(/^\/proxy\/execute\/([0-9a-f-]{36})$/);
      if (executeMatch && method === 'POST' && !response!) {
        response = await handleProxyExecute(req, { actionId: executeMatch[1] as string });
      }

      // GET /approvals/pending — dashboard lists pending actions for authenticated user
      if (pathname === '/approvals/pending' && method === 'GET' && !response!) {
        response = await handleListPendingApprovals(req);
      }

      // PATCH /approvals/:actionId/approve — dashboard approves a pending action
      const approveMatch = pathname.match(/^\/approvals\/([0-9a-f-]{36})\/approve$/);
      if (approveMatch && method === 'PATCH' && !response!) {
        response = await handleApproveAction(req, { actionId: approveMatch[1] as string });
      }

      // PATCH /approvals/:actionId/deny — dashboard denies a pending action
      const denyMatch = pathname.match(/^\/approvals\/([0-9a-f-]{36})\/deny$/);
      if (denyMatch && method === 'PATCH' && !response!) {
        response = await handleDenyAction(req, { actionId: denyMatch[1] as string });
      }
    }

    if (!response!) {
      // Check if path exists but with wrong method
      const pathExists = Object.keys(routes).some((key) => key.endsWith(pathname));
      if (pathExists) {
        response = errorResponse('Method not allowed', 405);
      } else {
        response = errorResponse('Not found', 404);
      }
    }
  } catch (error) {
    logger.error('Request handler error:', error);
    response = errorResponse('Internal server error', 500);
  }

  const duration = Date.now() - startTime;
  logger.info(`${method} ${pathname} ${response.status} (${duration}ms)`);

  return addCorsHeaders(response, origin);
}


// Global error handler
function handleError(error: Error): Response {
  logger.error('Server error:', error);
  return errorResponse(error.message || 'Internal server error', 500);
}

// Initialize encryption before starting server
initEncryption();

// TTL cleanup: expire approved requests that haven't been executed within the TTL window
// Runs every 5 minutes — prevents stale APPROVED entries accumulating in the queue
setInterval(() => {
  expireStaleApprovals().catch((err) => {
    logger.error('Approval TTL cleanup error:', err);
  });
}, 5 * 60 * 1000); // Every 5 minutes

// Start the server
const server = Bun.serve({
  port: env.PORT,
  fetch: handleRequest,
  error: handleError,
});

logger.info(`Server running on port ${server.port}`);
