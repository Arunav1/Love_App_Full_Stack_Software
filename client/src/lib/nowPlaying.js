// The song player behind the mini player. Picks the best way to play each track:
//   upload  → full song from our server
//   itunes  → 30-second preview
//   spotify → in this browser (Premium, desktop), on her active Spotify app (Premium),
//             or the Spotify embed player (free accounts / anything else)
import { useSyncExternalStore } from 'react';
import { claimAudio, registerAudio } from './music.js';
import * as spotify from './spotify.js';

const EMPTY = {
  track: null, queue: [], index: -1, playing: false, position: 0, duration: 0,
  mode: null, // 'audio' | 'spotify' | 'remote' | 'embed'
  embed: null, // 'track/<id>' | 'playlist/<id>'
  device: null, error: null,
};

const spotifyId = (uri) => uri?.split(':').pop();

class NowPlaying {
  state = EMPTY;
  listeners = new Set();
  audio = new Audio();
  premium = null;
  poll = null;

  constructor() {
    const a = this.audio;
    a.addEventListener('timeupdate', () => this.set({ position: a.currentTime * 1000 }));
    a.addEventListener('loadedmetadata', () => this.set({ duration: a.duration * 1000 }));
    a.addEventListener('play', () => this.set({ playing: true }));
    a.addEventListener('pause', () => this.set({ playing: false }));
    a.addEventListener('ended', () => this.next(true));
    a.addEventListener('error', () => this.state.mode === 'audio' && a.src && this.set({ playing: false, error: 'This song couldn’t be played.' }));
    registerAudio('tracks', () => this.pause());
  }

