import { memo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Heart, Play, RotateCcw, Trash2, X } from 'lucide-react';
import { mediaUrl, thumbUrl } from '../lib/api.js';

function MediaTile({ item, onOpen, onFavorite, onDelete, onRestore, onDeleteForever }) {
  const [pop, setPop] = useState(0);
  const src = thumbUrl(item);
  const aspect = item.thumbWidth && item.thumbHeight ? `${item.thumbWidth} / ${item.thumbHeight}` : undefined;
  const trashed = !!item.deletedAt;

  const favorite = (e) => {
    e.stopPropagation();
    if (!item.favorite) setPop((p) => p + 1);
    onFavorite(item);
  };

  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.35 }}
      className={`tile ${trashed ? 'deleted' : ''}`}
      onClick={() => !trashed && onOpen(item)}
      onDoubleClick={(e) => { if (!trashed && !item.favorite) favorite(e); }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && !trashed && onOpen(item)}
      aria-label={item.caption || `${item.type} memory`}
    >
      {src ? (
        <img src={src} alt={item.caption || ''} loading="lazy" style={{ aspectRatio: aspect }} draggable={false} />
      ) : item.type === 'video' ? (
        <video src={`${mediaUrl(item)}#t=0.5`} muted playsInline preload="metadata" />
      ) : (
        <div className="placeholder">♥</div>
      )}
      <div className={`shade ${item.caption ? 'keep' : ''}`} />
      {item.type === 'video' && <div className="video-badge"><Play size={22} fill="#fff" /></div>}
      {item.favorite && !trashed && <Heart className="fav-badge" size={22} fill="currentColor" />}
      {item.caption && <div className="cap">{item.caption}</div>}

      <div className="tools">
        {trashed ? (
          <>
            <button className="tool" title="Restore" onClick={(e) => { e.stopPropagation(); onRestore(item); }}><RotateCcw size={17} /></button>
            <button className="tool" title="Delete forever" onClick={(e) => { e.stopPropagation(); onDeleteForever(item); }}><X size={17} /></button>
          </>
        ) : (
          <>
            <button className="tool" title={item.favorite ? 'Unfavourite' : 'Favourite'} onClick={favorite}>
              <Heart size={17} fill={item.favorite ? 'currentColor' : 'none'} />
            </button>
            <button className="tool" title="Delete" onClick={(e) => { e.stopPropagation(); onDelete(item); }}><Trash2 size={17} /></button>
          </>
        )}
      </div>

      <AnimatePresence>
        {pop > 0 && (
          <motion.div
            key={pop}
            className="pop-heart"
            initial={{ scale: 0, opacity: 1, x: '-50%', y: '-50%' }}
            animate={{ scale: [0, 1.3, 1], opacity: [1, 1, 0] }}
            transition={{ duration: 0.9, times: [0, 0.4, 1] }}
            onAnimationComplete={() => setPop(0)}
          >
            <Heart size={84} fill="currentColor" />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default memo(MediaTile);
