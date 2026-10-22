import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronRight, Heart, List, Shuffle } from 'lucide-react';
import { useApp } from '../lib/store.jsx';
import { heartBurst } from '../lib/hearts.js';

const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

export default function Reasons() {
  const { content, settings } = useApp();
  const total = content.reasons.length;
  const [order, setOrder] = useState(() => content.reasons.map((_, i) => i));
  const [pos, setPos] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [exitDir, setExitDir] = useState(1);

  const index = order[pos];
  const seen = useMemo(() => pos + (flipped ? 1 : 0), [pos, flipped]);

  const flip = (e) => {
    if (!flipped) heartBurst(e.clientX, e.clientY, 0.6);
    setFlipped((f) => !f);
  };

  const next = () => {
    setExitDir(Math.random() > 0.5 ? 1 : -1);
    setFlipped(false);
    setPos((p) => (p + 1) % total);
  };

  const reshuffle = () => {
    setOrder(shuffle(order));
    setPos(0);
    setFlipped(false);
  };

  return (
    <main className="page">
      <header className="page-head">
        <h1>Reasons I Love You</h1>
        <p>There are infinite, {settings.herName}. But here are {total} to start with. Tap a card to reveal it.</p>
      </header>

      <div className="deck">
        <div className="reason-card" style={{ cursor: 'default' }}>
          <div className="stack" style={{ transform: 'rotate(4deg) translateY(10px)' }} />
          <div className="stack" style={{ transform: 'rotate(-3deg) translateY(5px)' }} />
          <AnimatePresence mode="popLayout" custom={exitDir}>
            <motion.div
              key={pos}
              className="reason-card"
              style={{ position: 'absolute', inset: 0 }}
              custom={exitDir}
              initial={{ opacity: 0, y: 30, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={(d) => ({ opacity: 0, x: d * 420, rotate: d * 18, transition: { duration: 0.45 } })}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.7}
              onDragEnd={(_, info) => Math.abs(info.offset.x) > 110 && next()}
              onTap={flip}
            >
              <motion.div
                style={{ position: 'absolute', inset: 0, transformStyle: 'preserve-3d', transformPerspective: 1200 }}
                animate={{ rotateY: flipped ? 180 : 0 }}
                transition={{ type: 'spring', damping: 18, stiffness: 120 }}
              >
                <div className="face front">
                  <div className="num">Reason #{pos + 1}</div>
                  <Heart className="heart" size={96} fill="#fff" color="#fff" />
                  <small>tap to reveal</small>
                </div>
                <div className="face back">
                  <div className="num">Reason #{pos + 1}</div>
                  <p>{content.reasons[index]}</p>
                  <Heart className="tiny" size={22} fill="currentColor" />
                </div>
              </motion.div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <div className="deck-controls">
        <button className="btn" onClick={reshuffle}><Shuffle size={16} /> Shuffle</button>
        <button className="btn primary" onClick={next}>Next reason <ChevronRight size={18} /></button>
        <button className="btn" onClick={() => setShowAll((s) => !s)}><List size={16} /> {showAll ? 'Hide list' : 'See them all'}</button>
      </div>
      <div className="deck-progress">{seen} of {total} revealed · swipe the card for the next one</div>

      <AnimatePresence>
        {showAll && (
          <motion.ul className="all-reasons" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {content.reasons.map((r, i) => <li key={i} className="card">{r}</li>)}
            <li className="card" style={{ fontStyle: 'italic' }}>…and a million more I haven’t found the words for yet.</li>
          </motion.ul>
        )}
      </AnimatePresence>
    </main>
  );
}
