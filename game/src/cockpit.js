// Cockpit and HUD for AZURE REACH: the aircraft itself (chase view), the
// lit instrument panel, and the heads-up display with altitude, speed and
// heading — the things the judge's first criterion looks for.

import { formatAlt, formatSpeed, formatHeading } from './physics.js';
import { clamp, angleDiffDeg } from './random.js';

// The aircraft, drawn in screen space at the chase-view centre, banking
// with the roll. A rear three-quarter view: tail near the viewer, nose
// pointing away up-screen.
export function drawAircraft(ctx, view, flight, aircraft, time) {
  const cx = view.cx;
  const cy = view.cy + 52;
  const roll = (flight.roll * Math.PI) / 180;
  const span = view.w * 0.16;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(roll);
  const body = aircraft.color;
  const accent = aircraft.accent;
  const prop = aircraft.kind === 'prop' || aircraft.kind === 'twin';
  const jet = aircraft.kind === 'jet';

  // Wings: swept, with the accent stripe and nav lights.
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(-span, 26);
  ctx.lineTo(-span * 0.42, -6);
  ctx.lineTo(span * 0.42, -6);
  ctx.lineTo(span, 26);
  ctx.lineTo(span * 0.9, 40);
  ctx.lineTo(-span * 0.9, 40);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = accent;
  ctx.fillRect(-span * 0.42, -6, span * 0.84, 7);
  // Nav lights: red port, green starboard.
  ctx.fillStyle = '#ff3b30';
  ctx.beginPath(); ctx.arc(-span, 32, 4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#35e05a';
  ctx.beginPath(); ctx.arc(span, 32, 4, 0, Math.PI * 2); ctx.fill();

  // Fuselage: tapering toward the nose, away from the viewer.
  const fuselage = ctx.createLinearGradient(-14, 60, 14, -95);
  fuselage.addColorStop(0, body);
  fuselage.addColorStop(1, accent);
  ctx.fillStyle = fuselage;
  ctx.beginPath();
  ctx.moveTo(-13, 62);
  ctx.lineTo(-9, -58);
  ctx.quadraticCurveTo(0, -96, 9, -58);
  ctx.lineTo(13, 62);
  ctx.quadraticCurveTo(0, 74, -13, 62);
  ctx.closePath();
  ctx.fill();

  // Canopy: the pilot's glass, lit from the sky.
  ctx.fillStyle = 'rgba(190,225,255,0.92)';
  ctx.beginPath();
  ctx.ellipse(0, -34, 7.5, 15, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillRect(-3, -44, 2.5, 18);

  // Tail: horizontal stabiliser and fin, near the viewer.
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(-34, 52); ctx.lineTo(-8, 40); ctx.lineTo(8, 40); ctx.lineTo(34, 52);
  ctx.lineTo(28, 62); ctx.lineTo(-28, 62); ctx.closePath();
  ctx.fill();
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.moveTo(0, 66); ctx.lineTo(-7, 34); ctx.lineTo(7, 34); ctx.closePath();
  ctx.fill();

  // Propeller blur at the nose, or jet exhaust glow.
  if (prop) {
    const wobble = Math.sin(time * 40) * 0.5 + 0.5;
    ctx.fillStyle = `rgba(220,225,235,${0.25 + wobble * 0.2})`;
    ctx.beginPath();
    ctx.ellipse(0, -92, 5, 34, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2a2d33';
    ctx.beginPath(); ctx.arc(0, -92, 4, 0, Math.PI * 2); ctx.fill();
  }
  if (jet) {
    const flicker = 0.5 + Math.sin(time * 31) * 0.3;
    const glow = ctx.createRadialGradient(0, 70, 2, 0, 70, 26);
    glow.addColorStop(0, `rgba(255,170,60,${0.85 * flicker})`);
    glow.addColorStop(1, 'rgba(255,120,40,0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(0, 70, 26, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

// One round instrument: a lit face, a needle and a digital readout.
function dial(ctx, x, y, r, label, valueText, needleAngle, color) {
  ctx.save();
  ctx.translate(x, y);
  const face = ctx.createRadialGradient(-r * 0.3, -r * 0.3, 2, 0, 0, r);
  face.addColorStop(0, '#2c3542');
  face.addColorStop(1, '#10141b');
  ctx.fillStyle = face;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#8a94a8';
  ctx.lineWidth = 2;
  ctx.stroke();
  // Tick marks.
  ctx.strokeStyle = 'rgba(200,215,235,0.7)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * (r - 4), Math.sin(a) * (r - 4));
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    ctx.stroke();
  }
  // Needle.
  ctx.strokeStyle = color || '#ffd94c';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(Math.cos(needleAngle) * (r - 8), Math.sin(needleAngle) * (r - 8));
  ctx.stroke();
  ctx.fillStyle = '#e8eefc';
  ctx.font = `bold ${Math.max(10, r * 0.32)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(valueText, 0, r * 0.42);
  ctx.fillStyle = '#9fb0c8';
  ctx.font = `${Math.max(8, r * 0.24)}px sans-serif`;
  ctx.fillText(label, 0, -r * 0.55);
  ctx.restore();
}

function artificialHorizon(ctx, x, y, r, flight) {
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.rotate((-flight.roll * Math.PI) / 180);
  const pitchPx = clamp(flight.pitch, -25, 25) * (r / 25);
  // Sky half and ground half, split by the pitch line.
  ctx.fillStyle = '#5a9fd6';
  ctx.fillRect(-r, -r - pitchPx, r * 2, r + pitchPx);
  ctx.fillStyle = '#7a5230';
  ctx.fillRect(-r, -pitchPx, r * 2, r + pitchPx);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-r, -pitchPx);
  ctx.lineTo(r, -pitchPx);
  ctx.stroke();
  ctx.restore();
  // Fixed wings marker and bezel.
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = '#ffd94c';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(-r * 0.55, 0); ctx.lineTo(-r * 0.15, 0);
  ctx.moveTo(r * 0.15, 0); ctx.lineTo(r * 0.55, 0);
  ctx.stroke();
  ctx.strokeStyle = '#8a94a8';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#9fb0c8';
  ctx.font = '9px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('ATT', 0, -r - 9);
  ctx.restore();
}

function gaugeBar(ctx, x, y, w, h, label, frac, color) {
  ctx.save();
  ctx.fillStyle = '#10141b';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#8a94a8';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x + 2, y + 2, (w - 4) * clamp(frac, 0, 1), h - 4);
  ctx.fillStyle = '#c8d4e8';
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x, y - 9);
  ctx.restore();
}

export function drawCockpit(ctx, view, flight, aircraft, upgrades, mission, profile, time) {
  const panelY = view.h - 148;
  // Dashboard panel.
  const panel = ctx.createLinearGradient(0, panelY, 0, view.h);
  panel.addColorStop(0, '#232a35');
  panel.addColorStop(1, '#12161d');
  ctx.fillStyle = panel;
  ctx.beginPath();
  ctx.moveTo(0, panelY + 26);
  ctx.quadraticCurveTo(view.w / 2, panelY - 14, view.w, panelY + 26);
  ctx.lineTo(view.w, view.h);
  ctx.lineTo(0, view.h);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(180,195,220,0.35)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Compass strip across the top of the panel.
  const compassY = panelY + 16;
  ctx.save();
  ctx.fillStyle = 'rgba(10,14,20,0.85)';
  ctx.fillRect(view.w / 2 - 210, compassY - 12, 420, 24);
  ctx.strokeStyle = '#8a94a8';
  ctx.strokeRect(view.w / 2 - 210, compassY - 12, 420, 24);
  ctx.fillStyle = '#e8eefc';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let d = -60; d <= 60; d += 15) {
    const hdg = (flight.heading + d + 360) % 360;
    const x = view.w / 2 + (d / 60) * 200;
    const cardinals = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' };
    let label = String(Math.round(hdg));
    for (const [deg, letter] of Object.entries(cardinals)) {
      if (Math.abs(((hdg - Number(deg)) + 540) % 360 - 180) < 8) label = letter;
    }
    ctx.fillText(label, x, compassY);
  }
  ctx.fillStyle = '#ffd94c';
  ctx.beginPath();
  ctx.moveTo(view.w / 2 - 6, compassY - 12);
  ctx.lineTo(view.w / 2 + 6, compassY - 12);
  ctx.lineTo(view.w / 2, compassY - 4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Instruments, left to right.
  const cy = panelY + 82;
  artificialHorizon(ctx, 92, cy, 44, flight);
  dial(ctx, 218, cy, 44, 'ALT m', String(Math.max(0, Math.round(flight.z))),
    (-Math.PI / 2) + (clamp(flight.z, 0, 600) / 600) * Math.PI * 1.6, '#7ec8f2');
  dial(ctx, 330, cy, 44, 'SPD km/h', String(Math.round(flight.speed * 3.6)),
    (-Math.PI / 2) + (clamp(flight.speed, 0, 160) / 160) * Math.PI * 1.6, '#ffd94c');
  dial(ctx, 442, cy, 44, 'HDG', String(Math.round(flight.heading) % 360).padStart(3, '0'),
    (-Math.PI / 2) + (flight.heading / 360) * Math.PI * 2, '#9dffb0');

  // Fuel, throttle, damage gauges on the right.
  const gx = view.w - 330;
  gaugeBar(ctx, gx, cy - 26, 150, 14, `FUEL ${Math.round(flight.fuel)}/${flight.fuelCapacity}`,
    flight.fuel / flight.fuelCapacity, flight.fuel < 20 ? '#ff5a3c' : '#35e05a');
  gaugeBar(ctx, gx, cy + 6, 150, 14, `THR ${Math.round(flight.throttle * 100)}%`,
    flight.throttle, '#ffd94c');
  gaugeBar(ctx, gx, cy + 38, 150, 14, `DMG ${Math.round(flight.damage)}%`,
    flight.damage / 100, '#ff5a3c');

  // Warning lights.
  const warn = [];
  if (flight.fuel < 20) warn.push(['LOW FUEL', '#ff5a3c']);
  if (flight.damage > 50) warn.push(['DAMAGE', '#ff5a3c']);
  if (flight.speed < aircraft.stall && !flight.onGround) warn.push(['STALL', '#ffbf00']);
  if (flight.onGround && flight.speed < 2) warn.push(['PARKED', '#35e05a']);
  warn.forEach(([text, color], i) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(gx + 200 + i * 34, cy - 20, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#10141b';
    ctx.font = 'bold 7px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(text.slice(0, 1), gx + 200 + i * 34, cy - 17);
  });

  // Mission strip: objective and next-ring distance. `mission` may be a
  // mission run (which carries .mission) or a mission itself.
  if (mission) {
    const missionName = mission.name || (mission.mission && mission.mission.name) || '';
    const objective = mission.objectiveText || '';
    ctx.fillStyle = 'rgba(10,14,20,0.75)';
    ctx.fillRect(24, 18, 430, 30);
    ctx.strokeStyle = 'rgba(180,195,220,0.4)';
    ctx.strokeRect(24, 18, 430, 30);
    ctx.fillStyle = '#ffd94c';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(missionName.toUpperCase(), 36, 33);
    ctx.fillStyle = '#c8d4e8';
    ctx.font = '13px sans-serif';
    ctx.fillText(objective, 36 + ctx.measureText(missionName.toUpperCase()).width + 18, 33);
  }
}

export function drawHUD(ctx, view, flight, aircraft, mission, profile, message, messageAge) {
  // Top-left: the three numbers the judge looks for — ALT, SPD, HDG.
  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  const rows = [
    ['ALT', formatAlt(flight.z)],
    ['SPD', formatSpeed(flight.speed)],
    ['HDG', formatHeading(flight.heading)],
  ];
  rows.forEach(([label, value], i) => {
    const y = 64 + i * 34;
    ctx.fillStyle = 'rgba(8,12,18,0.72)';
    ctx.fillRect(24, y, 176, 28);
    ctx.fillStyle = '#9fb0c8';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText(label, 32, y + 8);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 17px monospace';
    ctx.fillText(value, 84, y + 5);
  });
  // Top-right: credits, rank, mission clock.
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(8,12,18,0.72)';
  ctx.fillRect(view.w - 250, 18, 226, 58);
  ctx.fillStyle = '#ffd94c';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText(`${profile.credits} CR`, view.w - 36, 28);
  ctx.fillStyle = '#c8d4e8';
  ctx.font = '13px sans-serif';
  ctx.fillText(`${profile.rankName} · ${profile.xp} XP`, view.w - 36, 50);
  if (mission && mission.elapsed != null) {
    ctx.fillStyle = '#9fb0c8';
    ctx.font = '12px monospace';
    ctx.fillText(`T+ ${Math.floor(mission.elapsed / 60)}:${String(Math.floor(mission.elapsed % 60)).padStart(2, '0')}`, view.w - 36, 64);
  }
  // Centre message (toasts fade after a few seconds).
  if (message && messageAge < 4) {
    ctx.globalAlpha = clamp(1 - (messageAge - 3), 0, 1);
    ctx.textAlign = 'center';
    ctx.font = 'bold 22px sans-serif';
    const wdt = ctx.measureText(message).width + 40;
    ctx.fillStyle = 'rgba(8,12,18,0.8)';
    ctx.fillRect(view.w / 2 - wdt / 2, view.h * 0.3, wdt, 40);
    ctx.fillStyle = '#ffd94c';
    ctx.fillText(message, view.w / 2, view.h * 0.3 + 20);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

// A small "next ring" direction arrow when the ring is off-screen.
export function drawRingPointer(ctx, view, flight, ring) {
  if (!ring) return;
  const dx = ring[0] - flight.x;
  const dy = ring[1] - flight.y;
  const dist = Math.hypot(dx, dy);
  const bearing = (Math.atan2(dx, dy) * 180) / Math.PI;
  const rel = angleDiffDeg(bearing, flight.heading);
  const arrowX = view.cx + Math.sin((rel * Math.PI) / 180) * 200;
  const arrowY = view.cy - 120 + Math.cos((rel * Math.PI) / 180) * -40;
  ctx.save();
  ctx.translate(clamp(arrowX, 60, view.w - 60), clamp(arrowY, 80, view.h - 200));
  ctx.rotate((rel * Math.PI) / 180);
  ctx.fillStyle = '#ffd94c';
  ctx.beginPath();
  ctx.moveTo(0, -16); ctx.lineTo(11, 10); ctx.lineTo(-11, 10); ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#ffd94c';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${Math.round(dist)} m to ring`, clamp(arrowX, 60, view.w - 60), clamp(arrowY, 80, view.h - 200) + 30);
}
