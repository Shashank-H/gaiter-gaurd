// Edit service page — /services/:id/edit
// Renders ServiceForm pre-populated with existing service data
// Also renders CredentialForm below for managing credentials
// Vercel-style dark aesthetic with oat.ink semantic HTML

import React from 'react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/endpoints';
import { useUpdateService } from '@/hooks/useServices';
import type { ServiceType, ServicePayload } from '@/hooks/useServices';
import { ServiceForm } from '@/components/services/ServiceForm';
import { CredentialForm } from '@/components/services/CredentialForm';
import { Skeleton } from '@/components/primitives/Skeleton';

export const Route = createFileRoute('/_auth/services/$id/edit')({
  component: EditServicePage,
});

function EditServicePage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const updateService = useUpdateService();

  // Load service data — filter from cached list or fetch individually
  const { data: service, isPending, isError } = useQuery({
    queryKey: ['services', id],
    queryFn: async (): Promise<ServiceType> => {
      const result = await api.listServices() as ServiceType[] | { services: ServiceType[] };
      const list: ServiceType[] = Array.isArray(result) ? result : result.services ?? [];
      const found = list.find((s) => s.id === parseInt(id, 10));
      if (!found) throw new Error('Service not found');
      return found;
    },
    staleTime: 30_000,
  });

  function handleSubmit(data: ServicePayload) {
    const serviceId = parseInt(id, 10);
    updateService.mutate(
      { id: serviceId, data },
      {
        onSuccess: () => {
          void navigate({ to: '/services/' });
        },
      }
    );
  }

  if (isPending) {
    return (
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '2rem 1rem' }}>
        <div style={{ marginBottom: '2rem' }}>
          <Skeleton height="0.875rem" width={120} />
          <div style={{ marginTop: '1rem' }}>
            <Skeleton height="2rem" width="60%" />
          </div>
        </div>
        <article className="card">
          <Skeleton lines={4} />
        </article>
      </div>
    );
  }

  if (isError || !service) {
    return (
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '2rem 1rem' }}>
        <Link to="/services/" style={{ fontSize: '0.875rem', color: '#555' }}>
          &#8592; Back to Services
        </Link>
        <div
          style={{
            background: 'rgba(229, 57, 53, 0.1)',
            border: '1px solid rgba(229, 57, 53, 0.3)',
            borderRadius: 8,
            padding: '1rem',
            color: '#ef5350',
            marginTop: '1.5rem',
          }}
        >
          Service not found or failed to load.
        </div>
      </div>
    );
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
          Edit {service.name}
        </h1>
        <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: '#555' }}>
          Update service details or manage credentials.
        </p>
      </div>

      {/* Update error */}
      {updateService.isError && (
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
          Failed to update service. Please try again.
        </div>
      )}

      {/* Service details form */}
      <section style={{ marginBottom: '2rem' }}>
        <h2
          style={{
            margin: '0 0 1rem',
            fontSize: '1rem',
            fontWeight: 600,
            color: '#ededed',
          }}
        >
          Service Details
        </h2>
        <article className="card">
          <ServiceForm
            defaultValues={service}
            onSubmit={handleSubmit}
            isSubmitting={updateService.isPending}
          />
        </article>
      </section>

      {/* Visual separator */}
      <hr
        style={{
          border: 'none',
          borderTop: '1px solid #222',
          margin: '2rem 0',
        }}
      />

      {/* Credential management */}
      <section>
        <h2
          style={{
            margin: '0 0 0.5rem',
            fontSize: '1rem',
            fontWeight: 600,
            color: '#ededed',
          }}
        >
          Credentials
        </h2>
        <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: '#555' }}>
          Update the credentials used to authenticate requests to {service.name}.
          {service.credentials.count > 0 && (
            <span>
              {' '}Currently {service.credentials.count} credential{service.credentials.count !== 1 ? 's' : ''} stored.
            </span>
          )}
        </p>
        <article className="card">
          <CredentialForm serviceId={service.id} authType={service.authType} />
        </article>
      </section>
    </div>
  );
}
