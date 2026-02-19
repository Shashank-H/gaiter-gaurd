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
};
