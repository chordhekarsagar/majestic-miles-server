import { supabaseAuth } from '../supabase.js';

/**
 * Verifies the Supabase Auth JWT sent by the Angular admin panel as
 * "Authorization: Bearer <access_token>". Any authenticated user is
 * treated as an admin; create admin users in Supabase Dashboard >
 * Authentication > Users (keep sign-ups disabled).
 */
export async function requireAdmin(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing token' });

  const { data, error } = await supabaseAuth.auth.getUser(token);
  if (error || !data?.user) return res.status(401).json({ error: 'Invalid or expired token' });

  req.user = data.user;
  next();
}
