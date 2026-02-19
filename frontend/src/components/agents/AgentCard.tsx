// AgentCard — card displaying a single agent in the agents list
// Matches approval queue card visual style with oat.ink semantic HTML

import React from 'react';
import type { AgentType } from '@/api/endpoints';
import { Badge } from '@/components/primitives/Badge';
import { Button } from '@/components/primitives/Button';

interface AgentCardProps {
  agent: AgentType;
  onEdit: () => void;
  onRevoke?: () => void;      // only for active agents
  onReactivate?: () => void;  // only for revoked agents
  onDelete?: () => void;      // only for revoked agents
}

export function AgentCard({ agent, onEdit, onRevoke, onReactivate, onDelete }: AgentCardProps) {
  const lastUsedDate = agent.lastUsedAt
    ? new Date(agent.lastUsedAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : null;

  return (
    <article
      className="card"
      style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
    >
      {/* Header: agent name + status badge */}
      <header
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '0.75rem',
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: '0.95rem',
            fontWeight: 600,
            color: '#ededed',
            wordBreak: 'break-word',
          }}
        >
          {agent.name}
        </h3>
        <Badge variant={agent.isActive ? 'success' : 'danger'}>
          {agent.isActive ? 'Active' : 'Revoked'}
        </Badge>
      </header>

      {/* Body: key prefix + last used */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <p
          style={{
            margin: 0,
            fontFamily: 'monospace',
            fontSize: '0.8rem',
            color: '#888',
            wordBreak: 'break-all',
          }}
        >
          {agent.keyPrefix}...
        </p>
        {lastUsedDate ? (
          <p style={{ margin: 0, fontSize: '0.75rem', color: '#555' }}>
            Last used {lastUsedDate}
          </p>
        ) : (
          <p style={{ margin: 0, fontSize: '0.75rem', color: '#555' }}>Never used</p>
        )}
      </div>

      {/* Service tags */}
      {agent.services.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
          {agent.services.map((s) => (
            <span
              key={s.id}
              style={{
                fontSize: '0.7rem',
                padding: '0.15em 0.5em',
                background: '#111',
                border: '1px solid #222',
                borderRadius: 4,
                color: '#888',
              }}
            >
              {s.name}
            </span>
          ))}
        </div>
      )}

      {/* Footer: action buttons */}
      <footer
        style={{
          display: 'flex',
          gap: '0.5rem',
          paddingTop: '0.5rem',
          borderTop: '1px solid #1a1a1a',
          marginTop: 'auto',
        }}
      >
        <Button variant="ghost" onClick={onEdit} style={{ flex: 1 }}>
          Edit
        </Button>
        {agent.isActive ? (
          <Button variant="danger" onClick={onRevoke} style={{ flex: 1 }}>
            Revoke
          </Button>
        ) : (
          <>
            <Button variant="ghost" onClick={onReactivate} style={{ flex: 1 }}>
              Re-activate
            </Button>
            <Button variant="danger" onClick={onDelete} style={{ flex: 1 }}>
              Delete
            </Button>
          </>
        )}
      </footer>
    </article>
  );
}
