import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Heart, Loader2, LogOut, Pause, Play, Search, Trash2, Upload } from 'lucide-react';
import { useApp } from '../lib/store.jsx';
import { api } from '../lib/api.js';
import * as spotify from '../lib/spotify.js';
import { nowPlaying, useNowPlaying } from '../lib/nowPlaying.js';
import { Artwork, fmt } from '../components/MiniPlayer.jsx';

const SpotifyLogo = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 0a12 12 0 1 0 0 24 12 12 0 0 0 0-24zm5.5 17.3a.75.75 0 0 1-1 .25c-2.85-1.74-6.43-2.13-10.66-1.17a.75.75 0 1 1-.33-1.46c4.62-1.06 8.6-.6 11.74 1.33.35.21.47.68.25 1.05zm1.47-3.27a.94.94 0 0 1-1.29.3c-3.26-2-8.23-2.59-12.09-1.42a.94.94 0 1 1-.54-1.8c4.4-1.33 9.88-.68 13.61 1.62.44.27.58.85.31 1.3zm.13-3.4C15.2 8.3 8.78 8.09 5.06 9.22a1.13 1.13 0 1 1-.65-2.16c4.27-1.3 11.36-1.04 15.84 1.62a1.13 1.13 0 0 1-1.15 1.94z" />
  </svg>
);

function TrackRow({ track, queue, saved, onSave, onRemove }) {
  const np = useNowPlaying();
  const current = np.track?.id === track.id || (track.uri && np.track?.uri === track.uri);
  const playing = current && np.playing;
  return (
    <motion.div layout className={`track ${current ? 'current' : ''}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
      <button className="track-play" onClick={() => (current ? nowPlaying.toggle() : nowPlaying.play(track, queue))}
        aria-label={playing ? `Pause ${track.title}` : `Play ${track.title}`}>
        <Artwork src={track.art} size={52} />
        <span className="overlay-icon">{playing ? <Pause size={20} fill="#fff" /> : <Play size={20} fill="#fff" />}</span>
      </button>
      <div className="track-meta">
        <b>{track.title}</b>
        <span>
          {track.artist}
          {track.source === 'itunes' && <em className="badge">preview</em>}
          {track.source === 'spotify' && <em className="badge spotify"><SpotifyLogo size={10} /> Spotify</em>}
          {track.source === 'upload' && <em className="badge full">full song</em>}
          {track.addedBy && <em className="by">added by {track.addedBy}</em>}
        </span>
      </div>
      <span className="track-time">{fmt(track.durationMs)}</span>
      {onSave && (
        <button className={`btn small icon ${saved ? 'fav-on' : ''}`} onClick={() => onSave(track)}
          title={saved ? 'In Our Playlist' : 'Add to Our Playlist'} aria-label="Add to Our Playlist">
          <Heart size={16} fill={saved ? 'currentColor' : 'none'} />
        </button>
      )}
      {onRemove && (
        <button className="btn small icon" onClick={() => onRemove(track)} title="Remove from Our Playlist" aria-label="Remove">
          <Trash2 size={15} />
        </button>
      )}
    </motion.div>
  );
}

function SpotifyCard({ clientId, profile, onDisconnect }) {
  const { settings } = useApp();
  const problem = spotify.connectProblem();

  if (!clientId) {
    return (
      <div className="card spotify-card muted">
        <SpotifyLogo size={26} />
        <div><b>Spotify isn’t set up yet</b><span>{settings.fromName} needs to add a Spotify Client ID (see the README). Until then, search plays previews and uploaded songs play in full.</span></div>
      </div>
    );
  }
  if (profile) {
    return (
      <div className="card spotify-card on">
        {profile.images?.[0]?.url ? <img src={profile.images[0].url} alt="" className="avatar" /> : <SpotifyLogo size={30} />}
        <div>
          <b>Connected as {profile.display_name || 'you'}</b>
          <span>{profile.product === 'premium'
            ? 'Premium ✨ full songs play right here (or on your Spotify app on a phone).'
            : 'Free account: songs play in the Spotify player that pops up.'}</span>
        </div>
        <button className="btn small" onClick={onDisconnect}><LogOut size={14} /> Disconnect</button>
      </div>
    );
  }
  const connect = () => {
    if (problem === 'use-loopback') {
      location.href = `${location.protocol}//127.0.0.1:${location.port}/music?connect=1`;
    } else {
      spotify.login(clientId);
    }
  };
  return (
    <div className="card spotify-card">
      <SpotifyLogo size={30} />
      <div>
        <b>Bring your Spotify</b>
        <span>{problem === 'needs-https'
          ? 'Spotify only allows connecting from a secure (https) address. Open the app on the computer it runs on, or from its https link.'
          : 'Search all of Spotify, play your playlists and liked songs.'}</span>
      </div>
      <button className="btn spotify-btn" onClick={connect} disabled={problem === 'needs-https'}><SpotifyLogo size={16} /> Connect Spotify</button>
    </div>
  );
}

