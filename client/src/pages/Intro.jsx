import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Canvas, useFrame } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
import { AnimatePresence, motion } from 'framer-motion';
import { Heart } from 'lucide-react';
import * as THREE from 'three';
import HeartParticles from '../three/HeartParticles.jsx';
import { useApp } from '../lib/store.jsx';
import { player } from '../lib/music.js';

function FlyThrough({ active }) {
  const z = useRef(9);
  useFrame(({ camera, size }, delta) => {
    const rest = size.width / size.height < 0.8 ? 14 : 9; // step back on portrait phones
    z.current = THREE.MathUtils.damp(z.current, active ? 1.5 : rest, active ? 1.2 : 3, delta);
    camera.position.z = z.current;
  });
  return null;
}

export default function Intro() {
  const { settings } = useApp();
  const navigate = useNavigate();
  const [opened, setOpened] = useState(false);

  const open = () => {
    if (opened) return;
    setOpened(true);
    player.play(); // the music starts as the heart bursts open
    setTimeout(() => navigate('/home'), 2100);
  };

  return (
    <div className="intro">
      <Canvas camera={{ position: [0, 0, 9], fov: 50 }} dpr={[1, 2]} gl={{ antialias: true }}>
        <color attach="background" args={['#07030f']} />
        <Stars radius={90} depth={60} count={5000} factor={4} saturation={0.6} fade speed={0.6} />
        <HeartParticles explode={opened ? 1 : 0} />
        <FlyThrough active={opened} />
      </Canvas>

      <button className="btn small intro-skip" onClick={() => navigate('/home')}>Skip</button>

      <AnimatePresence>
        {!opened && (
          <motion.div className="intro-ui" exit={{ opacity: 0, y: 20, transition: { duration: 0.6 } }}>
            <motion.div className="intro-for" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6, duration: 1.2 }}>
              made with love, for
            </motion.div>
            <motion.div className="intro-name" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 1, duration: 1.4, ease: [0.2, 0.8, 0.2, 1] }}>
              {settings.herName}
            </motion.div>
            <motion.p className="intro-line" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.8, duration: 1.2 }}>
              A little universe where all our memories live — so you never forget how loved you are.
            </motion.p>
            <motion.button className="btn primary" onClick={open}
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 2.4, duration: 0.8 }}
              whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.96 }}>
              <Heart size={20} fill="currentColor" /> Open your gift
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
