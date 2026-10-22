import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Camera as CameraIcon, Download, Grid2x2, Heart, ImagePlus, RefreshCw, RotateCcw, Timer, Video } from 'lucide-react';
import { useApp } from '../lib/store.jsx';
import { celebrate, heartBurst } from '../lib/hearts.js';
import { FILTERS, FRAMES, FilterRenderer, drawFramed, frameSize, makeStrip, shutterSound } from '../lib/photoFilters.js';

const PREVIEW_MAX = 1080;
const CAPTURE_MAX = 2400;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const isTouch = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;

const sourceSize = (src) => ({ w: src.videoWidth || src.width, h: src.videoHeight || src.height });
const fit = ({ w, h }, max) => {
  const s = Math.min(1, max / Math.max(w, h));
  return { width: Math.round(w * s), height: Math.round(h * s) };
};

export default function Camera() {
  const { settings, upload, toast } = useApp();
  const navigate = useNavigate();

  const [mode, setMode] = useState('starting'); // starting | live | still | unavailable
  const [problem, setProblem] = useState(null); // insecure | denied | no-camera | no-webgl
  const [facing, setFacing] = useState('user');
  const [canFlip, setCanFlip] = useState(false);
  const [hasCamera, setHasCamera] = useState(false);
  const [filter, setFilter] = useState(1);
  const [strength, setStrength] = useState(1);
  const [frame, setFrame] = useState('none');
  const [timer, setTimer] = useState(0);
  const [booth, setBooth] = useState(false);
  const [countdown, setCountdown] = useState(null);
  const [boothShot, setBoothShot] = useState(0);
  const [flash, setFlash] = useState(0);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null); // { blob, url, strip }
  const [saving, setSaving] = useState(false);

  const videoRef = useRef(null);
  const viewRef = useRef(null);
  const streamRef = useRef(null);
  const stillRef = useRef(null);
  const renderer = useRef(null);
  const thumbRenderer = useRef(null);
  const chipRefs = useRef({});
  const nowRef = useRef({});
  const name = settings.herName;

  // Latest settings for the render loop without restarting it.
  nowRef.current = { mode, filter, strength, frame, mirror: mode === 'live' && facing === 'user', name };

  const source = () => (nowRef.current.mode === 'still' ? stillRef.current : nowRef.current.mode === 'live' ? videoRef.current : null);
  const sourceReady = (src) => src && (src.videoWidth ? src.readyState >= 2 : src.width > 0);

  // ── Set-up ──
  useEffect(() => {
    try {
      renderer.current = new FilterRenderer();
      thumbRenderer.current = new FilterRenderer();
    } catch {
      setProblem('no-webgl');
    }
    // Frames use these fonts – make sure they're ready before the first capture.
    document.fonts?.load("600 40px Caveat");
    document.fonts?.load("40px 'Great Vibes'");
    return () => stopStream();
  }, []);

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const startCamera = useCallback(async (face = facing) => {
    stopStream();
    if (!navigator.mediaDevices?.getUserMedia) {
      setProblem(window.isSecureContext ? 'no-camera' : 'insecure');
      setMode('unavailable');
      return;
    }
    setMode('starting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: face, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      const v = videoRef.current;
      v.srcObject = stream;
      await v.play().catch(() => {});
      setProblem(null);
      setHasCamera(true);
      setMode('live');
      const devices = await navigator.mediaDevices.enumerateDevices().catch(() => []);
      setCanFlip(devices.filter((d) => d.kind === 'videoinput').length > 1);
    } catch (err) {
      setProblem(err.name === 'NotAllowedError' || err.name === 'SecurityError' ? 'denied' : 'no-camera');
      setMode('unavailable');
    }
  }, [facing]);

  useEffect(() => { startCamera(facing); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Live preview loop ──
  useEffect(() => {
    let raf;
    const loop = (ts) => {
      raf = requestAnimationFrame(loop);
      const src = source();
      const view = viewRef.current;
      if (!renderer.current || !view || !sourceReady(src)) return;
      const s = nowRef.current;
      const { width, height } = fit(sourceSize(src), PREVIEW_MAX);
      renderer.current.upload(src);
      const photo = renderer.current.draw({ filter: s.filter, strength: s.strength, mirror: s.mirror, width, height, time: ts / 1000 });
      const size = frameSize(s.frame, width, height);
      if (view.width !== size.width || view.height !== size.height) Object.assign(view, size);
      drawFramed(view.getContext('2d'), photo, s.frame, { name: s.name, t: ts / 1000 });
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // ── Filter thumbnails (refresh every so often while live) ──
  useEffect(() => {
    const paint = () => {
      const src = source();
      if (!thumbRenderer.current || !sourceReady(src)) return;
      const { w, h } = sourceSize(src);
      const s = 120 / Math.min(w, h);
      const width = Math.round(w * s);
      const height = Math.round(h * s);
      thumbRenderer.current.upload(src);
      for (const f of FILTERS) {
        const chip = chipRefs.current[f.id];
        if (!chip) continue;
        const out = thumbRenderer.current.draw({ filter: f.id, strength: 1, mirror: nowRef.current.mirror, width, height });
        const side = Math.min(width, height);
        chip.getContext('2d').drawImage(out, (width - side) / 2, (height - side) / 2, side, side, 0, 0, chip.width, chip.height);
      }
    };
    const first = setTimeout(paint, 400);
    const t = mode === 'live' ? setInterval(paint, 1500) : null;
    return () => { clearTimeout(first); clearInterval(t); };
  }, [mode, facing]);

  // ── Capturing ──
  const captureFiltered = () => {
    const src = source();
    const s = nowRef.current;
    const { width, height } = fit(sourceSize(src), CAPTURE_MAX);
    renderer.current.upload(src);
    const out = renderer.current.draw({ filter: s.filter, strength: s.strength, mirror: s.mirror, width, height });
    const copy = document.createElement('canvas'); // the preview loop reuses the renderer's canvas
    copy.width = width;
    copy.height = height;
    copy.getContext('2d').drawImage(out, 0, 0);
    return copy;
  };

  const withFrame = (photo) => {
    const c = document.createElement('canvas');
    Object.assign(c, frameSize(nowRef.current.frame, photo.width, photo.height));
    drawFramed(c.getContext('2d'), photo, nowRef.current.frame, { name: nowRef.current.name });
    return c;
  };

  const snap = () => {
    setFlash((f) => f + 1);
    shutterSound();
    navigator.vibrate?.(30);
  };

  const shoot = async () => {
    if (busy || !sourceReady(source())) return;
    setBusy(true);
    try {
      await document.fonts?.ready;
      const count = booth && mode === 'live' ? 4 : 1;
      const shots = [];
      for (let i = 0; i < count; i++) {
        const wait = mode === 'live' ? (count > 1 ? 3 : timer) : 0;
        for (let n = wait; n > 0; n--) {
          setCountdown(n);
          await sleep(1000);
        }
        setCountdown(null);
        snap();
        shots.push(count > 1 ? captureFiltered() : withFrame(captureFiltered()));
        if (count > 1) {
          setBoothShot(i + 1);
          await sleep(600);
        }
      }
      const out = count > 1 ? makeStrip(shots, { name }) : shots[0];
      const blob = await new Promise((r) => out.toBlob(r, 'image/jpeg', 0.92));
      setResult({ blob, url: URL.createObjectURL(blob), strip: count > 1 });
      heartBurst(window.innerWidth / 2, window.innerHeight / 2, 0.8);
    } finally {
      setCountdown(null);
      setBoothShot(0);
      setBusy(false);
    }
  };

  const closeResult = () => {
    if (result) URL.revokeObjectURL(result.url);
    setResult(null);
  };

  const save = async () => {
    setSaving(true);
    try {
      const file = new File([result.blob], result.strip ? 'kaveri-photo-booth.jpg' : 'kaveri-camera.jpg', {
        type: 'image/jpeg', lastModified: Date.now(),
      });
      const [saved] = await upload([file]);
      if (saved?.error) throw new Error(saved.error);
      celebrate();
      toast('Saved to our memories ♥', 'love', { label: 'View', onClick: () => navigate(`/gallery?open=${saved.id}`) });
      closeResult();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  // ── Editing a photo from her device / phone camera ──
  const openFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      // Draw onto a canvas: WebGL ignores its flip-Y setting for ImageBitmaps, but honours it for canvases.
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
      const still = document.createElement('canvas');
      Object.assign(still, fit({ w: bmp.width, h: bmp.height }, CAPTURE_MAX));
      const ctx = still.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(bmp, 0, 0, still.width, still.height);
      bmp.close?.();
      stillRef.current = still;
      stopStream();
      setMode('still');
    } catch {
      toast('That photo couldn’t be opened. Try a JPG or PNG.', 'error');
    }
  };

  const flip = () => {
    const next = facing === 'user' ? 'environment' : 'user';
    setFacing(next);
    startCamera(next);
  };

  const fileInputs = (
    <>
      <input id="cam-native" type="file" accept="image/*" capture="user" hidden onChange={openFile} />
      <input id="cam-pick" type="file" accept="image/*" hidden onChange={openFile} />
    </>
  );

  const messages = {
    insecure: 'Live camera only works on a secure (https) address or on the computer running the app. You can still use your phone’s camera, and add the filters here.',
    denied: 'Camera permission was blocked. Allow it in your browser settings, or use your phone’s camera instead.',
    'no-camera': 'No camera found on this device. You can still add filters to any photo.',
    'no-webgl': 'This browser can’t run the filters. Try Chrome or Safari.',
  };

  return (
    <main className="page camera-page">
      <header className="page-head">
        <h1>Say Cheese</h1>
        <p>Strike a pose, {settings.nickname || settings.herName}. Pick a filter, add a frame, and every photo can go straight into our memories.</p>
      </header>
      {fileInputs}

      <div className="cam-layout">
        <div className="cam-main">
          <div className={`viewfinder ${mode}`}>
            <video ref={videoRef} className="cam-video" playsInline muted autoPlay />
            <canvas ref={viewRef} className="cam-view" style={{ visibility: mode === 'live' || mode === 'still' ? 'visible' : 'hidden' }} />

            {mode === 'starting' && <div className="cam-msg"><CameraIcon size={34} /><p>Waking up the camera…</p></div>}
            {mode === 'unavailable' && (
              <div className="cam-msg">
                <CameraIcon size={34} />
                <p>{messages[problem]}</p>
                <div className="row">
                  <label htmlFor={isTouch ? 'cam-native' : 'cam-pick'} className="btn primary"><CameraIcon size={16} /> {isTouch ? 'Open my camera' : 'Choose a photo'}</label>
                  {problem === 'denied' && <button className="btn" onClick={() => startCamera(facing)}><RefreshCw size={15} /> Try again</button>}
                </div>
              </div>
            )}

            <AnimatePresence>
              {countdown && (
                <motion.div key={countdown} className="countdown" initial={{ scale: 1.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.6, opacity: 0 }}>
                  {countdown}
                </motion.div>
              )}
            </AnimatePresence>
            {busy && booth && mode === 'live' && <div className="booth-chip">{boothShot} / 4</div>}
            <AnimatePresence>
              {flash > 0 && (
                <motion.div key={flash} className="flash" initial={{ opacity: 0.95 }} animate={{ opacity: 0 }} transition={{ duration: 0.45 }} />
              )}
            </AnimatePresence>
            {(mode === 'live' || mode === 'still') && (
              <div className="filter-label">{FILTERS.find((f) => f.id === filter)?.name}</div>
            )}
          </div>

          <div className="shutter-bar">
            <div className="side">
              {mode === 'still' && hasCamera && (
                <button className="btn icon" onClick={() => startCamera(facing)} title="Back to live camera" aria-label="Back to live camera"><Video size={19} /></button>
              )}
              <label htmlFor={isTouch ? 'cam-native' : 'cam-pick'} className="btn icon" title={isTouch ? 'Use phone camera' : 'Add filters to a photo'}>
                <ImagePlus size={19} />
              </label>
            </div>
            <button className={`shutter ${busy ? 'busy' : ''}`} onClick={shoot}
              disabled={busy || (mode !== 'live' && mode !== 'still')} aria-label={mode === 'still' ? 'Apply filter' : 'Take photo'}>
              <span />
            </button>
            <div className="side">
              {mode === 'live' && canFlip && (
                <button className="btn icon" onClick={flip} title="Switch camera" aria-label="Switch camera"><RefreshCw size={19} /></button>
              )}
            </div>
          </div>
        </div>

        <aside className="cam-controls card">
          <div className="section-label">Filters</div>
          <div className="filter-grid">
            {FILTERS.map((f) => (
              <button key={f.id} className={`filter-chip ${filter === f.id ? 'active' : ''}`} onClick={() => setFilter(f.id)}>
                <canvas ref={(el) => { chipRefs.current[f.id] = el; }} width={120} height={120} />
                <span>{f.name}</span>
              </button>
            ))}
          </div>

          {filter !== 0 && (
            <label className="strength">
              <span>Strength</span>
              <input type="range" min="0" max="1" step="0.05" value={strength} onChange={(e) => setStrength(Number(e.target.value))} />
              <b>{Math.round(strength * 100)}%</b>
            </label>
          )}

          <div className="section-label">Frame</div>
          <div className="pill-row">
            {FRAMES.map((f) => (
              <button key={f.id} className={`pill ${frame === f.id ? 'active' : ''}`} onClick={() => setFrame(f.id)} disabled={booth && mode === 'live'}>
                {f.name}
              </button>
            ))}
          </div>

          {mode === 'live' && (
            <>
              <div className="section-label">Shot</div>
              <div className="pill-row">
                {[0, 3, 10].map((t) => (
                  <button key={t} className={`pill ${timer === t && !booth ? 'active' : ''}`} onClick={() => { setTimer(t); setBooth(false); }}>
                    {t ? <><Timer size={13} /> {t}s</> : 'Instant'}
                  </button>
                ))}
                <button className={`pill ${booth ? 'active' : ''}`} onClick={() => setBooth((b) => !b)} title="4 photos in a strip">
                  <Grid2x2 size={13} /> Photo booth
                </button>
              </div>
            </>
          )}
        </aside>
      </div>

      <AnimatePresence>
        {result && (
          <motion.div className="overlay cam-result" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="result-card" initial={{ y: 40, scale: 0.94, rotate: -2 }} animate={{ y: 0, scale: 1, rotate: 0 }}
              transition={{ type: 'spring', damping: 18, stiffness: 180 }}>
              <img src={result.url} alt="Your photo" className={result.strip ? 'strip' : ''} />
              <div className="result-actions">
                <button className="btn" onClick={closeResult}><RotateCcw size={16} /> Retake</button>
                <a className="btn" href={result.url} download={`kaveri-${Date.now()}.jpg`}><Download size={16} /> Download</a>
                <button className="btn primary" onClick={save} disabled={saving}><Heart size={16} fill="currentColor" /> {saving ? 'Saving…' : 'Save to memories'}</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
