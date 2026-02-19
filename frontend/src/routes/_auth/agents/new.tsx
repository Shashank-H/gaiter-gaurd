// Create agent page — /agents/new
// Renders AgentForm, shows ApiKeyRevealModal on success, navigates to list on dismiss
// API key is stored only in local state and NEVER cached in TanStack Query

import React, { useState } from 'react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useCreateAgent } from '@/hooks/useAgents';
import { AgentForm } from '@/components/agents/AgentForm';
import { ApiKeyRevealModal } from '@/components/agents/ApiKeyRevealModal';

export const Route = createFileRoute('/_auth/agents/new')({
  component: NewAgentPage,
});

function NewAgentPage() {
  const navigate = useNavigate();
  const createAgent = useCreateAgent();

  // API key stored ONLY in local state — never in query cache
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [agentNameForModal, setAgentNameForModal] = useState('');

  function handleSubmit(data: { name: string; serviceIds: number[] }) {
    setAgentNameForModal(data.name);
    createAgent.mutate(data, {
      onSuccess: (result) => {
        // Store the API key locally for the modal — do NOT put in query cache
        if (result && 'apiKey' in result && typeof result.apiKey === 'string') {
          setRevealedKey(result.apiKey);
        }
      },
    });
  }

  function handleKeyModalClose() {
    setRevealedKey(null);
    void navigate({ to: '/agents' as never });
  }

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '2rem 1rem' }}>
      {/* Page header */}
      <div style={{ marginBottom: '2rem' }}>
        <Link
          to={'/agents' as never}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.375rem',
            fontSize: '0.875rem',
            color: '#555',
            marginBottom: '1rem',
          }}
        >
          &#8592; Back to Agents
        </Link>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#ededed' }}>
          Create Agent
        </h1>
        <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: '#555' }}>
          Create a new agent and assign the services it can access.
        </p>
      </div>

      {/* Error state */}
      {createAgent.isError && (
        <div
          style={{
            background: 'rgba(229, 57, 53, 0.1)',
            border: '1px solid rgba(229, 57, 53, 0.3)',
            borderRadius: 8,
            padding: '0.75rem 1rem',
            color: '#ef5350',
            fontSize: '0.875rem',
            marginBottom: '1.5rem',
          }}
        >
          Failed to create agent. Please try again.
        </div>
      )}

      {/* Agent form */}
      <AgentForm
        onSubmit={handleSubmit}
        isSubmitting={createAgent.isPending}
        submitLabel="Create Agent"
      />

      {/* API key reveal modal — shown once after successful creation */}
      {revealedKey !== null && (
        <ApiKeyRevealModal
          open={true}
          apiKey={revealedKey}
          agentName={agentNameForModal}
          onClose={handleKeyModalClose}
        />
      )}
    </div>
  );
}
