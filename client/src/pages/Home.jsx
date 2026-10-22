import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Camera, CalendarHeart, Disc3, Heart, Images, Mail, MessageCircleHeart, Orbit, Star, StickyNote } from 'lucide-react';
import { useApp, useMemories } from '../lib/store.jsx';
import { api, thumbUrl } from '../lib/api.js';
import { heartBurst, celebrate } from '../lib/hearts.js';
import { dayIndex, formatDate, greeting, parseDay, seeded, specialDay, timeSince } from '../lib/dates.js';

const fade = (i) => ({
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  transition: { delay: 0.1 + i * 0.08, duration: 0.6, ease: [0.2, 0.8, 0.2, 1] },
});

function useNow(interval = 1000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), interval);
    return () => clearInterval(t);
  }, [interval]);
  return now;
}

function LoveCounter() {
  const { settings, setSettingsOpen } = useApp();
  const now = useNow();
  const start = parseDay(settings.startDate);

  if (!start || start > now) {
    return (
      <div className="card counter">
        <div className="label">Our story</div>
        <p style={{ fontFamily: 'var(--serif)', fontSize: 26, margin: '14px 0 18px' }}>
          Every love story has a first page.
        </p>
        <button className="btn primary" onClick={() => setSettingsOpen(true)}>
          <CalendarHeart size={18} /> Tell me our special day
        </button>
      </div>
    );
  }

  const t = timeSince(start, now);
  const pad = (n) => String(n).padStart(2, '0');
  const units = [
    t.years > 0 && ['years', t.years],
    ['months', t.months],
    ['days', t.days],
  ].filter(Boolean);
  const heartbeats = Math.floor((t.totalMs / 1000) * 1.2); // ~72 bpm

  return (
    <div className="card counter">
      <div className="label">Together since {formatDate(start)}</div>
      <div className="units">
        {units.map(([label, value]) => (
          <div className="unit" key={label}><b>{value}</b><small>{value === 1 ? label.slice(0, -1) : label}</small></div>
        ))}
      </div>
      <div className="clock">{pad(t.hours)} : {pad(t.minutes)} : {pad(t.seconds)}</div>
      <div className="total">
        That’s <b>{t.totalDays.toLocaleString()}</b> days and about <b>{heartbeats.toLocaleString()}</b> heartbeats of loving you.
      </div>
    </div>
  );
}

function MissYou() {
  const { boot, setBoot } = useApp();
  const [reply, setReply] = useState('');
  const btn = useRef(null);

  const press = async () => {
    const r = btn.current.getBoundingClientRect();
    heartBurst(r.left + r.width / 2, r.top + r.height / 2, 1.2);
    navigator.vibrate?.([30, 60, 30]);
    const { count, reply } = await api.post('/api/miss-you');
    setReply(reply);
    setBoot((b) => ({ ...b, missYouCount: count }));
  };

  const count = boot.missYouCount;
  return (
    <div className="card miss">
      <h3>Miss me?</h3>
      <p>Press the heart whenever you do. I’ll know. ♥</p>
      <button ref={btn} className="big-heart" onClick={press} aria-label="I miss you">
        <Heart size={54} fill="currentColor" />
      </button>
      <motion.div key={reply} className="reply" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        {reply}
      </motion.div>
      {count > 0 && (
        <div className="tally">You’ve missed me {count} {count === 1 ? 'time' : 'times'}. I’ve missed you {count + 1}.</div>
      )}
    </div>
  );
}

