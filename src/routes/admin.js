import { Router } from 'express';
import { supabaseAdmin } from '../supabase.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();
router.use(requireAdmin);

/* Trips CRUD */
router.get('/trips', async (_req, res) => {
  const { data, error } = await supabaseAdmin
    .from('trips').select('*, collections(name)').order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.post('/trips', async (req, res) => {
  const { data, error } = await supabaseAdmin.from('trips').insert(req.body).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data);
});

router.put('/trips/:id', async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('trips').update(req.body).eq('id', req.params.id).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

router.delete('/trips/:id', async (req, res) => {
  // Soft delete: keep history, hide from public site
  const { error } = await supabaseAdmin
    .from('trips').update({ is_active: false }).eq('id', req.params.id);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ ok: true });
});

/* Bookings inbox */
router.get('/bookings', async (_req, res) => {
  const { data, error } = await supabaseAdmin
    .from('bookings').select('*, trips(title)').order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.put('/bookings/:id', async (req, res) => {
  const { status } = req.body || {};
  const { data, error } = await supabaseAdmin
    .from('bookings').update({ status }).eq('id', req.params.id).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

/* Contact inbox */
router.get('/contact', async (_req, res) => {
  const { data, error } = await supabaseAdmin
    .from('contact_messages').select('*').order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

export default router;
