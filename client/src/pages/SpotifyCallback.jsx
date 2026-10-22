import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../lib/store.jsx';
import { finishLogin } from '../lib/spotify.js';
import { Heart } from 'lucide-react';

let handled = false; // the code can only be used once (StrictMode runs effects twice)

export default function SpotifyCallback() {
  const { boot, toast } = useApp();
  const navigate = useNavigate();

  useEffect(() => {
    if (handled) return;
    handled = true;
    const params = new URLSearchParams(location.search);
    const code = params.get('code');
    const done = (msg, kind) => {
      toast(msg, kind);
      navigate('/music', { replace: true });
    };
    if (!code) return done(params.get('error') === 'access_denied' ? 'Spotify wasn’t connected' : 'Spotify sign-in failed', 'error');
    finishLogin(boot.features.spotifyClientId, code)
      .then(() => done('Spotify connected 🎶'))
      .catch((err) => done(err.message, 'error'));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return <div className="loading-heart"><Heart size={48} fill="currentColor" /></div>;
}
