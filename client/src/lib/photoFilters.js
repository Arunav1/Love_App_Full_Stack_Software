// Photo filters (a WebGL shader, so preview and saved photo look identical everywhere)
// plus frames drawn on top with canvas 2D.

export const FILTERS = [
  { id: 0, name: 'Original' },
  { id: 1, name: 'Rosé' },
  { id: 2, name: 'Golden Hour' },
  { id: 9, name: 'Love Glow' },
  { id: 5, name: 'Dreamy' },
  { id: 6, name: 'Lavender' },
  { id: 3, name: 'Vintage' },
  { id: 7, name: 'Cinema' },
  { id: 8, name: 'Film' },
  { id: 10, name: 'Pop' },
  { id: 4, name: 'Noir' },
];

export const FRAMES = [
  { id: 'none', name: 'No frame' },
  { id: 'polaroid', name: 'Polaroid' },
  { id: 'hearts', name: 'Hearts' },
  { id: 'sparkle', name: 'Sparkles' },
  { id: 'pink', name: 'Pink frame' },
  { id: 'date', name: 'Retro date' },
];

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() { vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;

const FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform sampler2D uTex;
uniform int uFilter;
uniform float uStrength;
uniform float uTime;
uniform vec2 uRes;
uniform bool uMirror;
varying vec2 vUv;

float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
vec3 sat(vec3 c, float s) { return mix(vec3(luma(c)), c, s); }
vec3 contrast(vec3 c, float k) { return (c - 0.5) * k + 0.5; }
float vignette(float amt) { vec2 d = vUv - 0.5; return 1.0 - amt * dot(d, d) * 2.2; }
float rand(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
vec2 src(vec2 uv) { return uMirror ? vec2(1.0 - uv.x, uv.y) : uv; }
vec3 glow(vec2 uv, float radius) {
  vec2 px = radius / uRes;
  vec3 s = vec3(0.0);
  for (int x = -1; x <= 1; x++)
    for (int y = -1; y <= 1; y++)
      s += texture2D(uTex, src(uv + vec2(float(x), float(y)) * px)).rgb;
  return s / 9.0;
}

void main() {
  vec3 o = texture2D(uTex, src(vUv)).rgb;
  vec3 c = o;
  if (uFilter == 1) {            // Rosé: soft blush tint
    c = sat(c, 0.92) * vec3(1.05, 0.96, 0.99) + vec3(0.07, 0.0, 0.035);
    c = contrast(c, 0.95);
  } else if (uFilter == 2) {     // Golden hour: warm sunset light
    c = c * vec3(1.1, 1.0, 0.8) + vec3(0.04, 0.02, 0.0);
    c = sat(contrast(c, 1.08), 1.15) * vignette(0.35);
  } else if (uFilter == 3) {     // Vintage: faded sepia with grain
    vec3 sep = vec3(luma(c)) * vec3(1.07, 0.95, 0.76);
    c = contrast(mix(c, sep, 0.75), 0.82) + vec3(0.06, 0.035, 0.0);
    c = c * vignette(0.65) + (rand(vUv * uRes + uTime) - 0.5) * 0.06;
  } else if (uFilter == 4) {     // Noir: dramatic black & white
    c = vec3(contrast(vec3(luma(c)), 1.35)) * vignette(0.45);
  } else if (uFilter == 5) {     // Dreamy: soft glow and pastel haze
    c = mix(c, glow(vUv, 7.0), 0.55) * 1.06 + vec3(0.05, 0.03, 0.06);
    c = contrast(c, 0.88);
  } else if (uFilter == 6) {     // Lavender
    c = sat(c, 0.85) * vec3(0.97, 0.93, 1.08) + vec3(0.035, 0.0, 0.07);
  } else if (uFilter == 7) {     // Cinema: teal shadows, warm highlights
    float l = luma(c);
    c = mix(c * vec3(0.85, 1.0, 1.12), c * vec3(1.14, 1.0, 0.84), smoothstep(0.15, 0.85, l));
    c = contrast(c, 1.15) * vignette(0.45);
  } else if (uFilter == 8) {     // Film: lifted blacks, grain
    c = sat(contrast(c, 0.86), 0.9) + vec3(0.045, 0.04, 0.03);
    c += (rand(floor(vUv * uRes) + fract(uTime)) - 0.5) * 0.09;
  } else if (uFilter == 9) {     // Love glow: pink haze around the edges
    c = mix(c, glow(vUv, 4.0), 0.3) * vec3(1.05, 0.97, 1.0);
    float e = smoothstep(0.28, 0.78, length(vUv - 0.5));
    c = mix(c, vec3(1.0, 0.42, 0.62), e * 0.5) + vec3(0.03, 0.0, 0.02);
  } else if (uFilter == 10) {    // Pop: vivid colours
    c = contrast(sat(c, 1.45), 1.1);
  }
  gl_FragColor = vec4(mix(o, clamp(c, 0.0, 1.0), uStrength), 1.0);
}`;

export class FilterRenderer {
  constructor() {
    this.canvas = document.createElement('canvas');
    const gl = this.canvas.getContext('webgl', { preserveDrawingBuffer: true, premultipliedAlpha: false });
    if (!gl) throw new Error('WebGL is not available');
    this.gl = gl;
    const shader = (type, code) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, code);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const prog = gl.createProgram();
    gl.attachShader(prog, shader(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
    for (const [k, v] of [[gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE],
      [gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    this.u = Object.fromEntries(['uFilter', 'uStrength', 'uTime', 'uRes', 'uMirror']
      .map((n) => [n, gl.getUniformLocation(prog, n)]));
  }

  /** Upload a video frame / image / canvas as the source. */
  upload(source) {
    const gl = this.gl;
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, source);
  }

  draw({ filter = 0, strength = 1, mirror = false, width, height, time = 0 }) {
    const gl = this.gl;
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    gl.viewport(0, 0, width, height);
    gl.uniform1i(this.u.uFilter, filter);
    gl.uniform1f(this.u.uStrength, strength);
    gl.uniform1f(this.u.uTime, time);
    gl.uniform2f(this.u.uRes, width, height);
    gl.uniform1i(this.u.uMirror, mirror ? 1 : 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    return this.canvas;
  }
}

// ── Frames ────────────────────────────────────────────────────────────────
function heartPath(ctx, x, y, size) {
  const s = size / 2;
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.6);
  ctx.bezierCurveTo(x - s * 1.6, y - s * 0.4, x - s * 0.7, y - s * 1.5, x, y - s * 0.55);
  ctx.bezierCurveTo(x + s * 0.7, y - s * 1.5, x + s * 1.6, y - s * 0.4, x, y + s * 0.6);
  ctx.closePath();
}

function sparkle(ctx, x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const rr = i % 2 ? r * 0.22 : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
}

// Deterministic "random" so decorations don't jump between preview and the saved photo.
const pr = (i) => {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/** Size of the final image for a given frame. */
export function frameSize(frame, w, h) {
  if (frame === 'polaroid') {
    const pad = Math.round(w * 0.05);
    return { width: w + pad * 2, height: h + pad + Math.round(h * 0.17) };
  }
  return { width: w, height: h };
}

/**
 * Draws the filtered photo plus its frame onto ctx (already sized with frameSize).
 * `t` animates decorations in the live preview; pass 0 when capturing.
 */
export function drawFramed(ctx, photo, frame, { name = 'Kaveri', t = 0, date = new Date() } = {}) {
  const w = photo.width;
  const h = photo.height;
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  const u = Math.min(w, h) / 100; // 1% of the short side
  ctx.save();
  ctx.clearRect(0, 0, W, H);

  if (frame === 'polaroid') {
    const pad = Math.round(w * 0.05);
    ctx.fillStyle = '#fffaf3';
    ctx.fillRect(0, 0, W, H);
    ctx.drawImage(photo, pad, pad, w, h);
    ctx.strokeStyle = 'rgba(0,0,0,0.06)';
    ctx.strokeRect(pad, pad, w, h);
    const cy = pad + h + (H - pad - h) / 2;
    ctx.fillStyle = '#4a2735';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `600 ${Math.round(u * 8)}px Caveat, 'Bradley Hand', cursive`;
    const label = `${name} · ${date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`;
    ctx.fillText(label, W / 2 - u * 3.5, cy);
    const tw = ctx.measureText(label).width;
    ctx.fillStyle = '#e8417a';
    heartPath(ctx, W / 2 + tw / 2 + u * 1.5, cy, u * 5);
    ctx.fill();
  } else {
    ctx.drawImage(photo, 0, 0, w, h);
  }

  if (frame === 'hearts') {
    const colors = ['#ff5c8a', '#ff8fab', '#ffb3c7', '#ffffff', '#e8417a'];
    for (let i = 0; i < 22; i++) {
      // Hug the edges, leave her face clear
      const edge = i % 4;
      const along = pr(i);
      const depth = pr(i + 50) * 0.16;
      let x = edge < 2 ? along * w : (edge === 2 ? depth : 1 - depth) * w;
      let y = edge === 0 ? depth * h : edge === 1 ? (1 - depth) * h : along * h;
      y += Math.sin(t * 1.5 + i) * u * 1.2;
      x += Math.cos(t * 1.1 + i) * u * 0.6;
      ctx.globalAlpha = 0.55 + pr(i + 9) * 0.4;
      ctx.fillStyle = colors[i % colors.length];
      ctx.shadowColor = 'rgba(255, 60, 120, 0.6)';
      ctx.shadowBlur = u * 2;
      heartPath(ctx, x, y, u * (4 + pr(i + 3) * 7));
      ctx.fill();
    }
  }

  if (frame === 'sparkle') {
    for (let i = 0; i < 34; i++) {
      const x = pr(i) * w;
      const y = pr(i + 99) * h;
      const tw = 0.5 + 0.5 * Math.sin(t * 3 + i * 1.7);
      ctx.globalAlpha = 0.35 + tw * 0.6;
      ctx.fillStyle = i % 3 ? '#fff6e0' : '#ffd6a5';
      ctx.shadowColor = '#fff';
      ctx.shadowBlur = u * 3;
      sparkle(ctx, x, y, u * (1.2 + pr(i + 7) * 2.8) * (0.7 + tw * 0.3));
      ctx.fill();
    }
  }

  if (frame === 'pink') {
    const b = u * 4;
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#ff9ab8');
    g.addColorStop(0.5, '#ff5c8a');
    g.addColorStop(1, '#c77dff');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    ctx.roundRect(b, b, W - b * 2, H - b * 2, u * 4);
    ctx.fill('evenodd');
    ctx.font = `${Math.round(u * 9)}px 'Great Vibes', cursive`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#fff';
    ctx.shadowColor = 'rgba(120, 0, 50, 0.6)';
    ctx.shadowBlur = u * 2;
    ctx.fillText(name, W / 2, H - b - u * 3);
  }

  if (frame === 'date') {
    const d = date;
    const text = `'${String(d.getFullYear()).slice(2)} ${String(d.getMonth() + 1).padStart(2, ' ')} ${String(d.getDate()).padStart(2, '0')}`;
    ctx.font = `bold ${Math.round(u * 5.5)}px 'Courier New', monospace`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = '#ff9a3c';
    ctx.shadowColor = '#ff6a00';
    ctx.shadowBlur = u * 2.5;
    ctx.fillText(text, W - u * 5, H - u * 4);
  }
  ctx.restore();
}

/** Classic photo-booth strip from 4 shots. */
export function makeStrip(shots, { name = 'Kaveri', date = new Date() } = {}) {
  const pw = 600;
  const ph = 450;
  const gap = 22;
  const top = 34;
  const bottom = 120;
  const canvas = document.createElement('canvas');
  canvas.width = pw + gap * 2;
  canvas.height = top + shots.length * ph + (shots.length - 1) * gap + bottom;
  const ctx = canvas.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
  g.addColorStop(0, '#fff3f6');
  g.addColorStop(1, '#ffe1ea');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  shots.forEach((s, i) => {
    // cover-crop each shot into the strip cell
    const scale = Math.max(pw / s.width, ph / s.height);
    const sw = pw / scale;
    const sh = ph / scale;
    ctx.drawImage(s, (s.width - sw) / 2, (s.height - sh) / 2, sw, sh, gap, top + i * (ph + gap), pw, ph);
  });
  const cy = canvas.height - bottom / 2;
  ctx.fillStyle = '#c2185b';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = "64px 'Great Vibes', cursive";
  ctx.fillText(name, canvas.width / 2, cy - 12);
  ctx.font = "600 26px Caveat, cursive";
  ctx.fillStyle = '#7a5763';
  ctx.fillText(date.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }), canvas.width / 2, cy + 36);
  return canvas;
}

/** A soft mechanical shutter click, synthesised. */
export function shutterSound() {
  try {
    const ctx = (shutterSound.ctx ??= new (window.AudioContext || window.webkitAudioContext)());
    ctx.resume();
    const len = Math.floor(ctx.sampleRate * 0.09);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1800;
    const gain = ctx.createGain();
    gain.gain.value = 0.45;
    src.connect(hp).connect(gain).connect(ctx.destination);
    src.start();
  } catch { /* sound is just a nicety */ }
}
