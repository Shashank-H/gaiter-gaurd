// ServiceCard — card displaying a single service in the services list
// Vercel-style dark aesthetic with oat.ink semantic HTML

import React from 'react';
import type { ServiceType } from '@/hooks/useServices';
import { Badge } from '@/components/primitives/Badge';
import { Button } from '@/components/primitives/Button';

interface ServiceCardProps {
  service: ServiceType;
  onEdit: () => void;
  onDelete: () => void;
}

// Map authType to Badge variant
function authTypeBadgeVariant(
  authType: string
): 'info' | 'warning' | 'danger' | 'success' {
  switch (authType) {
    case 'bearer':
      return 'info';
    case 'api_key':
      return 'warning';
    case 'basic':
      return 'danger';
    case 'oauth2':
      return 'success';
    default:
      return 'info';
  }
}

// Friendly label for auth types
function authTypeLabel(authType: string): string {
  switch (authType) {
    case 'bearer':
      return 'Bearer';
    case 'api_key':
      return 'API Key';
    case 'basic':
      return 'Basic';
    case 'oauth2':
      return 'OAuth 2';
    default:
      return authType;
  }
}

export function ServiceCard({ service, onEdit, onDelete }: ServiceCardProps) {
  const createdDate = new Date(service.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return (
    <article
      className="card"
      style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
    >
      {/* Header: name + auth type badge */}
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
          {service.name}
        </h3>
        <Badge variant={authTypeBadgeVariant(service.authType)}>
          {authTypeLabel(service.authType)}
        </Badge>
      </header>

      {/* Content: base URL and created date */}
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
          {service.baseUrl}
        </p>
        <p style={{ margin: 0, fontSize: '0.75rem', color: '#555' }}>
          Added {createdDate}
        </p>
      </div>

      {/* Credentials info */}
      {service.credentials.count > 0 && (
        <p style={{ margin: 0, fontSize: '0.75rem', color: '#555' }}>
          {service.credentials.count} credential{service.credentials.count !== 1 ? 's' : ''} stored
        </p>
      )}

      {/* Footer: edit and delete actions */}
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
        <Button variant="danger" onClick={onDelete} style={{ flex: 1 }}>
          Delete
        </Button>
      </footer>
    </article>
  );
}
