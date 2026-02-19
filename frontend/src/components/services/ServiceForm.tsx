// ServiceForm — reusable form for creating and editing services
// Vercel-style dark aesthetic with oat.ink semantic HTML
// Handles all 4 auth types: api_key, bearer, basic, oauth2

import React, { useState } from 'react';
import type { ServiceType, ServicePayload } from '@/hooks/useServices';
import { Button } from '@/components/primitives/Button';

interface ServiceFormProps {
  defaultValues?: Partial<ServiceType>;
  onSubmit: (data: ServicePayload) => void;
  isSubmitting: boolean;
}

interface FormErrors {
  name?: string;
  baseUrl?: string;
}

export function ServiceForm({ defaultValues, onSubmit, isSubmitting }: ServiceFormProps) {
  const [name, setName] = useState(defaultValues?.name ?? '');
  const [baseUrl, setBaseUrl] = useState(defaultValues?.baseUrl ?? '');
  const [authType, setAuthType] = useState<string>(defaultValues?.authType ?? 'api_key');
  const [errors, setErrors] = useState<FormErrors>({});

  function validate(): boolean {
    const newErrors: FormErrors = {};

    if (!name.trim() || name.trim().length < 3) {
      newErrors.name = 'Name must be at least 3 characters.';
    } else if (name.trim().length > 255) {
      newErrors.name = 'Name must be 255 characters or fewer.';
    }

    if (!baseUrl.trim()) {
      newErrors.baseUrl = 'Base URL is required.';
    } else if (!baseUrl.startsWith('https://') && !baseUrl.startsWith('http://')) {
      newErrors.baseUrl = 'Base URL must start with https:// or http://';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!validate()) return;
    onSubmit({ name: name.trim(), baseUrl: baseUrl.trim(), authType });
  }

  return (
    <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Name field */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
        <label
          htmlFor="service-name"
          style={{ fontSize: '0.875rem', fontWeight: 500, color: '#ededed' }}
        >
          Service Name <span style={{ color: '#e53935' }}>*</span>
        </label>
        <input
          id="service-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. GitHub API, Stripe, Notion"
          required
          minLength={3}
          maxLength={255}
          aria-describedby={errors.name ? 'name-error' : undefined}
          style={errors.name ? { borderColor: '#e53935' } : undefined}
        />
        {errors.name && (
          <span id="name-error" style={{ fontSize: '0.75rem', color: '#ef5350' }}>
            {errors.name}
          </span>
        )}
      </div>

      {/* Base URL field */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
        <label
          htmlFor="service-base-url"
          style={{ fontSize: '0.875rem', fontWeight: 500, color: '#ededed' }}
        >
          Base URL <span style={{ color: '#e53935' }}>*</span>
        </label>
        <input
          id="service-base-url"
          type="url"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          placeholder="https://api.example.com"
          required
          aria-describedby={errors.baseUrl ? 'base-url-error' : undefined}
          style={errors.baseUrl ? { borderColor: '#e53935' } : undefined}
        />
        {errors.baseUrl && (
          <span id="base-url-error" style={{ fontSize: '0.75rem', color: '#ef5350' }}>
            {errors.baseUrl}
          </span>
        )}
      </div>

      {/* Auth type select */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
        <label
          htmlFor="service-auth-type"
          style={{ fontSize: '0.875rem', fontWeight: 500, color: '#ededed' }}
        >
          Authentication Type
        </label>
        <select
          id="service-auth-type"
          value={authType}
          onChange={(e) => setAuthType(e.target.value)}
        >
          <option value="api_key">API Key</option>
          <option value="bearer">Bearer Token</option>
          <option value="basic">Basic Auth (Username &amp; Password)</option>
          <option value="oauth2">OAuth 2.0</option>
        </select>
        <span style={{ fontSize: '0.75rem', color: '#555' }}>
          {authType === 'api_key' && 'API key credential will be required.'}
          {authType === 'bearer' && 'Bearer token credential will be required.'}
          {authType === 'basic' && 'Username and password credentials will be required.'}
          {authType === 'oauth2' && 'Client ID, client secret, and token URL will be required.'}
        </span>
      </div>

      {/* Submit */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '0.5rem' }}>
        <Button
          type="submit"
          variant="primary"
          loading={isSubmitting}
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Saving...' : (defaultValues?.id ? 'Save Changes' : 'Register Service')}
        </Button>
      </div>
    </form>
  );
}
