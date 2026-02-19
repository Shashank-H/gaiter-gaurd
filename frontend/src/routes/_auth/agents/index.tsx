// Agents list page — /agents/
// Displays all registered agents in a responsive grid with active/revoked sections
// Vercel-style dark aesthetic with oat.ink semantic HTML

import React, { useState } from 'react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useAgents, useRevokeAgent, useReactivateAgent, useDeleteAgent } from '@/hooks/useAgents';
import type { AgentType } from '@/hooks/useAgents';
import { AgentCard } from '@/components/agents/AgentCard';
import { Skeleton } from '@/components/primitives/Skeleton';
import { Button } from '@/components/primitives/Button';
import { Modal } from '@/components/primitives/Modal';

export const Route = createFileRoute('/_auth/agents/')({
  component: AgentsPage,
});

function AgentsPage() {
  const { data: agents, isPending, isError } = useAgents();
  const revokeAgent = useRevokeAgent();
  const reactivateAgent = useReactivateAgent();
  const deleteAgent = useDeleteAgent();
  const navigate = useNavigate();

  const [agentToRevoke, setAgentToRevoke] = useState<AgentType | null>(null);
  const [agentToDelete, setAgentToDelete] = useState<AgentType | null>(null);

  const activeAgents = agents?.filter((a) => a.isActive) ?? [];
  const revokedAgents = agents?.filter((a) => !a.isActive) ?? [];

  function handleEdit(agent: AgentType) {
    // Route /agents/$id/edit is created in Plan 02 — cast to satisfy TS until routeTree regenerates
    void navigate({ to: `/agents/${String(agent.id)}/edit` as never });
  }

  function handleRevokeConfirm() {
    if (!agentToRevoke) return;
    revokeAgent.mutate(agentToRevoke.id, {
      onSuccess: () => setAgentToRevoke(null),
      onError: () => setAgentToRevoke(null),
    });
  }

  function handleDeleteConfirm() {
    if (!agentToDelete) return;
    deleteAgent.mutate(agentToDelete.id, {
      onSuccess: () => setAgentToDelete(null),
      onError: () => setAgentToDelete(null),
    });
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '2rem 1rem' }}>
      {/* Page header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '2rem',
          gap: '1rem',
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#ededed' }}>
            Agents
          </h1>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: '#555' }}>
            Manage your API agents and their service access
          </p>
        </div>
        {/* Route /agents/new is created in Plan 02 — cast to satisfy TS until routeTree regenerates */}
        <Link to={'/agents/new' as never}>
          <Button variant="primary">Create Agent</Button>
        </Link>
      </div>

      {/* Loading state: skeleton grid */}
      {isPending && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: '1rem',
          }}
        >
          {[1, 2, 3].map((i) => (
            <article
              key={i}
              className="card"
              style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
            >
              <Skeleton height="1.25rem" width="60%" />
              <Skeleton height="0.875rem" />
              <Skeleton height="0.875rem" width="40%" />
            </article>
          ))}
        </div>
      )}

      {/* Error state */}
      {isError && (
        <div
          style={{
            background: 'rgba(229, 57, 53, 0.1)',
            border: '1px solid rgba(229, 57, 53, 0.3)',
            borderRadius: 8,
            padding: '1rem',
            color: '#ef5350',
            textAlign: 'center',
          }}
        >
          Failed to load agents. Please refresh the page.
        </div>
      )}

      {/* Empty state: no agents at all */}
      {!isPending && !isError && agents && agents.length === 0 && (
        <div
          style={{
            background: '#0a0a0a',
            border: '1px solid #222',
            borderRadius: 12,
            padding: '4rem 2rem',
            textAlign: 'center',
          }}
        >
          <p
            style={{
              margin: '0 0 0.5rem',
              fontSize: '1.125rem',
              fontWeight: 600,
              color: '#ededed',
            }}
          >
            No agents yet
          </p>
          <p style={{ margin: '0 0 1.5rem', fontSize: '0.875rem', color: '#555' }}>
            Create an API agent to let your applications access services securely.
          </p>
          <Link to={'/agents/new' as never}>
            <Button variant="primary">Create your first agent</Button>
          </Link>
        </div>
      )}

      {/* Active agents section */}
      {!isPending && !isError && activeAgents.length > 0 && (
        <div style={{ marginBottom: revokedAgents.length > 0 ? '2rem' : 0 }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: '1rem',
            }}
          >
            {activeAgents.map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                onEdit={() => handleEdit(agent)}
                onRevoke={() => setAgentToRevoke(agent)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Revoked agents section — collapsed by default via <details> */}
      {!isPending && !isError && revokedAgents.length > 0 && (
        <details style={{ marginTop: activeAgents.length > 0 ? '2rem' : 0 }}>
          <summary
            style={{
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: 500,
              color: '#555',
              padding: '0.5rem 0',
              userSelect: 'none',
              listStyle: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <span
              style={{
                display: 'inline-block',
                width: 0,
                height: 0,
                borderTop: '4px solid transparent',
                borderBottom: '4px solid transparent',
                borderLeft: '6px solid #555',
                transition: 'transform 0.2s ease',
              }}
            />
            Revoked Agents ({revokedAgents.length})
          </summary>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: '1rem',
              marginTop: '1rem',
            }}
          >
            {revokedAgents.map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                onEdit={() => handleEdit(agent)}
                onReactivate={() => reactivateAgent.mutate(agent.id)}
                onDelete={() => setAgentToDelete(agent)}
              />
            ))}
          </div>
        </details>
      )}

      {/* Revoke confirmation modal */}
      <Modal
        open={agentToRevoke !== null}
        onClose={() => setAgentToRevoke(null)}
        title="Revoke Agent Access"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <p style={{ margin: 0, fontSize: '0.875rem', color: '#888', lineHeight: 1.6 }}>
            Revoke access for{' '}
            <strong style={{ color: '#ededed' }}>{agentToRevoke?.name}</strong>? The agent's API
            key will stop working immediately. You can re-activate later.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <Button
              variant="ghost"
              onClick={() => setAgentToRevoke(null)}
              disabled={revokeAgent.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleRevokeConfirm}
              loading={revokeAgent.isPending}
              disabled={revokeAgent.isPending}
            >
              {revokeAgent.isPending ? 'Revoking...' : 'Revoke'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete confirmation modal */}
      <Modal
        open={agentToDelete !== null}
        onClose={() => setAgentToDelete(null)}
        title="Delete Agent"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <p style={{ margin: 0, fontSize: '0.875rem', color: '#888', lineHeight: 1.6 }}>
            Permanently delete{' '}
            <strong style={{ color: '#ededed' }}>{agentToDelete?.name}</strong>? This cannot be
            undone.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <Button
              variant="ghost"
              onClick={() => setAgentToDelete(null)}
              disabled={deleteAgent.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleDeleteConfirm}
              loading={deleteAgent.isPending}
              disabled={deleteAgent.isPending}
            >
              {deleteAgent.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
