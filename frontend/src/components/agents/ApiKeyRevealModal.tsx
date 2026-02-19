// ApiKeyRevealModal — one-time API key display modal with copy-to-clipboard
// This modal shows the full API key immediately after agent creation.
// The key is shown ONCE and cannot be retrieved later.

import React, { useState } from 'react';
import { Modal } from '@/components/primitives/Modal';
import { Button } from '@/components/primitives/Button';

export interface ApiKeyRevealModalProps {
  apiKey: string;
  agentName: string;
  open: boolean;
  onClose: () => void;
}

/**
 * ApiKeyRevealModal — displays the full API key for a newly created agent.
 * The user MUST click "I've saved the key" to dismiss.
 * Copy-to-clipboard toggles button text to "Copied!" for 2 seconds.
 */
export function ApiKeyRevealModal({ apiKey, agentName, open, onClose }: ApiKeyRevealModalProps) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    void navigator.clipboard.writeText(apiKey).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <Modal open={open} onClose={onClose} title="Save your API key">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {/* Warning text */}
        <p style={{ margin: 0, fontSize: '0.875rem', color: '#aaa', lineHeight: 1.5 }}>
          This is the only time the full API key for <strong style={{ color: '#ededed' }}>{agentName}</strong> will
          be shown. Copy it now &mdash; it cannot be retrieved later.
        </p>

        {/* Code block with copy button */}
        <div
          style={{
            position: 'relative',
            background: '#111',
            border: '1px solid #222',
            borderRadius: 6,
            padding: '0.75rem',
          }}
        >
          <code
            style={{
              display: 'block',
              wordBreak: 'break-all',
              fontFamily: 'monospace',
              fontSize: '0.8125rem',
              color: '#ededed',
              paddingRight: '4rem',
              lineHeight: 1.6,
            }}
          >
            {apiKey}
          </code>

          {/* Copy button — positioned absolute top-right */}
          <button
            type="button"
            onClick={handleCopy}
            data-variant="ghost"
            style={{
              position: 'absolute',
              top: '0.5rem',
              right: '0.5rem',
              fontSize: '0.75rem',
              padding: '0.25rem 0.5rem',
              whiteSpace: 'nowrap',
            }}
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>

        {/* Dismiss button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button type="button" variant="primary" onClick={onClose}>
            I&apos;ve saved the key
          </Button>
        </div>
      </div>
    </Modal>
  );
}
