import { useEffect, useState } from 'react';
import { player } from './music.js';

export function useMusic() {
  const [playing, setPlaying] = useState(player.playing);
  useEffect(() => player.subscribe(setPlaying), []);
  return [playing, () => player.toggle()];
}
