// Services list page — /services
// Displays all registered services in a responsive grid
// Vercel-style dark aesthetic with oat.ink semantic HTML

import React, { useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useServices, useDeleteService } from '@/hooks/useServices';
import type { ServiceType } from '@/hooks/useServices';
import { ServiceCard } from '@/components/services/ServiceCard';
import { Skeleton } from '@/components/primitives/Skeleton';
import { Button } from '@/components/primitives/Button';
import { Modal } from '@/components/primitives/Modal';
import { useNavigate } from '@tanstack/react-router';

export const Route = createFileRoute('/_auth/services/')({
  component: ServicesPage,
});

function ServicesPage() {
  const { data: services, isPending, isError } = useServices();
  const deleteService = useDeleteService();
  const navigate = useNavigate();

  const [serviceToDelete, setServiceToDelete] = useState<ServiceType | null>(null);

  function handleEdit(service: ServiceType) {
    void navigate({ to: '/services/$id/edit', params: { id: String(service.id) } });
  }

  function handleDeleteConfirm() {
    if (!serviceToDelete) return;
    deleteService.mutate(serviceToDelete.id, {
      onSuccess: () => setServiceToDelete(null),
      onError: () => setServiceToDelete(null),
    });
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '2rem 1rem' }}>
      {/* Page header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '2rem',
          gap: '1rem',
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#ededed' }}>
            Services
          </h1>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: '#555' }}>
            Manage your registered API services and credentials
          </p>
        </div>
        <Link to="/services/new">
          <Button variant="primary">Add Service</Button>
        </Link>
      </div>

      {/* Loading state: skeleton grid */}
      {isPending && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: '1rem',
          }}
        >
          {[1, 2, 3].map((i) => (
            <article
              key={i}
              className="card"
              style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
            >
              <Skeleton height="1.25rem" width="60%" />
              <Skeleton height="0.875rem" />
              <Skeleton height="0.875rem" width="40%" />
            </article>
          ))}
        </div>
      )}

      {/* Error state */}
      {isError && (
        <div
          style={{
            background: 'rgba(229, 57, 53, 0.1)',
            border: '1px solid rgba(229, 57, 53, 0.3)',
            borderRadius: 8,
            padding: '1rem',
            color: '#ef5350',
            textAlign: 'center',
          }}
        >
          Failed to load services. Please refresh the page.
        </div>
      )}

      {/* Empty state */}
      {!isPending && !isError && services && services.length === 0 && (
        <div
          style={{
            background: '#0a0a0a',
            border: '1px solid #222',
            borderRadius: 12,
            padding: '4rem 2rem',
            textAlign: 'center',
          }}
        >
          <p
            style={{
              margin: '0 0 0.5rem',
              fontSize: '1.125rem',
              fontWeight: 600,
              color: '#ededed',
            }}
          >
            No services registered yet
          </p>
          <p style={{ margin: '0 0 1.5rem', fontSize: '0.875rem', color: '#555' }}>
            Register your first API service to start proxying agent requests securely.
          </p>
          <Link to="/services/new">
            <Button variant="primary">Register your first service</Button>
          </Link>
        </div>
      )}

      {/* Data state: responsive grid */}
      {!isPending && !isError && services && services.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: '1rem',
          }}
        >
          {services.map((service) => (
            <ServiceCard
              key={service.id}
              service={service}
              onEdit={() => handleEdit(service)}
              onDelete={() => setServiceToDelete(service)}
            />
          ))}
        </div>
      )}

      {/* Delete confirmation modal */}
      <Modal
        open={serviceToDelete !== null}
        onClose={() => setServiceToDelete(null)}
        title="Delete Service"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <p style={{ margin: 0, fontSize: '0.875rem', color: '#888', lineHeight: 1.6 }}>
            Delete service{' '}
            <strong style={{ color: '#ededed' }}>{serviceToDelete?.name}</strong>? This will also
            delete all credentials and agent access.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <Button
              variant="ghost"
              onClick={() => setServiceToDelete(null)}
              disabled={deleteService.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleDeleteConfirm}
              loading={deleteService.isPending}
              disabled={deleteService.isPending}
            >
              {deleteService.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
