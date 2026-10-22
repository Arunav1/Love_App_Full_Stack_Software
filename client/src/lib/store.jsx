import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api, uploadFiles, mediaUrl } from './api.js';
import { player } from './music.js';

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

export function AppProvider({ children }) {
  const [status, setStatus] = useState(null); // { locked, hint, herName }
  const [boot, setBoot] = useState(null); // { settings, content, missYouCount }
  const [media, setMedia] = useState([]);
  const [toasts, setToasts] = useState([]);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const toast = useCallback((text, kind = 'love', action = null) => {
    const id = Math.random().toString(36).slice(2);
    const dismiss = () => setToasts((t) => t.filter((x) => x.id !== id));
    setToasts((t) => [...t.slice(-3), { id, text, kind, action, dismiss }]);
    setTimeout(dismiss, action ? 6000 : 3800);
  }, []);

  const load = useCallback(async () => {
    const s = await api.get('/api/status');
    setStatus(s);
    if (s.locked) return;
    const [b, m] = await Promise.all([api.get('/api/bootstrap'), api.get('/api/media')]);
    setBoot(b);
    setMedia(m);
  }, []);

  useEffect(() => {
    load().catch(() => setStatus({ error: true }));
  }, [load]);

  useEffect(() => {
    player.setSong(boot?.settings.song ? `/song/${boot.settings.song.file}` : null);
  }, [boot?.settings.song]);

  // ── Media actions (optimistic, so everything feels instant) ──────────────
  const patchLocal = (id, patch) => setMedia((all) => all.map((m) => (m.id === id ? { ...m, ...patch } : m)));

  const updateMedia = useCallback(async (id, patch) => {
    patchLocal(id, patch);
    try {
      await api.patch(`/api/media/${id}`, patch);
    } catch (e) {
      toast(e.message, 'error');
    }
  }, [toast]);

  const deleteMedia = useCallback(async (id) => {
    patchLocal(id, { deletedAt: new Date().toISOString() });
    await api.del(`/api/media/${id}`).catch((e) => toast(e.message, 'error'));
  }, [toast]);

  const restoreMedia = useCallback(async (id) => {
    patchLocal(id, { deletedAt: null });
    await api.post(`/api/media/${id}/restore`).catch((e) => toast(e.message, 'error'));
  }, [toast]);

  const deleteForever = useCallback(async (id) => {
    setMedia((all) => all.filter((m) => m.id !== id));
    await api.del(`/api/media/${id}?forever=1`).catch((e) => toast(e.message, 'error'));
  }, [toast]);

  const emptyTrash = useCallback(async () => {
    setMedia((all) => all.filter((m) => !m.deletedAt));
    await api.post('/api/trash/empty').catch((e) => toast(e.message, 'error'));
  }, [toast]);

  const upload = useCallback(async (files, onProgress) => {
    const results = await uploadFiles(files, onProgress);
    const added = results.filter((r) => !r.error);
    setMedia((all) => {
      const byId = new Map(all.map((m) => [m.id, m]));
      for (const r of added) byId.set(r.id, { ...r, deletedAt: null });
      return [...byId.values()];
    });
    return results;
  }, []);

  const saveSettings = useCallback(async (patch) => {
    const settings = await api.put('/api/settings', patch);
    setBoot((b) => ({ ...b, settings }));
    return settings;
  }, []);

  const setSettings = useCallback((settings) => setBoot((b) => ({ ...b, settings })), []);

  // ── Video posters: the browser grabs a frame and the server keeps it ─────
  const posterQueue = useRef(new Set());
  useEffect(() => {
    const todo = media.filter((m) => m.type === 'video' && !m.thumb && !posterQueue.current.has(m.id));
    if (!todo.length) return;
    (async () => {
      for (const m of todo) {
        posterQueue.current.add(m.id);
        try {
          const blob = await captureFrame(mediaUrl(m));
          const form = new FormData();
          form.append('thumb', blob, 'poster.jpg');
          const updated = await api.post(`/api/media/${m.id}/thumb`, form);
          patchLocal(m.id, updated);
        } catch {
          /* the tile will simply show the video itself */
        }
      }
    })();
  }, [media]);

  const value = useMemo(() => ({
    status, boot, media, toasts, toast, load,
    settings: boot?.settings, content: boot?.content,
    setBoot, updateMedia, deleteMedia, restoreMedia, deleteForever, emptyTrash, upload,
    saveSettings, setSettings, settingsOpen, setSettingsOpen,
  }), [status, boot, media, toasts, toast, load, updateMedia, deleteMedia, restoreMedia,
    deleteForever, emptyTrash, upload, saveSettings, setSettings, settingsOpen]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

function captureFrame(src) {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.src = src;
    const fail = () => reject(new Error('no frame'));
    const timeout = setTimeout(fail, 15000);
    video.onerror = fail;
    video.onloadedmetadata = () => {
      video.currentTime = Math.min(1, (video.duration || 2) / 3);
    };
    video.onseeked = () => {
      clearTimeout(timeout);
      const canvas = document.createElement('canvas');
      const scale = Math.min(1, 720 / Math.max(video.videoWidth, video.videoHeight));
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((b) => (b ? resolve(b) : fail()), 'image/jpeg', 0.85);
      video.removeAttribute('src');
      video.load();
    };
  });
}

/** Visible (not deleted) memories, newest first. */
export const useMemories = () => {
  const { media } = useApp();
  return useMemo(
    () => media.filter((m) => !m.deletedAt).sort((a, b) => new Date(b.takenAt) - new Date(a.takenAt)),
    [media],
  );
};
