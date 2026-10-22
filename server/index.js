import './env.js'; // must come first: loads .env
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import express from 'express';
import multer from 'multer';
import { db, save, newId, MEDIA_DIR, THUMB_DIR, TMP_DIR, SONG_DIR } from './db.js';
import { ingest, kindOf, removeFiles, seedFrom, setVideoThumb } from './media.js';
import * as content from './content.js';
import { handleChat, chatEnabled } from './chat.js';
import { router as musicRouter, MUSIC_DIR } from './music.js';

const PORT = Number(process.env.PORT ?? 4000);
const SEED_DIR = path.resolve(process.env.SEED_DIR ?? path.join(import.meta.dirname, '..', '..'));
const DIST_DIR = path.resolve(import.meta.dirname, '..', 'dist');

// Optional secret word. If set, only someone who knows it can open the app.
const ACCESS_CODE = (process.env.ACCESS_CODE ?? '').trim();
const ACCESS_HINT = process.env.ACCESS_HINT ?? 'What do I call you? ♥';
const accessToken = ACCESS_CODE
  ? crypto.createHash('sha256').update(`kaveri:${ACCESS_CODE.toLowerCase()}`).digest('hex')
  : null;

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));

// ── Lock ─────────────────────────────────────────────────────────────────────
const cookie = (req, name) =>
  req.headers.cookie?.split(';').map((c) => c.trim().split('=')).find(([k]) => k === name)?.[1];
const isUnlocked = (req) => !accessToken || cookie(req, 'kaveri_key') === accessToken;

app.get('/api/status', (req, res) => {
  res.json({ locked: !isUnlocked(req), hint: ACCESS_HINT, herName: db.settings.herName });
});

app.post('/api/unlock', (req, res) => {
  const code = String(req.body?.code ?? '').trim().toLowerCase();
  if (!accessToken || code === ACCESS_CODE.toLowerCase()) {
    if (accessToken) {
      res.setHeader('Set-Cookie',
        `kaveri_key=${accessToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 365}`);
    }
    return res.json({ ok: true });
  }
  res.status(401).json({ ok: false });
});

app.use(['/api', '/media', '/thumbs', '/song', '/music-files'], (req, res, next) => {
  if (isUnlocked(req)) return next();
  res.status(401).json({ error: 'locked' });
});

// ── Files ────────────────────────────────────────────────────────────────────
app.use('/media', express.static(MEDIA_DIR, { maxAge: '30d', immutable: true }));
app.use('/thumbs', express.static(THUMB_DIR, { maxAge: '30d' }));
app.use('/song', express.static(SONG_DIR, { maxAge: '1d' }));
app.use('/music-files', express.static(MUSIC_DIR, { maxAge: '30d' }));

const upload = multer({
  dest: TMP_DIR,
  limits: { fileSize: 500 * 1024 * 1024, files: 60 },
  fileFilter: (_req, file, cb) => cb(null, !!kindOf(file.originalname, file.mimetype)),
});
const memoryUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });
const songUpload = multer({
  dest: TMP_DIR,
  limits: { fileSize: 40 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, file.mimetype.startsWith('audio/')),
});

const findMedia = (req, res) => {
  const item = db.media.find((m) => m.id === req.params.id);
  if (!item) res.status(404).json({ error: 'Memory not found' });
  return item;
};

// ── API ──────────────────────────────────────────────────────────────────────
app.get('/api/bootstrap', (_req, res) => {
  res.json({
    settings: db.settings,
    missYouCount: db.missYouCount,
    features: { chat: chatEnabled(), spotifyClientId: process.env.SPOTIFY_CLIENT_ID || null },
    content: {
      mainLetter: content.mainLetter,
      letters: content.letters.map((l) => ({ ...l, openedAt: db.letterOpens[l.id] ?? null })),
      reasons: content.reasons,
      dailyMessages: content.dailyMessages,
      missYouReplies: content.missYouReplies,
    },
  });
});

