// A tiny music box, synthesised live with the Web Audio API – no audio files needed.
// If "our song" has been uploaded in Settings, that plays instead.

// Only one thing plays at a time: the music box, or a song from the music player.
const owners = new Map();
export const registerAudio = (name, pause) => owners.set(name, pause);
export const claimAudio = (name) => owners.forEach((pause, n) => n !== name && pause());

const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);
// A gentle progression (C – G – Am – F) with a lullaby melody on top. MIDI numbers.
const BARS = [
  { chord: [48, 55, 64], melody: [76, 74, 72, 74, 76, 76, 76, null] },
  { chord: [43, 50, 59], melody: [74, 74, 74, null, 76, 79, 79, null] },
  { chord: [45, 52, 60], melody: [76, 74, 72, 74, 76, 76, 76, 76] },
  { chord: [41, 48, 57], melody: [74, 74, 76, 74, 72, null, null, null] },
];
const STEP = 0.36; // seconds per eighth note

class MusicBox {
  ctx = null;
  timer = null;
  nextTime = 0;
  step = 0;

  start() {
    this.ctx ??= new (window.AudioContext || window.webkitAudioContext)();
    const ctx = this.ctx;
    ctx.resume();
    if (!this.out) {
      this.out = ctx.createGain();
      this.out.gain.value = 0.5;
      // Soft echo for a dreamy, music-box-in-a-big-room feel.
      const delay = ctx.createDelay();
      delay.delayTime.value = STEP * 1.5;
      const feedback = ctx.createGain();
      feedback.gain.value = 0.28;
      const wet = ctx.createGain();
      wet.gain.value = 0.35;
      this.out.connect(ctx.destination);
      this.out.connect(delay);
      delay.connect(feedback).connect(delay);
      delay.connect(wet).connect(ctx.destination);
    }
    this.out.gain.cancelScheduledValues(ctx.currentTime);
    this.out.gain.setTargetAtTime(0.5, ctx.currentTime, 0.3);
    this.nextTime = ctx.currentTime + 0.1;
    clearInterval(this.timer);
    this.timer = setInterval(() => this.schedule(), 50);
  }

  stop() {
    clearInterval(this.timer);
    this.timer = null;
    if (this.ctx && this.out) this.out.gain.setTargetAtTime(0, this.ctx.currentTime, 0.4);
  }

  schedule() {
    while (this.nextTime < this.ctx.currentTime + 0.25) {
      const bar = BARS[Math.floor(this.step / 8) % BARS.length];
      const i = this.step % 8;
      const note = bar.melody[i];
      if (note) this.bell(NOTE(note), this.nextTime, 0.16, 1.8);
      // Arpeggiated accompaniment
      if (i % 2 === 0) this.bell(NOTE(bar.chord[(i / 2) % 3] + 12), this.nextTime, 0.07, 1.4);
      if (i === 0) this.bell(NOTE(bar.chord[0]), this.nextTime, 0.09, 2.6);
      this.nextTime += STEP;
      this.step++;
    }
  }

  bell(freq, time, volume, decay) {
    const ctx = this.ctx;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(volume, time + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + decay);
    gain.connect(this.out);
    for (const [mult, amp] of [[1, 1], [2.01, 0.25], [3.98, 0.08]]) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq * mult;
      g.gain.value = amp;
      osc.connect(g).connect(gain);
      osc.start(time);
      osc.stop(time + decay + 0.05);
    }
  }
}

class Player {
  box = new MusicBox();
  audio = null;
  songUrl = null;
  playing = false;
  listeners = new Set();

  constructor() {
    registerAudio('box', () => this.playing && this.pause());
  }

  setSong(url) {
    if (url === this.songUrl) return;
    const wasPlaying = this.playing;
    if (wasPlaying) this.pause();
    this.songUrl = url;
    this.audio = null;
    if (wasPlaying) this.play();
  }

  play() {
    claimAudio('box');
    if (this.songUrl) {
      if (!this.audio) {
        this.audio = new Audio(this.songUrl);
        this.audio.loop = true;
      }
      this.audio.play().catch(() => {});
    } else {
      this.box.start();
    }
    this.playing = true;
    this.emit();
  }

  pause() {
    this.audio?.pause();
    this.box.stop();
    this.playing = false;
    this.emit();
  }

  toggle() {
    this.playing ? this.pause() : this.play();
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit() {
    this.listeners.forEach((fn) => fn(this.playing));
  }
}

export const player = new Player();
