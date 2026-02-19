// Centralized environment variable validation
// Throws at import time if required variables are missing

function getEnvVar(key: string, required = true): string {
  const value = process.env[key];
  if (!value && required) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value || '';
}

function getEnvNumber(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error(`Environment variable ${key} must be a valid number`);
  }
  return parsed;
}

export const env = {
  DATABASE_URL: getEnvVar('DATABASE_URL'),
  PORT: getEnvNumber('PORT', 3000),
  JWT_SECRET: getEnvVar('JWT_SECRET'),
  JWT_ACCESS_EXPIRY: getEnvVar('JWT_ACCESS_EXPIRY', false) || '15m',
  JWT_REFRESH_EXPIRY: getEnvVar('JWT_REFRESH_EXPIRY', false) || '7d',
  ENCRYPTION_SECRET: (() => {
    const secret = getEnvVar('ENCRYPTION_SECRET');
    if (secret.length < 32) {
      throw new Error('ENCRYPTION_SECRET must be at least 32 characters long');
    }
    return secret;
  })(),
  ENCRYPTION_SALT: getEnvVar('ENCRYPTION_SALT', false) || 'gaiter-guard-salt-v1',
  // LLM configuration for risk assessment
  LLM_BASE_URL: getEnvVar('LLM_BASE_URL'),
  LLM_API_KEY: getEnvVar('LLM_API_KEY'),
  LLM_MODEL: getEnvVar('LLM_MODEL', false) || 'gpt-4o-mini',
  LLM_TIMEOUT_MS: getEnvNumber('LLM_TIMEOUT_MS', 10000),
  RISK_THRESHOLD: (() => {
    const val = parseFloat(process.env.RISK_THRESHOLD || '0.5');
    if (isNaN(val) || val < 0 || val > 1) {
      throw new Error('RISK_THRESHOLD must be a number between 0 and 1');
    }
    return val;
  })(),
  APPROVAL_EXECUTE_TTL_HOURS: getEnvNumber('APPROVAL_EXECUTE_TTL_HOURS', 1),
};
