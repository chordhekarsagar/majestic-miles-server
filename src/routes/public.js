import { Router } from 'express';
import { supabaseAdmin } from '../supabase.js';
import { listFolderMedia, driveImageUrl, streamDriveImage } from '../drive.js';

const router = Router();

/* GET /api/collections — all collections */
router.get('/collections', async (_req, res) => {
  const { data, error } = await supabaseAdmin
    .from('collections').select('*').order('sort_order');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

/* GET /api/collections/:slug — one collection + its active trips */
router.get('/collections/:slug', async (req, res) => {
  const { data: collection, error } = await supabaseAdmin
    .from('collections').select('*').eq('slug', req.params.slug).single();
  if (error || !collection) return res.status(404).json({ error: 'Collection not found' });

  const { data: trips } = await supabaseAdmin
    .from('trips').select('*')
    .eq('collection_id', collection.id).eq('is_active', true)
    .order('created_at', { ascending: false });

  res.json({ ...collection, trips: trips || [] });
});

/* GET /api/trips?featured=true&sort=price_asc — trip listing */
router.get('/trips', async (req, res) => {
  let query = supabaseAdmin.from('trips').select('*').eq('is_active', true);
  if (req.query.featured === 'true') query = query.eq('is_featured', true);

  const sort = req.query.sort;
  if (sort === 'price_asc') query = query.order('price', { ascending: true });
  else if (sort === 'price_desc') query = query.order('price', { ascending: false });
  else if (sort === 'duration') query = query.order('duration_days', { ascending: true });
  else query = query.order('created_at', { ascending: false });

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

/* GET /api/trips/:slug — trip detail + Google Drive gallery */
router.get('/trips/:slug', async (req, res) => {
  const { data: trip, error } = await supabaseAdmin
    .from('trips').select('*, collections(name, slug)')
    .eq('slug', req.params.slug).single();
  if (error || !trip) return res.status(404).json({ error: 'Trip not found' });

  let gallery = [];
  if (trip.drive_folder_id) {
    try { gallery = await listFolderMedia(trip.drive_folder_id); }
    catch (e) { console.warn('Drive gallery failed:', e.message); }
  }
  res.json({ ...trip, gallery });
});

/* GET /api/blogs and /api/blogs/:slug */
router.get('/blogs', async (_req, res) => {
  const { data, error } = await supabaseAdmin
    .from('blog_posts').select('id, slug, title, excerpt, cover_image, created_at')
    .eq('published', true).order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.get('/blogs/:slug', async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('blog_posts').select('*').eq('slug', req.params.slug).eq('published', true).single();
  if (error || !data) return res.status(404).json({ error: 'Post not found' });
  res.json(data);
});

/* GET /api/media/:fileId — helper to resolve a single Drive image URL */
router.get('/media/:fileId', (req, res) => {
  res.json({ url: driveImageUrl(req.params.fileId) });
});

/* GET /api/image/:fileId — proxies + caches a Drive file's bytes so the
   browser never hits drive.google.com's rate-limited thumbnail endpoint */
router.get('/image/:fileId', async (req, res) => {
  try {
    await streamDriveImage(req.params.fileId, res);
  } catch (e) {
    console.error('Image proxy failed:', e.message);
    if (!res.headersSent) res.status(502).json({ error: 'Failed to load image' });
  }
});

/* POST /api/bookings — booking enquiry from trip page */
router.post('/bookings', async (req, res) => {
  const { trip_id, full_name, email, phone, travellers, travel_date, message } = req.body || {};
  if (!trip_id || !full_name || !email || !phone)
    return res.status(400).json({ error: 'trip_id, full_name, email and phone are required' });

  const { data, error } = await supabaseAdmin.from('bookings')
    .insert({ trip_id, full_name, email, phone, travellers: travellers || 1, travel_date, message })
    .select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

/* POST /api/contact — contact form */
router.post('/contact', async (req, res) => {
  const { full_name, email, phone, message } = req.body || {};
  if (!full_name || !email || !message)
    return res.status(400).json({ error: 'full_name, email and message are required' });

  const { error } = await supabaseAdmin.from('contact_messages')
    .insert({ full_name, email, phone, message });
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json({ ok: true });
});

export default router;
