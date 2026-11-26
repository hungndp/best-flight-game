// Flight model for AZURE REACH: an arcade flight model with real
// trade-offs — throttle discipline, stall, wind, fuel and damage.
// Units: metres, seconds, degrees. Speed is m/s.

import { clamp, degToRad, angleDiffDeg } from './random.js';
import { AIRFIELDS } from './config.js';
import { terrainHeight, overRunway, runwayOffset } from './world.js';

export function newFlight(aircraft, field, upgrades) {
  const fuelCapacity = aircraft.fuel + (upgrades.has('tank') ? 40 : 0);
  return {
    x: field.x,
    y: field.y,
    z: 2,
    heading: field.runwayHeading,
    pitch: 0,
    roll: 0,
    speed: 0,
    throttle: 0,
    fuel: fuelCapacity,
    fuelCapacity,
    damage: 0,
    verticalSpeed: 0,
    onGround: true,
    landed: false,
    crashed: false,
    crashReason: '',
    gearDown: true,
    flaps: 0,
    // Throttle discipline score: smooth flying earns it, jerking loses it.
    smooth: 100,
    lastThrottle: 0,
  };
}

// One physics step. `input` carries pitch/roll/throttle intents in -1..1
// (throttle is a target 0..1). Returns events: [{type, ...}].
export function stepFlight(flight, aircraft, upgrades, world, wind, input, dt) {
  const events = [];
  if (flight.crashed || flight.landed) return events;

  const engineBoost = upgrades.has('engine') ? 1.12 : 1;
  const turnBoost = upgrades.has('winglets') ? 1.10 : 1;
  const maxSpeed = aircraft.maxSpeed * engineBoost;
  const stall = aircraft.stall;
  const fuelBurn = upgrades.has('prop') ? 0.85 : 1;

  // Throttle moves toward its target; jerking it costs smoothness.
  const throttleTarget = clamp(input.throttle, 0, 1);
  const before = flight.throttle;
  flight.throttle += clamp(throttleTarget - flight.throttle, -dt * 0.8, dt * 0.8);
  flight.smooth = clamp(flight.smooth - Math.abs(flight.throttle - before) * 260 * dt, 0, 100);
  flight.lastThrottle = flight.throttle;

  // Speed: thrust against drag; drag grows with the square of speed.
  const thrust = flight.throttle * maxSpeed * 0.55;
  const drag = 0.011 * flight.speed * flight.speed;
  const accel = flight.onGround
    ? thrust * 1.6 - drag * 0.4
    : thrust - drag - Math.sin(degToRad(flight.pitch)) * 9.8 * 0.9;
  flight.speed = Math.max(0, flight.speed + accel * dt);

  // Roll and pitch follow the stick, with authority that fades at low speed.
  const authority = clamp(flight.speed / (stall * 1.6), 0.25, 1);
  const targetRoll = clamp(input.roll, -1, 1) * 55;
  const targetPitch = clamp(input.pitch, -1, 1) * 22;
  flight.roll += (targetRoll - flight.roll) * Math.min(1, dt * 3.2 * authority);
  flight.pitch += (targetPitch - flight.pitch) * Math.min(1, dt * 2.6 * authority);

  // Turning: banked flight turns the heading; the turn rate scales with bank.
  const turnRate = degToRad(flight.roll) * aircraft.turn * turnBoost * clamp(flight.speed / 40, 0.3, 1.6);
  flight.heading = (flight.heading + (turnRate * 180) / Math.PI * dt + 360) % 360;

  // Lift: climb from pitch and speed; below stall speed the wing gives up.
  const climbRate = Math.sin(degToRad(flight.pitch)) * flight.speed * 0.9;
  const liftFactor = flight.speed < stall ? flight.speed / stall : 1;
  const sinkRate = flight.speed < stall ? (stall - flight.speed) * 0.55 : 0;
  flight.verticalSpeed = climbRate * liftFactor - sinkRate;
  flight.z += flight.verticalSpeed * dt;

  // Wind: a steady push plus gusts that shove the aircraft sideways.
  flight.x += Math.sin(degToRad(flight.heading)) * flight.speed * dt + wind.x * dt;
  flight.y += Math.cos(degToRad(flight.heading)) * flight.speed * dt + wind.y * dt;

  // Fuel: the throttle drinks it; empty tanks mean a glider.
  const burn = (0.028 + flight.throttle * 0.11) * fuelBurn;
  flight.fuel = Math.max(0, flight.fuel - burn * dt);
  if (flight.fuel <= 0 && flight.throttle > 0) {
    flight.throttle = 0;
    events.push({ type: 'fuel-empty' });
  }

  // Ground contact.
  const ground = terrainHeight(world, flight.x, flight.y);
  if (flight.z <= ground + 1.5) {
    flight.z = ground + 1.5;
    if (flight.onGround) {
      // Rolling along the ground: friction.
      flight.speed = Math.max(0, flight.speed - 14 * dt);
      if (flight.speed <= 0.5) events.push({ type: 'stopped' });
    } else {
      resolveTouchdown(flight, aircraft, upgrades, world, events);
    }
  } else {
    flight.onGround = false;
  }

  // World edge: the Reach is an archipelago; turn back at the walls.
  if (flight.x < -500 || flight.x > 12500 || Math.abs(flight.y) > 1550) {
    flight.heading = (flight.heading + 180) % 360;
    flight.x = clamp(flight.x, -480, 12480);
    flight.y = clamp(flight.y, -1530, 1530);
    events.push({ type: 'edge-turn' });
  }

  return events;
}

