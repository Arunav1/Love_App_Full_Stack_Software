import { NavLink } from 'react-router-dom';
import { Camera, Disc3, Heart, House, Images, Mail, MessageCircleHeart, Orbit, Settings, Star, StickyNote, Volume2, VolumeX } from 'lucide-react';
import { useApp } from '../lib/store.jsx';
import { useMusic } from '../lib/useMusic.js';

const LINKS = [
  { to: '/home', label: 'Home', icon: House },
  { to: '/gallery', label: 'Memories', icon: Images },
  { to: '/camera', label: 'Camera', icon: Camera },
  { to: '/universe', label: 'Universe', icon: Orbit },
  { to: '/letters', label: 'Letters', icon: Mail },
  { to: '/reasons', label: 'Reasons', icon: Heart },
  { to: '/dreams', label: 'Dreams', icon: Star },
  { to: '/notes', label: 'Notes', icon: StickyNote },
  { to: '/music', label: 'Music', icon: Disc3 },
  { to: '/cupid', label: 'Cupid', icon: MessageCircleHeart },
];

export default function Nav() {
  const { settings, setSettingsOpen } = useApp();
  const [playing, toggleMusic] = useMusic();

  const extras = (
    <>
      <button className={`icon-btn ${playing ? 'on' : ''}`} onClick={toggleMusic}
        title={playing ? 'Pause the music box' : 'Play the music box'} aria-label="Toggle music box">
        {playing ? <Volume2 size={19} /> : <VolumeX size={19} />}
      </button>
      <button className="icon-btn" onClick={() => setSettingsOpen(true)} title="Settings" aria-label="Settings">
        <Settings size={19} />
      </button>
    </>
  );

  return (
    <>
      <div className="mobile-top">
        <span className="brand">{settings.herName} <Heart size={18} fill="var(--rose)" color="var(--rose)" /></span>
        <div className="row nav-mobile-extras">{extras}</div>
      </div>
      <nav className="nav">
        <NavLink to="/" className="nav-brand" title="Replay the intro">
          <Heart size={18} fill="currentColor" /> {settings.herName}
        </NavLink>
        <div className="nav-sep" />
        {LINKS.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} title={label}>
            <Icon size={18} /> <span>{label}</span>
          </NavLink>
        ))}
        <div className="nav-sep" />
        <div className="nav-desktop-extras">{extras}</div>
      </nav>
    </>
  );
}
