import React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useApprovalQueue } from '@/hooks/useApprovalQueue';
import { useApproveAction } from '@/hooks/useApproveAction';
import { useDenyAction } from '@/hooks/useDenyAction';
import { SwipeCard } from '@/components/approval/SwipeCard';
import { ActionCard } from '@/components/approval/ActionCard';
import { QueueEmpty } from '@/components/approval/QueueEmpty';
import { Badge } from '@/components/primitives/Badge';
import { Skeleton } from '@/components/primitives/Skeleton';
import { Button } from '@/components/primitives/Button';

export const Route = createFileRoute('/_auth/queue')({
  component: QueuePage,
});

/** Detect if device supports touch (for mobile hint text) */
const isTouchDevice =
  typeof window !== 'undefined' && 'ontouchstart' in window;

function QueuePage() {
  const { data: actions, isPending, isError, refetch } = useApprovalQueue();
  const { mutate: approve, isPending: isApproving } = useApproveAction();
  const { mutate: deny, isPending: isDenying } = useDenyAction();

  return (
    <div
      style={{
        maxWidth: 600,
        margin: '0 auto',
        padding: '2rem 1rem',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {/* Page header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          marginBottom: '1.75rem',
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: '1.25rem',
            fontWeight: 600,
            color: '#ededed',
          }}
        >
          Approval Queue
        </h1>

        {actions && actions.length > 0 && (
          <Badge variant="warning">{actions.length} pending</Badge>
        )}
      </div>

      {/* Loading state — skeleton cards */}
      {isPending && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                background: '#0a0a0a',
                border: '1px solid #222',
                borderRadius: 12,
                padding: '1.25rem',
              }}
            >
              <Skeleton lines={4} />
            </div>
          ))}
        </div>
      )}

      {/* Error state */}
      {isError && (
        <div
          style={{
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 12,
            padding: '1.5rem',
            textAlign: 'center',
          }}
        >
          <p style={{ margin: '0 0 1rem', color: '#ef5350', fontSize: '0.9rem' }}>
            Failed to load pending approvals.
          </p>
          <Button variant="ghost" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      )}

      {/* Empty state */}
      {!isPending && !isError && actions && actions.length === 0 && <QueueEmpty />}

      {/* Approval cards */}
      {!isPending && !isError && actions && actions.length > 0 && (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {actions.map((action) => (
              <SwipeCard
                key={action.action_id}
                onApprove={() => approve(action.action_id)}
                onDeny={() => deny(action.action_id)}
              >
                <ActionCard
                  action={action}
                  onApprove={() => approve(action.action_id)}
                  onDeny={() => deny(action.action_id)}
                  isApproving={isApproving}
                  isDenying={isDenying}
                />
              </SwipeCard>
            ))}
          </div>

          {/* Mobile swipe hint */}
          {isTouchDevice && (
            <p
              style={{
                marginTop: '1.5rem',
                textAlign: 'center',
                color: '#444',
                fontSize: '0.8rem',
              }}
            >
              Swipe right to approve, left to deny
            </p>
          )}
        </>
      )}
    </div>
  );
}