// A touchdown: a good landing on a runway, a survivable rough landing on
// flat ground, or a crash. Damage accrues; 100 means the airframe is done.
function resolveTouchdown(flight, aircraft, upgrades, world, events) {
  const field = AIRFIELDS.find((f) => overRunway(f, flight.x, flight.y));
  const descent = -flight.verticalSpeed;
  const tolerance = upgrades.has('gear') ? 11 : 8;
  if (field) {
    const off = runwayOffset(field, flight.x, flight.y);
    const headingError = Math.abs(angleDiffDeg(flight.heading, field.runwayHeading));
    const aligned = headingError < 25 || headingError > 155;
    if (descent <= tolerance && flight.speed < aircraft.maxSpeed * 0.75 && aligned) {
      flight.onGround = true;
      flight.landed = true;
      flight.verticalSpeed = 0;
      const quality = descent <= 3 && Math.abs(off.across) < 8 ? 'perfect' : descent <= 6 ? 'good' : 'hard';
      events.push({ type: 'landed', field: field.id, quality, across: off.across, descent });
      return;
    }
    // On the runway but too fast, too steep or sideways: damage, keep rolling.
    const hit = Math.round((descent - tolerance) * 4 + (aligned ? 0 : 12));
    flight.damage = Math.min(100, flight.damage + Math.max(6, hit));
    flight.onGround = true;
    flight.verticalSpeed = 0;
    events.push({ type: 'rough-landing', field: field.id, damage: flight.damage });
  } else {
    // Off-runway: water and hills are unforgiving.
    const hit = Math.round(descent * 5 + flight.speed * 0.35);
    flight.damage = Math.min(100, flight.damage + Math.max(10, hit));
    flight.onGround = true;
    flight.verticalSpeed = 0;
    events.push({ type: 'off-field', damage: flight.damage });
  }
  if (flight.damage >= 100) {
    flight.crashed = true;
    flight.crashReason = field ? 'Airframe broke up on the runway.' : 'Down in the terrain.';
    events.push({ type: 'crashed', reason: flight.crashReason });
  }
}

// Ring pass: the aircraft crossed the ring plane within its radius.
export function checkRing(flight, ring, prev) {
  const [rx, ry, rz, radius] = ring;
  const dx = flight.x - rx;
  const dy = flight.y - ry;
  const dz = flight.z - rz;
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (dist > radius * 1.6) return false;
  // Crossing test: the previous position was on the other side of the
  // ring plane (the plane facing along the course, approximated by the
  // x-axis step), and we are inside the disc now.
  const prevDx = prev.x - rx;
  const crossed = Math.sign(prevDx) !== Math.sign(dx) || Math.abs(dx) < 6;
  const inDisc = Math.sqrt(dy * dy + dz * dz) < radius;
  return crossed && inDisc;
}

export function formatAlt(z) {
  return `${Math.max(0, Math.round(z))} m`;
}

export function formatSpeed(speed) {
  return `${Math.round(speed * 3.6)} km/h`;
}

export function formatHeading(heading) {
  return `${String(Math.round(heading) % 360).padStart(3, '0')}°`;
}
