import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Plus, Sparkles, X } from 'lucide-react';
import { useApp } from '../lib/store.jsx';
import { api } from '../lib/api.js';
import { celebrate } from '../lib/hearts.js';
import { formatDate } from '../lib/dates.js';

export default function Dreams() {
  const { toast } = useApp();
  const [dreams, setDreams] = useState(null);
  const [text, setText] = useState('');

  useEffect(() => {
    api.get('/api/dreams').then(setDreams).catch((e) => toast(e.message, 'error'));
  }, [toast]);

  const add = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    try {
      const dream = await api.post('/api/dreams', { text });
      setDreams((d) => [...d, dream]);
      setText('');
      toast('A new dream for us ✨');
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const toggle = async (dream) => {
    const updated = await api.patch(`/api/dreams/${dream.id}`, { done: !dream.done });
    setDreams((d) => d.map((x) => (x.id === dream.id ? updated : x)));
    if (updated.done) {
      celebrate();
      toast('One more dream come true 💞');
    }
  };

  const remove = async (dream) => {
    setDreams((d) => d.filter((x) => x.id !== dream.id));
    await api.del(`/api/dreams/${dream.id}`);
  };

  if (!dreams) return null;
  const done = dreams.filter((d) => d.done).length;
  const sorted = [...dreams.filter((d) => !d.done), ...dreams.filter((d) => d.done)];

  return (
    <main className="page">
      <header className="page-head">
        <h1>Our Dreams</h1>
        <p>All the things we’re going to do together. Add yours, and tick them off as we live them.</p>
      </header>

      <div className="dreams">
        <form className="card dream-add" onSubmit={add}>
          <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Someday, let’s…" maxLength={200} />
          <button className="btn primary" disabled={!text.trim()}><Plus size={18} /> Add</button>
        </form>

        {dreams.length > 0 && (
          <div className="card dream-progress">
            <div className="top"><span><Sparkles size={15} /> Dreams come true</span><b>{done} / {dreams.length}</b></div>
            <div className="progress"><div style={{ width: `${(done / dreams.length) * 100}%` }} /></div>
          </div>
        )}

        <AnimatePresence initial={false}>
          {sorted.map((d) => (
            <motion.div key={d.id} layout className={`card dream ${d.done ? 'done' : ''}`}
              initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 40 }}>
              <button className="check" onClick={() => toggle(d)} aria-label={d.done ? 'Mark as not done' : 'Mark as done'}>
                <Check size={20} strokeWidth={3} />
              </button>
              <div className="txt">
                {d.text}
                {d.done && d.doneAt && <span className="when">lived it on {formatDate(d.doneAt)} ♥</span>}
              </div>
              <button className="btn small icon del" onClick={() => remove(d)} aria-label="Remove dream"><X size={16} /></button>
            </motion.div>
          ))}
        </AnimatePresence>

        {dreams.length === 0 && (
          <div className="empty"><div className="em">🌠</div><h3>Let’s dream together</h3><p>Write the first thing you want us to do.</p></div>
        )}
      </div>
    </main>
  );
}
