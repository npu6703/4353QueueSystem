// Single source of truth for the backend URL.
//
// Defaults to the Railway-deployed backend so the app works out of the box
// after `git pull && npm install && npm run dev` — no extra setup.
//
// To point to a local backend instead (e.g. when debugging changes you
// haven't pushed yet), create `frontend/.env.local` with:
//
//   VITE_API_URL=http://localhost:3001
//
// Vite reads VITE_API_URL only at startup, so restart `npm run dev` after
// adding/changing it.
const RAILWAY_DEFAULT = 'https://4353queuesystem-production.up.railway.app'

export const API_BASE =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) ||
  RAILWAY_DEFAULT
