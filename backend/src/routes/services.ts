// Service management REST API routes
// All endpoints require JWT authentication

import { requireAuth, AuthError } from '@/middleware/auth';
import { validateBody, ValidationError } from '@/middleware/validation';
import {
  createService,
  getServicesByUser,
  getServiceById,
  updateService,
  deleteService,
  upsertCredentials,
  NotFoundError,
  createServiceSchema,
  updateServiceSchema,
  credentialsSchema,
} from '@/services/service.service';
import { formatServiceResponse } from '@/utils/masking';
import { successResponse, errorResponse } from '@/utils/responses';
import { logger } from '@/utils/logger';

// ============================================================================
// Route Handlers
// ============================================================================

/**
 * POST /services
 * Create a new service with encrypted credentials
 */
export async function handleCreateService(req: Request): Promise<Response> {
  try {
    // Authenticate user
    const { userId } = await requireAuth(req);

    // Validate request body
    const data = await validateBody(createServiceSchema)(req);

    // Create service
    const service = await createService(userId, data);
    logger.info(`Service created: ${service.name} (id: ${service.id}) by user ${userId}`);

    // Get credential keys (we just created them, so we know what they are)
    const credentialKeys = Object.keys(data.credentials);

    // Return formatted response (no credential values)
    return successResponse(
      formatServiceResponse(service, credentialKeys),
      201
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return errorResponse(error.message, error.statusCode);
    }
    if (error instanceof ValidationError) {
      return errorResponse(error.message, error.statusCode);
    }
    // Never log full error object - might contain credentials
    logger.error('Create service error:', error instanceof Error ? error.message : 'Unknown error');
    return errorResponse('Internal server error', 500);
  }
}

/**
 * GET /services
 * List all services for authenticated user
 */
export async function handleListServices(req: Request): Promise<Response> {
  try {
    // Authenticate user
    const { userId } = await requireAuth(req);

    // Get services
    const services = await getServicesByUser(userId);

    // Format responses
    const formattedServices = services.map((service) =>
      formatServiceResponse(service, service.credentialKeys)
    );

    return successResponse(formattedServices, 200);
  } catch (error) {
    if (error instanceof AuthError) {
      return errorResponse(error.message, error.statusCode);
    }
    logger.error('List services error:', error instanceof Error ? error.message : 'Unknown error');
    return errorResponse('Internal server error', 500);
  }
}

/**
 * GET /services/:id
 * Get a single service by ID (ownership checked)
 */
export async function handleGetService(req: Request, params: { id: string }): Promise<Response> {
  try {
    // Authenticate user
    const { userId } = await requireAuth(req);

    // Parse service ID
    const serviceId = parseInt(params.id, 10);
    if (isNaN(serviceId)) {
      return errorResponse('Invalid service ID', 400);
    }

    // Get service
    const service = await getServiceById(serviceId, userId);

    // Format response
    return successResponse(
      formatServiceResponse(service, service.credentialKeys),
      200
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return errorResponse(error.message, error.statusCode);
    }
    if (error instanceof NotFoundError) {
      return errorResponse(error.message, error.statusCode);
    }
    logger.error('Get service error:', error instanceof Error ? error.message : 'Unknown error');
    return errorResponse('Internal server error', 500);
  }
}

/**
 * PUT /services/:id
 * Update service details (not credentials)
 */
export async function handleUpdateService(req: Request, params: { id: string }): Promise<Response> {
  try {
    // Authenticate user
    const { userId } = await requireAuth(req);

    // Parse service ID
    const serviceId = parseInt(params.id, 10);
    if (isNaN(serviceId)) {
      return errorResponse('Invalid service ID', 400);
    }

    // Validate request body
    const data = await validateBody(updateServiceSchema)(req);

    // Update service
    const service = await updateService(serviceId, userId, data);

    // Get credential keys to include in response
    const serviceWithKeys = await getServiceById(serviceId, userId);

    // Format response
    return successResponse(
      formatServiceResponse(serviceWithKeys, serviceWithKeys.credentialKeys),
      200
    );
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
    logger.error('Update service error:', error instanceof Error ? error.message : 'Unknown error');
    return errorResponse('Internal server error', 500);
  }
}

/**
 * DELETE /services/:id
 * Delete a service (cascade deletes credentials and documentation)
 */
export async function handleDeleteService(req: Request, params: { id: string }): Promise<Response> {
  try {
    // Authenticate user
    const { userId } = await requireAuth(req);

    // Parse service ID
    const serviceId = parseInt(params.id, 10);
    if (isNaN(serviceId)) {
      return errorResponse('Invalid service ID', 400);
    }

    // Delete service
    await deleteService(serviceId, userId);
    logger.info(`Service deleted: id=${serviceId} by user ${userId}`);

    return successResponse({ message: 'Service deleted' }, 200);
  } catch (error) {
    if (error instanceof AuthError) {
      return errorResponse(error.message, error.statusCode);
    }
    if (error instanceof NotFoundError) {
      return errorResponse(error.message, error.statusCode);
    }
    logger.error('Delete service error:', error instanceof Error ? error.message : 'Unknown error');
    return errorResponse('Internal server error', 500);
  }
}

/**
 * POST /services/:id/credentials
 * Replace all credentials for a service
 */
export async function handleUpsertCredentials(req: Request, params: { id: string }): Promise<Response> {
  try {
    // Authenticate user
    const { userId } = await requireAuth(req);

    // Parse service ID
    const serviceId = parseInt(params.id, 10);
    if (isNaN(serviceId)) {
      return errorResponse('Invalid service ID', 400);
    }

    // Validate request body
    const data = await validateBody(credentialsSchema)(req);

    // Upsert credentials
    const result = await upsertCredentials(serviceId, userId, data);
    logger.info(`Credentials updated for service ${serviceId} by user ${userId}`);

    return successResponse({
      message: 'Credentials updated',
      ...result,
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
    logger.error('Upsert credentials error:', error instanceof Error ? error.message : 'Unknown error');
    return errorResponse('Internal server error', 500);
  }
}
