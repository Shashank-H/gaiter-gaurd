// AgentForm — reusable form for creating and editing agents
// Used by both /agents/new (create) and /agents/$id/edit (edit scope)
// Handles name input and service scope checkboxes

import React, { useState } from 'react';
import { useServices } from '@/hooks/useServices';
import { Button } from '@/components/primitives/Button';
import { Skeleton } from '@/components/primitives/Skeleton';

export interface AgentFormProps {
  defaultName?: string;
  defaultServiceIds?: number[];
  onSubmit: (data: { name: string; serviceIds: number[] }) => void;
  isSubmitting: boolean;
  submitLabel: string;
  errors?: Record<string, string>;
}

/**
 * AgentForm — renders name input and service scope checkboxes.
 * Validates: name 3-100 chars, at least 1 service selected.
 * Wraps in <article className="card"> for consistent card appearance.
 */
export function AgentForm({
  defaultName = '',
  defaultServiceIds = [],
  onSubmit,
  isSubmitting,
  submitLabel,
  errors: externalErrors = {},
}: AgentFormProps) {
  const [name, setName] = useState(defaultName);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set(defaultServiceIds));
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({});

  const { data: services, isPending: servicesLoading } = useServices();

  // Merge external errors (from mutation) with local validation errors
  const errors: Record<string, string> = { ...localErrors, ...externalErrors };

  function toggleService(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    // Clear services error when user interacts
    setLocalErrors((prev) => {
      const next = { ...prev };
      delete next.services;
      return next;
    });
  }

  function validate(): boolean {
    const newErrors: Record<string, string> = {};

    const trimmedName = name.trim();
    if (trimmedName.length < 3) {
      newErrors.name = 'Agent name must be at least 3 characters.';
    } else if (trimmedName.length > 100) {
      newErrors.name = 'Agent name must be 100 characters or fewer.';
    }

    if (selectedIds.size === 0) {
      newErrors.services = 'At least one service must be selected.';
    }

    setLocalErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!validate()) return;
    onSubmit({ name: name.trim(), serviceIds: [...selectedIds] });
  }

  return (
    <article className="card">
      <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

        {/* Name field */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
          <label
            htmlFor="agent-name"
            style={{ fontSize: '0.875rem', fontWeight: 500, color: '#ededed' }}
          >
            Agent Name <span style={{ color: '#e53935' }}>*</span>
          </label>
          <input
            id="agent-name"
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setLocalErrors((prev) => { const n = { ...prev }; delete n.name; return n; });
            }}
            placeholder="e.g. My Automation Bot"
            required
            minLength={3}
            maxLength={100}
            aria-describedby={errors.name ? 'agent-name-error' : undefined}
            style={errors.name ? { borderColor: '#e53935' } : undefined}
          />
          {errors.name && (
            <span id="agent-name-error" style={{ fontSize: '0.8rem', color: '#ef4444' }}>
              {errors.name}
            </span>
          )}
        </div>

        {/* Service scope checkboxes */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
          <span style={{ fontSize: '0.875rem', fontWeight: 500, color: '#ededed' }}>
            Service Scope <span style={{ color: '#e53935' }}>*</span>
          </span>
          <p style={{ margin: 0, fontSize: '0.75rem', color: '#666' }}>
            Select which services this agent is allowed to access.
          </p>

          {servicesLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
              <Skeleton height="1.25rem" width="70%" />
              <Skeleton height="1.25rem" width="55%" />
              <Skeleton height="1.25rem" width="65%" />
            </div>
          ) : services && services.length > 0 ? (
            <div
              style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.25rem' }}
              role="group"
              aria-labelledby="service-scope-label"
            >
              {services.map((service) => (
                <label
                  key={service.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    fontSize: '0.875rem',
                    color: '#ededed',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(service.id)}
                    onChange={() => toggleService(service.id)}
                    style={{ width: 'auto', margin: 0 }}
                  />
                  {service.name}
                </label>
              ))}
            </div>
          ) : (
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: '#666' }}>
              No services available. Add a service first.
            </p>
          )}

          {errors.services && (
            <span style={{ fontSize: '0.8rem', color: '#ef4444', marginTop: '0.25rem' }}>
              {errors.services}
            </span>
          )}
        </div>

        {/* Submit */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '0.5rem' }}>
          <Button
            type="submit"
            variant="primary"
            loading={isSubmitting}
            disabled={isSubmitting || servicesLoading}
          >
            {submitLabel}
          </Button>
        </div>

      </form>
    </article>
  );
}
