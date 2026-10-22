import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Heart, X } from 'lucide-react';
import { useApp } from '../lib/store.jsx';
import { api } from '../lib/api.js';
import { heartBurst } from '../lib/hearts.js';
import { useEscape } from '../components/Modal.jsx';

function useTypewriter(text, enabled, speed = 22) {
  const [count, setCount] = useState(enabled ? 0 : text.length);
  useEffect(() => {
    if (!enabled) return setCount(text.length);
    setCount(0);
    const t = setInterval(() => {
      setCount((c) => {
        if (c >= text.length) { clearInterval(t); return c; }
        // Pause a little longer at the end of sentences, like someone writing by hand.
        return c + (/[.!?\n]/.test(text[c]) ? 1 : 2);
      });
    }, speed);
    return () => clearInterval(t);
  }, [text, enabled, speed]);
  return [text.slice(0, count), count >= text.length, () => setCount(text.length)];
}

function Paper({ letter, signature, from, typewriter, onClose }) {
  const [shown, done, skip] = useTypewriter(letter.body, typewriter);
  useEscape(onClose);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  return createPortal(
    <motion.div className="paper-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <motion.article className="paper"
        initial={{ opacity: 0, y: 80, rotateX: 25, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, rotateX: 0, scale: 1 }}
        exit={{ opacity: 0, y: 40, scale: 0.95 }}
        transition={{ type: 'spring', damping: 22, stiffness: 160 }}>
        <button className="btn small icon close" onClick={onClose} aria-label="Close"><X size={18} /></button>
        <h2>{letter.title}</h2>
        <div className="body">{shown}{!done && <span className="caret" />}</div>
        {done && (
          <motion.div className="sign" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1 }}>
            <small>{signature}</small>
            {from} ♥
          </motion.div>
        )}
        {!done && <button className="skip" onClick={skip}>show the whole letter</button>}
      </motion.article>
    </motion.div>,
    document.body,
  );
}

function Envelope({ title, color, opened, onOpen, big }) {
  return (
    <motion.button className="envelope" style={{ '--env': color }} onClick={onOpen}
      whileTap={{ scale: 0.96 }} aria-label={title}>
      <span className="env">
        <span className="body" />
        <span className="pocket" />
        <span className="flap" />
        <span className="seal"><Heart size={big ? 24 : 20} fill="currentColor" /></span>
        {opened && <span className="opened">opened</span>}
      </span>
      <span className="title">{title}</span>
    </motion.button>
  );
}

export default function Letters() {
  const { content, settings, setBoot } = useApp();
  const [open, setOpen] = useState(null); // { letter, typewriter }

  const openLetter = (letter, e) => {
    heartBurst(e.clientX, e.clientY, 0.7);
    setTimeout(() => setOpen({ letter, typewriter: true }), 250);
    if (letter.id && !letter.openedAt) {
      api.post(`/api/letters/${letter.id}/open`).then(({ openedAt }) =>
        setBoot((b) => ({
          ...b,
          content: { ...b.content, letters: b.content.letters.map((l) => (l.id === letter.id ? { ...l, openedAt } : l)) },
        })));
    }
  };

  const main = { ...content.mainLetter, body: content.mainLetter.body };

  return (
    <main className="page">
      <header className="page-head">
        <h1>Letters for You</h1>
        <p>Words I want you to have whenever you need them. Open them when the moment is right.</p>
      </header>

      <div className="main-letter-wrap">
        <Envelope big title={main.title} color="#ffb3c7" onOpen={(e) => openLetter(main, e)} />
      </div>

      <h2 className="section-label" style={{ textAlign: 'center', marginTop: 60, fontSize: 13 }}>Open when…</h2>
      <div className="letters-grid">
        {content.letters.map((l) => (
          <Envelope key={l.id} title={l.title} color={l.color} opened={!!l.openedAt} onOpen={(e) => openLetter(l, e)} />
        ))}
      </div>

      <AnimatePresence>
        {open && (
          <Paper
            letter={open.letter}
            typewriter={open.typewriter}
            signature={open.letter.signature ?? 'All my love,'}
            from={settings.fromName}
            onClose={() => setOpen(null)}
          />
        )}
      </AnimatePresence>
    </main>
  );
}
