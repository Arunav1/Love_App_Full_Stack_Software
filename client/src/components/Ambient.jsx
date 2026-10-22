import { useEffect, useMemo } from 'react';
import { useApp } from '../lib/store.jsx';
import { heartBurst, heartRain } from '../lib/hearts.js';

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Floating hearts in the background, hearts on click, a sparkly cursor trail and a secret. */
export default function Ambient() {
  const { toast, settings } = useApp();

  const hearts = useMemo(
    () => Array.from({ length: 16 }, (_, i) => ({
      left: `${(i * 6.3 + Math.random() * 5) % 100}%`,
      size: 10 + Math.random() * 22,
      duration: 16 + Math.random() * 18,
      delay: -Math.random() * 30,
      opacity: 0.12 + Math.random() * 0.3,
      sway: `${(Math.random() - 0.5) * 120}px`,
    })),
    [],
  );

  // Tap on an empty spot → a little puff of hearts.
  useEffect(() => {
    const onClick = (e) => {
      if (reducedMotion()) return;
      if (e.target.closest('button, a, input, textarea, select, label, video, canvas, .tile, .overlay, .lightbox, .paper-overlay, .slideshow, .note, .reason-card, .envelope, .mini-player, .chat-page, .camera-page, .track, .no-burst')) return;
      heartBurst(e.clientX, e.clientY, 0.45);
    };
    window.addEventListener('click', onClick);
    return () => window.removeEventListener('click', onClick);
  }, []);

  // Heart trail behind the mouse (desktop only).
  useEffect(() => {
    if (reducedMotion() || !window.matchMedia('(pointer: fine)').matches) return;
    let last = 0;
    const onMove = (e) => {
      const now = performance.now();
      if (now - last < 70) return;
      last = now;
      const el = document.createElement('span');
      el.className = 'trail-heart';
      el.textContent = Math.random() > 0.3 ? '♥' : '✦';
      el.style.left = `${e.clientX}px`;
      el.style.top = `${e.clientY}px`;
      el.style.fontSize = `${8 + Math.random() * 10}px`;
      el.style.color = ['#ffb3c7', '#ff8fab', '#ffd6a5', '#c9b6ff'][Math.floor(Math.random() * 4)];
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 900);
    };
    window.addEventListener('pointermove', onMove);
    return () => window.removeEventListener('pointermove', onMove);
  }, []);

  // Secret: type "iloveyou" anywhere (or tap the top-left name 7 times on a phone).
  useEffect(() => {
    let typed = '';
    let taps = [];
    const reveal = () => {
      heartRain(5000);
      toast(`I love you more, ${settings.nickname || settings.herName}. Always. ♥`);
    };
    const onKey = (e) => {
      if (e.target.matches?.('input, textarea')) return;
      typed = (typed + e.key.toLowerCase()).replace(/[^a-z]/g, '').slice(-8);
      if (typed === 'iloveyou') {
        typed = '';
        reveal();
      }
    };
    const onTap = (e) => {
      if (!e.target.closest('.mobile-top .brand')) return;
      const now = Date.now();
      taps = [...taps.filter((t) => now - t < 2500), now];
      if (taps.length >= 7) {
        taps = [];
        reveal();
      }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('click', onTap);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('click', onTap);
    };
  }, [toast, settings.herName, settings.nickname]);

  return (
    <div className="floating-hearts" aria-hidden="true">
      {hearts.map((h, i) => (
        <span
          key={i}
          style={{
            left: h.left,
            fontSize: h.size,
            animationDuration: `${h.duration}s`,
            animationDelay: `${h.delay}s`,
            '--o': h.opacity,
            '--sway': h.sway,
          }}
        >
          ♥
        </span>
      ))}
    </div>
  );
}
