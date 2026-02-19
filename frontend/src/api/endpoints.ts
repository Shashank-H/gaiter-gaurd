// Centralized backend API URLs and fetch helpers
// Single source of truth for all backend communication

import { getStoredToken, clearStoredToken } from '@/lib/api-client';

// VITE_BACKEND_URL is set via .env file (e.g., VITE_BACKEND_URL=https://api.example.com)
// Falls back to localhost:3000 for local development
export const BACKEND_BASE: string =
  (import.meta.env as Record<string, string | undefined>).VITE_BACKEND_URL ??
  'http://localhost:3000';

/**
 * Authenticated fetch helper — adds Authorization: Bearer header, handles 401
 */
async function authedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = getStoredToken();

  const res = await fetch(`${BACKEND_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers as Record<string, string> | undefined),
    },
  });

  if (res.status === 401) {
    // Token expired — clear and redirect to login
    clearStoredToken();
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  }

  return res;
}

export const api = {
  // Auth — no token needed
  login: async (email: string, password: string) => {
    const res = await fetch(`${BACKEND_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    return res.json();
  },

  // Approvals (dashboard-facing)
  listPendingApprovals: async () => {
    const res = await authedFetch('/approvals/pending');
    return res.json() as Promise<{ approvals: PendingApproval[] }>;
  },

  approveAction: async (actionId: string) => {
    const res = await authedFetch(`/approvals/${actionId}/approve`, { method: 'PATCH' });
    return res.json();
  },

  denyAction: async (actionId: string) => {
    const res = await authedFetch(`/approvals/${actionId}/deny`, { method: 'PATCH' });
    return res.json();
  },

  // Services
  listServices: async () => {
    const res = await authedFetch('/services');
    return res.json();
  },

  createService: async (data: unknown) => {
    const res = await authedFetch('/services', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return res.json();
  },

  updateService: async (id: number, data: unknown) => {
    const res = await authedFetch(`/services/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return res.json();
  },

  deleteService: async (id: number) => {
    return authedFetch(`/services/${id}`, { method: 'DELETE' });
  },

  upsertCredentials: async (id: number, data: unknown) => {
    const res = await authedFetch(`/services/${id}/credentials`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return res.json();
  },

  // Agents
  listAgents: async (): Promise<AgentType[]> => {
    const res = await authedFetch('/agents');
    return res.json();
  },

  createAgent: async (data: { name: string; serviceIds: number[] }) => {
    const res = await authedFetch('/agents', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return res.json() as Promise<{ agent: AgentType; apiKey: string }>;
  },

  getAgent: async (id: number): Promise<AgentType> => {
    const res = await authedFetch(`/agents/${id}`);
    return res.json();
  },

  updateAgent: async (id: number, data: { name?: string; isActive?: boolean }): Promise<AgentType> => {
    const res = await authedFetch(`/agents/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return res.json();
  },

  deleteAgent: async (id: number) => {
    return authedFetch(`/agents/${id}`, { method: 'DELETE' });
  },

  updateAgentServices: async (id: number, serviceIds: number[]): Promise<{ message: string; services: Array<{ id: number; name: string }> }> => {
    const res = await authedFetch(`/agents/${id}/services`, {
      method: 'PUT',
      body: JSON.stringify({ serviceIds }),
    });
    return res.json();
  },
};

// Agent type matching backend response
export interface AgentType {
  id: number;
  name: string;
  keyPrefix: string;
  isActive: boolean;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt?: string;
  services: Array<{ id: number; name: string }>;
}

// Type for pending approval entries from the dashboard API
export interface PendingApproval {
  action_id: string;
  agent_name: string;
  service_id: number;
  method: string;
  target_url: string;
  intent: string;
  risk_score: number;
  risk_explanation: string;
  request_headers: Record<string, string>;
  request_body: string | null;
  created_at: string;
}
