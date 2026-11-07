/**
 * Centralized Application Configuration
 *
 * Single source of truth for the PersonalChat backend URL.
 * Defaults to the live production backend on Render.
 * Override locally via VITE_BACKEND_URL in .env.local if running a local backend server.
 */

export const getBackendUrl = (): string => {
  if (
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ) {
    const envUrl = (import.meta.env.VITE_BACKEND_URL as string | undefined)?.replace(/\/+$/, '');
    if (envUrl && (envUrl.includes('localhost') || envUrl.includes('127.0.0.1'))) {
      return envUrl;
    }
    return 'http://localhost:5000';
  }
  return (
    (import.meta.env.VITE_BACKEND_URL as string | undefined)?.replace(/\/+$/, '') ||
    'https://personalchat-backend.onrender.com'
  );
};

export const BACKEND_URL: string = getBackendUrl();
