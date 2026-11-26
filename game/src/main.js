// AZURE REACH — main game: screens, game loop, menus, hangar, shop,
// contracts and the flight itself. The game is a single-page canvas app
// with no network requests and no build step.

import {
  AIRFIELDS, AIRCRAFT, MISSIONS, SHOP, WEATHER, STORM_FRONTS,
  GAME_TITLE, GAME_SUBTITLE, GAME_TAGLINE,
} from './config.js';
import { buildWorld, airfieldById, terrainHeight } from './world.js';
import { newFlight, stepFlight } from './physics.js';
import { drawWorld } from './render.js';
import { drawAircraft, drawCockpit, drawHUD, drawRingPointer } from './cockpit.js';
import {
  missionById, newMissionRun, stepMission, nextRing, missionListForMenu,
} from './missions.js';
import {
  loadProfile, saveProfile, selectedAircraft, ownedUpgrades,
  applyDebrief, buyItem, dailyContracts, contractDoneToday,
  completeContract, progressSummary, refreshRank,
} from './economy.js';
import { createInput, hitButton } from './input.js';
import { createAudio } from './audio.js';
import { parseShotQuery, buildShotState, SHOTS } from './shots.js';
import { hashSeed, makeNoise1D, clamp } from './random.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const W = 1280;
const H = 720;
canvas.width = W;
canvas.height = H;

const input = createInput(canvas);
input.attach();
const audio = createAudio();

const profile = loadProfile();
refreshRank(profile);

// The title screen flies itself: a fixed golden-hour scene behind the menu.
const titleScene = buildShotState('cover', 7);

const G = {
  screen: 'title',
  profile,
  world: buildWorld(20261126),
  flight: null,
  run: null,
  weather: WEATHER.clear,
  time: 0,
  message: '',
  messageAge: 99,
  selectedMission: 0,
  hangarTab: 'aircraft',
  contract: null,
  debrief: null,
  gustNoise: makeNoise1D(99),
  shotMode: parseShotQuery(window.location.search),
};

function toast(text) {
  G.message = text;
  G.messageAge = 0;
}

function windAt(time, weather, flight) {
  // A steady westerly plus gusts; storm fronts add a shove near their x.
  const gust = G.gustNoise(time * 0.35) * weather.gust;
  let wx = -weather.wind + gust * 0.6;
  let wy = gust * 0.4;
  for (const front of STORM_FRONTS) {
    const d = Math.abs(flight.x - front.x);
    if (d < 600) {
      const strength = front.strength * (1 - d / 600);
      wx += strength * 6 * Math.sin(time * 1.7);
      wy += strength * 5 * Math.cos(time * 1.3);
    }
  }
  return { x: wx, y: wy };
}

function startMission(mission, contract) {
  const aircraft = selectedAircraft(profile);
  const upgrades = ownedUpgrades(profile);
  G.world = buildWorld(hashSeed(mission.id));
  const fromField = airfieldById(mission.from);
  G.flight = newFlight(aircraft, fromField, upgrades);
  G.flight.throttle = 0;
  G.run = newMissionRun(mission, profile);
  G.weather = WEATHER[mission.weather] || WEATHER.clear;
  G.contract = contract || null;
  G.screen = 'flying';
  G.time = 0;
  input.throttleTarget = 0;
  toast(`${mission.name} — ${mission.briefing}`);
  audio.start();
}

function startContractFlight(contract, dateString) {
  const dest = airfieldById(contract.destination);
  const home = airfieldById('meridian');
  const midX = (home.x + dest.x) / 2;
  const midY = (home.y + dest.y) / 2;
  const mission = {
    id: `contract-${contract.kind}-${dateString}`,
    name: contract.name,
    type: 'contract',
    weather: 'golden',
    from: 'meridian',
    reward: contract.pay,
    xp: 40,
    briefing: `${contract.desc} Destination: ${dest.name}.`,
    rings: [
      [home.x + (dest.x - home.x) * 0.3, home.y + (dest.y - home.y) * 0.3, 140, 24],
      [midX, midY, 150, 24],
      [home.x + (dest.x - home.x) * 0.75, home.y + (dest.y - home.y) * 0.75, 130, 24],
    ],
    stops: [contract.destination],
  };
  startMission(mission, contract);
}

