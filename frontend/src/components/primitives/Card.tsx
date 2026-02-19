import React, { useState } from 'react';

export interface CardProps {
  header?: React.ReactNode;
  footer?: React.ReactNode;
  expandable?: boolean;
  expandedContent?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Card primitive — wraps <article class="card"> with optional header, footer, and expandable state.
 * Uses oat.ink semantic card styling with Vercel dark theme overrides.
 */
export function Card({
  header,
  footer,
  expandable = false,
  expandedContent,
  children,
  className,
  style,
}: CardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <article
      className={['card', className].filter(Boolean).join(' ')}
      style={style}
    >
      {header && (
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
          {header}
          {expandable && (
            <button
              data-variant="ghost"
              onClick={() => setExpanded((prev) => !prev)}
              aria-expanded={expanded}
              style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
            >
              {expanded ? 'Collapse' : 'Expand'}
            </button>
          )}
        </header>
      )}

      <div>{children}</div>

      {expandable && expanded && expandedContent && (
        <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #222' }}>
          {expandedContent}
        </div>
      )}

      {footer && (
        <footer style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #222' }}>
          {footer}
        </footer>
      )}
    </article>
  );
}
