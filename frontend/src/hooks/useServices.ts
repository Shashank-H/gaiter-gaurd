// TanStack Query hooks for services CRUD
// Provides useServices, useCreateService, useUpdateService, useDeleteService, useUpsertCredentials

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/endpoints';

// Service type matching backend response (credentials shown as metadata, not values)
export interface ServiceType {
  id: number;
  name: string;
  baseUrl: string;
  authType: string;
  userId: number;
  createdAt: string;
  updatedAt: string;
  credentials: {
    keys: string[];
    count: number;
  };
}

// Payload for creating or updating a service
export interface ServicePayload {
  name: string;
  baseUrl: string;
  authType: string;
}

// Credential pair for upsert
export interface CredentialPair {
  key: string;
  value: string;
}

const SERVICES_QUERY_KEY = ['services'] as const;

/**
 * useServices — list all services for the authenticated user.
 * queryKey: ['services']
 */
export function useServices() {
  return useQuery({
    queryKey: SERVICES_QUERY_KEY,
    queryFn: () => api.listServices() as Promise<{ services?: ServiceType[]; success?: boolean } | ServiceType[]>,
    select: (data): ServiceType[] => {
      // Backend returns array directly (formatServiceResponse returns array)
      if (Array.isArray(data)) return data;
      // Or wrapped in { services: [...] } shape
      if (data && 'services' in data && Array.isArray(data.services)) return data.services;
      return [];
    },
  });
}

/**
 * useCreateService — create a new service.
 * Invalidates ['services'] on success.
 */
export function useCreateService() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ServicePayload) => api.createService(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SERVICES_QUERY_KEY });
    },
  });
}

/**
 * useUpdateService — update an existing service by ID.
 * Invalidates ['services'] on success.
 */
export function useUpdateService() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<ServicePayload> }) =>
      api.updateService(id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SERVICES_QUERY_KEY });
    },
  });
}

/**
 * useDeleteService — delete a service by ID.
 * Optimistically removes the service from the cache, invalidates on error.
 */
export function useDeleteService() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => api.deleteService(id),
    onMutate: async (id: number) => {
      // Cancel any in-flight refetches
      await queryClient.cancelQueries({ queryKey: SERVICES_QUERY_KEY });

      // Snapshot previous value for rollback
      const previousServices = queryClient.getQueryData<ServiceType[]>(SERVICES_QUERY_KEY);

      // Optimistically remove the service from cache
      queryClient.setQueryData<ServiceType[]>(SERVICES_QUERY_KEY, (old) =>
        old ? old.filter((s) => s.id !== id) : []
      );

      return { previousServices };
    },
    onError: (_err, _id, context) => {
      // Rollback on error
      if (context?.previousServices) {
        queryClient.setQueryData(SERVICES_QUERY_KEY, context.previousServices);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: SERVICES_QUERY_KEY });
    },
  });
}

/**
 * useUpsertCredentials — replace all credentials for a service.
 * Accepts Record<string, string> matching backend credentialsSchema.
 * Invalidates ['services'] on success.
 */
export function useUpsertCredentials() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ serviceId, credentials }: { serviceId: number; credentials: Record<string, string> }) =>
      api.upsertCredentials(serviceId, credentials),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SERVICES_QUERY_KEY });
    },
  });
}
