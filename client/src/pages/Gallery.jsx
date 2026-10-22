import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowDownUp, CalendarDays, Camera, Film, Heart, Image, LayoutGrid, Play, Search, Trash2, Upload } from 'lucide-react';
import { useApp } from '../lib/store.jsx';
import { celebrate } from '../lib/hearts.js';
import { formatDate } from '../lib/dates.js';
import MediaTile from '../components/MediaTile.jsx';
import Lightbox from '../components/Lightbox.jsx';
import Slideshow from '../components/Slideshow.jsx';
import { Confirm } from '../components/Modal.jsx';

const ACCEPT = 'image/*,video/*,.heic,.heif';

function useUploader() {
  const { upload, toast } = useApp();
  const [job, setJob] = useState(null); // { count, progress, phase }

  const start = useCallback(async (fileList) => {
    const files = [...fileList].filter((f) => /^(image|video)\//.test(f.type) || /\.(heic|heif)$/i.test(f.name));
    if (!files.length) return toast('Only photos and videos can live here ♥', 'error');
    setJob({ count: files.length, progress: 0, phase: 'uploading' });
    try {
      const results = await upload(files, (p) =>
        setJob((j) => ({ ...j, progress: p, phase: p >= 1 ? 'saving' : 'uploading' })),
      );
      const added = results.filter((r) => !r.error && !r.duplicate).length;
      const dupes = results.filter((r) => r.duplicate).length;
      const failed = results.filter((r) => r.error).length;
      if (added) {
        celebrate();
        toast(added === 1 ? 'A new memory, saved forever ♥' : `${added} new memories, saved forever ♥`);
      }
      if (dupes) toast(`${dupes} ${dupes === 1 ? 'was' : 'were'} already here — we never lose a memory 😉`);
      if (failed) toast(`${failed} file${failed === 1 ? '' : 's'} couldn’t be added`, 'error');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setJob(null);
    }
  }, [upload, toast]);

  return [job, start];
}

function groupByDay(items) {
  const groups = new Map();
  for (const m of items) {
    const d = new Date(m.takenAt);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (!groups.has(key)) groups.set(key, { date: d, items: [] });
    groups.get(key).items.push(m);
  }
  return [...groups.values()];
}

export default function Gallery() {
  const { media, content, updateMedia, deleteMedia, restoreMedia, deleteForever, emptyTrash, toast } = useApp();
  const [params, setParams] = useSearchParams();
  const [filter, setFilter] = useState('all');
  const [view, setView] = useState(() => localStorage.getItem('kaveri.view') || 'grid');
  const [newestFirst, setNewestFirst] = useState(true);
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState(params.get('open'));
  const [slideshow, setSlideshow] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [job, startUpload] = useUploader();
  const fileInput = useRef(null);
  const dragDepth = useRef(0);

  useEffect(() => {
    try { localStorage.setItem('kaveri.view', view); } catch { /* private mode */ }
  }, [view]);

  useEffect(() => {
    if (params.get('open')) setParams({}, { replace: true });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const live = useMemo(() => media.filter((m) => !m.deletedAt), [media]);
  const trash = useMemo(() => media.filter((m) => m.deletedAt), [media]);
  const counts = {
    all: live.length,
    image: live.filter((m) => m.type === 'image').length,
    video: live.filter((m) => m.type === 'video').length,
    favorite: live.filter((m) => m.favorite).length,
    trash: trash.length,
  };

  const items = useMemo(() => {
    let list = filter === 'trash' ? trash : live;
    if (filter === 'image' || filter === 'video') list = list.filter((m) => m.type === filter);
    if (filter === 'favorite') list = list.filter((m) => m.favorite);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((m) =>
        m.caption?.toLowerCase().includes(q) ||
        formatDate(m.takenAt, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).toLowerCase().includes(q));
    }
    const sign = newestFirst ? -1 : 1;
    return [...list].sort((a, b) => sign * (new Date(a.takenAt) - new Date(b.takenAt)));
  }, [filter, live, trash, query, newestFirst]);

  // The lightbox browses whatever is currently shown (or everything, if opened from elsewhere).
  const lightboxItems = filter === 'trash' ? live : items.some((m) => m.id === openId) ? items : live;
  const openIndex = lightboxItems.findIndex((m) => m.id === openId);

  // ── Actions ──
  const onOpen = useCallback((m) => setOpenId(m.id), []);
  const onFavorite = useCallback((m) => {
    updateMedia(m.id, { favorite: !m.favorite });
    if (!m.favorite) toast('Added to favourites ♥');
  }, [updateMedia, toast]);
  const onDelete = useCallback((m) => {
    deleteMedia(m.id);
    toast('Moved to Recently deleted', 'love', { label: 'Undo', onClick: () => restoreMedia(m.id) });
  }, [deleteMedia, restoreMedia, toast]);
  const onRestore = useCallback((m) => { restoreMedia(m.id); toast('Memory restored ♥'); }, [restoreMedia, toast]);
  const onDeleteForever = useCallback((m) => setConfirm({
    title: 'Delete forever?',
    text: 'This memory will be gone for good. Are you sure, love?',
    confirmLabel: 'Delete forever',
    onConfirm: () => deleteForever(m.id),
  }), [deleteForever]);

  const deleteFromLightbox = (m) => {
    const next = lightboxItems[openIndex + 1] ?? lightboxItems[openIndex - 1];
    setOpenId(next && next.id !== m.id ? next.id : null);
    onDelete(m);
  };

  // ── Drag & drop anywhere on the page ──
  useEffect(() => {
    const hasFiles = (e) => [...(e.dataTransfer?.types ?? [])].includes('Files');
    const enter = (e) => { if (hasFiles(e)) { dragDepth.current++; setDragging(true); } };
    const leave = () => { dragDepth.current = Math.max(0, dragDepth.current - 1); if (!dragDepth.current) setDragging(false); };
    const over = (e) => hasFiles(e) && e.preventDefault();
    const drop = (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      dragDepth.current = 0;
      setDragging(false);
      startUpload(e.dataTransfer.files);
    };
    window.addEventListener('dragenter', enter);
    window.addEventListener('dragleave', leave);
    window.addEventListener('dragover', over);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('dragenter', enter);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('dragover', over);
      window.removeEventListener('drop', drop);
    };
  }, [startUpload]);

  const tileProps = { onOpen, onFavorite, onDelete, onRestore, onDeleteForever };
  const renderGrid = (list) => (
    <div className="masonry">
      <AnimatePresence>
        {list.map((m) => <MediaTile key={m.id} item={m} {...tileProps} />)}
      </AnimatePresence>
    </div>
  );

  const tabs = [
    ['all', 'All', null],
    ['image', 'Photos', Image],
    ['video', 'Videos', Film],
    ['favorite', 'Favourites', Heart],
    ['trash', 'Recently deleted', Trash2],
  ];

  return (
    <main className="page">
      <header className="page-head">
        <h1>Our Memories</h1>
        <p>{counts.all} little moments, kept safe forever. Drop new ones anywhere on this page.</p>
      </header>

      <div className="toolbar">
        <div className="left">
          <div className="tabs" role="tablist">
            {tabs.map(([key, label, Icon]) => (
              <button key={key} className={filter === key ? 'active' : ''} onClick={() => setFilter(key)} role="tab" aria-selected={filter === key}>
                {Icon && <Icon size={15} />} {label} <span className="count">{counts[key]}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="right">
          <label className="search">
            <Search size={16} />
            <input className="input" placeholder="Search captions, dates…" value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
          <div className="tabs">
            <button className={view === 'grid' ? 'active' : ''} onClick={() => setView('grid')} title="Grid" aria-label="Grid view"><LayoutGrid size={16} /></button>
            <button className={view === 'timeline' ? 'active' : ''} onClick={() => setView('timeline')} title="Timeline" aria-label="Timeline view"><CalendarDays size={16} /></button>
            <button onClick={() => setNewestFirst((v) => !v)} title={newestFirst ? 'Newest first' : 'Oldest first'} aria-label="Change sort order">
              <ArrowDownUp size={16} /> {newestFirst ? 'Newest' : 'Oldest'}
            </button>
          </div>
          <button className="btn" onClick={() => setSlideshow(true)} disabled={!counts.image}><Play size={16} /> Slideshow</button>
          <Link className="btn" to="/camera"><Camera size={16} /> Take a photo</Link>
          <button className="btn primary" onClick={() => fileInput.current.click()} disabled={!!job}><Upload size={16} /> Add memories</button>
          <input ref={fileInput} type="file" accept={ACCEPT} multiple hidden
            onChange={(e) => { startUpload(e.target.files); e.target.value = ''; }} />
        </div>
      </div>

      {filter === 'trash' && trash.length > 0 && (
        <div className="card trash-note">
          <span>Deleted memories wait here, just in case you change your mind. 💭</span>
          <button className="btn small danger" onClick={() => setConfirm({
            title: 'Empty Recently deleted?',
            text: `${trash.length} ${trash.length === 1 ? 'memory' : 'memories'} will be deleted forever.`,
            confirmLabel: 'Empty it',
            onConfirm: emptyTrash,
          })}>
            <Trash2 size={15} /> Empty
          </button>
        </div>
      )}

      {items.length === 0 ? (
        <div className="empty">
          <div className="em">{filter === 'trash' ? '🗑️' : filter === 'favorite' ? '💗' : '📷'}</div>
          <h3>{filter === 'trash' ? 'Nothing here' : filter === 'favorite' ? 'No favourites yet' : query ? 'No matches' : 'No memories yet'}</h3>
          <p>{filter === 'favorite' ? 'Double-tap any photo to make it a favourite.' : filter === 'trash' ? 'Every memory is safe. ♥' : 'Add your first photo and let’s start our story.'}</p>
        </div>
      ) : view === 'timeline' ? (
        groupByDay(items).map((g) => (
          <section className="day-group" key={g.date.toDateString()}>
            <h3>
              {formatDate(g.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              <small>{g.items.length} {g.items.length === 1 ? 'memory' : 'memories'}</small>
            </h3>
            <div className="line" />
            {renderGrid(g.items)}
          </section>
        ))
      ) : (
        renderGrid(items)
      )}

      <AnimatePresence>
        {dragging && (
          <motion.div className="dropzone" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="inner">Drop your memories here ♥</div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {job && (
          <motion.div className="card upload-panel" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}>
            <h4><Upload size={16} /> {job.phase === 'saving' ? 'Wrapping them up with love…' : `Uploading ${job.count} ${job.count === 1 ? 'memory' : 'memories'}…`}</h4>
            <p>{Math.round(job.progress * 100)}%</p>
            <div className="progress"><div style={{ width: `${job.progress * 100}%` }} /></div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {openIndex >= 0 && (
          <Lightbox
            items={lightboxItems}
            index={openIndex}
            onIndex={(i) => setOpenId(lightboxItems[i].id)}
            onClose={() => setOpenId(null)}
            onFavorite={onFavorite}
            onCaption={(m, caption) => { updateMedia(m.id, { caption }); toast('Caption saved ♥'); }}
            onDelete={deleteFromLightbox}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {slideshow && (
          <Slideshow items={filter === 'favorite' && counts.favorite ? items : live} reasons={content.reasons} onClose={() => setSlideshow(false)} />
        )}
      </AnimatePresence>

      <Confirm open={!!confirm} {...confirm} danger onClose={() => setConfirm(null)} />
    </main>
  );
}