  set(patch) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((fn) => fn());
  }

  subscribe = (fn) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  play(track, queue) {
    queue = queue?.length ? queue : [track];
    // Must stay synchronous until here: browsers only allow audio to start inside the tap itself.
    spotify.sdk.player?.activateElement?.();
    claimAudio('tracks');
    this.set({
      track, queue, index: queue.findIndex((t) => t.id === track.id), error: null,
      position: 0, duration: track.source === 'itunes' ? 30000 : track.durationMs || 0, device: null,
    });
    if (track.source === 'spotify') {
      const uris = queue.filter((t) => t.source === 'spotify').map((t) => t.uri);
      return this.playSpotify({ uris, offset: { position: Math.max(0, uris.indexOf(track.uri)) } }, `track/${spotifyId(track.uri)}`);
    }
    this.stopSpotify();
    this.audio.src = track.source === 'upload' ? `/music-files/${track.file}` : track.previewUrl;
    this.set({ mode: 'audio', embed: null });
    return this.audio.play().catch(() => this.set({ playing: false }));
  }

  /** Play one of her Spotify playlists. */
  playPlaylist(playlist) {
    spotify.sdk.player?.activateElement?.();
    claimAudio('tracks');
    this.audio.pause();
    this.set({
      track: { id: playlist.uri, source: 'spotify', title: playlist.name, artist: 'Spotify playlist', art: playlist.images?.[0]?.url },
      queue: [], index: -1, position: 0, duration: 0, error: null, device: null,
    });
    return this.playSpotify({ context_uri: playlist.uri }, `playlist/${playlist.id}`);
  }

  async playSpotify(body, embed) {
    this.audio.pause();
    this.audio.removeAttribute('src');
    this.stopPolling();
    try {
      if (this.premium === null) this.premium = (await spotify.me()).product === 'premium';
      if (!this.premium) return this.set({ mode: 'embed', embed, playing: true });

      let deviceId = await spotify.initSdk((s) => this.fromSdk(s));
      let mode = 'spotify';
      if (!deviceId) {
        // Phones can't play Spotify inside a web page – use her Spotify app instead.
        const { devices } = await spotify.api('/me/player/devices');
        const device = devices.find((d) => d.is_active) ?? devices[0];
        if (!device) return this.set({ mode: 'embed', embed, playing: true });
        deviceId = device.id;
        mode = 'remote';
        this.set({ device: device.name });
      }
      await spotify.api(`/me/player/play?device_id=${deviceId}`, { method: 'PUT', body });
      this.set({ mode, embed, playing: true });
      this.startPolling();
    } catch {
      this.set({ mode: 'embed', embed, playing: true });
    }
  }

  fromSdk(s) {
    if (!s || this.state.mode !== 'spotify') return;
    const t = s.track_window?.current_track;
    this.fromSpotifyTrack(t, !s.paused, s.position, s.duration);
  }

  fromSpotifyTrack(t, playing, position, duration) {
    if (!t) return this.set({ playing });
    const index = this.state.queue.findIndex((q) => q.uri === t.uri);
    const isPlaylist = this.state.embed?.startsWith('playlist/');
    this.set({
      playing, position, duration,
      index: index >= 0 ? index : this.state.index,
      track: index >= 0 && !isPlaylist ? this.state.queue[index] : {
        id: `spotify:${t.id}`, source: 'spotify', uri: t.uri, title: t.name,
        artist: t.artists?.map((a) => a.name).join(', '),
        art: t.album?.images?.[0]?.url,
      },
    });
  }

  startPolling() {
    this.stopPolling();
    this.poll = setInterval(async () => {
      if (this.state.mode === 'spotify') {
        this.fromSdk(await spotify.sdk.player?.getCurrentState());
      } else if (this.state.mode === 'remote') {
        const s = await spotify.api('/me/player').catch(() => null);
        if (s) this.fromSpotifyTrack(s.item, s.is_playing, s.progress_ms, s.item?.duration_ms);
      }
    }, this.state.mode === 'remote' ? 4000 : 1000);
  }

  stopPolling() {
    clearInterval(this.poll);
    this.poll = null;
  }

  stopSpotify() {
    this.stopPolling();
    if (this.state.mode === 'spotify') spotify.sdk.player?.pause();
    if (this.state.mode === 'remote' && this.state.playing) spotify.api('/me/player/pause', { method: 'PUT' }).catch(() => {});
  }

  toggle() {
    const { mode, playing } = this.state;
    if (!playing) claimAudio('tracks');
    if (mode === 'audio') return playing ? this.audio.pause() : this.audio.play().catch(() => {});
    if (mode === 'spotify') return spotify.sdk.player?.togglePlay();
    if (mode === 'remote') {
      spotify.api(`/me/player/${playing ? 'pause' : 'play'}`, { method: 'PUT' }).catch(() => {});
      this.set({ playing: !playing });
    }
  }

  pause() {
    const { mode, playing } = this.state;
    if (mode === 'audio') this.audio.pause();
    else if (mode === 'embed') this.stop(); // the embed can't be paused from outside – close it
    else if (playing) this.toggle();
  }

  next(auto = false) {
    const { queue, index, mode } = this.state;
    if (mode === 'spotify') return spotify.sdk.player?.nextTrack();
    if (mode === 'remote') return spotify.api('/me/player/next', { method: 'POST' }).catch(() => {});
    if (index >= 0 && index < queue.length - 1) return this.play(queue[index + 1], queue);
    if (auto) this.set({ playing: false, position: 0 });
  }

  prev() {
    const { queue, index, mode, position } = this.state;
    if (mode === 'spotify') return spotify.sdk.player?.previousTrack();
    if (mode === 'remote') return spotify.api('/me/player/previous', { method: 'POST' }).catch(() => {});
    if (position > 3000 || index <= 0) return this.seek(0);
    return this.play(queue[index - 1], queue);
  }

  seek(fraction) {
    const ms = fraction * (this.state.duration || 0);
    if (this.state.mode === 'audio') this.audio.currentTime = ms / 1000;
    if (this.state.mode === 'spotify') spotify.sdk.player?.seek(ms);
    if (this.state.mode === 'remote') spotify.api(`/me/player/seek?position_ms=${Math.round(ms)}`, { method: 'PUT' }).catch(() => {});
    this.set({ position: ms });
  }

  stop() {
    this.stopSpotify();
    this.audio.pause();
    this.audio.removeAttribute('src');
    this.set(EMPTY);
  }
}

export const nowPlaying = new NowPlaying();
export const useNowPlaying = () => useSyncExternalStore(nowPlaying.subscribe, () => nowPlaying.state);
