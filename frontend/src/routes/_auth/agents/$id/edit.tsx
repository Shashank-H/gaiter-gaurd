// Edit agent page — /agents/$id/edit
// Two independent sections: Agent Details (name) and Service Scope (checkboxes)
// Each section has its own save button and saves independently

import React, { useState, useEffect } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useAgent, useUpdateAgent, useUpdateAgentServices } from '@/hooks/useAgents';
import { useServices } from '@/hooks/useServices';
import { Button } from '@/components/primitives/Button';
import { Skeleton } from '@/components/primitives/Skeleton';

export const Route = createFileRoute('/_auth/agents/$id/edit')({
  component: EditAgentPage,
});

function EditAgentPage() {
  const { id } = Route.useParams();
  const agentId = parseInt(id, 10);

  const { data: agent, isPending, isError } = useAgent(agentId);
  const updateAgent = useUpdateAgent();
  const updateAgentServices = useUpdateAgentServices();
  const { data: services, isPending: servicesLoading } = useServices();

  // Details section state
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState('');
  const [nameSaved, setNameSaved] = useState(false);

  // Scope section state
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [scopeError, setScopeError] = useState('');
  const [scopeSaved, setScopeSaved] = useState(false);

  // Initialize form from loaded agent data
  useEffect(() => {
    if (agent) {
      setName(agent.name);
      setSelectedIds(new Set(agent.services.map((s) => s.id)));
    }
  }, [agent]);

  // --- Details section handlers ---

  function validateName(value: string): string {
    const trimmed = value.trim();
    if (trimmed.length < 3) return 'Agent name must be at least 3 characters.';
    if (trimmed.length > 100) return 'Agent name must be 100 characters or fewer.';
    return '';
  }

  function handleSaveDetails(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const error = validateName(name);
    if (error) {
      setNameError(error);
      return;
    }
    setNameError('');
    updateAgent.mutate(
      { id: agentId, data: { name: name.trim() } },
      {
        onSuccess: () => {
          setNameSaved(true);
          setTimeout(() => setNameSaved(false), 2000);
        },
      }
    );
  }

  // --- Scope section handlers ---

  function toggleService(serviceId: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(serviceId)) {
        next.delete(serviceId);
      } else {
        next.add(serviceId);
      }
      return next;
    });
    setScopeError('');
  }

  function handleSaveScope(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (selectedIds.size === 0) {
      setScopeError('At least one service must be selected.');
      return;
    }
    setScopeError('');
    updateAgentServices.mutate(
      { id: agentId, serviceIds: [...selectedIds] },
      {
        onSuccess: () => {
          setScopeSaved(true);
          setTimeout(() => setScopeSaved(false), 2000);
        },
      }
    );
  }

  // --- NaN guard ---
  if (isNaN(agentId)) {
    return (
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '2rem 1rem' }}>
        <Link to={'/agents' as never} style={{ fontSize: '0.875rem', color: '#555' }}>
          &#8592; Back to Agents
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
          Invalid agent ID.
        </div>
      </div>
    );
  }

  // --- Loading state ---
  if (isPending) {
    return (
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '2rem 1rem' }}>
        <div style={{ marginBottom: '2rem' }}>
          <Skeleton height="0.875rem" width={120} />
          <div style={{ marginTop: '1rem' }}>
            <Skeleton height="2rem" width="60%" />
          </div>
        </div>
        <article className="card" style={{ marginBottom: '1.5rem' }}>
          <Skeleton lines={3} />
        </article>
        <article className="card">
          <Skeleton lines={4} />
        </article>
      </div>
    );
  }

  // --- Error state ---
  if (isError || !agent) {
    return (
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '2rem 1rem' }}>
        <Link to={'/agents' as never} style={{ fontSize: '0.875rem', color: '#555' }}>
          &#8592; Back to Agents
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
          Agent not found or failed to load.
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '2rem 1rem' }}>
      {/* Page header */}
      <div style={{ marginBottom: '2rem' }}>
        <Link
          to={'/agents' as never}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.375rem',
            fontSize: '0.875rem',
            color: '#555',
            marginBottom: '1rem',
          }}
        >
          &#8592; Back to Agents
        </Link>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#ededed' }}>
          Edit Agent
        </h1>
        <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: '#555' }}>
          Update agent details or modify its service scope.
        </p>
      </div>

      {/* Section 1 — Agent Details */}
      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: 600, color: '#ededed' }}>
          Agent Details
        </h2>

        {updateAgent.isError && (
          <div
            style={{
              background: 'rgba(229, 57, 53, 0.1)',
              border: '1px solid rgba(229, 57, 53, 0.3)',
              borderRadius: 8,
              padding: '0.75rem 1rem',
              color: '#ef5350',
              fontSize: '0.875rem',
              marginBottom: '1rem',
            }}
          >
            Failed to update agent details. Please try again.
          </div>
        )}

        <article className="card">
          <form
            onSubmit={handleSaveDetails}
            noValidate
            style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              <label
                htmlFor="agent-edit-name"
                style={{ fontSize: '0.875rem', fontWeight: 500, color: '#ededed' }}
              >
                Agent Name <span style={{ color: '#e53935' }}>*</span>
              </label>
              <input
                id="agent-edit-name"
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setNameError('');
                }}
                required
                minLength={3}
                maxLength={100}
                aria-describedby={nameError ? 'agent-edit-name-error' : undefined}
                style={nameError ? { borderColor: '#e53935' } : undefined}
              />
              {nameError && (
                <span id="agent-edit-name-error" style={{ fontSize: '0.8rem', color: '#ef4444' }}>
                  {nameError}
                </span>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.75rem' }}>
              {nameSaved && (
                <span style={{ fontSize: '0.875rem', color: '#22c55e' }}>Saved</span>
              )}
              <Button
                type="submit"
                variant="primary"
                loading={updateAgent.isPending}
                disabled={updateAgent.isPending || updateAgentServices.isPending}
              >
                Save Details
              </Button>
            </div>
          </form>
        </article>
      </section>

      <hr style={{ border: 'none', borderTop: '1px solid #222', margin: '2rem 0' }} />

      {/* Section 2 — Service Scope */}
      <section>
        <h2 style={{ margin: '0 0 0.5rem', fontSize: '1rem', fontWeight: 600, color: '#ededed' }}>
          Service Scope
        </h2>
        <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: '#555' }}>
          Select which services this agent is allowed to access.
        </p>

        {updateAgentServices.isError && (
          <div
            style={{
              background: 'rgba(229, 57, 53, 0.1)',
              border: '1px solid rgba(229, 57, 53, 0.3)',
              borderRadius: 8,
              padding: '0.75rem 1rem',
              color: '#ef5350',
              fontSize: '0.875rem',
              marginBottom: '1rem',
            }}
          >
            Failed to update service scope. Please try again.
          </div>
        )}

        <article className="card">
          <form
            onSubmit={handleSaveScope}
            noValidate
            style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              {servicesLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <Skeleton height="1.25rem" width="70%" />
                  <Skeleton height="1.25rem" width="55%" />
                  <Skeleton height="1.25rem" width="65%" />
                </div>
              ) : services && services.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }} role="group">
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
                <p style={{ margin: 0, fontSize: '0.875rem', color: '#666' }}>
                  No services available.
                </p>
              )}

              {scopeError && (
                <span style={{ fontSize: '0.8rem', color: '#ef4444', marginTop: '0.25rem' }}>
                  {scopeError}
                </span>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.75rem' }}>
              {scopeSaved && (
                <span style={{ fontSize: '0.875rem', color: '#22c55e' }}>Saved</span>
              )}
              <Button
                type="submit"
                variant="primary"
                loading={updateAgentServices.isPending}
                disabled={updateAgentServices.isPending || servicesLoading || updateAgent.isPending}
              >
                Save Scope
              </Button>
            </div>
          </form>
        </article>
      </section>
    </div>
  );
}
