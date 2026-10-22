// Everything about turning a file on disk into a "memory": hashing, thumbnails, dates.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import exifReader from 'exif-reader';
import { db, save, newId, MEDIA_DIR, THUMB_DIR } from './db.js';

export const IMAGE_EXT = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif', '.heic', '.heif'];
export const VIDEO_EXT = ['.mp4', '.mov', '.webm', '.m4v', '.ogg'];

const MIME = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp',
  '.gif': 'image/gif', '.avif': 'image/avif', '.heic': 'image/heic', '.heif': 'image/heif',
  '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm', '.m4v': 'video/mp4',
  '.ogg': 'video/ogg',
};

export function kindOf(filename, mime = '') {
  const ext = path.extname(filename).toLowerCase();
  if (IMAGE_EXT.includes(ext) || mime.startsWith('image/')) return 'image';
  if (VIDEO_EXT.includes(ext) || mime.startsWith('video/')) return 'video';
  return null;
}

async function hashFile(file) {
  const hash = crypto.createHash('sha1');
  for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}

// WhatsApp strips EXIF, but its filenames carry the date:
//   IMG-20261017-WA0016.jpg   |   WhatsApp Image 2026-10-22 at 1.53.42 PM.jpeg
export function dateFromName(name) {
  let m = name.match(/(20\d{2})-(\d{2})-(\d{2}) at (\d{1,2})\.(\d{2})\.(\d{2})\s*(AM|PM)?/i);
  if (m) {
    let h = Number(m[4]);
    if (m[7]?.toUpperCase() === 'PM' && h < 12) h += 12;
    if (m[7]?.toUpperCase() === 'AM' && h === 12) h = 0;
    return new Date(+m[1], +m[2] - 1, +m[3], h, +m[5], +m[6]).toISOString();
  }
  m = name.match(/(20\d{2})[-_]?(\d{2})[-_]?(\d{2})[-_ T]?(\d{2})?(\d{2})?(\d{2})?/);
  if (m && +m[2] >= 1 && +m[2] <= 12 && +m[3] >= 1 && +m[3] <= 31) {
    return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 12), +(m[5] ?? 0), +(m[6] ?? 0)).toISOString();
  }
  return null;
}

function exifDate(exif) {
  try {
    const d = exifReader(exif)?.Photo?.DateTimeOriginal;
    return d instanceof Date && !isNaN(d) ? d.toISOString() : null;
  } catch {
    return null;
  }
}

async function makeImageThumb(src, id) {
  const thumb = `${id}.webp`;
  const img = sharp(src, { failOn: 'none' }).rotate(); // .rotate() honours EXIF orientation
  const meta = await img.metadata();
  const info = await img
    .resize({ width: 720, height: 720, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80 })
    .toFile(path.join(THUMB_DIR, thumb));
  const swap = (meta.orientation ?? 1) >= 5;
  return {
    thumb,
    width: swap ? meta.height : meta.width,
    height: swap ? meta.width : meta.height,
    thumbWidth: info.width,
    thumbHeight: info.height,
    takenAt: meta.exif ? exifDate(meta.exif) : null,
  };
}

/**
 * Adds a file as a memory. `move` = true moves it (uploads), false copies (seeding,
 * so the original photos in the folder are never touched).
 */
export async function ingest(srcPath, { originalName, mime, lastModified, move = false, by = 'kaveri' }) {
  const type = kindOf(originalName, mime);
  if (!type) throw new Error(`Unsupported file type: ${originalName}`);

  const hash = await hashFile(srcPath);
  const existing = db.media.find((m) => m.hash === hash);
  if (existing) {
    if (move) await fs.promises.rm(srcPath, { force: true });
    if (existing.deletedAt) { existing.deletedAt = null; await save(); }
    return { item: existing, duplicate: true };
  }

  const id = newId();
  const ext = path.extname(originalName).toLowerCase() || (type === 'image' ? '.jpg' : '.mp4');
  const file = `${id}${ext}`;
  const dest = path.join(MEDIA_DIR, file);
  if (move) {
    await fs.promises.rename(srcPath, dest).catch(async () => {
      await fs.promises.copyFile(srcPath, dest);
      await fs.promises.rm(srcPath, { force: true });
    });
  } else {
    await fs.promises.copyFile(srcPath, dest);
  }

  const stat = await fs.promises.stat(dest);
  let extra = {};
  if (type === 'image') {
    try {
      extra = await makeImageThumb(dest, id);
    } catch (err) {
      console.warn(`Could not make a thumbnail for ${originalName}: ${err.message}`);
    }
  }

  const fallbackDate = lastModified ? new Date(Number(lastModified)).toISOString() : stat.mtime.toISOString();
  const item = {
    id,
    type,
    file,
    mime: MIME[ext] ?? mime ?? 'application/octet-stream',
    originalName,
    size: stat.size,
    hash,
    width: extra.width ?? null,
    height: extra.height ?? null,
    thumb: extra.thumb ?? null,
    thumbWidth: extra.thumbWidth ?? null,
    thumbHeight: extra.thumbHeight ?? null,
    takenAt: extra.takenAt ?? dateFromName(originalName) ?? fallbackDate,
    addedAt: new Date().toISOString(),
    caption: '',
    favorite: false,
    deletedAt: null,
    by,
  };
  db.media.push(item);
  await save();
  return { item, duplicate: false };
}

/** Saves a poster frame (captured by the browser) for a video. */
export async function setVideoThumb(item, buffer) {
  const thumb = `${item.id}.webp`;
  const info = await sharp(buffer)
    .resize({ width: 720, height: 720, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 78 })
    .toFile(path.join(THUMB_DIR, thumb));
  Object.assign(item, { thumb, thumbWidth: info.width, thumbHeight: info.height });
  item.width ??= info.width;
  item.height ??= info.height;
  await save();
  return item;
}

export async function removeFiles(item) {
  await fs.promises.rm(path.join(MEDIA_DIR, item.file), { force: true });
  if (item.thumb) await fs.promises.rm(path.join(THUMB_DIR, item.thumb), { force: true });
}

/** First run: bring every photo & video from the gift folder into the app. */
export async function seedFrom(dir) {
  if (db.seeded) return;
  let entries = [];
  try {
    entries = await fs.promises.readdir(dir, { withFileTypes: true });
  } catch {
    console.warn(`Seed folder not found: ${dir}`);
  }
  const files = entries.filter((e) => e.isFile() && kindOf(e.name)).map((e) => e.name).sort();
  let added = 0;
  for (const name of files) {
    try {
      const { duplicate } = await ingest(path.join(dir, name), { originalName: name, by: 'seed' });
      if (!duplicate) added++;
    } catch (err) {
      console.warn(`Skipped ${name}: ${err.message}`);
    }
  }
  db.seeded = true;
  await save();
  if (files.length) console.log(`  ♥ Imported ${added} memories from ${dir}`);
}
