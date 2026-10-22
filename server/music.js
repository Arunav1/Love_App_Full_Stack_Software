// Music: song search (no account needed) and "Our Playlist" – saved tracks + uploaded songs.
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import multer from 'multer';
import { parseFile } from 'music-metadata';
import { db, save, newId, DATA_DIR, TMP_DIR } from './db.js';

export const MUSIC_DIR = path.join(DATA_DIR, 'music');
fs.mkdirSync(MUSIC_DIR, { recursive: true });
db.playlist ??= [];

const COUNTRY = process.env.MUSIC_COUNTRY || 'IN';
const AUDIO_EXT = ['.mp3', '.m4a', '.aac', '.wav', '.ogg', '.oga', '.flac', '.opus', '.webm'];

const upload = multer({
  dest: TMP_DIR,
  limits: { fileSize: 60 * 1024 * 1024, files: 30 },
  fileFilter: (_req, file, cb) =>
    cb(null, file.mimetype.startsWith('audio/') || AUDIO_EXT.includes(path.extname(file.originalname).toLowerCase())),
});

export const router = express.Router();

// Search via the public iTunes catalogue: full metadata + 30-second previews, no login.
router.get('/music/search', async (req, res) => {
  const q = String(req.query.q ?? '').trim().slice(0, 100);
  if (!q) return res.json([]);
  try {
    const url = `https://itunes.apple.com/search?${new URLSearchParams({ term: q, media: 'music', entity: 'song', limit: '25', country: COUNTRY })}`;
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const data = await r.json();
    res.json((data.results ?? []).filter((t) => t.previewUrl).map((t) => ({
      id: `itunes:${t.trackId}`,
      source: 'itunes',
      title: t.trackName,
      artist: t.artistName,
      album: t.collectionName,
      art: t.artworkUrl100?.replace('100x100bb', '600x600bb'),
      previewUrl: t.previewUrl,
      durationMs: t.trackTimeMillis,
    })));
  } catch {
    res.status(502).json({ error: 'Song search is unavailable right now. Check the internet connection.' });
  }
});

router.get('/playlist', (_req, res) => res.json(db.playlist));

// Save a track (from search or Spotify) to Our Playlist.
router.post('/playlist', async (req, res) => {
  const t = req.body ?? {};
  if (!['itunes', 'spotify'].includes(t.source) || !t.title) return res.status(400).json({ error: 'Not a song' });
  const key = t.source === 'spotify' ? t.uri : t.previewUrl;
  const existing = db.playlist.find((p) => (p.source === 'spotify' ? p.uri : p.previewUrl) === key);
  if (existing) return res.json(existing);
  const str = (v, n = 300) => (typeof v === 'string' ? v.slice(0, n) : null);
  const item = {
    id: newId(),
    source: t.source,
    title: str(t.title, 200),
    artist: str(t.artist, 200),
    album: str(t.album, 200),
    art: str(t.art, 500),
    previewUrl: t.source === 'itunes' ? str(t.previewUrl, 500) : null,
    uri: t.source === 'spotify' ? str(t.uri, 100) : null,
    durationMs: Number(t.durationMs) || null,
    addedBy: str(req.body.addedBy, 40),
    addedAt: new Date().toISOString(),
  };
  db.playlist.unshift(item);
  await save();
  res.json(item);
});

// Upload real song files – these play in full, forever, no account needed.
router.post('/playlist/upload', upload.array('songs'), async (req, res) => {
  const added = [];
  for (const file of req.files ?? []) {
    const id = newId();
    const ext = path.extname(file.originalname).toLowerCase() || '.mp3';
    const dest = path.join(MUSIC_DIR, `${id}${ext}`);
    await fs.promises.rename(file.path, dest);

    let meta = { common: {}, format: {} };
    try { meta = await parseFile(dest); } catch { /* untagged file – fall back to its name */ }
    // "Artist - Title.mp3" is the usual naming when there are no tags
    const base = path.parse(file.originalname).name.replace(/[_]+/g, ' ');
    const [guessArtist, guessTitle] = base.includes(' - ') ? base.split(' - ', 2) : [null, base];

    let art = null;
    const pic = meta.common.picture?.[0];
    if (pic?.data) {
      const artFile = `${id}.${pic.format?.includes('png') ? 'png' : 'jpg'}`;
      await fs.promises.writeFile(path.join(MUSIC_DIR, artFile), pic.data);
      art = `/music-files/${artFile}`;
    }
    const item = {
      id,
      source: 'upload',
      file: `${id}${ext}`,
      title: meta.common.title || guessTitle.trim(),
      artist: meta.common.artist || guessArtist?.trim() || null,
      album: meta.common.album || null,
      art,
      durationMs: meta.format.duration ? Math.round(meta.format.duration * 1000) : null,
      addedBy: typeof req.body.addedBy === 'string' ? req.body.addedBy.slice(0, 40) : null,
      addedAt: new Date().toISOString(),
    };
    db.playlist.unshift(item);
    added.push(item);
  }
  await save();
  res.json(added);
});

router.delete('/playlist/:id', async (req, res) => {
  const item = db.playlist.find((p) => p.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'Not found' });
  if (item.source === 'upload') {
    await fs.promises.rm(path.join(MUSIC_DIR, item.file), { force: true });
    if (item.art) await fs.promises.rm(path.join(MUSIC_DIR, path.basename(item.art)), { force: true });
  }
  db.playlist = db.playlist.filter((p) => p.id !== item.id);
  await save();
  res.json({ ok: true });
});
