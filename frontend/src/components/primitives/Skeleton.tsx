import React from 'react';

export interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  lines?: number;
  className?: string;
}

/**
 * Skeleton primitive — animated placeholder for loading states.
 * Can render a single block or multiple lines via the `lines` prop.
 */
export function Skeleton({
  width = '100%',
  height = '1rem',
  lines,
  className,
}: SkeletonProps) {
  const style: React.CSSProperties = {
    width,
    height,
    borderRadius: 4,
    background: 'linear-gradient(90deg, #111 25%, #1a1a1a 50%, #111 75%)',
    backgroundSize: '200% 100%',
    animation: 'gg-skeleton-shimmer 1.5s infinite',
    display: 'block',
  };

  if (lines && lines > 1) {
    return (
      <>
        <style>{`
          @keyframes gg-skeleton-shimmer {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
          }
        `}</style>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {Array.from({ length: lines }).map((_, i) => (
            <span
              key={i}
              className={className}
              style={{
                ...style,
                width: i === lines - 1 ? '60%' : width,
              }}
            />
          ))}
        </div>
      </>
    );
  }

  return (
    <>
      <style>{`
        @keyframes gg-skeleton-shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
      <span className={className} style={style} />
    </>
  );
}
