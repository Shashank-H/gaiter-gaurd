import React from 'react';

export interface BadgeProps {
  variant?: 'info' | 'warning' | 'danger' | 'success';
  children: React.ReactNode;
  className?: string;
}

/**
 * Badge primitive — colored label for risk scores, HTTP methods, status indicators.
 * Uses oat.ink badge class with data-variant for color theming.
 */
export function Badge({ variant = 'info', children, className }: BadgeProps) {
  return (
    <span
      className={['badge', className].filter(Boolean).join(' ')}
      data-variant={variant}
    >
      {children}
    </span>
  );
}
