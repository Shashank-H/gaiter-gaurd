import React, { useState } from 'react';
import { createFileRoute, useNavigate, Link } from '@tanstack/react-router';
import { api } from '@/api/endpoints';

export const Route = createFileRoute('/signup')({
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      const result = await api.register(email, password);

      if (!result.error && !result.message?.toLowerCase().includes('already')) {
        // Success: no error field, or message indicates success
        await navigate({ to: '/login' });
      } else if (
        result.error?.toLowerCase().includes('already') ||
        result.message?.toLowerCase().includes('already')
      ) {
        setError('An account with this email already exists');
      } else {
        setError(result.message || result.error || 'Registration failed. Please try again.');
      }
    } catch {
      setError('Unable to connect to the server. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#000',
        padding: '1rem',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 400,
        }}
      >
        {/* Logo / Brand */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1
            style={{
              fontSize: '1.5rem',
              fontWeight: 700,
              color: '#ededed',
              margin: 0,
              letterSpacing: '-0.02em',
            }}
          >
            GaiterGuard
          </h1>
          <p style={{ color: '#888', fontSize: '0.875rem', margin: '0.5rem 0 0' }}>
            Agent proxy approval dashboard
          </p>
        </div>

        {/* Signup card */}
        <div
          style={{
            background: '#0a0a0a',
            border: '1px solid #222',
            borderRadius: 8,
            padding: '1.5rem',
          }}
        >
          <h2
            style={{
              fontSize: '1rem',
              fontWeight: 600,
              color: '#ededed',
              margin: '0 0 1.5rem',
            }}
          >
            Create account
          </h2>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label
                htmlFor="email"
                style={{
                  display: 'block',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  color: '#888',
                  marginBottom: '0.375rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoComplete="email"
                autoFocus
                style={{
                  background: '#111',
                  border: '1px solid #222',
                  borderRadius: 6,
                  color: '#ededed',
                  padding: '0.625rem 0.75rem',
                  fontSize: '0.875rem',
                  width: '100%',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div>
              <label
                htmlFor="password"
                style={{
                  display: 'block',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  color: '#888',
                  marginBottom: '0.375rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="new-password"
                style={{
                  background: '#111',
                  border: '1px solid #222',
                  borderRadius: 6,
                  color: '#ededed',
                  padding: '0.625rem 0.75rem',
                  fontSize: '0.875rem',
                  width: '100%',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                style={{
                  display: 'block',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  color: '#888',
                  marginBottom: '0.375rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Confirm password
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="new-password"
                style={{
                  background: '#111',
                  border: '1px solid #222',
                  borderRadius: 6,
                  color: '#ededed',
                  padding: '0.625rem 0.75rem',
                  fontSize: '0.875rem',
                  width: '100%',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {error && (
              <div
                role="alert"
                style={{
                  background: 'rgba(229, 57, 53, 0.1)',
                  border: '1px solid rgba(229, 57, 53, 0.3)',
                  borderRadius: 6,
                  color: '#ef5350',
                  fontSize: '0.875rem',
                  padding: '0.625rem 0.75rem',
                }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              data-variant="primary"
              style={{
                marginTop: '0.5rem',
                width: '100%',
                padding: '0.625rem',
                justifyContent: 'center',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: 500,
              }}
            >
              {loading ? (
                <>
                  <span
                    style={{
                      width: 14,
                      height: 14,
                      border: '2px solid rgba(255,255,255,0.3)',
                      borderTopColor: '#fff',
                      borderRadius: '50%',
                      display: 'inline-block',
                      animation: 'spin 0.6s linear infinite',
                    }}
                  />
                  Creating account...
                </>
              ) : (
                'Create account'
              )}
            </button>

            <Link
              to="/login"
              style={{
                fontSize: '0.875rem',
                color: '#888',
                textAlign: 'center',
                marginTop: '0.75rem',
                display: 'block',
              }}
            >
              Already have an account? Sign in
            </Link>
          </form>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input:focus {
          outline: none;
          border-color: #0070f3 !important;
          box-shadow: 0 0 0 2px rgba(0, 112, 243, 0.2);
        }
      `}</style>
    </div>
  );
}
