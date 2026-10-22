import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Download, Heart, Trash2, X } from 'lucide-react';
import { mediaUrl, thumbUrl } from '../lib/api.js';
import { formatDate } from '../lib/dates.js';
import { heartBurst } from '../lib/hearts.js';

/**
 * Full-screen viewer. Arrow keys / swipe to move, double-tap to love,
 * F to favourite, Esc to close. The caption is editable in place.
 */
export default function Lightbox({ items, index, onIndex, onClose, onFavorite, onCaption, onDelete }) {
  const item = items[index];
  const [dir, setDir] = useState(0);
  const [caption, setCaption] = useState(item?.caption ?? '');
  const [pop, setPop] = useState(0);
  const lastTap = useRef(0);

  useEffect(() => setCaption(item?.caption ?? ''), [item?.id, item?.caption]);

  const go = useCallback((d) => {
    if (items.length < 2) return;
    setDir(d);
    onIndex((index + d + items.length) % items.length);
  }, [index, items.length, onIndex]);

  const love = useCallback((x, y) => {
    if (!item.favorite) onFavorite(item);
    setPop((p) => p + 1);
    heartBurst(x ?? window.innerWidth / 2, y ?? window.innerHeight / 2, 0.8);
  }, [item, onFavorite]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.matches('input, textarea')) return;
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
      if (e.key.toLowerCase() === 'f') onFavorite(item);
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [go, onClose, onFavorite, item]);

  if (!item) return null;

  const saveCaption = () => {
    if (caption.trim() !== (item.caption ?? '')) onCaption(item, caption.trim());
  };

  const onTap = (e) => {
    const now = Date.now();
    if (now - lastTap.current < 300) love(e.clientX, e.clientY);
    lastTap.current = now;
  };

  return createPortal(
    <motion.div className="lightbox" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="lb-top">
        <div className="meta">
          <b>{formatDate(item.takenAt, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</b>
          {index + 1} of {items.length}
        </div>
        <div className="acts">
          <button className={`btn icon ${item.favorite ? 'fav-on' : ''}`} onClick={() => onFavorite(item)}
            title="Favourite (F)" aria-label="Favourite">
            <Heart size={19} fill={item.favorite ? 'currentColor' : 'none'} />
          </button>
          <a className="btn icon" href={mediaUrl(item)} download={item.originalName} title="Download" aria-label="Download">
            <Download size={19} />
          </a>
          <button className="btn icon" onClick={() => onDelete(item)} title="Delete" aria-label="Delete"><Trash2 size={19} /></button>
          <button className="btn icon" onClick={onClose} title="Close (Esc)" aria-label="Close"><X size={20} /></button>
        </div>
      </div>

      <div className="lb-stage">
        <AnimatePresence initial={false} custom={dir} mode="popLayout">
          <motion.div
            key={item.id}
            className="frame"
            custom={dir}
            initial={{ opacity: 0, x: dir * 80, scale: 0.98 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: dir * -80, scale: 0.98 }}
            transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
            drag={item.type === 'image' ? 'x' : false}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.6}
            onDragEnd={(_, info) => {
              if (info.offset.x < -70 || info.velocity.x < -400) go(1);
              else if (info.offset.x > 70 || info.velocity.x > 400) go(-1);
            }}
            onClick={item.type === 'image' ? onTap : undefined}
          >
            {item.type === 'video' ? (
              <video className="media" src={mediaUrl(item)} poster={thumbUrl(item) ?? undefined} controls autoPlay playsInline />
            ) : (
              <img
                className="media"
                src={mediaUrl(item)}
                alt={item.caption || ''}
                draggable={false}
                style={{ backgroundImage: `url(${thumbUrl(item)})`, backgroundSize: 'cover' }}
              />
            )}
          </motion.div>
        </AnimatePresence>

        {items.length > 1 && (
          <>
            <button className="btn icon lb-nav prev" onClick={() => go(-1)} aria-label="Previous"><ChevronLeft /></button>
            <button className="btn icon lb-nav next" onClick={() => go(1)} aria-label="Next"><ChevronRight /></button>
          </>
        )}

        <AnimatePresence>
          {pop > 0 && (
            <motion.div
              key={pop}
              className="lb-pop"
              initial={{ scale: 0, opacity: 1, x: '-50%', y: '-50%' }}
              animate={{ scale: [0, 1.4, 1.1], opacity: [1, 1, 0] }}
              transition={{ duration: 1, times: [0, 0.35, 1] }}
            >
              <Heart size={140} fill="currentColor" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="lb-bottom">
        <input
          className="lb-caption"
          value={caption}
          placeholder="Write a little caption…"
          maxLength={300}
          onChange={(e) => setCaption(e.target.value)}
          onBlur={saveCaption}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        />
      </div>
    </motion.div>,
    document.body,
  );
}
