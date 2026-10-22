import { useEffect, useRef, useState } from 'react';
import { Music, Trash2, Upload } from 'lucide-react';
import Modal from './Modal.jsx';
import { useApp } from '../lib/store.jsx';
import { api } from '../lib/api.js';

const FIELDS = ['herName', 'nickname', 'fromName', 'startDate', 'birthday'];

export default function SettingsModal() {
  const { settings, saveSettings, setSettings, settingsOpen, setSettingsOpen, toast } = useApp();
  const [form, setForm] = useState({});
  const [busy, setBusy] = useState(false);
  const songInput = useRef(null);

  useEffect(() => {
    if (settingsOpen) setForm(Object.fromEntries(FIELDS.map((k) => [k, settings[k] ?? ''])));
  }, [settingsOpen, settings]);

  const close = () => setSettingsOpen(false);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await saveSettings(form);
      toast('Saved with love ♥');
      close();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const uploadSong = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.append('song', file);
      setSettings(await api.post('/api/song', form));
      toast('Our song is set 🎶 Tap the music note to play it');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const removeSong = async () => {
    setSettings(await api.del('/api/song'));
    toast('Back to the music box 🎐');
  };

  return (
    <Modal open={settingsOpen} onClose={close} width={560}>
      <h2>Settings</h2>
      <p className="sub">Little details that make this place ours.</p>
      <form className="grid" onSubmit={submit}>
        <div className="two">
          <label className="field">Her name
            <input className="input" value={form.herName ?? ''} onChange={set('herName')} required />
          </label>
          <label className="field">Pet name
            <input className="input" value={form.nickname ?? ''} onChange={set('nickname')} placeholder="Dhunu" />
          </label>
        </div>
        <label className="field">Made with love by
          <input className="input" value={form.fromName ?? ''} onChange={set('fromName')} />
        </label>
        <div className="two">
          <label className="field">Our special day <small>when “us” began</small>
            <input className="input" type="date" value={form.startDate ?? ''} onChange={set('startDate')} />
          </label>
          <label className="field">Her birthday <small>for a surprise 🎂</small>
            <input className="input" type="date" value={form.birthday ?? ''} onChange={set('birthday')} />
          </label>
        </div>

        <div className="section-label">Our song</div>
        <div className="card" style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Music size={20} color="var(--pink)" />
          <div style={{ flex: 1, minWidth: 160 }}>
            {settings.song ? <b>{settings.song.name}</b> : <span style={{ color: 'var(--muted)' }}>A gentle music box tune (no song uploaded)</span>}
          </div>
          <input ref={songInput} type="file" accept="audio/*" hidden onChange={uploadSong} />
          <button type="button" className="btn small" disabled={busy} onClick={() => songInput.current.click()}>
            <Upload size={15} /> {settings.song ? 'Change' : 'Upload a song'}
          </button>
          {settings.song && (
            <button type="button" className="btn small icon danger" onClick={removeSong} aria-label="Remove song"><Trash2 size={15} /></button>
          )}
        </div>

        <div className="actions">
          <button type="button" className="btn" onClick={close}>Cancel</button>
          <button className="btn primary" disabled={busy}>Save</button>
        </div>
      </form>
    </Modal>
  );
}
