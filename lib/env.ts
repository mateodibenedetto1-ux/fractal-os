export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
export const SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
export const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/$/, '');

/** Sin Supabase configurado la app corre en modo demo con datos de ejemplo. */
export const DEMO = !SUPABASE_URL || !SUPABASE_ANON;
