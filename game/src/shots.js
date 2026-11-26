// Screenshot scenes for AZURE REACH. `?shot=<name>&seed=<n>` puts the
// game into a fixed, deterministic flying state and renders it — the same
// scene every time, so the screenshots are real renders of this code.
// The shots are also reachable from the title screen (keys 1–4 preview).

import { MISSIONS, WEATHER, AIRCRAFT } from './config.js';
import { buildWorld, airfieldById } from './world.js';
import { newFlight } from './physics.js';
import { missionById, newMissionRun } from './missions.js';

// Four scenes, each a different face of the game. The first is the cover.
export const SHOTS = {
  cover: {
    mission: 'm01', aircraft: 'courier', weather: 'golden',
    // Chase view, ring ahead, runway below, golden hour.
    flight: { x: 1080, y: 60, z: 165, heading: 88, pitch: -2, roll: -6, speed: 58, throttle: 0.72 },
    ringIndex: 1,
  },
  race: {
    mission: 'm07', aircraft: 'stormpetrel', weather: 'golden',
    // Canyon pass: low, fast, ring dead ahead between the rocks.
    flight: { x: 3980, y: -120, z: 78, heading: 82, pitch: -1, roll: 12, speed: 88, throttle: 0.9 },
    ringIndex: 1,
  },
  night: {
    mission: 'm06', aircraft: 'albatross', weather: 'night',
    // Night final: lit runway, glowing instruments, ring ahead.
    flight: { x: 9080, y: -40, z: 120, heading: 72, pitch: -4, roll: -4, speed: 52, throttle: 0.55 },
    ringIndex: 3,
  },
  storm: {
    mission: 'm05', aircraft: 'gullwing', weather: 'storm',
    // Storm front: rain, grey wall, ring glowing through it.
    flight: { x: 6980, y: 80, z: 210, heading: 95, pitch: -2, roll: 8, speed: 95, throttle: 0.85 },
    ringIndex: 1,
  },
};

export function parseShotQuery(search) {
  const params = new URLSearchParams(search);
  const shot = params.get('shot');
  if (!shot || !SHOTS[shot]) return null;
  const seed = Number(params.get('seed') || 7);
  return { name: shot, seed, def: SHOTS[shot] };
}

export function aircraftById(id) {
  return AIRCRAFT.find((a) => a.id === id) || AIRCRAFT[0];
}

// Build the fixed state a shot renders: world, flight, mission run and
// weather, all deterministic from the shot definition.
export function buildShotState(shotName, seed) {
  const def = SHOTS[shotName];
  const mission = missionById(def.mission);
  const world = buildWorld(seed);
  const aircraft = aircraftById(def.aircraft);
  const weather = WEATHER[def.weather];
  const startField = airfieldById(mission.from);
  const flight = newFlight(aircraft, startField, new Set());
  Object.assign(flight, def.flight);
  flight.onGround = false;
  flight.fuel = aircraft.fuel * 0.72;
  flight.smooth = 92;
  const run = newMissionRun(mission, { completed: [], best: {} });
  run.ringIndex = def.ringIndex;
  run.elapsed = 87 + def.ringIndex * 23;
  run.objectiveText = `Ring ${def.ringIndex + 1}/${mission.rings.length}`;
  return { world, flight, aircraft, mission, run, weather, time: 12.4 };
}
