// TanStack Query hooks for agents CRUD
// Provides useAgents, useAgent, useCreateAgent, useUpdateAgent, useRevokeAgent,
// useReactivateAgent, useDeleteAgent, useUpdateAgentServices

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/endpoints';
import type { AgentType } from '@/api/endpoints';

export type { AgentType };

const AGENTS_QUERY_KEY = ['agents'] as const;

/**
 * useAgents — list all agents for the authenticated user.
 * queryKey: ['agents']
 */
export function useAgents() {
  return useQuery({
    queryKey: AGENTS_QUERY_KEY,
    queryFn: () => api.listAgents() as Promise<AgentType[] | { agents?: AgentType[] }>,
    select: (data): AgentType[] => {
      if (Array.isArray(data)) return data;
      if (data && 'agents' in data && Array.isArray(data.agents)) return data.agents;
      return [];
    },
  });
}

/**
 * useAgent — fetch a single agent by ID.
 * queryKey: ['agents', id]
 * Only enabled when id > 0.
 */
export function useAgent(id: number) {
  return useQuery({
    queryKey: [...AGENTS_QUERY_KEY, id] as const,
    queryFn: () => api.getAgent(id),
    enabled: id > 0,
  });
}

/**
 * useCreateAgent — create a new agent.
 * Returns { agent: AgentType, apiKey: string } — apiKey shown only once.
 * Invalidates ['agents'] on settled.
 */
export function useCreateAgent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { name: string; serviceIds: number[] }) => api.createAgent(data),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: AGENTS_QUERY_KEY });
    },
  });
}

/**
 * useUpdateAgent — update an existing agent by ID (name and/or isActive).
 * Optimistically updates name/isActive in cache; invalidates on settled.
 */
export function useUpdateAgent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: { name?: string; isActive?: boolean } }) =>
      api.updateAgent(id, data),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: AGENTS_QUERY_KEY });
      const previousAgents = queryClient.getQueryData<AgentType[]>(AGENTS_QUERY_KEY);

      queryClient.setQueryData<AgentType[]>(AGENTS_QUERY_KEY, (old) =>
        old
          ? old.map((a) =>
              a.id === id
                ? {
                    ...a,
                    ...(data.name !== undefined ? { name: data.name } : {}),
                    ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
                  }
                : a
            )
          : []
      );

      return { previousAgents };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousAgents) {
        queryClient.setQueryData(AGENTS_QUERY_KEY, context.previousAgents);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: AGENTS_QUERY_KEY });
    },
  });
}

/**
 * useRevokeAgent — soft-revoke an agent (sets isActive = false).
 * Optimistically updates isActive in list cache; reverts on error.
 */
export function useRevokeAgent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => api.updateAgent(id, { isActive: false }),
    onMutate: async (id: number) => {
      await queryClient.cancelQueries({ queryKey: AGENTS_QUERY_KEY });
      const previousAgents = queryClient.getQueryData<AgentType[]>(AGENTS_QUERY_KEY);

      queryClient.setQueryData<AgentType[]>(AGENTS_QUERY_KEY, (old) =>
        old ? old.map((a) => (a.id === id ? { ...a, isActive: false } : a)) : []
      );

      return { previousAgents };
    },
    onError: (_err, _id, context) => {
      if (context?.previousAgents) {
        queryClient.setQueryData(AGENTS_QUERY_KEY, context.previousAgents);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: AGENTS_QUERY_KEY });
    },
  });
}

/**
 * useReactivateAgent — re-activate a revoked agent (sets isActive = true).
 * Optimistically updates isActive in list cache; reverts on error.
 */
export function useReactivateAgent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => api.updateAgent(id, { isActive: true }),
    onMutate: async (id: number) => {
      await queryClient.cancelQueries({ queryKey: AGENTS_QUERY_KEY });
      const previousAgents = queryClient.getQueryData<AgentType[]>(AGENTS_QUERY_KEY);

      queryClient.setQueryData<AgentType[]>(AGENTS_QUERY_KEY, (old) =>
        old ? old.map((a) => (a.id === id ? { ...a, isActive: true } : a)) : []
      );

      return { previousAgents };
    },
    onError: (_err, _id, context) => {
      if (context?.previousAgents) {
        queryClient.setQueryData(AGENTS_QUERY_KEY, context.previousAgents);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: AGENTS_QUERY_KEY });
    },
  });
}

/**
 * useDeleteAgent — hard-delete an agent by ID.
 * Optimistically removes from cache; reverts on error. Follows useDeleteService pattern.
 */
export function useDeleteAgent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => api.deleteAgent(id),
    onMutate: async (id: number) => {
      await queryClient.cancelQueries({ queryKey: AGENTS_QUERY_KEY });
      const previousAgents = queryClient.getQueryData<AgentType[]>(AGENTS_QUERY_KEY);

      queryClient.setQueryData<AgentType[]>(AGENTS_QUERY_KEY, (old) =>
        old ? old.filter((a) => a.id !== id) : []
      );

      return { previousAgents };
    },
    onError: (_err, _id, context) => {
      if (context?.previousAgents) {
        queryClient.setQueryData(AGENTS_QUERY_KEY, context.previousAgents);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: AGENTS_QUERY_KEY });
    },
  });
}

/**
 * useUpdateAgentServices — replace the service scope for an agent.
 * Invalidates ['agents'] and ['agents', id] on settled.
 */
export function useUpdateAgentServices() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, serviceIds }: { id: number; serviceIds: number[] }) =>
      api.updateAgentServices(id, serviceIds),
    onSettled: (_data, _error, { id }) => {
      void queryClient.invalidateQueries({ queryKey: AGENTS_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: [...AGENTS_QUERY_KEY, id] });
    },
  });
}
