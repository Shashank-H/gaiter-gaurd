// Create service page — /services/new
// Renders ServiceForm for registering a new API service
// Vercel-style dark aesthetic with oat.ink semantic HTML

import React from 'react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useCreateService } from '@/hooks/useServices';
import type { ServicePayload } from '@/hooks/useServices';
import { ServiceForm } from '@/components/services/ServiceForm';

export const Route = createFileRoute('/_auth/services/new')({
  component: NewServicePage,
});

function NewServicePage() {
  const navigate = useNavigate();
  const createService = useCreateService();

  function handleSubmit(data: ServicePayload) {
    createService.mutate(data, {
      onSuccess: () => {
        void navigate({ to: '/services/' });
      },
    });
  }

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '2rem 1rem' }}>
      {/* Page header */}
      <div style={{ marginBottom: '2rem' }}>
        <Link
          to="/services/"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.375rem',
            fontSize: '0.875rem',
            color: '#555',
            marginBottom: '1rem',
          }}
        >
          &#8592; Back to Services
        </Link>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#ededed' }}>
          Register Service
        </h1>
        <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: '#555' }}>
          Add a new API service that agents can proxy requests through.
        </p>
      </div>

      {/* Error state */}
      {createService.isError && (
        <div
          style={{
            background: 'rgba(229, 57, 53, 0.1)',
            border: '1px solid rgba(229, 57, 53, 0.3)',
            borderRadius: 8,
            padding: '0.75rem 1rem',
            color: '#ef5350',
            fontSize: '0.875rem',
            marginBottom: '1.5rem',
          }}
        >
          Failed to create service. Please try again.
        </div>
      )}

      {/* Form card */}
      <article className="card">
        <ServiceForm
          onSubmit={handleSubmit}
          isSubmitting={createService.isPending}
        />
      </article>
    </div>
  );
}