export default function Music() {
  const { boot, settings, toast } = useApp();
  const clientId = boot.features?.spotifyClientId;
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState('search');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [playlist, setPlaylist] = useState([]);
  const [profile, setProfile] = useState(null);
  const [mine, setMine] = useState(null); // { liked, top, playlists }
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef(null);
  const searchSeq = useRef(0);
  const connected = !!profile;

  useEffect(() => {
    api.get('/api/playlist').then(setPlaylist).catch(() => {});
  }, []);

  // Spotify profile (and finishing a hop from "localhost" to 127.0.0.1)
  useEffect(() => {
    if (!clientId) return;
    if (params.get('connect') === '1' && !spotify.isConnected() && !spotify.connectProblem()) {
      setParams({}, { replace: true });
      spotify.login(clientId);
      return;
    }
    if (spotify.isConnected()) spotify.me().then(setProfile).catch(() => spotify.logout());
  }, [clientId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!connected || tab !== 'spotify' || mine) return;
    Promise.all([
      spotify.likedSongs().catch(() => []),
      spotify.topTracks().catch(() => []),
      spotify.playlists().catch(() => []),
    ]).then(([liked, top, playlists]) => setMine({ liked, top, playlists }));
  }, [connected, tab, mine]);

  const runSearch = useCallback(async (q) => {
    const seq = ++searchSeq.current;
    if (!q.trim()) { setResults(null); return; }
    setSearching(true);
    try {
      const found = connected
        ? await spotify.search(q).catch(() => api.get(`/api/music/search?q=${encodeURIComponent(q)}`))
        : await api.get(`/api/music/search?q=${encodeURIComponent(q)}`);
      if (seq === searchSeq.current) setResults(found);
    } catch (err) {
      if (seq === searchSeq.current) toast(err.message, 'error');
    } finally {
      if (seq === searchSeq.current) setSearching(false);
    }
  }, [connected, toast]);

  useEffect(() => {
    const t = setTimeout(() => runSearch(query), 450);
    return () => clearTimeout(t);
  }, [query, runSearch]);

  const keyOf = (t) => t.uri || t.previewUrl || t.id;
  const savedKeys = new Set(playlist.map(keyOf));

  const save = async (track) => {
    const existing = playlist.find((p) => keyOf(p) === keyOf(track));
    if (existing) return remove(existing);
    try {
      const item = await api.post('/api/playlist', { ...track, addedBy: settings.herName });
      setPlaylist((p) => [item, ...p.filter((x) => x.id !== item.id)]);
      toast('Added to Our Playlist 🎶');
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const remove = async (track) => {
    setPlaylist((p) => p.filter((x) => x.id !== track.id));
    await api.del(`/api/playlist/${track.id}`).catch((e) => toast(e.message, 'error'));
  };

  const uploadSongs = async (e) => {
    const files = [...e.target.files];
    e.target.value = '';
    if (!files.length) return;
    setUploading(true);
    try {
      const form = new FormData();
      files.forEach((f) => form.append('songs', f));
      form.append('addedBy', settings.herName);
      const added = await api.post('/api/playlist/upload', form);
      setPlaylist((p) => [...added, ...p]);
      setTab('playlist');
      toast(added.length === 1 ? `“${added[0].title}” is ours now 🎶` : `${added.length} songs added 🎶`);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setUploading(false);
    }
  };

  const disconnect = () => {
    spotify.logout();
    nowPlaying.premium = null;
    setProfile(null);
    setMine(null);
    if (tab === 'spotify') setTab('search');
    toast('Spotify disconnected');
  };

  const list = (tracks, { removable } = {}) => (
    <div className="tracks">
      <AnimatePresence initial={false}>
        {tracks.map((t) => (
          <TrackRow key={t.id} track={t} queue={tracks} saved={savedKeys.has(keyOf(t))}
            onSave={t.source !== 'upload' && !removable ? save : undefined}
            onRemove={removable ? remove : undefined} />
        ))}
      </AnimatePresence>
    </div>
  );

  const tabs = [
    ['search', 'Search'],
    ['playlist', `Our Playlist · ${playlist.length}`],
    ...(connected ? [['spotify', 'Your Spotify']] : []),
  ];

  return (
    <main className="page music-page">
      <header className="page-head">
        <h1>Our Music</h1>
        <p>Search any song, keep the ones that are “us” in our playlist, and play them anywhere in this little universe.</p>
      </header>

      <SpotifyCard clientId={clientId} profile={profile} onDisconnect={disconnect} />

      <label className="music-search card">
        {searching ? <Loader2 size={20} className="spin" /> : <Search size={20} />}
        <input value={query} onChange={(e) => { setQuery(e.target.value); setTab('search'); }}
          placeholder={connected ? 'Search all of Spotify…' : 'Search any song or artist…'} />
        <span className="via">{connected ? <><SpotifyLogo size={13} /> Spotify</> : '30s previews'}</span>
      </label>

      <div className="toolbar" style={{ marginTop: 18 }}>
        <div className="tabs">
          {tabs.map(([key, label]) => (
            <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>{label}</button>
          ))}
        </div>
        {tab === 'playlist' && (
          <div className="right">
            {playlist.length > 0 && <button className="btn" onClick={() => nowPlaying.play(playlist[0], playlist)}><Play size={16} /> Play all</button>}
            <button className="btn primary" onClick={() => fileInput.current.click()} disabled={uploading}>
              {uploading ? <Loader2 size={16} className="spin" /> : <Upload size={16} />} Upload songs
            </button>
          </div>
        )}
        <input ref={fileInput} type="file" accept="audio/*,.mp3,.m4a,.flac,.wav,.ogg,.opus" multiple hidden onChange={uploadSongs} />
      </div>

      {tab === 'search' && (
        results === null ? (
          <div className="empty"><div className="em">🎧</div><h3>What are we listening to?</h3><p>Try “Tum Hi Ho”, “Perfect” or your favourite artist.</p></div>
        ) : results.length === 0 && !searching ? (
          <div className="empty"><div className="em">🔍</div><h3>No songs found</h3><p>Try a different spelling or the artist’s name.</p></div>
        ) : list(results)
      )}

      {tab === 'playlist' && (
        playlist.length === 0 ? (
          <div className="empty"><div className="em">💿</div><h3>Our playlist is empty</h3>
            <p>Tap the ♥ on any song to add it, or upload song files to play them in full.</p></div>
        ) : list(playlist, { removable: true })
      )}

      {tab === 'spotify' && (
        !mine ? <div className="empty"><Loader2 className="spin" /></div> : (
          <>
            {mine.playlists.length > 0 && (
              <section>
                <h3 className="music-h">Your playlists</h3>
                <div className="sp-playlists">
                  {mine.playlists.map((p) => (
                    <button key={p.id} className="sp-playlist card" onClick={() => nowPlaying.playPlaylist(p)}>
                      <Artwork src={p.images?.[0]?.url} size={140} />
                      <b>{p.name}</b>
                    </button>
                  ))}
                </div>
              </section>
            )}
            {mine.top.length > 0 && <section><h3 className="music-h">On repeat lately</h3>{list(mine.top)}</section>}
            {mine.liked.length > 0 && <section><h3 className="music-h">Liked songs</h3>{list(mine.liked)}</section>}
          </>
        )
      )}
    </main>
  );
}
