import React, { useState } from 'react';
import type { PendingAction } from '@/hooks/useApprovalQueue';
import { Badge } from '@/components/primitives/Badge';
import { Button } from '@/components/primitives/Button';

interface ActionCardProps {
  action: PendingAction;
  onApprove: () => void;
  onDeny: () => void;
  isApproving?: boolean;
  isDenying?: boolean;
}

function riskVariant(score: number): 'danger' | 'warning' | 'info' {
  if (score >= 0.7) return 'danger';
  if (score >= 0.4) return 'warning';
  return 'info';
}

function methodVariant(method: string): 'danger' | 'warning' | 'info' {
  const upper = method.toUpperCase();
  if (upper === 'DELETE' || upper === 'PUT') return 'danger';
  if (upper === 'POST' || upper === 'PATCH') return 'warning';
  return 'info';
}

/**
 * ActionCard — the content displayed inside a SwipeCard.
 *
 * Shows: agent intent (prominent), risk score badge, HTTP method badge,
 * target URL, and an expandable section with headers, body, and risk explanation.
 * Includes approve/deny buttons as desktop fallback.
 */
export function ActionCard({ action, onApprove, onDeny, isApproving, isDenying }: ActionCardProps) {
  const [expanded, setExpanded] = useState(false);

  const headersText = Object.keys(action.request_headers).length > 0
    ? JSON.stringify(action.request_headers, null, 2)
    : '(none)';

  return (
    <article
      style={{
        background: '#0a0a0a',
        border: '1px solid #222',
        borderRadius: 12,
        overflow: 'hidden',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {/* Header: intent + risk badge */}
      <header
        style={{
          padding: '1.25rem 1.25rem 0',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.75rem',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3
            style={{
              margin: '0 0 0.75rem',
              fontSize: '1rem',
              fontWeight: 600,
              color: '#ededed',
              lineHeight: 1.4,
            }}
          >
            {action.intent}
          </h3>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <Badge variant={riskVariant(action.risk_score)}>
              risk {(action.risk_score * 100).toFixed(0)}%
            </Badge>
            <Badge variant={methodVariant(action.method)}>
              {action.method}
            </Badge>
            <span style={{ color: '#555', fontSize: '0.75rem' }}>
              {action.agent_name}
            </span>
          </div>
        </div>
      </header>

      {/* URL */}
      <div style={{ padding: '0.75rem 1.25rem' }}>
        <p
          style={{
            margin: 0,
            color: '#888',
            fontSize: '0.8rem',
            fontFamily: 'monospace',
            overflowWrap: 'break-word',
            wordBreak: 'break-all',
          }}
        >
          {action.target_url}
        </p>
      </div>

      {/* Expandable details */}
      <div style={{ padding: '0 1.25rem' }}>
        <button
          onClick={() => setExpanded((v) => !v)}
          style={{
            background: 'none',
            border: 'none',
            padding: '0.25rem 0 0.75rem',
            color: '#0070f3',
            fontSize: '0.8rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
          }}
        >
          {expanded ? '▲ Hide details' : '▼ Show details'}
        </button>

        <div
          style={{
            maxHeight: expanded ? '600px' : '0px',
            overflow: 'hidden',
            transition: 'max-height 0.25s ease',
          }}
        >
          <div style={{ paddingBottom: '1rem' }}>
            {/* Risk explanation */}
            <p style={{ margin: '0 0 0.75rem', color: '#aaa', fontSize: '0.85rem', lineHeight: 1.5 }}>
              <strong style={{ color: '#ededed' }}>Risk explanation:</strong>{' '}
              {action.risk_explanation}
            </p>

            {/* Request headers */}
            <div style={{ marginBottom: '0.75rem' }}>
              <p style={{ margin: '0 0 0.35rem', color: '#888', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Request headers
              </p>
              <pre
                style={{
                  margin: 0,
                  background: '#111',
                  border: '1px solid #1a1a1a',
                  borderRadius: 6,
                  padding: '0.75rem',
                  fontSize: '0.75rem',
                  color: '#aaa',
                  overflowX: 'auto',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                }}
              >
                {headersText}
              </pre>
            </div>

            {/* Request body */}
            {action.request_body !== null && (
              <div>
                <p style={{ margin: '0 0 0.35rem', color: '#888', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Request body
                </p>
                <pre
                  style={{
                    margin: 0,
                    background: '#111',
                    border: '1px solid #1a1a1a',
                    borderRadius: 6,
                    padding: '0.75rem',
                    fontSize: '0.75rem',
                    color: '#aaa',
                    overflowX: 'auto',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                  }}
                >
                  {action.request_body}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer: desktop approve/deny buttons */}
      <footer
        style={{
          padding: '0.75rem 1.25rem 1.25rem',
          display: 'flex',
          gap: '0.75rem',
          justifyContent: 'flex-end',
          borderTop: '1px solid #111',
        }}
      >
        <Button
          variant="danger"
          onClick={(e) => { e.stopPropagation(); onDeny(); }}
          loading={isDenying}
          disabled={isApproving || isDenying}
        >
          Deny
        </Button>
        <Button
          variant="primary"
          onClick={(e) => { e.stopPropagation(); onApprove(); }}
          loading={isApproving}
          disabled={isApproving || isDenying}
        >
          Approve
        </Button>
      </footer>
    </article>
  );
}
