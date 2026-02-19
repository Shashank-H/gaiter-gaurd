// Agent CRUD operations with API key management

import { z } from 'zod';
import { db } from '@/config/db';
import { agents, agentServices, services, type Agent, type InsertAgent } from '@/db/schema';
import { generateApiKey, hashApiKey } from '@/utils/apikey';
import { eq, and, inArray } from 'drizzle-orm';

// ============================================================================
// Validation Schemas
// ============================================================================

/**
 * Schema for creating a new agent
 */
export const createAgentSchema = z.object({
  name: z.string().min(3).max(100),
  serviceIds: z.array(z.number().int().positive()).min(1),
});

/**
 * Schema for updating an agent
 * All fields optional but at least one must be present
 */
export const updateAgentSchema = z.object({
  name: z.string().min(3).max(100).optional(),
  isActive: z.boolean().optional(),
}).refine(
  (obj) => Object.keys(obj).length > 0,
  { message: 'At least one field must be provided for update' }
);

/**
 * Schema for updating agent services
 */
export const updateAgentServicesSchema = z.object({
  serviceIds: z.array(z.number().int().positive()).min(1),
});

// ============================================================================
// Custom Errors
// ============================================================================

/**
 * Error thrown when an agent or service is not found or user doesn't have access
 */
export class NotFoundError extends Error {
  statusCode = 404;

  constructor(message: string = 'Resource not found') {
    super(message);
    this.name = 'NotFoundError';
  }
}

// ============================================================================
// Agent CRUD Operations
// ============================================================================

/**
 * Create a new agent with API key and service scoping
 *
 * @param userId - The ID of the user creating the agent
 * @param data - Agent data including name and service IDs
 * @returns Created agent with full API key (only returned once)
 */
export async function createAgent(
  userId: number,
  data: z.infer<typeof createAgentSchema>
): Promise<{ agent: { id: number; name: string; keyPrefix: string; isActive: boolean; createdAt: Date }; apiKey: string }> {
  // Generate API key
  const apiKey = generateApiKey();
  const keyHash = hashApiKey(apiKey);
  const keyPrefix = apiKey.substring(0, 12);

  // Verify all service IDs belong to the user
  const userServices = await db
    .select({ id: services.id })
    .from(services)
    .where(and(
      eq(services.userId, userId),
      inArray(services.id, data.serviceIds)
    ));

  if (userServices.length !== data.serviceIds.length) {
    throw new NotFoundError('One or more services not found or do not belong to this user');
  }

  // Create agent and service associations in a transaction
  return await db.transaction(async (tx) => {
    // Insert agent
    const [agent] = await tx.insert(agents).values({
      userId,
      name: data.name,
      keyHash,
      keyPrefix,
      isActive: true,
    }).returning();

    // Insert agent-service associations
    const agentServiceEntries = data.serviceIds.map(serviceId => ({
      agentId: agent.id,
      serviceId,
    }));

    await tx.insert(agentServices).values(agentServiceEntries);

    return {
      agent: {
        id: agent.id,
        name: agent.name,
        keyPrefix: agent.keyPrefix,
        isActive: agent.isActive ?? true,
        createdAt: agent.createdAt ?? new Date(),
      },
      apiKey, // Full key returned ONLY here
    };
  });
}

/**
 * Get all agents for a user
 *
 * @param userId - The ID of the user
 * @returns Array of agents with their associated services
 */
export async function getAgentsByUser(
  userId: number
): Promise<Array<{
  id: number;
  name: string;
  keyPrefix: string;
  isActive: boolean;
  lastUsedAt: Date | null;
  createdAt: Date;
  services: Array<{ id: number; name: string }>;
}>> {
  // Get all agents for this user
  const userAgents = await db
    .select()
    .from(agents)
    .where(eq(agents.userId, userId))
    .orderBy(agents.createdAt);

  // For each agent, get associated services
  const agentsWithServices = await Promise.all(
    userAgents.map(async (agent) => {
      const agentServiceRecords = await db
        .select({
          id: services.id,
          name: services.name,
        })
        .from(agentServices)
        .innerJoin(services, eq(agentServices.serviceId, services.id))
        .where(eq(agentServices.agentId, agent.id));

      return {
        id: agent.id,
        name: agent.name,
        keyPrefix: agent.keyPrefix,
        isActive: agent.isActive ?? true,
        lastUsedAt: agent.lastUsedAt,
        createdAt: agent.createdAt ?? new Date(),
        services: agentServiceRecords,
      };
    })
  );

  return agentsWithServices;
}

