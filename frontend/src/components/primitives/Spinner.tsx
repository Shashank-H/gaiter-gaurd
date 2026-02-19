import React from 'react';

export interface SpinnerProps {
  size?: 'small' | 'large';
  className?: string;
}

const spinnerStyles: Record<string, React.CSSProperties> = {
  small: { width: 16, height: 16, borderWidth: 2 },
  large: { width: 32, height: 32, borderWidth: 3 },
};

/**
 * Spinner primitive — CSS-only loading spinner.
 * Uses inline keyframe animation via a style tag injection.
 * Sizes: small (16px) and large (32px).
 */
export function Spinner({ size = 'small', className }: SpinnerProps) {
  return (
    <>
      <style>{`
        @keyframes gg-spin {
          to { transform: rotate(360deg); }
        }
        .gg-spinner {
          border-style: solid;
          border-color: #333;
          border-top-color: #0070f3;
          border-radius: 50%;
          animation: gg-spin 0.6s linear infinite;
          display: inline-block;
          flex-shrink: 0;
        }
      `}</style>
      <span
        className={['gg-spinner', className].filter(Boolean).join(' ')}
        role="status"
        aria-label="Loading"
        style={spinnerStyles[size]}
      />
    </>
  );
}