function MemoryOfTheDay() {
  const memories = useMemories();
  const navigate = useNavigate();
  const pick = useMemo(() => {
    const photos = memories.filter((m) => m.type === 'image' || m.thumb);
    if (!photos.length) return null;
    return photos[Math.floor(seeded(dayIndex()) * photos.length)];
  }, [memories]);

  if (!pick) {
    return (
      <div className="card motd">
        <div>
          <h3>Our first memory awaits</h3>
          <p>Add a photo of us and it’ll show up here.</p>
          <Link className="btn primary" to="/gallery">Add memories</Link>
        </div>
      </div>
    );
  }
  return (
    <div className="card motd">
      <button className="polaroid" onClick={() => navigate(`/gallery?open=${pick.id}`)} aria-label="Open memory of the day">
        <img src={thumbUrl(pick)} alt={pick.caption || 'A memory of us'} />
        <span className="cap">{pick.caption || formatDate(pick.takenAt, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
      </button>
      <div>
        <div className="section-label" style={{ margin: 0 }}>Memory of the day</div>
        <h3>Remember this?</h3>
        <p>{formatDate(pick.takenAt, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}. One of my favourite moments — because you’re in it.</p>
        <Link className="btn" to="/gallery">See all {memories.length} memories</Link>
      </div>
    </div>
  );
}

export default function Home() {
  const { settings, content } = useApp();
  const memories = useMemories();
  const now = useNow(60000);
  const special = specialDay(settings, now);
  const daily = content.dailyMessages[dayIndex(now) % content.dailyMessages.length];
  const unopened = content.letters.filter((l) => !l.openedAt).length;

  useEffect(() => {
    if (special) setTimeout(celebrate, 600);
  }, [special?.kind]); // eslint-disable-line react-hooks/exhaustive-deps

  const quick = [
    { to: '/gallery', icon: Images, title: 'Our Memories', sub: `${memories.length} moments` },
    { to: '/camera', icon: Camera, title: 'Say Cheese', sub: 'Camera with filters' },
    { to: '/universe', icon: Orbit, title: 'Our Universe', sub: 'Memories in 3D' },
    { to: '/letters', icon: Mail, title: 'Letters', sub: unopened ? `${unopened} unopened` : 'All read ♥' },
    { to: '/reasons', icon: Heart, title: 'Reasons', sub: `${content.reasons.length}+ reasons I love you` },
    { to: '/dreams', icon: Star, title: 'Our Dreams', sub: 'Things we’ll do together' },
    { to: '/notes', icon: StickyNote, title: 'Love Notes', sub: 'Little words for each other' },
    { to: '/music', icon: Disc3, title: 'Our Music', sub: 'Any song, our playlist' },
    { to: '/cupid', icon: MessageCircleHeart, title: 'Talk to Cupid', sub: 'Your AI companion 💘' },
  ];

  return (
    <main className="page">
      {special && (
        <motion.div className="special-banner" {...fade(0)}>{special.text}</motion.div>
      )}
      <motion.section className="hero" {...fade(0)}>
        <div className="hello">{greeting(now)},</div>
        <h1>{settings.herName}</h1>
        {settings.nickname && <div className="nick">my {settings.nickname} <Heart size={20} fill="var(--rose)" color="var(--rose)" style={{ verticalAlign: -2 }} /></div>}
      </motion.section>

      <div className="home-grid">
        <motion.div className="span-7" {...fade(1)}><LoveCounter /></motion.div>
        <motion.div className="span-5 card daily" {...fade(2)}>
          <span className="quote-mark">“</span>
          <div className="label">Today’s little message</div>
          <blockquote>{daily}</blockquote>
        </motion.div>
        <motion.div className="span-7" {...fade(3)}><MemoryOfTheDay /></motion.div>
        <motion.div className="span-5" {...fade(4)}><MissYou /></motion.div>
        <motion.nav className="quick" {...fade(5)} aria-label="Explore">
          {quick.map(({ to, icon: Icon, title, sub }) => (
            <Link key={to} to={to} className="card">
              <span className="ic"><Icon size={22} /></span>
              <b>{title}</b>
              <small>{sub}</small>
            </Link>
          ))}
        </motion.nav>
      </div>

      <footer className="footer">
        <div className="script">made with all my love</div>
        by {settings.fromName}, for {settings.herName} · psst… try typing “i love you”
      </footer>
    </main>
  );
}