function applyRunDebrief() {
  const run = G.run;
  const debrief = run.debrief;
  if (!debrief) return;
  const mission = run.mission;
  if (G.contract && debrief.success) {
    const dateString = new Date().toISOString().slice(0, 10);
    profile.contractsDone[`${dateString}:${G.contract.id}`] = true;
    if (profile.upgradesOwned.includes('radio')) {
      const bonus = Math.round(G.contract.pay * 0.25);
      debrief.credits += bonus;
    }
  }
  applyDebrief(profile, mission, debrief);
  G.debrief = debrief;
  G.screen = 'debrief';
  if (debrief.success) audio.fanfare();
  else audio.crashSound();
}

// ---- menu drawing helpers -------------------------------------------------

function drawButton(x, y, w, h, label, active, disabled) {
  const hovered = input.mouse.x >= x && input.mouse.x <= x + w
    && input.mouse.y >= y && input.mouse.y <= y + h;
  ctx.fillStyle = disabled ? '#3a3f47' : hovered || active ? '#ffd94c' : '#2c3542';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = hovered || active ? '#fff3c4' : '#8a94a8';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = disabled ? '#8a94a8' : hovered || active ? '#1a1200' : '#e8eefc';
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + w / 2, y + h / 2 + 1);
  return hovered && !disabled;
}

function drawPanel(x, y, w, h) {
  ctx.fillStyle = 'rgba(10,14,20,0.82)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(180,195,220,0.45)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x, y, w, h);
}

function drawTitleScreen(dt) {
  // The game itself is the backdrop: golden-hour chase view, ring ahead.
  // No cockpit on the menu — the title, buttons and footer own the frame.
  const scene = titleScene;
  const view = { w: W, h: H, cx: W / 2, cy: H * 0.46 };
  drawWorld(ctx, view, scene.world, scene.flight, scene.weather,
    scene.mission.rings, scene.run.ringIndex, G.time);
  drawAircraft(ctx, view, scene.flight, scene.aircraft, G.time);

  // Title block.
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(8,12,18,0.55)';
  ctx.fillRect(0, 84, W, 118);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 64px sans-serif';
  ctx.fillText(GAME_TITLE, W / 2, 128);
  ctx.fillStyle = '#ffd94c';
  ctx.font = 'bold 19px sans-serif';
  ctx.fillText(GAME_SUBTITLE, W / 2, 164);
  ctx.fillStyle = '#c8d4e8';
  ctx.font = '15px sans-serif';
  ctx.fillText(GAME_TAGLINE, W / 2, 188);

  const click = input.consumeClick();
  const by = 330;
  if (drawButton(W / 2 - 150, by, 300, 52, 'FLY A MISSION', false)) {
    if (click && hitButton(click, W / 2 - 150, by, 300, 52)) G.screen = 'missions';
  }
  if (drawButton(W / 2 - 150, by + 66, 300, 52, 'HANGAR & SHOP', false)) {
    if (click && hitButton(click, W / 2 - 150, by + 66, 300, 52)) G.screen = 'hangar';
  }
  if (drawButton(W / 2 - 150, by + 132, 300, 52, 'DAILY CONTRACTS', false)) {
    if (click && hitButton(click, W / 2 - 150, by + 132, 300, 52)) G.screen = 'contracts';
  }
  if (drawButton(W / 2 - 150, by + 198, 300, 52, 'HOW TO FLY', false)) {
    if (click && hitButton(click, W / 2 - 150, by + 198, 300, 52)) G.screen = 'help';
  }
  if (input.wasPressed('enter') || input.wasPressed(' ')) G.screen = 'missions';
  if (input.wasPressed('h')) G.screen = 'hangar';
  if (input.wasPressed('c')) G.screen = 'contracts';

  // Footer: pilot standing and progress, over a dark strip so it reads
  // against the sea.
  ctx.fillStyle = 'rgba(8,12,18,0.72)';
  ctx.fillRect(0, H - 56, W, 56);
  const sum = progressSummary(profile);
  ctx.fillStyle = '#e8eefc';
  ctx.font = '15px sans-serif';
  ctx.fillText(
    `${profile.rankName} · ${profile.credits} CR · ${sum.missionsDone}/${sum.missionsTotal} missions · ` +
    `${sum.aircraftOwned}/${sum.aircraftTotal} aircraft · ${sum.ringsFlown} rings flown · ${sum.landings} landings`,
    W / 2, H - 24);
  ctx.fillStyle = '#9fb0c8';
  ctx.font = '13px sans-serif';
  ctx.fillText('Keyboard: arrows/WASD fly · Shift/Ctrl throttle · Space airbrake · Esc menu · M mute · 1–4 screenshot previews', W / 2, H - 44);
  for (const key of ['1', '2', '3', '4']) {
    if (input.wasPressed(key)) {
      const names = Object.keys(SHOTS);
      const scene2 = buildShotState(names[Number(key) - 1], 7);
      titleScene.world = scene2.world;
      titleScene.flight = scene2.flight;
      titleScene.mission = scene2.mission;
      titleScene.run = scene2.run;
      titleScene.weather = scene2.weather;
      titleScene.aircraft = scene2.aircraft;
    }
  }
}

