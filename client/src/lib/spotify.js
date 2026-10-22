// Spotify: sign-in with PKCE (no client secret needed), Web API helpers and in-browser playback.
// Tokens live only in her browser (localStorage), never on the server.

const KEY = 'kaveri.spotify';
const VERIFIER = 'kaveri.spotify.verifier';
const SCOPES = [
  'streaming', 'user-read-email', 'user-read-private',
  'user-read-playback-state', 'user-modify-playback-state',
  'user-library-read', 'playlist-read-private', 'playlist-read-collaborative', 'user-top-read',
].join(' ');

const store = {
  get: () => { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } },
  set: (v) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* private mode */ } },
  clear: () => { try { localStorage.removeItem(KEY); } catch { /* private mode */ } },
};

export const redirectUri = () => `${location.origin}/spotify/callback`;

/** Spotify only accepts https addresses or the loopback IP (not "localhost", not a LAN IP). */
export function connectProblem() {
  const { protocol, hostname } = location;
  if (protocol === 'https:' || hostname === '127.0.0.1' || hostname === '[::1]') return null;
  if (hostname === 'localhost') return 'use-loopback';
  return 'needs-https';
}

const b64url = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)))
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export async function login(clientId) {
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(48)));
  const challenge = b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
  localStorage.setItem(VERIFIER, verifier);
  location.href = `https://accounts.spotify.com/authorize?${new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    scope: SCOPES,
    redirect_uri: redirectUri(),
    code_challenge_method: 'S256',
    code_challenge: challenge,
  })}`;
}

async function tokenRequest(params) {
  const r = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error_description || data.error || 'Spotify sign-in failed');
  const prev = store.get();
  const saved = {
    access: data.access_token,
    refresh: data.refresh_token ?? prev?.refresh,
    expires: Date.now() + (data.expires_in - 60) * 1000,
    clientId: params.client_id,
  };
  store.set(saved);
  return saved;
}

export async function finishLogin(clientId, code) {
  const verifier = localStorage.getItem(VERIFIER);
  localStorage.removeItem(VERIFIER);
  if (!verifier) throw new Error('Sign-in expired, please try again');
  return tokenRequest({
    grant_type: 'authorization_code', code, redirect_uri: redirectUri(), client_id: clientId, code_verifier: verifier,
  });
}

let refreshing = null;
export async function getToken() {
  const t = store.get();
  if (!t) return null;
  if (Date.now() < t.expires) return t.access;
  refreshing ??= tokenRequest({ grant_type: 'refresh_token', refresh_token: t.refresh, client_id: t.clientId })
    .then((s) => s.access)
    .catch(() => { store.clear(); return null; })
    .finally(() => { refreshing = null; });
  return refreshing;
}

export const isConnected = () => !!store.get();
export function logout() {
  store.clear();
  sdk.player?.disconnect();
  sdk.player = null;
  sdk.deviceId = null;
}

export async function api(path, { method = 'GET', body } = {}) {
  const token = await getToken();
  if (!token) throw Object.assign(new Error('Not connected to Spotify'), { status: 401 });
  const r = await fetch(`https://api.spotify.com/v1${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (r.status === 204) return null;
  const data = await r.json().catch(() => null);
  if (!r.ok) {
    throw Object.assign(new Error(data?.error?.message || `Spotify error ${r.status}`), {
      status: r.status, reason: data?.error?.reason,
    });
  }
  return data;
}

export const toTrack = (t) => ({
  id: `spotify:${t.id}`,
  source: 'spotify',
  uri: t.uri,
  title: t.name,
  artist: t.artists?.map((a) => a.name).join(', '),
  album: t.album?.name,
  art: t.album?.images?.[0]?.url,
  durationMs: t.duration_ms,
});

export const me = () => api('/me');
export const search = async (q) =>
  (await api(`/search?${new URLSearchParams({ q, type: 'track', limit: '10' })}`)).tracks.items.map(toTrack);
export const playlists = async () => (await api('/me/playlists?limit=30')).items.filter(Boolean);
export const likedSongs = async () => (await api('/me/tracks?limit=30')).items.map((i) => toTrack(i.track));
export const topTracks = async () => (await api('/me/top/tracks?limit=20&time_range=short_term')).items.map(toTrack);

// ── Playback inside the browser (Web Playback SDK – desktop browsers, Premium) ─
export const sdk = { player: null, deviceId: null, failed: false, ready: null };

function loadScript() {
  if (window.Spotify) return Promise.resolve();
  return new Promise((resolve, reject) => {
    window.onSpotifyWebPlaybackSDKReady = resolve;
    const s = document.createElement('script');
    s.src = 'https://sdk.scdn.co/spotify-player.js';
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

/** Resolves with this browser's Spotify device id, or null when in-browser playback isn't possible. */
export function initSdk(onState) {
  if (sdk.failed) return Promise.resolve(null);
  sdk.ready ??= (async () => {
    try {
      await loadScript();
      const player = new window.Spotify.Player({
        name: 'Kaveri’s Universe 💗',
        getOAuthToken: (cb) => getToken().then(cb),
        volume: 0.8,
      });
      const id = new Promise((resolve) => {
        player.addListener('ready', ({ device_id }) => resolve(device_id));
        for (const e of ['initialization_error', 'authentication_error', 'account_error']) {
          player.addListener(e, () => { sdk.failed = true; resolve(null); });
        }
        setTimeout(() => resolve(null), 8000);
      });
      player.addListener('player_state_changed', (s) => onState?.(s));
      if (!(await player.connect())) return null;
      sdk.player = player;
      sdk.deviceId = await id;
      return sdk.deviceId;
    } catch {
      sdk.failed = true;
      return null;
    }
  })();
  return sdk.ready;
}
