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
  credentials?: string;
}

export function ServiceForm({ defaultValues, onSubmit, isSubmitting }: ServiceFormProps) {
  const isCreateMode = !defaultValues?.id;
  const [name, setName] = useState(defaultValues?.name ?? '');
  const [baseUrl, setBaseUrl] = useState(defaultValues?.baseUrl ?? '');
  const [authType, setAuthType] = useState<string>(defaultValues?.authType ?? 'api_key');
  const [apiKeyHeader, setApiKeyHeader] = useState('X-API-Key');
  const [apiKeyValue, setApiKeyValue] = useState('');
  const [bearerToken, setBearerToken] = useState('');
  const [basicUsername, setBasicUsername] = useState('');
  const [basicPassword, setBasicPassword] = useState('');
  const [oauthAccessToken, setOauthAccessToken] = useState('');
  const [customCredentials, setCustomCredentials] = useState<Array<{ key: string; value: string }>>([]);
  const [errors, setErrors] = useState<FormErrors>({});

  function buildCredentials(): Record<string, string> {
    const credentials: Record<string, string> = {};

    if (authType === 'api_key') {
      credentials[(apiKeyHeader.trim() || 'X-API-Key')] = apiKeyValue.trim();
    } else if (authType === 'bearer') {
      credentials.token = bearerToken.trim();
    } else if (authType === 'basic') {
      credentials.username = basicUsername.trim();
      credentials.password = basicPassword.trim();
    } else if (authType === 'oauth2') {
      credentials.access_token = oauthAccessToken.trim();
    }

    for (const pair of customCredentials) {
      if (pair.key.trim() && pair.value.trim()) {
        credentials[pair.key.trim()] = pair.value.trim();
      }
    }

    return credentials;
  }

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

    if (isCreateMode) {
      const hasCustomPairErrors = customCredentials.some(
        (pair) =>
          (pair.key.trim().length > 0 && pair.value.trim().length === 0) ||
          (pair.key.trim().length === 0 && pair.value.trim().length > 0)
      );

      if (hasCustomPairErrors) {
        newErrors.credentials = 'Each custom credential row must have both key and value.';
      } else {
        const credentials = buildCredentials();
        if (Object.keys(credentials).length === 0) {
          newErrors.credentials = 'At least one credential is required.';
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!validate()) return;

    const payload: ServicePayload = {
      name: name.trim(),
      baseUrl: baseUrl.trim(),
      authType,
    };

    if (isCreateMode) {
      payload.credentials = buildCredentials();
    }

    onSubmit(payload);
  }

  function updateCustomCredential(index: number, patch: Partial<{ key: string; value: string }>) {
    setCustomCredentials((prev) =>
      prev.map((row, i) => (i === index ? { ...row, ...patch } : row))
    );
    setErrors((prev) => ({ ...prev, credentials: undefined }));
  }

  function removeCustomCredential(index: number) {
    setCustomCredentials((prev) => prev.filter((_, i) => i !== index));
    setErrors((prev) => ({ ...prev, credentials: undefined }));
  }

  function addCustomCredential() {
    setCustomCredentials((prev) => [...prev, { key: '', value: '' }]);
    setErrors((prev) => ({ ...prev, credentials: undefined }));
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
          {authType === 'api_key' && 'Header name and API key value are required.'}
          {authType === 'bearer' && 'Token field maps to credentials.token.'}
          {authType === 'basic' && 'Username and password map to credentials.username/password.'}
          {authType === 'oauth2' && 'Access token maps to credentials.access_token.'}
        </span>
      </div>

      {isCreateMode && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <h3 style={{ margin: 0, fontSize: '0.95rem', color: '#ededed' }}>Credentials</h3>
          <p style={{ margin: 0, fontSize: '0.75rem', color: '#666' }}>
            Required fields adapt by auth type. Add optional custom fields for service-specific parameters.
          </p>

          {authType === 'api_key' && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                <label style={{ fontSize: '0.875rem', fontWeight: 500, color: '#ededed' }}>
                  Header Name
                </label>
                <input
                  type="text"
                  value={apiKeyHeader}
                  onChange={(e) => setApiKeyHeader(e.target.value)}
                  placeholder="X-API-Key"
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                <label style={{ fontSize: '0.875rem', fontWeight: 500, color: '#ededed' }}>
                  API Key Value
                </label>
                <input
                  type="password"
                  value={apiKeyValue}
                  onChange={(e) => setApiKeyValue(e.target.value)}
                  placeholder="Enter API key"
                  autoComplete="new-password"
                />
              </div>
            </>
          )}

          {authType === 'bearer' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              <label style={{ fontSize: '0.875rem', fontWeight: 500, color: '#ededed' }}>
                Bearer Token
              </label>
              <input
                type="password"
                value={bearerToken}
                onChange={(e) => setBearerToken(e.target.value)}
                placeholder="Enter bearer token"
                autoComplete="new-password"
              />
            </div>
          )}

          {authType === 'basic' && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                <label style={{ fontSize: '0.875rem', fontWeight: 500, color: '#ededed' }}>
                  Username
                </label>
                <input
                  type="text"
                  value={basicUsername}
                  onChange={(e) => setBasicUsername(e.target.value)}
                  placeholder="Enter username"
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                <label style={{ fontSize: '0.875rem', fontWeight: 500, color: '#ededed' }}>
                  Password
                </label>
                <input
                  type="password"
                  value={basicPassword}
                  onChange={(e) => setBasicPassword(e.target.value)}
                  placeholder="Enter password"
                  autoComplete="new-password"
                />
              </div>
            </>
          )}

          {authType === 'oauth2' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              <label style={{ fontSize: '0.875rem', fontWeight: 500, color: '#ededed' }}>
                Access Token
              </label>
              <input
                type="password"
                value={oauthAccessToken}
                onChange={(e) => setOauthAccessToken(e.target.value)}
                placeholder="Enter OAuth access token"
                autoComplete="new-password"
              />
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ fontSize: '0.8125rem', color: '#888' }}>Optional custom credentials</div>
            {customCredentials.map((pair, index) => (
              <div key={index} style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="text"
                  value={pair.key}
                  onChange={(e) => updateCustomCredential(index, { key: e.target.value })}
                  placeholder="Key"
                />
                <input
                  type="password"
                  value={pair.value}
                  onChange={(e) => updateCustomCredential(index, { value: e.target.value })}
                  placeholder="Value"
                  autoComplete="new-password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => removeCustomCredential(index)}
                  style={{ whiteSpace: 'nowrap' }}
                >
                  Remove
                </Button>
              </div>
            ))}
            <div>
              <Button type="button" variant="ghost" onClick={addCustomCredential}>
                Add Custom Field
              </Button>
            </div>
            {errors.credentials && (
              <span style={{ fontSize: '0.75rem', color: '#ef5350' }}>{errors.credentials}</span>
            )}
          </div>
        </div>
      )}

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
