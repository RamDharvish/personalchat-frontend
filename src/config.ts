/**
 * Centralized Application Configuration
 *
 * Single source of truth for the PersonalChat backend URL.
 * Defaults to the live production backend on Render.
 * Override locally via VITE_BACKEND_URL in .env.local if running a local backend server.
 */

export const BACKEND_URL: string =
  (import.meta.env.VITE_BACKEND_URL as string | undefined)?.replace(/\/+$/, '') ||
  (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:5000'
    : 'https://personalchat-backend.onrender.com');
