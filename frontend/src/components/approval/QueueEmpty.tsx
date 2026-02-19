import React from 'react';

/**
 * QueueEmpty — friendly empty state for the approval queue.
 * Shown when there are no pending actions awaiting approval.
 */
export function QueueEmpty() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '4rem 2rem',
        textAlign: 'center',
      }}
    >
      {/* Checkmark icon */}
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: '50%',
          background: 'rgba(34, 197, 94, 0.1)',
          border: '2px solid rgba(34, 197, 94, 0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '1.5rem',
          fontSize: '1.75rem',
        }}
        aria-hidden="true"
      >
        &#10003;
      </div>

      <h2
        style={{
          margin: '0 0 0.5rem',
          fontSize: '1.125rem',
          fontWeight: 600,
          color: '#ededed',
        }}
      >
        All clear
      </h2>

      <p
        style={{
          margin: 0,
          fontSize: '0.9rem',
          color: '#555',
          maxWidth: 260,
          lineHeight: 1.5,
        }}
      >
        No pending actions. Agent requests requiring review will appear here.
      </p>
    </div>
  );
}
