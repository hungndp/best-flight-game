// World rendering for AZURE REACH: sky, sea, ridges, islands, runways,
// rings and clouds, drawn on a 2D canvas from a chase camera behind the
// aircraft. No images, no assets — every pixel is drawn from the world data.

import { AIRFIELDS, WEATHER } from './config.js';
import { clamp, lerp, degToRad } from './random.js';
import { ridgeHeightAt, runwayEndpoints } from './world.js';

const FOCAL = 640;

// Camera: sits behind and above the aircraft, looks along its heading.
export function createCamera(flight) {
  const headingRad = degToRad(flight.heading);
  const fx = Math.sin(headingRad);
  const fy = Math.cos(headingRad);
  const lookPitch = degToRad(flight.pitch) * 0.55;
  return {
    x: flight.x - fx * 78,
    y: flight.y - fy * 78,
    z: flight.z + 16,
    heading: flight.heading,
    headingRad,
    pitch: lookPitch,
    roll: degToRad(flight.roll),
    fx, fy,
    rx: Math.cos(headingRad),
    ry: -Math.sin(headingRad),
  };
}

// Project a world point to screen space. Returns null behind the camera.
export function projectPoint(cam, view, px, py, pz) {
  const dx = px - cam.x;
  const dy = py - cam.y;
  const dz = pz - cam.z;
  let fwd = dx * cam.fx + dy * cam.fy;
  let right = dx * cam.rx + dy * cam.ry;
  let up = dz;
  const cp = Math.cos(cam.pitch);
  const sp = Math.sin(cam.pitch);
  const fwd2 = fwd * cp + up * sp;
  const up2 = -fwd * sp + up * cp;
  if (fwd2 < 10) return null;
  const s = FOCAL / fwd2;
  let sx = view.cx + right * s;
  let sy = view.cy - up2 * s;
  // Roll the whole view around the screen centre.
  const cr = Math.cos(-cam.roll);
  const sr = Math.sin(-cam.roll);
  const ox = sx - view.cx;
  const oy = sy - view.cy;
  sx = view.cx + ox * cr - oy * sr;
  sy = view.cy + ox * sr + oy * cr;
  return { x: sx, y: sy, scale: s, depth: fwd2 };
}

// The horizon line on screen, as two endpoints (already roll-rotated).
export function horizonLine(view, cam) {
  const tilt = -cam.roll;
  const dx = Math.cos(tilt) * view.w;
  const dy = Math.sin(tilt) * view.w;
  return {
    x1: view.cx - dx / 2, y1: view.cy - dy / 2,
    x2: view.cx + dx / 2, y2: view.cy + dy / 2,
  };
}

function skyGradient(ctx, view, weather) {
  const g = ctx.createLinearGradient(0, 0, 0, view.h);
  g.addColorStop(0, weather.sky[0]);
  g.addColorStop(0.55, weather.sky[1]);
  g.addColorStop(1, weather.sky[2]);
  return g;
}

export function drawSky(ctx, view, weather, time) {
  ctx.fillStyle = skyGradient(ctx, view, weather);
  ctx.fillRect(0, 0, view.w, view.h);
  // Sun or moon: placed by the weather, low and warm at golden hour.
  const sunX = view.w * 0.72;
  const sunY = view.h * (weather.sun > 0.5 ? 0.2 : 0.34);
  const sunR = weather.night ? 26 : 34;
  const glow = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, sunR * 4);
  const sunColor = weather.night ? 'rgba(220,230,255,0.9)' : 'rgba(255,236,180,0.95)';
  glow.addColorStop(0, sunColor);
  glow.addColorStop(0.25, weather.night ? 'rgba(200,210,255,0.25)' : 'rgba(255,220,140,0.35)');
  glow.addColorStop(1, 'rgba(255,220,140,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(sunX - sunR * 4, sunY - sunR * 4, sunR * 8, sunR * 8);
  ctx.fillStyle = weather.night ? '#e8eefc' : '#fff3c4';
  ctx.beginPath();
  ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
  ctx.fill();
  if (weather.night) {
    // A few stars above the horizon.
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    for (let i = 0; i < 40; i++) {
      const sx = ((i * 137.5) % view.w);
      const sy = ((i * 89.3) % (view.h * 0.4));
      ctx.fillRect(sx, sy, 1.6, 1.6);
    }
  }
}

