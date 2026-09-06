/**
 * Centralized Application Configuration
 *
 * Single source of truth for the PersonalChat backend URL.
 * Defaults to the live production backend on Render.
 * Override locally via VITE_BACKEND_URL in .env.local if running a local backend server.
 */

export const BACKEND_URL: string =
  (import.meta.env.VITE_BACKEND_URL as string | undefined)?.replace(/\/+$/, '') ||
  'https://personalchat-backend.onrender.com';
