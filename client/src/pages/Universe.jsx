import { Suspense, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Sparkles, Stars } from '@react-three/drei';
import { AnimatePresence } from 'framer-motion';
import * as THREE from 'three';
import MemoryCloud from '../three/MemoryCloud.jsx';
import Lightbox from '../components/Lightbox.jsx';
import { useApp, useMemories } from '../lib/store.jsx';

const MAX_CARDS = 150;

function heartShape() {
  const s = new THREE.Shape();
  s.moveTo(0, 0.5);
  s.bezierCurveTo(0, 0.8, -0.5, 1.1, -0.9, 0.8);
  s.bezierCurveTo(-1.4, 0.4, -1.1, -0.3, 0, -1.1);
  s.bezierCurveTo(1.1, -0.3, 1.4, 0.4, 0.9, 0.8);
  s.bezierCurveTo(0.5, 1.1, 0, 0.8, 0, 0.5);
  return s;
}

/** A glowing, beating heart at the centre of everything. */
function CoreHeart() {
  const mesh = useRef();
  const geometry = useMemo(() => {
    const g = new THREE.ExtrudeGeometry(heartShape(), { depth: 0.35, bevelEnabled: true, bevelSegments: 8, bevelSize: 0.12, bevelThickness: 0.12, curveSegments: 32 });
    g.center();
    return g;
  }, []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime % 1.1;
    const beat = Math.exp(-(((t - 0.1) * 13) ** 2)) + 0.6 * Math.exp(-(((t - 0.33) * 13) ** 2));
    mesh.current.scale.setScalar(0.85 * (1 + beat * 0.1));
    mesh.current.rotation.y = clock.elapsedTime * 0.6;
  });
  return (
    <mesh ref={mesh} geometry={geometry}>
      <meshStandardMaterial color="#ff4f86" emissive="#ff2d6f" emissiveIntensity={1.4} roughness={0.25} metalness={0.3} />
    </mesh>
  );
}

const LAYOUT_NAMES = [
  ['heart', 'Heart'],
  ['sphere', 'Sphere'],
  ['galaxy', 'Galaxy'],
  ['helix', 'Helix'],
];

export default function Universe() {
  const { updateMedia, deleteMedia, restoreMedia, toast } = useApp();
  const memories = useMemories();
  const items = useMemo(() => memories.filter((m) => m.thumb || m.type === 'image').slice(0, MAX_CARDS), [memories]);
  const [layout, setLayout] = useState('heart');
  const [openId, setOpenId] = useState(null);
  const openIndex = items.findIndex((m) => m.id === openId);
  const portrait = typeof window !== 'undefined' && window.innerWidth / window.innerHeight < 0.8;

  return (
    <div className="universe" style={{ zIndex: 1 }}>
      <Canvas camera={{ position: [0, 0, portrait ? 34 : 23], fov: 55 }} dpr={[1, 2]}>
        <color attach="background" args={['#0a0516']} />
        <fog attach="fog" args={['#0a0516', 22, 55]} />
        <ambientLight intensity={0.6} />
        <pointLight position={[0, 0, 4]} intensity={30} color="#ff7aa2" />
        <pointLight position={[6, 8, -4]} intensity={20} color="#c9b6ff" />
        <Stars radius={100} depth={50} count={6000} factor={4} saturation={0.5} fade speed={0.5} />
        <Sparkles count={260} scale={[26, 18, 26]} size={3} speed={0.35} color="#ffb3c7" opacity={0.8} />
        <CoreHeart />
        <Suspense fallback={null}>
          <MemoryCloud items={items} layout={layout} onSelect={(m) => setOpenId(m.id)} />
        </Suspense>
        <OrbitControls enablePan={false} enableDamping dampingFactor={0.06} autoRotate={openIndex < 0}
          autoRotateSpeed={0.55} minDistance={4} maxDistance={45} />
      </Canvas>

      <div className="universe-ui">
        <h1>Our Universe</h1>
        <p>{items.length ? `${items.length} memories orbiting one heart · drag to explore · tap a memory` : 'Add photos and they’ll start orbiting here ✨'}</p>
        <div className="tabs">
          {LAYOUT_NAMES.map(([key, label]) => (
            <button key={key} className={layout === key ? 'active' : ''} onClick={() => setLayout(key)}>{label}</button>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {openIndex >= 0 && (
          <Lightbox
            items={items}
            index={openIndex}
            onIndex={(i) => setOpenId(items[i].id)}
            onClose={() => setOpenId(null)}
            onFavorite={(m) => updateMedia(m.id, { favorite: !m.favorite })}
            onCaption={(m, caption) => { updateMedia(m.id, { caption }); toast('Caption saved ♥'); }}
            onDelete={(m) => {
              setOpenId(null);
              deleteMedia(m.id);
              toast('Moved to Recently deleted', 'love', { label: 'Undo', onClick: () => restoreMedia(m.id) });
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
