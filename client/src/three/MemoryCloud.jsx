import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Billboard } from '@react-three/drei';
import * as THREE from 'three';
import { thumbUrl } from '../lib/api.js';

const loader = new THREE.TextureLoader();

// ── Layouts: every memory gets a place in the sky ───────────────────────────
export const LAYOUTS = {
  heart(n) {
    const s = 0.28 + Math.sqrt(n) * 0.04;
    return Array.from({ length: n }, (_, i) => {
      const t = (i / n) * Math.PI * 2;
      const ring = i % 2 ? 1 : 0.82; // two nested outlines read better than one
      const x = 16 * Math.sin(t) ** 3;
      const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
      return new THREE.Vector3(x * s * ring, y * s * ring + 2.2, (i % 3 - 1) * 0.9);
    });
  },
  sphere(n) {
    const r = Math.max(5.5, Math.sqrt(n) * 1.15);
    const golden = Math.PI * (3 - Math.sqrt(5));
    return Array.from({ length: n }, (_, i) => {
      const y = 1 - (i / Math.max(1, n - 1)) * 2;
      const rad = Math.sqrt(1 - y * y);
      const th = golden * i;
      return new THREE.Vector3(Math.cos(th) * rad * r, y * r, Math.sin(th) * rad * r);
    });
  },
  galaxy(n) {
    return Array.from({ length: n }, (_, i) => {
      const arm = i % 3;
      const r = 2.5 + (i / n) * (7 + n * 0.06);
      const a = r * 0.55 + (arm * Math.PI * 2) / 3;
      return new THREE.Vector3(Math.cos(a) * r, Math.sin(i * 12.9898) * 0.8, Math.sin(a) * r);
    });
  },
  helix(n) {
    return Array.from({ length: n }, (_, i) => {
      const a = i * 0.55;
      return new THREE.Vector3(Math.cos(a) * 5, (i - n / 2) * 0.38, Math.sin(a) * 5);
    });
  },
};

function PhotoCard({ item, target, index, onSelect }) {
  const group = useRef();
  const [texture, setTexture] = useState(null);
  const [hovered, setHovered] = useState(false);
  const scale = useRef(0);

  useEffect(() => {
    let tex;
    let alive = true;
    loader.load(thumbUrl(item), (t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
      tex = t;
      if (alive) setTexture(t);
      else t.dispose();
    });
    return () => { alive = false; tex?.dispose(); };
  }, [item]);

  useFrame((state, delta) => {
    const g = group.current;
    if (!g) return;
    g.position.lerp(target, 1 - Math.exp(-delta * 2.2));
    // Gentle bobbing so the universe breathes
    g.position.y += Math.sin(state.clock.elapsedTime * 0.8 + index) * 0.002;
    const want = (texture ? 1 : 0) * (hovered ? 1.35 : 1);
    scale.current = THREE.MathUtils.damp(scale.current, want, 6, delta);
    g.scale.setScalar(scale.current);
  });

  const aspect = texture ? texture.image.width / texture.image.height : 0.75;
  const w = aspect >= 1 ? 1.7 : 1.7 * aspect;
  const h = aspect >= 1 ? 1.7 / aspect : 1.7;

  return (
    <group ref={group} position={target.clone().multiplyScalar(0.1)}>
      <Billboard>
        <group
          onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; }}
          onPointerOut={() => { setHovered(false); document.body.style.cursor = ''; }}
          onClick={(e) => { e.stopPropagation(); if (e.delta < 6) onSelect(item); }}
        >
          {/* polaroid frame */}
          <mesh position={[0, -0.09, -0.01]}>
            <planeGeometry args={[w + 0.16, h + 0.34]} />
            <meshBasicMaterial color={hovered ? '#ffe3ec' : '#fffaf5'} toneMapped={false} />
          </mesh>
          {texture && (
            <mesh>
              <planeGeometry args={[w, h]} />
              <meshBasicMaterial map={texture} toneMapped={false} />
            </mesh>
          )}
        </group>
      </Billboard>
    </group>
  );
}

export default function MemoryCloud({ items, layout, onSelect }) {
  const targets = useMemo(() => LAYOUTS[layout](items.length), [layout, items.length]);
  return items.map((item, i) => (
    <PhotoCard key={item.id} item={item} index={i} target={targets[i]} onSelect={onSelect} />
  ));
}
