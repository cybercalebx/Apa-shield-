// Public settings read from .env.local. Never put secrets here.
// Set VITE_SUPPORT_EMAIL to the address users should contact.
const env = import.meta.env ?? {};

export const SUPPORT_EMAIL = (env.VITE_SUPPORT_EMAIL || "").trim();
