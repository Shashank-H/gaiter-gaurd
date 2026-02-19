// Service CRUD operations with encrypted credential management

import { z } from 'zod';
import { db } from '@/db';
import { services, credentials, type Service, type InsertService, type InsertCredential } from '@/db/schema';
import { encrypt } from '@/services/encryption.service';
import { eq, and } from 'drizzle-orm';

// ============================================================================
// Validation Schemas
// ============================================================================

/**
 * Schema for creating a new service
 */
export const createServiceSchema = z.object({
  name: z.string().min(1).max(255),
  baseUrl: z.string().url().max(512),
  authType: z.enum(['api_key', 'bearer', 'basic', 'oauth2']),
  credentials: z.record(z.string().min(1), z.string().min(1)).refine(
    (obj) => Object.keys(obj).length > 0,
    { message: 'At least one credential is required' }
  ),
});

/**
 * Schema for updating a service
 * All fields optional but at least one must be present
 */
export const updateServiceSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  baseUrl: z.string().url().max(512).optional(),
  authType: z.enum(['api_key', 'bearer', 'basic', 'oauth2']).optional(),
}).refine(
  (obj) => Object.keys(obj).length > 0,
  { message: 'At least one field must be provided for update' }
);

/**
 * Schema for upserting credentials
 */
export const credentialsSchema = z.record(z.string().min(1), z.string().min(1)).refine(
  (obj) => Object.keys(obj).length > 0,
  { message: 'At least one credential is required' }
);

// ============================================================================
// Custom Errors
// ============================================================================

/**
 * Error thrown when a service is not found or user doesn't have access
 */
export class NotFoundError extends Error {
  statusCode = 404;

  constructor(message: string = 'Service not found') {
    super(message);
    this.name = 'NotFoundError';
  }
}

// ============================================================================
// Service CRUD Operations
// ============================================================================

/**
 * Create a new service with encrypted credentials
 *
 * @param userId - The ID of the user creating the service
 * @param data - Service data including credentials
 * @returns Created service (without credential values)
 */
export async function createService(
  userId: number,
  data: z.infer<typeof createServiceSchema>
): Promise<Service> {
  return await db.transaction(async (tx) => {
    // Insert service
    const [service] = await tx.insert(services).values({
      userId,
      name: data.name,
      baseUrl: data.baseUrl,
      authType: data.authType,
    }).returning();

    // Insert encrypted credentials
    const credentialEntries = Object.entries(data.credentials).map(([key, value]) => ({
      serviceId: service.id,
      key,
      encryptedValue: encrypt(value),
    }));

    await tx.insert(credentials).values(credentialEntries);

    return service;
  });
}

/**
 * Get all services for a user
 *
 * @param userId - The ID of the user
 * @returns Array of services with credential key names (no values)
 */
export async function getServicesByUser(
  userId: number
): Promise<Array<Service & { credentialKeys: string[] }>> {
  // Get all services for this user
  const userServices = await db.select().from(services).where(eq(services.userId, userId));

  // For each service, get credential keys
  const servicesWithKeys = await Promise.all(
    userServices.map(async (service) => {
      const serviceCreds = await db
        .select({ key: credentials.key })
        .from(credentials)
        .where(eq(credentials.serviceId, service.id));

      return {
        ...service,
        credentialKeys: serviceCreds.map((c) => c.key),
      };
    })
  );

  return servicesWithKeys;
}

/**
 * Get a single service by ID (with ownership check)
 *
 * @param serviceId - The service ID
 * @param userId - The user ID (for ownership verification)
 * @returns Service with credential key names (no values)
 * @throws NotFoundError if service doesn't exist or user doesn't own it
 */
export async function getServiceById(
  serviceId: number,
  userId: number
): Promise<Service & { credentialKeys: string[] }> {
  // Check ownership
  const [service] = await db
    .select()
    .from(services)
    .where(and(eq(services.id, serviceId), eq(services.userId, userId)));

  if (!service) {
    throw new NotFoundError('Service not found');
  }

  // Get credential keys
  const serviceCreds = await db
    .select({ key: credentials.key })
    .from(credentials)
    .where(eq(credentials.serviceId, serviceId));

  return {
    ...service,
    credentialKeys: serviceCreds.map((c) => c.key),
  };
}

/**
 * Update a service's details (not credentials)
 *
 * @param serviceId - The service ID
 * @param userId - The user ID (for ownership verification)
 * @param data - Updated service fields
 * @returns Updated service
 * @throws NotFoundError if service doesn't exist or user doesn't own it
 */
export async function updateService(
  serviceId: number,
  userId: number,
  data: z.infer<typeof updateServiceSchema>
): Promise<Service> {
  // Verify ownership first
  const [existingService] = await db
    .select()
    .from(services)
    .where(and(eq(services.id, serviceId), eq(services.userId, userId)));

  if (!existingService) {
    throw new NotFoundError('Service not found');
  }

  // Update service
  const [updatedService] = await db
    .update(services)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(services.id, serviceId))
    .returning();

  return updatedService;
}

/**
 * Delete a service (cascade deletes credentials and documentation)
 *
 * @param serviceId - The service ID
 * @param userId - The user ID (for ownership verification)
 * @returns Success indicator
 * @throws NotFoundError if service doesn't exist or user doesn't own it
 */
export async function deleteService(
  serviceId: number,
  userId: number
): Promise<{ deleted: true }> {
  // Verify ownership first
  const [existingService] = await db
    .select()
    .from(services)
    .where(and(eq(services.id, serviceId), eq(services.userId, userId)));

  if (!existingService) {
    throw new NotFoundError('Service not found');
  }

  // Delete service (cascade handles credentials and documentation)
  await db.delete(services).where(eq(services.id, serviceId));

  return { deleted: true };
}

/**
 * Upsert (replace) all credentials for a service
 * Deletes existing credentials and inserts new ones
 *
 * @param serviceId - The service ID
 * @param userId - The user ID (for ownership verification)
 * @param credentialsData - New credentials to store (replaces all existing)
 * @returns Metadata about stored credentials (no values)
 * @throws NotFoundError if service doesn't exist or user doesn't own it
 */
export async function upsertCredentials(
  serviceId: number,
  userId: number,
  credentialsData: Record<string, string>
): Promise<{ keys: string[]; count: number }> {
  // Verify service ownership
  const [existingService] = await db
    .select()
    .from(services)
    .where(and(eq(services.id, serviceId), eq(services.userId, userId)));

  if (!existingService) {
    throw new NotFoundError('Service not found');
  }

  // Replace credentials in transaction
  return await db.transaction(async (tx) => {
    // Delete all existing credentials
    await tx.delete(credentials).where(eq(credentials.serviceId, serviceId));

    // Insert new credentials (encrypted)
    const credentialEntries = Object.entries(credentialsData).map(([key, value]) => ({
      serviceId,
      key,
      encryptedValue: encrypt(value),
    }));

    await tx.insert(credentials).values(credentialEntries);

    const keys = Object.keys(credentialsData);
    return {
      keys,
      count: keys.length,
    };
  });
}
