// Authentication token management using localStorage
// Key: access_token — stores JWT bearer token

const TOKEN_KEY = 'access_token';

/**
 * Get the stored access token, or null if not present
 */
export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

/**
 * Store the access token in localStorage
 */
export function setStoredToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

/**
 * Clear the access token (used on logout or 401 response)
 */
export function clearStoredToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

/**
 * Returns true if a token is stored (does not validate expiry)
 */
export function isAuthenticated(): boolean {
  return Boolean(getStoredToken());
}
