import React from 'react';
import { createFileRoute, redirect, Outlet } from '@tanstack/react-router';
import { getStoredToken } from '@/lib/api-client';

/**
 * Auth guard layout route.
 * All child routes (/_auth/...) are protected — unauthenticated users are redirected to /login.
 * Child routes inherit this protection automatically via TanStack Router's beforeLoad cascade.
 */
export const Route = createFileRoute('/_auth')({
  beforeLoad: async () => {
    const token = getStoredToken();
    if (!token) {
      throw redirect({
        to: '/login',
        search: {
          redirect: typeof window !== 'undefined' ? window.location.pathname : '/',
        },
      });
    }
    return { token };
  },
  component: () => <Outlet />,
});
