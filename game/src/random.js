// Seeded randomness for AZURE REACH. Every world feature, cloud and gust
// comes from these functions, so a mission and a screenshot scene play the
// same way every time they are built from the same seed.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A small string hash, so a mission id or a date string becomes a seed.
export function hashSeed(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function pick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

export function range(rng, min, max) {
  return min + rng() * (max - min);
}

// Smooth 1D value noise: a deterministic wobble for gusts and ridges.
export function makeNoise1D(seed) {
  const rng = mulberry32(seed);
  const knots = [];
  for (let i = 0; i < 64; i++) knots.push(rng() * 2 - 1);
  return function noise(x) {
    const xi = Math.floor(x);
    const xf = x - xi;
    const a = knots[((xi % 64) + 64) % 64];
    const b = knots[(((xi + 1) % 64) + 64) % 64];
    const u = xf * xf * (3 - 2 * xf);
    return a + (b - a) * u;
  };
}

export function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function degToRad(degrees) {
  return (degrees * Math.PI) / 180;
}

export function radToDeg(radians) {
  return (radians * 180) / Math.PI;
}

// Smallest signed angle difference, in degrees.
export function angleDiffDeg(a, b) {
  let d = (a - b) % 360;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}