export function drawSea(ctx, view, cam, weather) {
  const line = horizonLine(view, cam);
  // Sea fills everything below the horizon line.
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(line.x1, line.y1);
  ctx.lineTo(line.x2, line.y2);
  ctx.lineTo(view.w, view.h);
  ctx.lineTo(0, view.h);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, view.cy, 0, view.h);
  const deep = weather.night ? '#0e1a33' : weather.storm ? '#2c3e4e' : '#1d6f9e';
  const shallow = weather.night ? '#16294d' : weather.storm ? '#4a6a80' : '#3fa8c9';
  g.addColorStop(0, shallow);
  g.addColorStop(1, deep);
  ctx.fillStyle = g;
  ctx.fill();
  // Sun glitter: a shimmering path on the water toward the sun.
  if (weather.sun > 0.3) {
    ctx.fillStyle = 'rgba(255,240,190,0.20)';
    const gx = view.w * 0.72;
    for (let i = 0; i < 14; i++) {
      const y = view.cy + 18 + i * ((view.h - view.cy - 18) / 14);
      const wdt = 26 + i * 9;
      ctx.fillRect(gx - wdt / 2 + Math.sin(i * 2.7) * 12, y, wdt, 2.5);
    }
  }
  ctx.restore();
}

export function drawRidges(ctx, view, cam, world) {
  // Distant mountain skyline: sample the ridge function across the view.
  const steps = 48;
  ctx.beginPath();
  const line = horizonLine(view, cam);
  ctx.moveTo(line.x1, line.y1);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const heading = cam.heading + (t - 0.5) * 130;
    const h = ridgeHeightAt(world, (heading + 360) % 360);
    const px = line.x1 + (line.x2 - line.x1) * t;
    const py = line.y1 + (line.y2 - line.y1) * t - h * view.h * 0.55;
    ctx.lineTo(px, py);
  }
  ctx.lineTo(line.x2, line.y2);
  ctx.closePath();
  ctx.fillStyle = 'rgba(52, 74, 96, 0.55)';
  ctx.fill();
  // Snow caps on the tallest ridge teeth.
  ctx.fillStyle = 'rgba(240,244,250,0.5)';
  for (let i = 0; i <= steps; i += 2) {
    const t = i / steps;
    const heading = cam.heading + (t - 0.5) * 130;
    const h = ridgeHeightAt(world, (heading + 360) % 360);
    if (h > 0.16) {
      const px = line.x1 + (line.x2 - line.x1) * t;
      const py = line.y1 + (line.y2 - line.y1) * t - h * view.h * 0.55;
      ctx.beginPath();
      ctx.moveTo(px - 9, py + 7);
      ctx.lineTo(px, py - 2);
      ctx.lineTo(px + 9, py + 7);
      ctx.closePath();
      ctx.fill();
    }
  }
}

