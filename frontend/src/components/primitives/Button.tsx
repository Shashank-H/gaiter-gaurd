import React from 'react';
import { Spinner } from './Spinner';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'danger' | 'ghost';
  loading?: boolean;
  children: React.ReactNode;
}

/**
 * Button primitive — wraps <button> with variant and loading state support.
 * Variants: primary (blue), danger (red outline), ghost (subtle outline).
 */
export function Button({
  variant = 'primary',
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      data-variant={variant}
      disabled={disabled || loading}
      aria-busy={loading}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.5rem',
        ...props.style,
      }}
    >
      {loading && <Spinner size="small" />}
      {children}
    </button>
  );
}
