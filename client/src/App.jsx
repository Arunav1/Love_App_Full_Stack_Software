import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { AppProvider, useApp } from './lib/store.jsx';
import Nav from './components/Nav.jsx';
import Ambient from './components/Ambient.jsx';
import Toasts from './components/Toasts.jsx';
import SettingsModal from './components/SettingsModal.jsx';
import LockScreen from './components/LockScreen.jsx';
import MiniPlayer from './components/MiniPlayer.jsx';
import Home from './pages/Home.jsx';
import Gallery from './pages/Gallery.jsx';
import Letters from './pages/Letters.jsx';
import Reasons from './pages/Reasons.jsx';
import Dreams from './pages/Dreams.jsx';
import Notes from './pages/Notes.jsx';
import Music from './pages/Music.jsx';
import Chat from './pages/Chat.jsx';
import SpotifyCallback from './pages/SpotifyCallback.jsx';
import Camera from './pages/Camera.jsx';

// The 3D pages pull in three.js, so they load on demand.
const Intro = lazy(() => import('./pages/Intro.jsx'));
const Universe = lazy(() => import('./pages/Universe.jsx'));

export const LoadingHeart = () => (
  <div className="loading-heart"><Heart size={48} fill="currentColor" /></div>
);

function Shell() {
  const { status, boot } = useApp();
  const { pathname } = useLocation();

  if (status?.error) {
    return (
      <div className="lock">
        <div className="card">
          <h1>Oh no</h1>
          <p>I can’t reach the server right now. Is it running? (<code>npm start</code>)</p>
        </div>
      </div>
    );
  }
  if (!status) return <LoadingHeart />;
  if (status.locked) return <><div className="sky" /><LockScreen /></>;
  if (!boot) return <LoadingHeart />;

  const isIntro = pathname === '/';
  return (
    <div className="shell">
      {!isIntro && <><div className="sky" /><Ambient /><Nav /></>}
      <Suspense fallback={<LoadingHeart />}>
        <Routes>
          <Route path="/" element={<Intro />} />
          <Route path="/home" element={<Home />} />
          <Route path="/gallery" element={<Gallery />} />
          <Route path="/universe" element={<Universe />} />
          <Route path="/letters" element={<Letters />} />
          <Route path="/reasons" element={<Reasons />} />
          <Route path="/dreams" element={<Dreams />} />
          <Route path="/notes" element={<Notes />} />
          <Route path="/music" element={<Music />} />
          <Route path="/cupid" element={<Chat />} />
          <Route path="/camera" element={<Camera />} />
          <Route path="/spotify/callback" element={<SpotifyCallback />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </Suspense>
      {!isIntro && <MiniPlayer />}
      <SettingsModal />
      <Toasts />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Shell />
      </BrowserRouter>
    </AppProvider>
  );
}
