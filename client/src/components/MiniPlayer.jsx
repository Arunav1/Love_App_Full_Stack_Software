import { AnimatePresence, motion } from 'framer-motion';
import { Music2, Pause, Play, SkipBack, SkipForward, Smartphone, X } from 'lucide-react';
import { nowPlaying, useNowPlaying } from '../lib/nowPlaying.js';

export const fmt = (ms) => {
  if (!ms && ms !== 0) return '';
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export function Artwork({ src, size = 48 }) {
  return src
    ? <img className="art" src={src} alt="" width={size} height={size} style={{ width: size, height: size }} />
    : <span className="art art-empty" style={{ width: size, height: size }}><Music2 size={size * 0.42} /></span>;
}

/** Floating player that keeps the music going on every page. */
export default function MiniPlayer() {
  const s = useNowPlaying();
  const { track, mode } = s;

  return (
    <AnimatePresence>
      {track && (
        <motion.div className={`mini-player card ${mode === 'embed' ? 'embed' : ''}`}
          initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 30 }}>
          <button className="mp-close" onClick={() => nowPlaying.stop()} aria-label="Close player"><X size={15} /></button>
          {mode === 'embed' ? (
            <>
              <iframe
                key={s.embed}
                title="Spotify player"
                src={`https://open.spotify.com/embed/${s.embed}?utm_source=generator&theme=0`}
                width="100%"
                height={s.embed?.startsWith('playlist') ? 352 : 152}
                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                loading="lazy"
              />
              <small className="mp-note">Log in to Spotify in this browser to hear full songs.</small>
            </>
          ) : (
            <>
              <div className="mp-row">
                <Artwork src={track.art} />
                <div className="mp-meta">
                  <b>{track.title}</b>
                  <span>
                    {track.artist}
                    {track.source === 'itunes' && <em className="badge">preview</em>}
                    {mode === 'remote' && s.device && <em className="badge"><Smartphone size={11} /> {s.device}</em>}
                  </span>
                </div>
                <div className="mp-controls">
                  <button onClick={() => nowPlaying.prev()} aria-label="Previous"><SkipBack size={17} fill="currentColor" /></button>
                  <button className="mp-play" onClick={() => nowPlaying.toggle()} aria-label={s.playing ? 'Pause' : 'Play'}>
                    {s.playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
                  </button>
                  <button onClick={() => nowPlaying.next()} aria-label="Next"><SkipForward size={17} fill="currentColor" /></button>
                </div>
              </div>
              {s.error ? (
                <small className="mp-note">{s.error}</small>
              ) : (
                <div className="mp-progress">
                  <span>{fmt(s.position)}</span>
                  <div className="bar" role="slider" aria-label="Seek" aria-valuenow={Math.round(s.position / 1000)}
                    onClick={(e) => {
                      const r = e.currentTarget.getBoundingClientRect();
                      nowPlaying.seek(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)));
                    }}>
                    <div style={{ width: `${s.duration ? Math.min(100, (s.position / s.duration) * 100) : 0}%` }} />
                  </div>
                  <span>{fmt(s.duration)}</span>
                </div>
              )}
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
