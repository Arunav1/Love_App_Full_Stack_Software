import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Send, X } from 'lucide-react';
import { useApp } from '../lib/store.jsx';
import { api } from '../lib/api.js';
import { heartBurst } from '../lib/hearts.js';
import { formatDate } from '../lib/dates.js';
import { Confirm } from '../components/Modal.jsx';

export default function Notes() {
  const { settings, toast } = useApp();
  const [notes, setNotes] = useState(null);
  const [text, setText] = useState('');
  const [from, setFrom] = useState(settings.herName);
  const [removing, setRemoving] = useState(null);

  useEffect(() => {
    api.get('/api/notes').then(setNotes).catch((e) => toast(e.message, 'error'));
  }, [toast]);

  const send = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    const r = e.currentTarget.getBoundingClientRect(); // read before the await – React clears currentTarget
    try {
      const note = await api.post('/api/notes', { text, from });
      setNotes((n) => [note, ...n]);
      setText('');
      heartBurst(r.left + r.width / 2, r.bottom - 30, 1);
      toast(from === settings.herName ? `Pinned! ${settings.fromName} will love this ♥` : 'Pinned to the board ♥');
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const remove = async (note) => {
    setNotes((n) => n.filter((x) => x.id !== note.id));
    await api.del(`/api/notes/${note.id}`);
  };

  if (!notes) return null;
  const people = [settings.herName, settings.fromName].filter(Boolean);

  return (
    <main className="page">
      <header className="page-head">
        <h1>Love Notes</h1>
        <p>A little board for little words. Leave a note for each other — big or small, silly or soppy.</p>
      </header>

      <form className="card note-compose" onSubmit={send}>
        <textarea className="textarea" value={text} onChange={(e) => setText(e.target.value)} maxLength={500}
          placeholder={`Write something sweet…`} onKeyDown={(e) => (e.metaKey || e.ctrlKey) && e.key === 'Enter' && send(e)} />
        <div className="row">
          <div className="tabs">
            {people.map((p) => (
              <button type="button" key={p} className={from === p ? 'active' : ''} onClick={() => setFrom(p)}>from {p}</button>
            ))}
          </div>
          <button className="btn primary" disabled={!text.trim()}><Send size={16} /> Pin it</button>
        </div>
      </form>

      {notes.length === 0 ? (
        <div className="empty"><div className="em">💌</div><h3>The board is waiting</h3><p>Be the first to leave a little note.</p></div>
      ) : (
        <div className="notes-board">
          <AnimatePresence initial={false}>
            {notes.map((n) => (
              <motion.div key={n.id} layout className="note" style={{ background: n.color, rotate: `${n.tilt}deg` }}
                initial={{ opacity: 0, scale: 0.6, y: -30 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.6 }}
                transition={{ type: 'spring', damping: 16, stiffness: 200 }}>
                <span className="pin" />
                <p>{n.text}</p>
                <div className="foot">
                  <span>— {n.from} · {formatDate(n.createdAt, { day: 'numeric', month: 'short' })}</span>
                  <button onClick={() => setRemoving(n)} aria-label="Remove note"><X size={16} /></button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <Confirm open={!!removing} title="Unpin this note?" text="It will be removed from the board." confirmLabel="Remove"
        danger onConfirm={() => remove(removing)} onClose={() => setRemoving(null)} />
    </main>
  );
}