function drawMissionsScreen() {
  ctx.fillStyle = '#0e1622';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 34px sans-serif';
  ctx.fillText('MISSIONS — THE MERIDIAN ISLES', 48, 64);
  ctx.fillStyle = '#ffd94c';
  ctx.font = '16px sans-serif';
  ctx.fillText('12 missions · 5 airfields · 40 rings · 3 storm fronts — fly them in order, or replay any you have cleared.', 48, 92);

  const list = missionListForMenu(profile);
  const click = input.consumeClick();
  list.forEach((m, i) => {
    const y = 122 + i * 46;
    const selected = i === G.selectedMission;
    ctx.fillStyle = selected ? 'rgba(255,217,76,0.16)' : 'rgba(255,255,255,0.05)';
    ctx.fillRect(48, y, 760, 40);
    ctx.strokeStyle = selected ? '#ffd94c' : 'rgba(180,195,220,0.3)';
    ctx.strokeRect(48, y, 760, 40);
    ctx.fillStyle = m.unlocked ? '#e8eefc' : '#6a7482';
    ctx.font = 'bold 17px sans-serif';
    ctx.fillText(`${String(m.number).padStart(2, '0')}  ${m.name}`, 62, y + 20);
    ctx.fillStyle = '#9fb0c8';
    ctx.font = '14px sans-serif';
    const typeLabel = { rings: 'Ring course', deliver: 'Delivery', rescue: 'Rescue', storm: 'Storm', night: 'Night', photo: 'Photo run', tow: 'Banner tow', tour: 'Grand tour' }[m.type] || m.type;
    ctx.fillText(`${typeLabel} · ${m.rings.length} rings · ${m.stops.map((s) => airfieldById(s).short).join(' → ')}`, 300, y + 20);
    ctx.textAlign = 'right';
    ctx.fillStyle = m.best ? '#35e05a' : '#ffd94c';
    ctx.fillText(m.best ? `BEST ${Math.floor(m.best.timeSeconds / 60)}:${String(m.best.timeSeconds % 60).padStart(2, '0')}` : `${m.reward} CR`, 796, y + 20);
    ctx.textAlign = 'left';
    if (click && hitButton(click, 48, y, 760, 40) && m.unlocked) G.selectedMission = i;
    if (click && hitButton(click, 48, y, 760, 40) && !m.unlocked) toast('Finish the previous mission to unlock this one.');
  });

  // Briefing panel for the selected mission.
  const m = list[G.selectedMission];
  drawPanel(840, 122, 392, 420);
  ctx.fillStyle = '#ffd94c';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText(m.name.toUpperCase(), 862, 152);
  ctx.fillStyle = '#c8d4e8';
  ctx.font = '15px sans-serif';
  wrapText(m.briefing, 862, 182, 348, 22);
  ctx.fillStyle = '#9fb0c8';
  ctx.font = '14px sans-serif';
  let by = 330;
  const rows = [
    `From: ${airfieldById(m.from).name}`,
    `Stops: ${m.stops.map((s) => airfieldById(s).name).join(' → ')}`,
    `Weather: ${m.weather}`,
    `Reward: ${m.reward} CR · ${m.xp} XP`,
    `Rings: ${m.rings.length} (total across the campaign: 40)`,
  ];
  for (const row of rows) { ctx.fillText(row, 862, by); by += 24; }

  if (drawButton(862, 470, 348, 48, m.unlocked ? 'FLY THIS MISSION  (Enter)' : 'LOCKED', false, !m.unlocked)) {
    if (click && hitButton(click, 862, 470, 348, 48) && m.unlocked) startMission(missionById(m.id), null);
  }
  if (drawButton(48, 668, 200, 40, '← BACK  (Esc)', false)) {
    if (click && hitButton(click, 48, 668, 200, 40)) G.screen = 'title';
  }
  if (input.wasPressed('escape')) G.screen = 'title';
  if (input.wasPressed('enter') && m.unlocked) startMission(missionById(m.id), null);
  if (input.wasPressed('arrowdown')) G.selectedMission = Math.min(list.length - 1, G.selectedMission + 1);
  if (input.wasPressed('arrowup')) G.selectedMission = Math.max(0, G.selectedMission - 1);
}

