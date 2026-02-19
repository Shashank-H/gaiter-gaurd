// CredentialForm — dynamic credential management for a service
// Fields adapt based on authType: api_key, bearer, basic, oauth2
// Vercel-style dark aesthetic with oat.ink semantic HTML

import React, { useState } from 'react';
import { useUpsertCredentials } from '@/hooks/useServices';
import { Button } from '@/components/primitives/Button';

interface CredentialFormProps {
  serviceId: number;
  authType: string;
}

// Define field config for each auth type
interface FieldConfig {
  key: string;
  label: string;
  sensitive?: boolean;
}

function getFields(authType: string): FieldConfig[] {
  switch (authType) {
    case 'api_key':
      return [
        { key: 'header_name', label: 'Header Name', sensitive: false },
        { key: 'api_key_value', label: 'API Key Value', sensitive: true },
      ];
    case 'bearer':
      return [{ key: 'token', label: 'Bearer Token', sensitive: true }];
    case 'basic':
      return [
        { key: 'username', label: 'Username', sensitive: false },
        { key: 'password', label: 'Password', sensitive: true },
      ];
    case 'oauth2':
      return [{ key: 'access_token', label: 'Access Token', sensitive: true }];
    default:
      return [];
  }
}

export function CredentialForm({ serviceId, authType }: CredentialFormProps) {
  const fields = getFields(authType);
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(
      fields.map((f) => [f.key, f.key === 'header_name' ? 'X-API-Key' : ''])
    )
  );
  const [customCredentials, setCustomCredentials] = useState<Array<{ key: string; value: string }>>([]);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const upsert = useUpsertCredentials();

  function handleChange(key: string, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setSuccessMessage(null);
    setErrorMessage(null);
  }

  function updateCustomCredential(index: number, patch: Partial<{ key: string; value: string }>) {
    setCustomCredentials((prev) =>
      prev.map((row, i) => (i === index ? { ...row, ...patch } : row))
    );
    setSuccessMessage(null);
    setErrorMessage(null);
  }

  function removeCustomCredential(index: number) {
    setCustomCredentials((prev) => prev.filter((_, i) => i !== index));
    setSuccessMessage(null);
    setErrorMessage(null);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSuccessMessage(null);
    setErrorMessage(null);

    // Validate all fields are filled
    const hasEmpty = fields.some((f) => !values[f.key]?.trim());
    if (hasEmpty) {
      setErrorMessage('All credential fields are required.');
      return;
    }

    const hasCustomPairErrors = customCredentials.some(
      (pair) =>
        (pair.key.trim().length > 0 && pair.value.trim().length === 0) ||
        (pair.key.trim().length === 0 && pair.value.trim().length > 0)
    );
    if (hasCustomPairErrors) {
      setErrorMessage('Each custom credential row must include both key and value.');
      return;
    }

    // Build credentials object: { key: value, ... }
    const credentials: Record<string, string> = {};
    if (authType === 'api_key') {
      const headerName = values.header_name.trim() || 'X-API-Key';
      credentials[headerName] = values.api_key_value.trim();
    } else {
      for (const field of fields) {
        credentials[field.key] = values[field.key].trim();
      }
    }

    for (const pair of customCredentials) {
      if (pair.key.trim() && pair.value.trim()) {
        credentials[pair.key.trim()] = pair.value.trim();
      }
    }

    upsert.mutate(
      { serviceId, credentials },
      {
        onSuccess: () => {
          setSuccessMessage('Credentials saved successfully.');
          // Clear form values after save
          setValues(
            Object.fromEntries(
              fields.map((f) => [f.key, f.key === 'header_name' ? 'X-API-Key' : ''])
            )
          );
          setCustomCredentials([]);
        },
        onError: () => {
          setErrorMessage('Failed to save credentials. Please try again.');
        },
      }
    );
  }

  if (fields.length === 0) {
    return (
      <p style={{ color: '#555', fontSize: '0.875rem' }}>
        No credential fields configured for auth type: {authType}
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Security notice */}
      <div
        style={{
          background: 'rgba(41, 182, 246, 0.07)',
          border: '1px solid rgba(41, 182, 246, 0.2)',
          borderRadius: 6,
          padding: '0.75rem 1rem',
          fontSize: '0.8125rem',
          color: '#888',
        }}
      >
        Credentials are encrypted at rest. Values cannot be retrieved after saving.
      </div>

      {/* Dynamic fields by auth type */}
      {fields.map((field) => (
        <div key={field.key} style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
          <label
            htmlFor={`cred-${field.key}`}
            style={{ fontSize: '0.875rem', fontWeight: 500, color: '#ededed' }}
          >
            {field.label} <span style={{ color: '#e53935' }}>*</span>
          </label>
          <input
            id={`cred-${field.key}`}
            type={field.sensitive === false ? 'text' : 'password'}
            value={values[field.key] ?? ''}
            onChange={(e) => handleChange(field.key, e.target.value)}
            placeholder={`Enter ${field.label.toLowerCase()}`}
            required
            autoComplete={field.sensitive === false ? 'off' : 'new-password'}
          />
        </div>
      ))}

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
          <Button
            type="button"
            variant="ghost"
            onClick={() => setCustomCredentials((prev) => [...prev, { key: '', value: '' }])}
          >
            Add Custom Field
          </Button>
        </div>
      </div>

      {/* Success message */}
      {successMessage && (
        <div
          style={{
            background: 'rgba(0, 200, 83, 0.1)',
            border: '1px solid rgba(0, 200, 83, 0.3)',
            borderRadius: 6,
            padding: '0.75rem 1rem',
            fontSize: '0.875rem',
            color: '#4caf50',
          }}
        >
          {successMessage}
        </div>
      )}

      {/* Error message */}
      {errorMessage && (
        <div
          style={{
            background: 'rgba(229, 57, 53, 0.1)',
            border: '1px solid rgba(229, 57, 53, 0.3)',
            borderRadius: 6,
            padding: '0.75rem 1rem',
            fontSize: '0.875rem',
            color: '#ef5350',
          }}
        >
          {errorMessage}
        </div>
      )}

      {/* Submit */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          type="submit"
          variant="primary"
          loading={upsert.isPending}
          disabled={upsert.isPending}
        >
          {upsert.isPending ? 'Saving...' : 'Save Credentials'}
        </Button>
      </div>
    </form>
  );
}
