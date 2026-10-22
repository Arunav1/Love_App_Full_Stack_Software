import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Music, Pause, Play, X } from 'lucide-react';
import { mediaUrl, thumbUrl } from '../lib/api.js';
import { player } from '../lib/music.js';
import { useMusic } from '../lib/useMusic.js';
import { nowPlaying } from '../lib/nowPlaying.js';

const DURATION = 6000;
// Ken Burns: each slide drifts and zooms a little differently.
const MOVES = [
  { from: { scale: 1, x: 0, y: 0 }, to: { scale: 1.12, x: -20, y: -10 } },
  { from: { scale: 1.12, x: 20, y: 0 }, to: { scale: 1, x: 0, y: 0 } },
  { from: { scale: 1.02, x: 0, y: 15 }, to: { scale: 1.14, x: 10, y: -15 } },
  { from: { scale: 1.14, x: -15, y: -10 } , to: { scale: 1.03, x: 10, y: 5 } },
];

/** A cinematic slideshow – each photo paired with a reason I love her. */
export default function Slideshow({ items, reasons, onClose }) {
  const photos = useMemo(() => items.filter((m) => m.type === 'image'), [items]);
  const words = useMemo(() => [...reasons].sort(() => Math.random() - 0.5), [reasons]);
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const [idle, setIdle] = useState(false);
  const [playing, toggleMusic] = useMusic();
  const idleTimer = useRef(null);

  useEffect(() => {
    const startedMusic = !player.playing && !nowPlaying.state.playing;
    if (startedMusic) player.play();
    document.body.style.overflow = 'hidden';
    return () => {
      if (startedMusic) player.pause();
      document.body.style.overflow = '';
    };
  }, []);

  useEffect(() => {
    if (paused || photos.length < 2) return;
    const t = setTimeout(() => setI((n) => (n + 1) % photos.length), DURATION);
    return () => clearTimeout(t);
  }, [i, paused, photos.length]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setI((n) => (n + 1) % photos.length);
      if (e.key === 'ArrowLeft') setI((n) => (n - 1 + photos.length) % photos.length);
      if (e.key === ' ') { e.preventDefault(); setPaused((p) => !p); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, photos.length]);

  const wake = () => {
    setIdle(false);
    clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => setIdle(true), 2500);
  };
  useEffect(() => { wake(); return () => clearTimeout(idleTimer.current); }, []);

  const photo = photos[i];
  if (!photo) return null;
  const move = MOVES[i % MOVES.length];
  const reason = photo.caption || words[i % words.length];

  return createPortal(
    <motion.div className={`slideshow ${idle ? 'idle' : ''}`} onPointerMove={wake} onClick={wake}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <AnimatePresence>
        <motion.div key={photo.id} className="slide" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 1.4 }}>
          <div className="bg" style={{ backgroundImage: `url(${thumbUrl(photo)})` }} />
          <motion.img src={mediaUrl(photo)} alt="" initial={move.from} animate={move.to}
            transition={{ duration: DURATION / 1000 + 1.5, ease: 'linear' }} />
        </motion.div>
      </AnimatePresence>
      <div className="vignette" />

      <AnimatePresence mode="wait">
        <motion.div key={photo.id} className="words" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.9, delay: 0.5 }}>
          {!photo.caption && <div className="because">I love you because…</div>}
          <div className="text">{reason}</div>
        </motion.div>
      </AnimatePresence>

      <div className="controls">
        <button className="btn icon" onClick={() => setI((n) => (n - 1 + photos.length) % photos.length)} aria-label="Previous"><ChevronLeft size={20} /></button>
        <button className="btn icon" onClick={() => setPaused((p) => !p)} aria-label={paused ? 'Play' : 'Pause'}>
          {paused ? <Play size={18} /> : <Pause size={18} />}
        </button>
        <button className="btn icon" onClick={() => setI((n) => (n + 1) % photos.length)} aria-label="Next"><ChevronRight size={20} /></button>
        <button className={`btn icon ${playing ? 'fav-on' : ''}`} onClick={toggleMusic} aria-label="Music"><Music size={18} /></button>
        <button className="btn icon" onClick={onClose} aria-label="Close"><X size={20} /></button>
      </div>
      {!paused && (
        <motion.div key={`bar-${i}`} className="bar" initial={{ width: '0%' }} animate={{ width: '100%' }}
          transition={{ duration: DURATION / 1000, ease: 'linear' }} />
      )}
    </motion.div>,
    document.body,
  );
}
