// A tiny JSON-file database. Writes are atomic (temp file + rename) and serialized,
// so a crash mid-write never corrupts our memories.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.resolve(import.meta.dirname, 'data');
export const MEDIA_DIR = path.join(DATA_DIR, 'media');
export const THUMB_DIR = path.join(DATA_DIR, 'thumbs');
export const TMP_DIR = path.join(DATA_DIR, 'tmp');
export const SONG_DIR = path.join(DATA_DIR, 'song');

for (const dir of [DATA_DIR, MEDIA_DIR, THUMB_DIR, TMP_DIR, SONG_DIR]) {
  fs.mkdirSync(dir, { recursive: true });
}

const DB_FILE = path.join(DATA_DIR, 'db.json');

const DEFAULTS = {
  version: 1,
  seeded: false,
  settings: {
    herName: 'Kaveri',
    nickname: 'Dhunu',
    fromName: 'Arunabha',
    startDate: '', // "our day" – YYYY-MM-DD
    birthday: '', // her birthday – YYYY-MM-DD
    song: null, // { file, name, mime }
  },
  media: [],
  dreams: [],
  notes: [],
  letterOpens: {},
  playlist: [],
  missYouCount: 0,
};

function load() {
  try {
    const raw = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    return {
      ...structuredClone(DEFAULTS),
      ...raw,
      settings: { ...DEFAULTS.settings, ...raw.settings },
    };
  } catch {
    return structuredClone(DEFAULTS);
  }
}

export const db = load();

let writing = Promise.resolve();
export function save() {
  writing = writing.then(async () => {
    const tmp = `${DB_FILE}.${process.pid}.tmp`;
    await fs.promises.writeFile(tmp, JSON.stringify(db, null, 2));
    await fs.promises.rename(tmp, DB_FILE);
  }).catch((err) => console.error('Could not save db:', err));
  return writing;
}

export const newId = () => crypto.randomBytes(8).toString('hex');