app.put('/api/settings', async (req, res) => {
  const allowed = ['herName', 'nickname', 'fromName', 'startDate', 'birthday'];
  for (const key of allowed) {
    if (typeof req.body?.[key] === 'string') db.settings[key] = req.body[key].trim().slice(0, 80);
  }
  await save();
  res.json(db.settings);
});

app.get('/api/media', (_req, res) => {
  res.json(db.media.map(({ hash, ...m }) => m));
});

app.post('/api/media', upload.array('files'), async (req, res) => {
  let lastModified = [];
  try { lastModified = JSON.parse(req.body.lastModified ?? '[]'); } catch { /* optional */ }
  const results = [];
  for (const [i, file] of (req.files ?? []).entries()) {
    try {
      const { item, duplicate } = await ingest(file.path, {
        originalName: file.originalname,
        mime: file.mimetype,
        lastModified: lastModified[i],
        move: true,
      });
      const { hash, ...rest } = item;
      results.push({ ...rest, duplicate });
    } catch (err) {
      await fs.promises.rm(file.path, { force: true });
      results.push({ error: err.message, originalName: file.originalname });
    }
  }
  res.json(results);
});

app.patch('/api/media/:id', async (req, res) => {
  const item = findMedia(req, res);
  if (!item) return;
  if (typeof req.body.caption === 'string') item.caption = req.body.caption.slice(0, 300);
  if (typeof req.body.favorite === 'boolean') item.favorite = req.body.favorite;
  await save();
  const { hash, ...rest } = item;
  res.json(rest);
});

