/**
 * Utility functions for handling URLs in different environments
 */

/**
 * Get the base URL for the current environment
 */
export function getBaseUrl(): string {
  // In production (Netlify), use the NETLIFY_SITE_URL or construct from headers
  if (process.env.NETLIFY_SITE_URL) {
    return process.env.NETLIFY_SITE_URL;
  }

  // In development, use localhost
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:3000';
  }

  // Fallback: try to construct from Vercel URL or other hosting platforms
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  // Last resort: localhost
  return 'http://localhost:3000';
}

/**
 * Get the TrueLayer callback URL for the current environment
 */
export function getTrueLayerCallbackUrl(): string {
  const baseUrl = getBaseUrl();
  return `${baseUrl}/api/auth/truelayer/callback`;
}

/**
 * Get the Monzo callback URL for the current environment
 */
export function getMonzoCallbackUrl(): string {
  const baseUrl = getBaseUrl();
  return `${baseUrl}/api/auth/monzo/callback`;
}

/**
 * Get the redirect URI for TrueLayer OAuth
 * Uses environment variable if set, otherwise constructs dynamically
 */
export function getTrueLayerRedirectUri(): string {
  return process.env.TRUELAYER_REDIRECT_URI || getTrueLayerCallbackUrl();
}

/**
 * Get the redirect URI for Monzo OAuth
 * Uses environment variable if set, otherwise constructs dynamically
 */
export function getMonzoRedirectUri(): string {
  return process.env.MONZO_REDIRECT_URI || getMonzoCallbackUrl();
}

/**
 * Check if we're running in production
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * Check if we're running in development
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development';
}
