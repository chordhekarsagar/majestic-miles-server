import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

// Service-role client: bypasses RLS. Server-side only.
export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

// Anon client: used to verify user JWTs coming from the Angular app.
export const supabaseAuth = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY,
  { auth: { persistSession: false } }
);
