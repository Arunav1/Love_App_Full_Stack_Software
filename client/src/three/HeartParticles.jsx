import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

// Classic implicit 3D heart: (x² + 9/4·y² + z² − 1)³ − x²z³ − 9/80·y²z³ = 0   (z is "up")
const heartF = (x, y, z) => {
  const a = x * x + 2.25 * y * y + z * z - 1;
  return a * a * a - x * x * z * z * z - 0.1125 * y * y * z * z * z;
};

/** Points on (and just inside) the heart surface, found by bisection along random rays. */
function buildHeart(count, dust) {
  const total = count + dust;
  const positions = new Float32Array(total * 3);
  const randoms = new Float32Array(total * 3);
  const scales = new Float32Array(total);
  const tints = new Float32Array(total);
  const v = new THREE.Vector3();

  for (let i = 0; i < total; i++) {
    if (i < count) {
      v.randomDirection();
      let lo = 0, hi = 2;
      for (let k = 0; k < 18; k++) {
        const mid = (lo + hi) / 2;
        heartF(v.x * mid, v.z * mid, v.y * mid) < 0 ? (lo = mid) : (hi = mid);
      }
      const r = lo * (1 - Math.pow(Math.random(), 3) * 0.55);
      positions.set([v.x * r * 2.05, v.y * r * 2.05 + 1.35, v.z * r * 2.05], i * 3);
      scales[i] = 0.5 + Math.random();
      tints[i] = Math.random() < 0.15 ? 1 : Math.random() * 0.45;
    } else {
      // Dreamy dust floating around the heart.
      v.randomDirection().multiplyScalar(4 + Math.random() * 9);
      positions.set([v.x, v.y, v.z], i * 3);
      scales[i] = 0.3 + Math.random() * 0.8;
      tints[i] = Math.random();
    }
    v.randomDirection();
    randoms.set([v.x, v.y, v.z], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aRandom', new THREE.BufferAttribute(randoms, 3));
  geo.setAttribute('aScale', new THREE.BufferAttribute(scales, 1));
  geo.setAttribute('aTint', new THREE.BufferAttribute(tints, 1));
  return geo;
}

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uExplode;
  uniform float uSize;
  uniform float uPixelRatio;
  attribute vec3 aRandom;
  attribute float aScale;
  attribute float aTint;
  varying float vTint;
  varying float vAlpha;

  void main() {
    // Heartbeat: lub-dub, every 1.1s
    float t = mod(uTime, 1.1);
    float beat = exp(-pow((t - 0.10) * 13.0, 2.0)) + 0.6 * exp(-pow((t - 0.33) * 13.0, 2.0));
    vec3 p = position * (1.0 + 0.07 * beat);

    // Gentle shimmer so the heart feels alive
    p += aRandom * 0.035 * sin(uTime * 2.0 + aScale * 20.0);

    // Burst outwards when the gift is opened
    float e = uExplode * uExplode;
    p += aRandom * e * (10.0 + aScale * 14.0);
    p.y += e * 3.0 * aRandom.y;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float twinkle = 0.75 + 0.25 * sin(uTime * 3.0 + aScale * 40.0);
    gl_PointSize = uSize * aScale * twinkle * uPixelRatio * (1.0 / -mv.z);
    vTint = aTint;
    vAlpha = 1.0 - uExplode * 0.85;
  }
`;

const fragmentShader = /* glsl */ `
  varying float vTint;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float glow = pow(smoothstep(0.5, 0.0, d), 1.8);
    vec3 rose = vec3(1.0, 0.33, 0.55);
    vec3 blush = vec3(1.0, 0.75, 0.82);
    vec3 gold = vec3(1.0, 0.86, 0.62);
    vec3 col = vTint > 0.99 ? gold : mix(rose, blush, vTint * 2.0);
    gl_FragColor = vec4(col, glow * vAlpha);
  }
`;

export default function HeartParticles({ explode = 0, count = 9000, dust = 1500 }) {
  const geometry = useMemo(() => buildHeart(count, dust), [count, dust]);
  const { gl } = useThree();
  const material = useRef();
  const group = useRef();
  const pointer = useRef({ x: 0, y: 0 });

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uExplode: { value: 0 },
    uSize: { value: 70 },
    uPixelRatio: { value: Math.min(gl.getPixelRatio(), 2) },
  }), [gl]);

  useFrame((state, delta) => {
    uniforms.uTime.value += delta;
    uniforms.uExplode.value = THREE.MathUtils.damp(uniforms.uExplode.value, explode, 1.6, delta);
    pointer.current.x = THREE.MathUtils.damp(pointer.current.x, state.pointer.x, 2, delta);
    pointer.current.y = THREE.MathUtils.damp(pointer.current.y, state.pointer.y, 2, delta);
    if (group.current) {
      group.current.rotation.y = Math.sin(uniforms.uTime.value * 0.3) * 0.5 + pointer.current.x * 0.6;
      group.current.rotation.x = -pointer.current.y * 0.3;
    }
  });

  return (
    <group ref={group}>
      <points geometry={geometry}>
        <shaderMaterial
          ref={material}
          uniforms={uniforms}
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
}
