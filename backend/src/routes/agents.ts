// Agent management REST API routes
// All endpoints require JWT authentication

import { requireAuth, AuthError } from '@/middleware/auth';
import { validateBody, ValidationError } from '@/middleware/validation';
import {
  createAgent,
  getAgentsByUser,
  getAgentById,
  updateAgent,
  deleteAgent,
  updateAgentServices,
  createAgentSchema,
  updateAgentSchema,
  updateAgentServicesSchema,
  NotFoundError,
} from '@/services/agent.service';
import { successResponse, errorResponse } from '@/utils/responses';

// ============================================================================
// Route Handlers
// ============================================================================

/**
 * POST /agents
 * Create a new agent with API key and service scoping
 */
export async function handleCreateAgent(req: Request): Promise<Response> {
  try {
    // Authenticate user
    const { userId } = await requireAuth(req);

    // Validate request body
    const data = await validateBody(createAgentSchema)(req);

    // Create agent
    const result = await createAgent(userId, data);

    // Return agent with full API key (only time it's exposed)
    return successResponse(result, 201);
  } catch (error) {
    if (error instanceof AuthError) {
      return errorResponse(error.message, error.statusCode);
    }
    if (error instanceof ValidationError) {
      return errorResponse(error.message, error.statusCode);
    }
    if (error instanceof NotFoundError) {
      return errorResponse(error.message, error.statusCode);
    }
    console.error('Create agent error:', error instanceof Error ? error.message : 'Unknown error');
    return errorResponse('Internal server error', 500);
  }
}

/**
 * GET /agents
 * List all agents for authenticated user
 */
export async function handleListAgents(req: Request): Promise<Response> {
  try {
    // Authenticate user
    const { userId } = await requireAuth(req);

    // Get agents
    const agents = await getAgentsByUser(userId);

    return successResponse(agents, 200);
  } catch (error) {
    if (error instanceof AuthError) {
      return errorResponse(error.message, error.statusCode);
    }
    console.error('List agents error:', error instanceof Error ? error.message : 'Unknown error');
    return errorResponse('Internal server error', 500);
  }
}

/**
 * GET /agents/:id
 * Get a single agent by ID (ownership checked)
 */
export async function handleGetAgent(req: Request, params: { id: string }): Promise<Response> {
  try {
    // Authenticate user
    const { userId } = await requireAuth(req);

    // Parse agent ID
    const agentId = parseInt(params.id, 10);
    if (isNaN(agentId)) {
      return errorResponse('Invalid agent ID', 400);
    }

    // Get agent
    const agent = await getAgentById(agentId, userId);

    return successResponse(agent, 200);
  } catch (error) {
    if (error instanceof AuthError) {
      return errorResponse(error.message, error.statusCode);
    }
    if (error instanceof NotFoundError) {
      return errorResponse(error.message, error.statusCode);
    }
    console.error('Get agent error:', error instanceof Error ? error.message : 'Unknown error');
    return errorResponse('Internal server error', 500);
  }
}

/**
 * PUT /agents/:id
 * Update agent details (name and/or isActive)
 */
export async function handleUpdateAgent(req: Request, params: { id: string }): Promise<Response> {
  try {
    // Authenticate user
    const { userId } = await requireAuth(req);

    // Parse agent ID
    const agentId = parseInt(params.id, 10);
    if (isNaN(agentId)) {
      return errorResponse('Invalid agent ID', 400);
    }

    // Validate request body
    const data = await validateBody(updateAgentSchema)(req);

    // Update agent
    await updateAgent(agentId, userId, data);

    // Get updated agent with services
    const updatedAgent = await getAgentById(agentId, userId);

    return successResponse(updatedAgent, 200);
  } catch (error) {
    if (error instanceof AuthError) {
      return errorResponse(error.message, error.statusCode);
    }
    if (error instanceof ValidationError) {
      return errorResponse(error.message, error.statusCode);
    }
    if (error instanceof NotFoundError) {
      return errorResponse(error.message, error.statusCode);
    }
    console.error('Update agent error:', error instanceof Error ? error.message : 'Unknown error');
    return errorResponse('Internal server error', 500);
  }
}

/**
 * DELETE /agents/:id
 * Delete an agent (cascade deletes agent_services)
 */
export async function handleDeleteAgent(req: Request, params: { id: string }): Promise<Response> {
  try {
    // Authenticate user
    const { userId } = await requireAuth(req);

    // Parse agent ID
    const agentId = parseInt(params.id, 10);
    if (isNaN(agentId)) {
      return errorResponse('Invalid agent ID', 400);
    }

    // Delete agent
    await deleteAgent(agentId, userId);

    return successResponse({ message: 'Agent deleted' }, 200);
  } catch (error) {
    if (error instanceof AuthError) {
      return errorResponse(error.message, error.statusCode);
    }
    if (error instanceof NotFoundError) {
      return errorResponse(error.message, error.statusCode);
    }
    console.error('Delete agent error:', error instanceof Error ? error.message : 'Unknown error');
    return errorResponse('Internal server error', 500);
  }
}

/**
 * PUT /agents/:id/services
 * Update agent service associations (replace semantics)
 */
export async function handleUpdateAgentServices(req: Request, params: { id: string }): Promise<Response> {
  try {
    // Authenticate user
    const { userId } = await requireAuth(req);

    // Parse agent ID
    const agentId = parseInt(params.id, 10);
    if (isNaN(agentId)) {
      return errorResponse('Invalid agent ID', 400);
    }

    // Validate request body
    const data = await validateBody(updateAgentServicesSchema)(req);

    // Update agent services
    const updatedServices = await updateAgentServices(agentId, userId, data);

    return successResponse({
      message: 'Agent services updated',
      services: updatedServices,
    }, 200);
  } catch (error) {
    if (error instanceof AuthError) {
      return errorResponse(error.message, error.statusCode);
    }
    if (error instanceof ValidationError) {
      return errorResponse(error.message, error.statusCode);
    }
    if (error instanceof NotFoundError) {
      return errorResponse(error.message, error.statusCode);
    }
    console.error('Update agent services error:', error instanceof Error ? error.message : 'Unknown error');
    return errorResponse('Internal server error', 500);
  }
}