function islandShape(ctx, view, cam, world, cx, cy, radius, height, colors) {
  const p = projectPoint(cam, view, cx, cy, height);
  if (!p || p.depth > 9000 || p.depth < 220) return;
  const r = Math.min(240, Math.max(3, radius * p.scale * 0.9));
  if (p.x < -r * 2 || p.x > view.w + r * 2 || p.y < -r || p.y > view.h + r) return;
  // Sand ring, grass, then the hilltop — three nested ellipses.
  ctx.fillStyle = colors.sand;
  ctx.beginPath();
  ctx.ellipse(p.x, p.y, r * 1.18, r * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = colors.grass;
  ctx.beginPath();
  ctx.ellipse(p.x, p.y, r, r * 0.36, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = colors.top;
  ctx.beginPath();
  ctx.ellipse(p.x, p.y - r * 0.1, r * 0.55, r * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();
}

export function drawIslands(ctx, view, cam, world, weather) {
  const night = weather.night;
  const colors = night
    ? { sand: '#5a5348', grass: '#1e3a24', top: '#2c4a2e' }
    : { sand: '#e8d8a0', grass: '#5da24a', top: '#3f7d33' };
  // Hills between the airfields.
  for (const hill of world.hills) {
    islandShape(ctx, view, cam, world, hill.x, hill.y, hill.radius, hill.height * 0.4, colors);
  }
  // The airfield islands themselves, drawn bigger and flatter.
  for (const field of AIRFIELDS) {
    islandShape(ctx, view, cam, world, field.x, field.y, 420, 0, colors);
  }
}

function drawStrip(ctx, view, cam, field, weather) {
  const ends = runwayEndpoints(field);
  const halfW = field.runwayWidth / 2;
  const rad = degToRad(field.runwayHeading);
  const px = Math.cos(rad) * halfW;
  const py = -Math.sin(rad) * halfW;
  const corners = [
    projectPoint(cam, view, ends.start.x + px, ends.start.y + py, 2),
    projectPoint(cam, view, ends.start.x - px, ends.start.y - py, 2),
    projectPoint(cam, view, ends.end.x - px, ends.end.y - py, 2),
    projectPoint(cam, view, ends.end.x + px, ends.end.y + py, 2),
  ];
  if (corners.some((c) => !c)) return;
  // A pale apron under the strip, 2.4x as wide, so the runway reads as a
  // strip even when it is viewed nearly end-on.
  const apronW = halfW * 2.4;
  const ax = Math.cos(rad) * apronW;
  const ay = -Math.sin(rad) * apronW;
  const apron = [
    projectPoint(cam, view, ends.start.x + ax, ends.start.y + ay, 1),
    projectPoint(cam, view, ends.start.x - ax, ends.start.y - ay, 1),
    projectPoint(cam, view, ends.end.x - ax, ends.end.y - ay, 1),
    projectPoint(cam, view, ends.end.x + ax, ends.end.y + ay, 1),
  ];
  if (apron.every((c) => c)) {
    ctx.beginPath();
    ctx.moveTo(apron[0].x, apron[0].y);
    for (let i = 1; i < 4; i++) ctx.lineTo(apron[i].x, apron[i].y);
    ctx.closePath();
    ctx.fillStyle = weather.night ? '#3a3f47' : '#9aa0a8';
    ctx.fill();
  }
  ctx.beginPath();
  ctx.moveTo(corners[0].x, corners[0].y);
  for (let i = 1; i < 4; i++) ctx.lineTo(corners[i].x, corners[i].y);
  ctx.closePath();
  ctx.fillStyle = weather.night ? '#2a2d33' : '#3c3f45';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // Centreline dashes.
  ctx.fillStyle = weather.night ? '#ffd94c' : '#f5f0dc';
  const dashes = 9;
  for (let i = 0; i < dashes; i++) {
    const t0 = (i + 0.15) / dashes;
    const t1 = (i + 0.55) / dashes;
    const a = projectPoint(cam, view, lerp(ends.start.x, ends.end.x, t0), lerp(ends.start.y, ends.end.y, t0), 3);
    const b = projectPoint(cam, view, lerp(ends.start.x, ends.end.x, t1), lerp(ends.start.y, ends.end.y, t1), 3);
    if (!a || !b) continue;
    ctx.lineWidth = Math.max(1, 3 * a.scale);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  // Threshold bars at both ends.
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  for (const t of [0.02, 0.98]) {
    const c = projectPoint(cam, view, lerp(ends.start.x, ends.end.x, t), lerp(ends.start.y, ends.end.y, t), 3);
    if (!c) continue;
    ctx.fillRect(c.x - 8 * c.scale, c.y - 1.5, 16 * c.scale, 3);
  }
  // Edge lights after dark: glowing dots along both edges.
  if (weather.night || weather.light < 0.7) {
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      for (const side of [1, -1]) {
        const c = projectPoint(cam, view,
          lerp(ends.start.x, ends.end.x, t) + px * side,
          lerp(ends.start.y, ends.end.y, t) + py * side, 3);
        if (!c) continue;
        ctx.fillStyle = '#7dff9a';
        ctx.beginPath();
        ctx.arc(c.x, c.y, Math.max(1.5, 2.5 * c.scale), 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

export function drawRunways(ctx, view, cam, world, weather) {
  for (const field of AIRFIELDS) drawStrip(ctx, view, cam, field, weather);
}

export function drawRings(ctx, view, cam, rings, nextIndex) {
  rings.forEach((ring, i) => {
    const [rx, ry, rz, radius] = ring;
    const p = projectPoint(cam, view, rx, ry, rz);
    if (!p) return;
    const r = radius * p.scale;
    if (r < 2 || r > 900) return;
    const isNext = i === nextIndex;
    const isDone = i < nextIndex;
    ctx.save();
    ctx.globalAlpha = isDone ? 0.25 : isNext ? 1 : 0.55;
    // Outer glow.
    ctx.strokeStyle = isNext ? '#ffd94c' : '#7ec8f2';
    ctx.lineWidth = Math.max(2, r * 0.14);
    ctx.shadowColor = isNext ? '#ffbf00' : '#4c8fd6';
    ctx.shadowBlur = isNext ? 18 : 6;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = isNext ? '#fff3c4' : 'rgba(255,255,255,0.85)';
    ctx.lineWidth = Math.max(1, r * 0.045);
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.stroke();
    // Ring number, readable at a glance.
    if (r > 14) {
      ctx.fillStyle = isNext ? '#3a2a00' : '#0e2a44';
      ctx.font = `bold ${Math.max(11, Math.min(26, r * 0.5))}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(i + 1), p.x, p.y);
    }
    ctx.restore();
  });
}

export function drawClouds(ctx, view, cam, world, weather) {
  const night = weather.night;
  for (const cloud of world.clouds) {
    const p = projectPoint(cam, view, cloud.x, cloud.y, cloud.z);
    if (!p || p.depth > 11000 || p.depth < 350) continue;
    const r = Math.min(150, cloud.size * p.scale);
    if (r < 4) continue;
    ctx.save();
    ctx.globalAlpha = (night ? 0.3 : 0.55) * cloud.shade;
    ctx.fillStyle = night ? '#8a94b8' : '#ffffff';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, r, r * 0.38, 0, 0, Math.PI * 2);
    ctx.ellipse(p.x - r * 0.5, p.y + r * 0.08, r * 0.6, r * 0.3, 0, 0, Math.PI * 2);
    ctx.ellipse(p.x + r * 0.5, p.y + r * 0.06, r * 0.65, r * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

export function drawRain(ctx, view, world, weather, time) {
  if (!weather.rain) return;
  ctx.save();
  ctx.strokeStyle = 'rgba(190,210,230,0.5)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 90; i++) {
    const x = (i * 97.3 + time * 40) % (view.w + 40) - 20;
    const y = (i * 57.1 + time * 900) % (view.h + 60) - 30;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - 6, y + 22);
    ctx.stroke();
  }
  ctx.restore();
}

// The full world pass, in draw order. Returns the camera for the cockpit.
export function drawWorld(ctx, view, world, flight, weather, rings, nextRing, time) {
  const cam = createCamera(flight);
  drawSky(ctx, view, weather, time);
  drawSea(ctx, view, cam, weather);
  drawRidges(ctx, view, cam, world);
  drawIslands(ctx, view, cam, world, weather);
  drawRunways(ctx, view, cam, world, weather);
  drawRings(ctx, view, cam, rings, nextRing);
  drawClouds(ctx, view, cam, world, weather);
  drawRain(ctx, view, world, weather, time);
  return cam;
}