app.post('/api/media/:id/thumb', memoryUpload.single('thumb'), async (req, res) => {
  const item = findMedia(req, res);
  if (!item) return;
  if (!req.file) return res.status(400).json({ error: 'No image' });
  try {
    const { hash, ...rest } = await setVideoThumb(item, req.file.buffer);
    res.json(rest);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/media/:id/restore', async (req, res) => {
  const item = findMedia(req, res);
  if (!item) return;
  item.deletedAt = null;
  await save();
  res.json({ ok: true });
});

app.delete('/api/media/:id', async (req, res) => {
  const item = findMedia(req, res);
  if (!item) return;
  if (req.query.forever === '1') {
    await removeFiles(item);
    db.media.splice(db.media.indexOf(item), 1);
  } else {
    item.deletedAt = new Date().toISOString();
  }
  await save();
  res.json({ ok: true });
});

app.post('/api/trash/empty', async (_req, res) => {
  const gone = db.media.filter((m) => m.deletedAt);
  for (const item of gone) await removeFiles(item);
  db.media = db.media.filter((m) => !m.deletedAt);
  await save();
  res.json({ removed: gone.length });
});

// Our song
app.post('/api/song', songUpload.single('song'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Please choose an audio file' });
  if (db.settings.song) await fs.promises.rm(path.join(SONG_DIR, db.settings.song.file), { force: true });
  const file = `our-song-${Date.now()}${path.extname(req.file.originalname).toLowerCase() || '.mp3'}`;
  await fs.promises.rename(req.file.path, path.join(SONG_DIR, file));
  db.settings.song = { file, name: path.parse(req.file.originalname).name, mime: req.file.mimetype };
  await save();
  res.json(db.settings);
});

app.delete('/api/song', async (_req, res) => {
  if (db.settings.song) await fs.promises.rm(path.join(SONG_DIR, db.settings.song.file), { force: true });
  db.settings.song = null;
  await save();
  res.json(db.settings);
});

// Dreams (bucket list)
app.get('/api/dreams', (_req, res) => res.json(db.dreams));

app.post('/api/dreams', async (req, res) => {
  const text = String(req.body?.text ?? '').trim().slice(0, 200);
  if (!text) return res.status(400).json({ error: 'Write a dream first ♥' });
  const dream = { id: newId(), text, done: false, createdAt: new Date().toISOString(), doneAt: null };
  db.dreams.push(dream);
  await save();
  res.json(dream);
});

app.patch('/api/dreams/:id', async (req, res) => {
  const dream = db.dreams.find((d) => d.id === req.params.id);
  if (!dream) return res.status(404).json({ error: 'Not found' });
  if (typeof req.body.done === 'boolean') {
    dream.done = req.body.done;
    dream.doneAt = dream.done ? new Date().toISOString() : null;
  }
  if (typeof req.body.text === 'string' && req.body.text.trim()) dream.text = req.body.text.trim().slice(0, 200);
  await save();
  res.json(dream);
});

app.delete('/api/dreams/:id', async (req, res) => {
  db.dreams = db.dreams.filter((d) => d.id !== req.params.id);
  await save();
  res.json({ ok: true });
});

// Love notes
app.get('/api/notes', (_req, res) => res.json(db.notes));

app.post('/api/notes', async (req, res) => {
  const text = String(req.body?.text ?? '').trim().slice(0, 500);
  if (!text) return res.status(400).json({ error: 'Your note is empty ♥' });
  const note = {
    id: newId(),
    text,
    from: String(req.body?.from ?? db.settings.herName).slice(0, 40),
    color: ['#ffd6e0', '#fff1b8', '#d7f5e3', '#dbe7ff', '#efdcff'][Math.floor(Math.random() * 5)],
    tilt: Math.round((Math.random() * 8 - 4) * 10) / 10,
    createdAt: new Date().toISOString(),
  };
  db.notes.unshift(note);
  await save();
  res.json(note);
});

app.delete('/api/notes/:id', async (req, res) => {
  db.notes = db.notes.filter((n) => n.id !== req.params.id);
  await save();
  res.json({ ok: true });
});

app.post('/api/letters/:id/open', async (req, res) => {
  db.letterOpens[req.params.id] ??= new Date().toISOString();
  await save();
  res.json({ openedAt: db.letterOpens[req.params.id] });
});

app.post('/api/miss-you', async (_req, res) => {
  db.missYouCount += 1;
  await save();
  const replies = content.missYouReplies;
  res.json({ count: db.missYouCount, reply: replies[Math.floor(Math.random() * replies.length)] });
});

// Cupid, the AI companion
app.post('/api/chat', handleChat);

// Music search + Our Playlist
app.use('/api', musicRouter);

app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

// ── The app itself (after `npm run build`) ──────────────────────────────────
if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  app.get('/{*splat}', (_req, res) => res.sendFile(path.join(DIST_DIR, 'index.html')));
}

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status ?? 500).json({ error: err.message ?? 'Something went wrong' });
});

// ── Start ────────────────────────────────────────────────────────────────────
if (!db.seeded && db.dreams.length === 0) {
  db.dreams = content.starterDreams.map((text) => ({
    id: newId(), text, done: false, createdAt: new Date().toISOString(), doneAt: null,
  }));
}
await seedFrom(SEED_DIR);

app.listen(PORT, '0.0.0.0', () => {
  const lan = Object.values(os.networkInterfaces()).flat()
    .find((i) => i?.family === 'IPv4' && !i.internal)?.address;
  console.log(`\n  ♥ Kaveri's universe is running`);
  console.log(`    API:   http://localhost:${PORT}`);
  if (fs.existsSync(DIST_DIR)) {
    console.log(`    Open:  http://localhost:${PORT}${lan ? `   (on her phone, same Wi-Fi: http://${lan}:${PORT})` : ''}`);
  }
  console.log(`    💘 Cupid (AI chat): ${chatEnabled() ? 'on' : 'off – add GROQ_API_KEY to .env'}`);
  console.log(`    🎵 Spotify: ${process.env.SPOTIFY_CLIENT_ID ? 'ready' : 'not set up – add SPOTIFY_CLIENT_ID to .env'}`);
  if (accessToken) console.log('    🔒 Protected with a secret word');
  console.log('');
});
