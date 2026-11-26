// World building for AZURE REACH: the Meridian Isles terrain, its islands,
// runways, ring courses and clouds — all generated from a fixed seed so
// the world is the same on every load.

import { AIRFIELDS, STORM_FRONTS } from './config.js';
import { mulberry32, range, makeNoise1D, clamp } from './random.js';

// Extra hills and islets that make the sea readable as terrain: each is a
// gaussian bump with a height, a radius and a palm/town flavour.
const HILL_SEED = 20261126;

export function buildWorld(seed) {
  const rng = mulberry32(seed);
  const hills = [];
  const hillSpots = [
    [1200, 700, 90, 420], [2600, 500, 120, 520], [3900, -800, 80, 380],
    [4600, -700, 140, 560], [6100, 800, 110, 480], [6800, -900, 95, 420],
    [8300, 700, 130, 540], [9200, -700, 85, 400], [10800, -600, 120, 500],
    [11000, 800, 100, 460], [1800, -900, 70, 360], [5600, -900, 75, 380],
  ];
  for (const [x, y, h, r] of hillSpots) {
    hills.push({ x, y, height: h, radius: r, palms: Math.floor(range(rng, 4, 14)) });
  }

  // Clouds: seeded puffs with a position, size and drift.
  const clouds = [];
  for (let i = 0; i < 46; i++) {
    clouds.push({
      x: range(rng, -400, 12400),
      y: range(rng, -1500, 1500),
      z: range(rng, 260, 520),
      size: range(rng, 90, 260),
      shade: range(rng, 0.75, 1),
    });
  }

  // Rain columns for storm weather, placed along the storm fronts.
  const rain = [];
  for (const front of STORM_FRONTS) {
    for (let i = 0; i < 26; i++) {
      rain.push({
        x: front.x + range(rng, -500, 500),
        y: range(rng, -1400, 1400),
        z: range(rng, 60, 420),
        len: range(rng, 30, 70),
      });
    }
  }

  return { seed, hills, clouds, rain, ridge: makeNoise1D(HILL_SEED) };
}

// Ground height in metres at (x, y). Runway aprons are flat; hills rise
// between the isles; the open sea is zero.
export function terrainHeight(world, x, y) {
  // Keep every runway apron flat: within 500 m of an airfield centre.
  for (const field of AIRFIELDS) {
    const dx = x - field.x;
    const dy = y - field.y;
    if (dx * dx + dy * dy < 500 * 500) return 0;
  }
  let h = 0;
  for (const hill of world.hills) {
    const dx = x - hill.x;
    const dy = y - hill.y;
    const d2 = dx * dx + dy * dy;
    const r2 = hill.radius * hill.radius;
    if (d2 < r2 * 4) h += hill.height * Math.exp(-d2 / r2);
  }
  // The far north and south edges rise into mountain walls.
  const edge = Math.max(0, Math.abs(y) - 1300) / 300;
  h += edge * edge * 260;
  return h;
}

// The distant ridge skyline, as a function of compass heading: the
// mountains the pilot sees on the horizon in every direction.
export function ridgeHeightAt(world, headingDeg) {
  const t = (headingDeg / 360) * 24;
  const n = world.ridge(t);
  return 0.10 + 0.10 * (n * 0.5 + 0.5) + 0.05 * Math.abs(world.ridge(t * 3.7));
}

// Runway geometry: the two threshold points and the centre, for a field.
export function runwayEndpoints(field) {
  const half = field.runwayLength / 2;
  const rad = (field.runwayHeading * Math.PI) / 180;
  const dx = Math.sin(rad) * half;
  const dy = Math.cos(rad) * half;
  return {
    start: { x: field.x - dx, y: field.y - dy },
    end: { x: field.x + dx, y: field.y + dy },
    centre: { x: field.x, y: field.y },
  };
}

// Is the point over a runway strip (within its width, along its length)?
export function overRunway(field, x, y) {
  const ends = runwayEndpoints(field);
  const rad = (field.runwayHeading * Math.PI) / 180;
  const fx = Math.sin(rad);
  const fy = Math.cos(rad);
  const dx = x - field.x;
  const dy = y - field.y;
  const along = dx * fx + dy * fy;
  const across = Math.abs(dx * fy - dy * fx);
  return Math.abs(along) <= field.runwayLength / 2 && across <= field.runwayWidth / 2;
}

// Distance from the point to the runway centreline, for landing quality.
export function runwayOffset(field, x, y) {
  const ends = runwayEndpoints(field);
  const rad = (field.runwayHeading * Math.PI) / 180;
  const fx = Math.sin(rad);
  const fy = Math.cos(rad);
  const dx = x - field.x;
  const dy = y - field.y;
  return {
    along: dx * fx + dy * fy,
    across: dx * fy - dy * fx,
  };
}

export function airfieldById(id) {
  return AIRFIELDS.find((f) => f.id === id) || AIRFIELDS[0];
}

export function clampToWorld(x, y) {
  return {
    x: clamp(x, -600, 12600),
    y: clamp(y, -1550, 1550),
  };
}
