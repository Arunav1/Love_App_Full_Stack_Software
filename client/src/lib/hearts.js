import confetti from 'canvas-confetti';

let heartShape;
const heart = () =>
  (heartShape ??= confetti.shapeFromPath({
    path: 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z',
  }));

const COLORS = ['#ff5c8a', '#ff8fab', '#ffb3c7', '#ffd6e0', '#ffc2d1', '#ff3d7f', '#ffd6a5'];

/** A little puff of hearts from a point on screen (pixels). */
export function heartBurst(x = window.innerWidth / 2, y = window.innerHeight / 2, power = 1) {
  confetti({
    particleCount: Math.round(26 * power),
    spread: 70 + 40 * power,
    startVelocity: 22 + 12 * power,
    gravity: 0.9,
    scalar: 1.3,
    ticks: 140,
    shapes: [heart()],
    colors: COLORS,
    origin: { x: x / window.innerWidth, y: y / window.innerHeight },
    disableForReducedMotion: true,
    zIndex: 9999,
  });
}

/** Hearts raining from the sky for a few seconds. */
export function heartRain(duration = 3500) {
  const end = Date.now() + duration;
  (function frame() {
    confetti({
      particleCount: 3,
      startVelocity: 0,
      ticks: 320,
      gravity: 0.5,
      drift: Math.random() - 0.5,
      scalar: 1.6 + Math.random(),
      shapes: [heart()],
      colors: COLORS,
      origin: { x: Math.random(), y: -0.05 },
      disableForReducedMotion: true,
      zIndex: 9999,
    });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
}

/** Big celebration – for checked-off dreams, birthdays and anniversaries. */
export function celebrate() {
  const fire = (ratio, opts) =>
    confetti({
      origin: { y: 0.7 },
      particleCount: Math.floor(220 * ratio),
      shapes: [heart(), 'circle'],
      colors: COLORS,
      zIndex: 9999,
      disableForReducedMotion: true,
      ...opts,
    });
  fire(0.25, { spread: 26, startVelocity: 55 });
  fire(0.2, { spread: 60 });
  fire(0.35, { spread: 100, decay: 0.91, scalar: 1.2 });
  fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.6 });
  fire(0.1, { spread: 120, startVelocity: 45 });
}
