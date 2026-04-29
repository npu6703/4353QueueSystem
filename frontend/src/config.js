// Single source of truth for the backend URL.
//
// In dev (Vite), VITE_API_URL is read from frontend/.env (or .env.local).
// In production builds, it's whatever was set at `npm run build` time.
// Falls back to local backend so `npm run dev` works out of the box.
export const API_BASE =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) ||
  'http://localhost:3001'