function wrapText(text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, yy);
      line = word;
      yy += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, yy);
  return yy;
}

function drawHangarScreen() {
  ctx.fillStyle = '#0e1622';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 34px sans-serif';
  ctx.fillText('HANGAR & SHOP', 48, 64);
  ctx.fillStyle = '#ffd94c';
  ctx.font = '16px sans-serif';
  ctx.fillText(`Credits: ${profile.credits} CR · ${profile.rankName} · ${profile.xp} XP`, 48, 92);

  const click = input.consumeClick();
  const tabY = 116;
  if (drawButton(48, tabY, 180, 40, 'AIRCRAFT (6)', G.hangarTab === 'aircraft')) {
    if (click && hitButton(click, 48, tabY, 180, 40)) G.hangarTab = 'aircraft';
  }
  if (drawButton(240, tabY, 180, 40, 'UPGRADES (12)', G.hangarTab === 'shop')) {
    if (click && hitButton(click, 240, tabY, 180, 40)) G.hangarTab = 'shop';
  }

  if (G.hangarTab === 'aircraft') {
    AIRCRAFT.forEach((a, i) => {
      const y = 176 + i * 82;
      const owned = profile.aircraftOwned.includes(a.id);
      const selected = profile.aircraftSelected === a.id;
      ctx.fillStyle = selected ? 'rgba(255,217,76,0.16)' : 'rgba(255,255,255,0.05)';
      ctx.fillRect(48, y, 760, 74);
      ctx.strokeStyle = selected ? '#ffd94c' : 'rgba(180,195,220,0.3)';
      ctx.strokeRect(48, y, 760, 74);
      ctx.fillStyle = a.color;
      ctx.beginPath(); ctx.arc(86, y + 37, 22, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#10141b';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(a.name.slice(0, 2).toUpperCase(), 86, y + 41);
      ctx.textAlign = 'left';
      ctx.fillStyle = '#e8eefc';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText(`${a.name} — ${a.maker}`, 122, y + 26);
      ctx.fillStyle = '#9fb0c8';
      ctx.font = '14px sans-serif';
      ctx.fillText(a.blurb, 122, y + 50);
      ctx.fillStyle = '#c8d4e8';
      ctx.font = '13px sans-serif';
      ctx.fillText(`Top ${Math.round(a.maxSpeed * 3.6)} km/h · Climb ${a.climb} m/s · Fuel ${a.fuel} · Stall ${Math.round(a.stall * 3.6)} km/h`, 122, y + 66 - 2);
      const label = selected ? 'SELECTED' : owned ? 'SELECT' : `${a.price} CR — BUY`;
      if (drawButton(640, y + 16, 150, 42, label, selected, false)) {
        if (click && hitButton(click, 640, y + 16, 150, 42)) {
          if (owned) {
            profile.aircraftSelected = a.id;
            saveProfile(profile);
            toast(`${a.name} selected.`);
          } else {
            const res = buyItem(profile, a.id);
            toast(res.text);
          }
        }
      }
    });
  } else {
    SHOP.forEach((item, i) => {
      const y = 176 + i * 42;
      const owned = profile.upgradesOwned.includes(item.id);
      ctx.fillStyle = owned ? 'rgba(53,224,90,0.10)' : 'rgba(255,255,255,0.05)';
      ctx.fillRect(48, y, 760, 36);
      ctx.strokeStyle = 'rgba(180,195,220,0.3)';
      ctx.strokeRect(48, y, 760, 36);
      ctx.fillStyle = '#e8eefc';
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText(item.name, 62, y + 18);
      ctx.fillStyle = '#9fb0c8';
      ctx.font = '13px sans-serif';
      ctx.fillText(item.desc, 250, y + 18);
      const label = owned ? 'INSTALLED' : `${item.price} CR — BUY`;
      if (drawButton(640, y + 4, 150, 28, label, owned, false)) {
        if (click && hitButton(click, 640, y + 4, 150, 28) && !owned) {
          const res = buyItem(profile, item.id);
          toast(res.text);
        }
      }
    });
  }

  // Side panel: the pilot's logbook.
  drawPanel(840, 176, 392, 420);
  ctx.fillStyle = '#ffd94c';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText('LOGBOOK', 862, 204);
  ctx.fillStyle = '#c8d4e8';
  ctx.font = '14px sans-serif';
  let ly = 232;
  if (!profile.logbook.length) {
    ctx.fillText('No flights yet. The sky is waiting.', 862, ly);
  }
  for (const entry of profile.logbook.slice(0, 12)) {
    ctx.fillStyle = entry.success ? '#35e05a' : '#ff5a3c';
    ctx.fillText(entry.success ? '✓' : '✗', 862, ly);
    ctx.fillStyle = '#e8eefc';
    ctx.fillText(`${entry.mission} — +${entry.credits} CR, +${entry.xp} XP`, 882, ly);
    ly += 24;
  }
  ctx.fillStyle = '#9fb0c8';
  ctx.fillText(`Flights: ${profile.flights} · Rings: ${profile.ringsFlown} · Landings: ${profile.landings}`, 862, 580);

  if (drawButton(48, 668, 200, 40, '← BACK  (Esc)', false)) {
    if (click && hitButton(click, 48, 668, 200, 40)) G.screen = 'title';
  }
  if (input.wasPressed('escape')) G.screen = 'title';
  if (input.wasPressed('h')) G.screen = 'title';
}

function drawContractsScreen() {
  ctx.fillStyle = '#0e1622';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 34px sans-serif';
  ctx.fillText('DAILY CONTRACTS', 48, 64);
  const dateString = new Date().toISOString().slice(0, 10);
  ctx.fillStyle = '#ffd94c';
  ctx.font = '16px sans-serif';
  ctx.fillText(`Three jobs a day, seeded by the date (${dateString}). Fly one, get paid — the radio upgrade adds 25%.`, 48, 92);
  const contracts = dailyContracts(dateString);
  const click = input.consumeClick();
  contracts.forEach((c, i) => {
    const y = 130 + i * 130;
    const done = contractDoneToday(profile, dateString, c.id);
    drawPanel(48, y, 1184, 110);
    ctx.fillStyle = done ? '#35e05a' : '#ffd94c';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText(c.name, 72, y + 34);
    ctx.fillStyle = '#c8d4e8';
    ctx.font = '15px sans-serif';
    ctx.fillText(`${c.desc} Destination: ${airfieldById(c.destination).name}.`, 72, y + 62);
    ctx.fillStyle = '#9fb0c8';
    ctx.font = '14px sans-serif';
    ctx.fillText(`Pay: ${c.pay} CR${profile.upgradesOwned.includes('radio') ? ' (+25% radio)' : ''} · 3 rings · 1 landing`, 72, y + 88);
    if (drawButton(1020, y + 30, 190, 50, done ? 'FLOWN ✓' : 'FLY IT', false, done)) {
      if (click && hitButton(click, 1020, y + 30, 190, 50) && !done) startContractFlight(c, dateString);
    }
  });
  ctx.fillStyle = '#9fb0c8';
  ctx.font = '14px sans-serif';
  ctx.fillText('Contracts are the retention loop: come back tomorrow and three fresh jobs are waiting.', 48, 560);
  if (drawButton(48, 668, 200, 40, '← BACK  (Esc)', false)) {
    if (click && hitButton(click, 48, 668, 200, 40)) G.screen = 'title';
  }
  if (input.wasPressed('escape')) G.screen = 'title';
  if (input.wasPressed('c')) G.screen = 'title';
}

function drawHelpScreen() {
  ctx.fillStyle = '#0e1622';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 34px sans-serif';
  ctx.fillText('HOW TO FLY', 48, 64);
  const lines = [
    ['TAKE OFF', 'Throttle up with Shift (or +), hold the runway, pull back gently with ↑ / W once past 90 km/h.'],
    ['FLY', '← → / A D bank and turn. ↑ / W climbs, ↓ / S descends. Watch the stall light below 90 km/h.'],
    ['THROTTLE', 'Shift / + more power, Ctrl / − less. Smooth throttle earns the smoothness bonus; jerking it does not.'],
    ['RINGS', 'Fly through the gold rings in order — the next one glows. The arrow points at it when it is off-screen.'],
    ['LAND', 'Slow below 200 km/h, line up with the runway, descend gently. A perfect landing pays 120; a hard one hurts.'],
    ['FUEL', 'The gauge is real. Empty tanks mean a glider: find a runway, any runway, and put her down.'],
    ['MOUSE', 'Menus, hangar and shop are all clickable. In flight the mouse is free — the keyboard flies the plane.'],
    ['KEYS', 'Esc menu · M mute · Enter start · 1–4 preview the four screenshot scenes from the title screen.'],
  ];
  ctx.font = '15px sans-serif';
  let y = 120;
  for (const [head, body] of lines) {
    ctx.fillStyle = '#ffd94c';
    ctx.font = 'bold 17px sans-serif';
    ctx.fillText(head, 48, y);
    ctx.fillStyle = '#c8d4e8';
    ctx.font = '15px sans-serif';
    ctx.fillText(body, 220, y);
    y += 44;
  }
  ctx.fillStyle = '#9fb0c8';
  ctx.font = '14px sans-serif';
  ctx.fillText('The Reach rewards discipline: throttle, turn and landing quality are all scored. Fly smooth, fly far.', 48, 560);
  const click = input.consumeClick();
  if (drawButton(48, 668, 200, 40, '← BACK  (Esc)', false)) {
    if (click && hitButton(click, 48, 668, 200, 40)) G.screen = 'title';
  }
  if (input.wasPressed('escape')) G.screen = 'title';
}

function drawDebriefScreen() {
  const d = G.debrief;
  const run = G.run;
  ctx.fillStyle = '#0e1622';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = d.success ? '#35e05a' : '#ff5a3c';
  ctx.font = 'bold 44px sans-serif';
  ctx.fillText(d.success ? 'MISSION COMPLETE' : 'MISSION FAILED', W / 2, 120);
  ctx.fillStyle = '#e8eefc';
  ctx.font = '20px sans-serif';
  ctx.fillText(run.mission.name, W / 2, 156);
  if (!d.success) {
    ctx.fillStyle = '#ff9a8a';
    ctx.font = '16px sans-serif';
    ctx.fillText(d.reason, W / 2, 184);
  }
  drawPanel(W / 2 - 260, 220, 520, 240);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#c8d4e8';
  ctx.font = '17px sans-serif';
  const rows = [
    `Rings flown: ${d.rings}`,
    `Landings: ${d.landings.join(', ') || '—'}`,
    `Time: ${Math.floor(d.timeSeconds / 60)}:${String(d.timeSeconds % 60).padStart(2, '0')}`,
    `Throttle smoothness: ${d.smooth}% (+${d.smoothBonus})`,
    `Time bonus: +${d.timeBonus}`,
    `Credits earned: +${d.credits} CR`,
    `Experience: +${d.xp} XP`,
  ];
  rows.forEach((row, i) => ctx.fillText(row, W / 2 - 230, 258 + i * 30));
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd94c';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText(`Balance: ${profile.credits} CR · Rank: ${profile.rankName}`, W / 2, 496);

  const click = input.consumeClick();
  const by = 540;
  if (drawButton(W / 2 - 320, by, 200, 50, 'RETRY  (R)', false)) {
    if (click && hitButton(click, W / 2 - 320, by, 200, 50)) startMission(run.mission, G.contract);
  }
  if (drawButton(W / 2 - 100, by, 200, 50, 'MISSIONS  (Enter)', false)) {
    if (click && hitButton(click, W / 2 - 100, by, 200, 50)) G.screen = 'missions';
  }
  if (drawButton(W / 2 + 120, by, 200, 50, 'HANGAR  (H)', false)) {
    if (click && hitButton(click, W / 2 + 120, by, 200, 50)) G.screen = 'hangar';
  }
  if (input.wasPressed('r')) startMission(run.mission, G.contract);
  if (input.wasPressed('enter')) G.screen = 'missions';
  if (input.wasPressed('h')) G.screen = 'hangar';
  if (input.wasPressed('escape')) G.screen = 'title';
}

// ---- flight update and draw ----------------------------------------------

function updateFlight(dt) {
  const flight = G.flight;
  const run = G.run;
  const prev = { x: flight.x, y: flight.y, z: flight.z };
  const intents = input.pollFlight();
  const wind = windAt(G.time, G.weather, flight);
  const events = stepFlight(flight, selectedAircraft(profile), ownedUpgrades(profile), G.world, wind, intents, dt);
  const missionEvents = stepMission(run, flight, prev, events, dt);
  audio.update(flight.throttle, flight.speed, flight.onGround);

  for (const ev of missionEvents) {
    if (ev.type === 'ring') {
      audio.ringChime();
      toast(`Ring ${ev.index}/${ev.total} — clean!`);
    } else if (ev.type === 'pickup') {
      audio.ringChime();
      toast('Passengers aboard — fly them home!');
    } else if (ev.type === 'landed-stop') {
      audio.landThud(ev.quality === 'hard');
      toast(ev.quality === 'perfect' ? 'Perfect landing!' : ev.quality === 'good' ? 'Good landing.' : 'Hard landing — the gear felt that.');
    } else if (ev.type === 'wrong-field') {
      toast(`Wrong airfield — the mission needs ${airfieldById(ev.expected).name}.`);
    } else if (ev.type === 'fuel-empty') {
      toast('Fuel empty — you are a glider now. Find a runway.');
    } else if (ev.type === 'complete') {
      applyRunDebrief();
      return;
    } else if (ev.type === 'failed') {
      applyRunDebrief();
      return;
    }
  }
  for (const ev of events) {
    if (ev.type === 'rough-landing') toast(`Rough landing — damage ${ev.damage}%.`);
    if (ev.type === 'off-field') toast(`Off-field landing — damage ${ev.damage}%. Get to a runway.`);
    if (ev.type === 'stopped' && flight.onGround && flight.speed < 1) {
      // Parked somewhere that is not a mission stop: offer nothing, just note it.
    }
  }
  if (input.wasPressed('escape')) {
    G.screen = 'missions';
    toast('Mission abandoned.');
  }
  if (input.wasPressed('m')) {
    const muted = audio.toggleMute();
    toast(muted ? 'Sound off.' : 'Sound on.');
  }
}

function drawFlight() {
  const flight = G.flight;
  const run = G.run;
  const view = { w: W, h: H, cx: W / 2, cy: H * 0.46 };
  drawWorld(ctx, view, G.world, flight, G.weather, run.mission.rings, run.ringIndex, G.time);
  drawAircraft(ctx, view, flight, selectedAircraft(profile), G.time);
  drawCockpit(ctx, view, flight, selectedAircraft(profile), ownedUpgrades(profile), run, profile, G.time);
  drawHUD(ctx, view, flight, selectedAircraft(profile), run, profile, G.message, G.messageAge);
  const ring = nextRing(run);
  if (ring) drawRingPointer(ctx, view, flight, ring);
}

// ---- screenshot mode and the main loop ------------------------------------

function drawShotMode() {
  const shot = G.shotMode;
  const state = buildShotState(shot.name, shot.seed);
  const view = { w: W, h: H, cx: W / 2, cy: H * 0.46 };
  drawWorld(ctx, view, state.world, state.flight, state.weather,
    state.mission.rings, state.run.ringIndex, state.time);
  drawAircraft(ctx, view, state.flight, state.aircraft, state.time);
  const fakeProfile = { credits: 1240, xp: 860, rankName: 'Island Pilot' };
  drawCockpit(ctx, view, state.flight, state.aircraft, new Set(), state.run, fakeProfile, state.time);
  drawHUD(ctx, view, state.flight, state.aircraft, state.run, fakeProfile, '', 99);
  window.__shotReady = true;
}

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  G.time += dt;
  G.messageAge += dt;

  if (G.shotMode) {
    drawShotMode();
    input.endFrame();
    requestAnimationFrame(loop);
    return;
  }

  if (G.screen === 'flying') updateFlight(dt);

  if (G.screen === 'title') drawTitleScreen(dt);
  else if (G.screen === 'missions') drawMissionsScreen();
  else if (G.screen === 'hangar') drawHangarScreen();
  else if (G.screen === 'contracts') drawContractsScreen();
  else if (G.screen === 'help') drawHelpScreen();
  else if (G.screen === 'debrief') drawDebriefScreen();
  else if (G.screen === 'flying') drawFlight();

  input.endFrame();
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
