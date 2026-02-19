import React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/endpoints';
import { Spinner } from '@/components/primitives/Spinner';
import { Skeleton } from '@/components/primitives/Skeleton';
import { Badge } from '@/components/primitives/Badge';

// Placeholder queue page — full implementation in Plan 02
export const Route = createFileRoute('/_auth/queue')({
  component: QueuePage,
});

function QueuePage() {
  const { data, isPending, isError } = useQuery({
    queryKey: ['approvals', 'pending'],
    queryFn: () => api.listPendingApprovals(),
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
    select: (data) => data.approvals,
  });

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '2rem 1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: '#ededed' }}>
          Pending Approvals
        </h1>
        {isPending && <Spinner size="small" />}
      </div>

      {isPending && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {[1, 2, 3].map((i) => (
            <div key={i} style={{ background: '#0a0a0a', border: '1px solid #222', borderRadius: 8, padding: '1.25rem' }}>
              <Skeleton lines={3} />
            </div>
          ))}
        </div>
      )}

      {isError && (
        <div style={{
          background: 'rgba(229, 57, 53, 0.1)',
          border: '1px solid rgba(229, 57, 53, 0.3)',
          borderRadius: 8,
          padding: '1rem',
          color: '#ef5350',
          textAlign: 'center',
        }}>
          Failed to load pending approvals.
        </div>
      )}

      {data && data.length === 0 && (
        <div style={{
          background: '#0a0a0a',
          border: '1px solid #222',
          borderRadius: 8,
          padding: '3rem',
          textAlign: 'center',
          color: '#555',
        }}>
          <p style={{ margin: 0, fontSize: '1rem' }}>No pending approvals</p>
          <p style={{ margin: '0.5rem 0 0', fontSize: '0.875rem' }}>Agent actions requiring review will appear here</p>
        </div>
      )}

      {data && data.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {data.map((approval) => (
            <div
              key={approval.action_id}
              style={{
                background: '#0a0a0a',
                border: '1px solid #222',
                borderRadius: 8,
                padding: '1.25rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <Badge variant={approval.risk_score > 0.7 ? 'danger' : approval.risk_score > 0.4 ? 'warning' : 'info'}>
                  risk {(approval.risk_score * 100).toFixed(0)}%
                </Badge>
                <Badge variant="info">{approval.method}</Badge>
                <span style={{ color: '#888', fontSize: '0.75rem', marginLeft: 'auto' }}>
                  {approval.agent_name}
                </span>
              </div>

              <p style={{ margin: '0 0 0.5rem', color: '#ededed', fontSize: '0.9rem' }}>
                {approval.intent}
              </p>

              <p style={{ margin: 0, color: '#555', fontSize: '0.75rem', fontFamily: 'monospace' }}>
                {approval.target_url}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