/**
 * Get a single agent by ID (with ownership check)
 *
 * @param agentId - The agent ID
 * @param userId - The user ID (for ownership verification)
 * @returns Agent with associated services
 * @throws NotFoundError if agent doesn't exist or user doesn't own it
 */
export async function getAgentById(
  agentId: number,
  userId: number
): Promise<{
  id: number;
  name: string;
  keyPrefix: string;
  isActive: boolean;
  lastUsedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  services: Array<{ id: number; name: string }>;
}> {
  // Check ownership
  const [agent] = await db
    .select()
    .from(agents)
    .where(and(eq(agents.id, agentId), eq(agents.userId, userId)));

  if (!agent) {
    throw new NotFoundError('Agent not found');
  }

  // Get associated services
  const agentServiceRecords = await db
    .select({
      id: services.id,
      name: services.name,
    })
    .from(agentServices)
    .innerJoin(services, eq(agentServices.serviceId, services.id))
    .where(eq(agentServices.agentId, agentId));

  return {
    id: agent.id,
    name: agent.name,
    keyPrefix: agent.keyPrefix,
    isActive: agent.isActive ?? true,
    lastUsedAt: agent.lastUsedAt,
    createdAt: agent.createdAt ?? new Date(),
    updatedAt: agent.updatedAt ?? new Date(),
    services: agentServiceRecords,
  };
}

/**
 * Update an agent's details
 *
 * @param agentId - The agent ID
 * @param userId - The user ID (for ownership verification)
 * @param data - Updated agent fields
 * @returns Updated agent
 * @throws NotFoundError if agent doesn't exist or user doesn't own it
 */
export async function updateAgent(
  agentId: number,
  userId: number,
  data: z.infer<typeof updateAgentSchema>
): Promise<Agent> {
  // Verify ownership first
  const [existingAgent] = await db
    .select()
    .from(agents)
    .where(and(eq(agents.id, agentId), eq(agents.userId, userId)));

  if (!existingAgent) {
    throw new NotFoundError('Agent not found');
  }

  // Update agent
  const [updatedAgent] = await db
    .update(agents)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(agents.id, agentId))
    .returning();

  return updatedAgent;
}

/**
 * Delete an agent (cascade deletes agent_services entries)
 *
 * @param agentId - The agent ID
 * @param userId - The user ID (for ownership verification)
 * @returns void
 * @throws NotFoundError if agent doesn't exist or user doesn't own it
 */
export async function deleteAgent(
  agentId: number,
  userId: number
): Promise<void> {
  // Verify ownership first
  const [existingAgent] = await db
    .select()
    .from(agents)
    .where(and(eq(agents.id, agentId), eq(agents.userId, userId)));

  if (!existingAgent) {
    throw new NotFoundError('Agent not found');
  }

  // Delete agent (cascade handles agent_services)
  await db.delete(agents).where(eq(agents.id, agentId));
}

/**
 * Update agent service associations
 *
 * @param agentId - The agent ID
 * @param userId - The user ID (for ownership verification)
 * @param data - New service IDs to associate
 * @returns Updated service list
 * @throws NotFoundError if agent or services don't exist or user doesn't own them
 */
export async function updateAgentServices(
  agentId: number,
  userId: number,
  data: z.infer<typeof updateAgentServicesSchema>
): Promise<Array<{ id: number; name: string }>> {
  // Verify agent ownership
  const [existingAgent] = await db
    .select()
    .from(agents)
    .where(and(eq(agents.id, agentId), eq(agents.userId, userId)));

  if (!existingAgent) {
    throw new NotFoundError('Agent not found');
  }

  // Verify all service IDs belong to the user
  const userServices = await db
    .select({ id: services.id, name: services.name })
    .from(services)
    .where(and(
      eq(services.userId, userId),
      inArray(services.id, data.serviceIds)
    ));

  if (userServices.length !== data.serviceIds.length) {
    throw new NotFoundError('One or more services not found or do not belong to this user');
  }

  // Replace service associations in a transaction
  return await db.transaction(async (tx) => {
    // Delete all existing agent_services for this agent
    await tx.delete(agentServices).where(eq(agentServices.agentId, agentId));

    // Insert new associations
    const agentServiceEntries = data.serviceIds.map(serviceId => ({
      agentId,
      serviceId,
    }));

    await tx.insert(agentServices).values(agentServiceEntries);

    return userServices;
  });
}
