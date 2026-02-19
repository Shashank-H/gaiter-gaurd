import React from 'react';
import { createFileRoute, redirect, Outlet, Link, useLocation } from '@tanstack/react-router';
import { getStoredToken, clearStoredToken } from '@/lib/api-client';

/**
 * Auth guard layout route.
 * All child routes (/_auth/...) are protected — unauthenticated users are redirected to /login.
 * Child routes inherit this protection automatically via TanStack Router's beforeLoad cascade.
 *
 * Provides: navigation bar with Queue and Services links, and a logout button.
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
  component: AuthLayout,
});

function AuthLayout() {
  const location = useLocation();

  function handleLogout() {
    clearStoredToken();
    window.location.href = '/login';
  }

  function isActive(prefix: string): boolean {
    // Normalize: /services/ and /services both mean the services section
    const normalizedPath = location.pathname.endsWith('/') ? location.pathname : location.pathname + '/';
    const normalizedPrefix = prefix.endsWith('/') ? prefix : prefix + '/';
    return normalizedPath.startsWith(normalizedPrefix);
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#000' }}>
      {/* Navigation bar */}
      <nav
        style={{
          borderBottom: '1px solid #222',
          background: '#000',
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
      >
        <div
          style={{
            maxWidth: 1200,
            margin: '0 auto',
            padding: '0 1rem',
            display: 'flex',
            alignItems: 'center',
            height: 56,
            gap: '1.5rem',
          }}
        >
          {/* Brand */}
          <span
            style={{
              fontWeight: 700,
              fontSize: '0.9375rem',
              color: '#ededed',
              letterSpacing: '-0.01em',
              marginRight: '0.5rem',
            }}
          >
            GaiterGuard
          </span>

          {/* Nav links */}
          <menu
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              margin: 0,
              padding: 0,
              listStyle: 'none',
              flex: 1,
            }}
          >
            <li>
              <Link
                to="/queue"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '0.375rem 0.75rem',
                  borderRadius: 6,
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  textDecoration: 'none',
                  color: isActive('/queue') ? '#ededed' : '#555',
                  background: isActive('/queue') ? '#111' : 'transparent',
                  border: isActive('/queue') ? '1px solid #222' : '1px solid transparent',
                  transition: 'color 0.15s ease, background 0.15s ease, border-color 0.15s ease',
                }}
              >
                Queue
              </Link>
            </li>
            <li>
              <Link
                to="/services/"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '0.375rem 0.75rem',
                  borderRadius: 6,
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  textDecoration: 'none',
                  color: isActive('/services') ? '#ededed' : '#555',
                  background: isActive('/services') ? '#111' : 'transparent',
                  border: isActive('/services') ? '1px solid #222' : '1px solid transparent',
                  transition: 'color 0.15s ease, background 0.15s ease, border-color 0.15s ease',
                }}
              >
                Services
              </Link>
            </li>
          </menu>

          {/* Logout button */}
          <button
            data-variant="ghost"
            onClick={handleLogout}
            style={{ padding: '0.375rem 0.75rem', fontSize: '0.875rem' }}
          >
            Log out
          </button>
        </div>
      </nav>

      {/* Page content */}
      <main style={{ flex: 1 }}>
        <Outlet />
      </main>
    </div>
  );
}
