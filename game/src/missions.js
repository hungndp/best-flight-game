// Mission logic for AZURE REACH: objectives, ring order, landings,
// pickups, scoring and the debrief. A mission is a small state machine:
// rings in order, then landings in order, then done.

import { MISSIONS, AIRFIELDS } from './config.js';
import { airfieldById } from './world.js';
import { checkRing } from './physics.js';

export function missionById(id) {
  return MISSIONS.find((m) => m.id === id) || MISSIONS[0];
}

export function newMissionRun(mission, profile) {
  return {
    mission,
    ringIndex: 0,
    stopIndex: 0,
    ringsDone: 0,
    elapsed: 0,
    phase: 'fly', // fly | pickup | done | failed
    pickupTimer: 0,
    pickupDone: false,
    landedFields: [],
    score: 0,
    smoothBonus: 0,
    objectiveText: objectiveText(mission, 0, 0),
    done: false,
    failed: false,
    failReason: '',
    debrief: null,
  };
}

function objectiveText(mission, ringIndex, stopIndex) {
  const totalRings = mission.rings.length;
  if (ringIndex < totalRings) return `Ring ${ringIndex + 1}/${totalRings}`;
  const nextStop = mission.stops[stopIndex];
  if (nextStop) return `Land at ${airfieldById(nextStop).name}`;
  return 'Mission complete';
}

// Advance the mission by one frame. `events` come from the physics step.
// Returns mission events: [{type, ...}] for sounds and toasts.
export function stepMission(run, flight, prevFlight, events, dt) {
  const out = [];
  const mission = run.mission;
  run.elapsed += dt;

  // Ring progression: rings must be flown in order.
  if (run.ringIndex < mission.rings.length) {
    const ring = mission.rings[run.ringIndex];
    if (checkRing(flight, ring, prevFlight)) {
      run.ringIndex += 1;
      run.ringsDone += 1;
      run.score += 50;
      out.push({ type: 'ring', index: run.ringIndex, total: mission.rings.length });
    }
  }

  // Pickup: hold still on the ground at the pickup point.
  if (mission.pickup && !run.pickupDone && run.ringIndex >= mission.rings.length) {
    const p = mission.pickup;
    const dist = Math.hypot(flight.x - p.x, flight.y - p.y);
    if (flight.onGround && dist < 120 && flight.speed < 3) {
      run.pickupTimer += dt;
      run.phase = 'pickup';
      run.objectiveText = `Boarding… ${Math.ceil(p.holdSeconds - run.pickupTimer)}s`;
      if (run.pickupTimer >= p.holdSeconds) {
        run.pickupDone = true;
        run.phase = 'fly';
        run.score += 150;
        out.push({ type: 'pickup' });
      }
    } else if (flight.onGround) {
      run.pickupTimer = 0;
      run.objectiveText = 'Taxi to the pickup point';
    }
  }

  // Landing progression: land at each stop in order, after the rings.
  for (const ev of events) {
    if (ev.type === 'landed' && run.ringIndex >= mission.rings.length) {
      const expected = mission.stops[run.stopIndex];
      if (ev.field === expected) {
        run.stopIndex += 1;
        run.landedFields.push(ev.field);
        run.score += ev.quality === 'perfect' ? 120 : ev.quality === 'good' ? 80 : 40;
        out.push({ type: 'landed-stop', field: ev.field, quality: ev.quality, stop: run.stopIndex, total: mission.stops.length });
        if (run.stopIndex >= mission.stops.length && (!mission.pickup || run.pickupDone)) {
          finishMission(run, flight, true, '');
          out.push({ type: 'complete', debrief: run.debrief });
        }
      } else {
        out.push({ type: 'wrong-field', field: ev.field, expected });
      }
    }
    if (ev.type === 'crashed') {
      finishMission(run, flight, false, ev.reason);
      out.push({ type: 'failed', reason: ev.reason });
    }
    if (ev.type === 'fuel-empty') {
      out.push({ type: 'fuel-empty' });
    }
  }

  // A tour mission that ends at home: the last stop is home base.
  if (!run.done && run.stopIndex >= mission.stops.length && run.ringIndex >= mission.rings.length) {
    if (!mission.pickup || run.pickupDone) {
      finishMission(run, flight, true, '');
      out.push({ type: 'complete', debrief: run.debrief });
    }
  }

  if (!run.done && !run.failed) {
    run.objectiveText = objectiveText(mission, run.ringIndex, run.stopIndex);
    if (mission.pickup && !run.pickupDone && run.ringIndex >= mission.rings.length && flight.onGround) {
      run.objectiveText = 'Taxi to the pickup point';
    }
  }
  return out;
}

function finishMission(run, flight, success, reason) {
  const mission = run.mission;
  // Smoothness bonus: throttle discipline pays.
  const smoothBonus = Math.round((flight.smooth / 100) * 60);
  run.smoothBonus = success ? smoothBonus : 0;
  const timeBonus = success ? Math.max(0, Math.round(300 - run.elapsed)) : 0;
  const ringBonus = run.ringsDone * 50;
  const landBonus = run.landedFields.length * 80;
  const total = success ? ringBonus + landBonus + smoothBonus + timeBonus : 0;
  run.score = total;
  run.done = success;
  run.failed = !success;
  run.failReason = reason;
  run.debrief = {
    success,
    reason,
    rings: `${run.ringsDone}/${mission.rings.length}`,
    landings: run.landedFields.map((id) => airfieldById(id).name),
    timeSeconds: Math.round(run.elapsed),
    smooth: Math.round(flight.smooth),
    smoothBonus,
    timeBonus,
    credits: success ? mission.reward + Math.floor(total / 10) : 0,
    xp: success ? mission.xp + Math.floor(total / 20) : Math.floor(mission.xp / 4),
  };
}

// The next ring the pilot should aim for (null when all are done).
export function nextRing(run) {
  const mission = run.mission;
  if (run.ringIndex < mission.rings.length) return mission.rings[run.ringIndex];
  return null;
}

// Distance to the current objective, for the HUD and the pointer.
export function objectiveDistance(run, flight) {
  const ring = nextRing(run);
  if (ring) return Math.hypot(ring[0] - flight.x, ring[1] - flight.y);
  const stop = run.mission.stops[run.stopIndex];
  if (stop) {
    const field = airfieldById(stop);
    return Math.hypot(field.x - flight.x, field.y - flight.y);
  }
  return 0;
}

export function missionListForMenu(profile) {
  return MISSIONS.map((m, i) => ({
    ...m,
    number: i + 1,
    unlocked: i === 0 || profile.completed.includes(MISSIONS[i - 1].id),
    best: profile.best[m.id] || null,
  }));
}
