// Pilot economy for AZURE REACH: the profile, the hangar shop, daily
// contracts and ranks. Credits earned in the air are spent in the hangar —
// the loop closes, and nothing is earned that cannot be spent.

import { AIRCRAFT, SHOP, RANKS, CONTRACT_KINDS, MISSIONS } from './config.js';
import { hashSeed, mulberry32 } from './random.js';

const SAVE_KEY = 'azure-reach-save-v1';

export function newProfile() {
  return {
    credits: 150,
    xp: 0,
    rankName: 'Cadet',
    aircraftOwned: ['kite'],
    aircraftSelected: 'kite',
    upgradesOwned: [],
    completed: [],
    best: {},
    contractsDone: {},
    logbook: [],
    flights: 0,
    ringsFlown: 0,
    landings: 0,
    createdAt: new Date().toISOString().slice(0, 10),
  };
}

export function loadProfile() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return newProfile();
    const saved = JSON.parse(raw);
    const fresh = newProfile();
    return { ...fresh, ...saved, best: saved.best || {}, logbook: saved.logbook || [] };
  } catch (err) {
    return newProfile();
  }
}

export function saveProfile(profile) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(profile));
  } catch (err) {
    // The game plays fine without a save; the logbook just stays in memory.
  }
}

export function rankForXp(xp) {
  let rank = RANKS[0];
  for (const r of RANKS) if (xp >= r.xp) rank = r;
  return rank;
}

export function refreshRank(profile) {
  profile.rankName = rankForXp(profile.xp).name;
}

export function selectedAircraft(profile) {
  return AIRCRAFT.find((a) => a.id === profile.aircraftSelected) || AIRCRAFT[0];
}

export function ownedUpgrades(profile) {
  return new Set(profile.upgradesOwned);
}

export function applyDebrief(profile, mission, debrief) {
  profile.flights += 1;
  profile.ringsFlown += Number(String(debrief.rings).split('/')[0]);
  profile.landings += debrief.landings.length;
  profile.credits += debrief.credits;
  profile.xp += debrief.xp;
  if (debrief.success && !profile.completed.includes(mission.id)) {
    profile.completed.push(mission.id);
  }
  const prevBest = profile.best[mission.id];
  if (debrief.success && (!prevBest || debrief.timeSeconds < prevBest.timeSeconds)) {
    profile.best[mission.id] = { timeSeconds: debrief.timeSeconds, score: debrief.score || 0 };
  }
  profile.logbook.unshift({
    mission: mission.name,
    success: debrief.success,
    credits: debrief.credits,
    xp: debrief.xp,
    timeSeconds: debrief.timeSeconds,
    when: new Date().toISOString().slice(0, 10),
  });
  profile.logbook = profile.logbook.slice(0, 24);
  refreshRank(profile);
  saveProfile(profile);
}

// Shop: buy an aircraft or an upgrade. Returns a result string.
export function buyItem(profile, itemId) {
  const aircraft = AIRCRAFT.find((a) => a.id === itemId);
  if (aircraft) {
    if (profile.aircraftOwned.includes(aircraft.id)) return { ok: false, text: 'Already in your hangar.' };
    if (profile.credits < aircraft.price) return { ok: false, text: 'Not enough credits — fly more missions.' };
    profile.credits -= aircraft.price;
    profile.aircraftOwned.push(aircraft.id);
    profile.aircraftSelected = aircraft.id;
    saveProfile(profile);
    return { ok: true, text: `${aircraft.name} is yours. Selected in the hangar.` };
  }
  const item = SHOP.find((s) => s.id === itemId);
  if (!item) return { ok: false, text: 'No such item.' };
  if (profile.upgradesOwned.includes(item.id)) return { ok: false, text: 'Already installed.' };
  if (profile.credits < item.price) return { ok: false, text: 'Not enough credits — fly more missions.' };
  profile.credits -= item.price;
  profile.upgradesOwned.push(item.id);
  saveProfile(profile);
  return { ok: true, text: `${item.name} installed.` };
}

// Daily contracts: three per calendar day, seeded by the date, so the
// same day always offers the same three jobs. Completing one pays credits.
export function dailyContracts(dateString) {
  const rng = mulberry32(hashSeed(`azure-reach-contracts-${dateString}`));
  const kinds = [...CONTRACT_KINDS];
  const picked = [];
  for (let i = 0; i < 3; i++) {
    const index = Math.floor(rng() * kinds.length);
    picked.push(kinds.splice(index, 1)[0]);
  }
  const fields = ['coral', 'gull', 'turtle', 'beacon'];
  return picked.map((kind, i) => ({
    id: `${dateString}-${i}`,
    kind: kind.kind,
    name: kind.name,
    pay: kind.pay,
    desc: kind.desc,
    destination: fields[Math.floor(rng() * fields.length)],
  }));
}

export function contractDoneToday(profile, dateString, contractId) {
  return Boolean(profile.contractsDone[`${dateString}:${contractId}`]);
}

export function completeContract(profile, dateString, contract) {
  const key = `${dateString}:${contract.id}`;
  if (profile.contractsDone[key]) return { ok: false, text: 'Already flown today.' };
  profile.contractsDone[key] = true;
  const radio = profile.upgradesOwned.includes('radio');
  const pay = radio ? Math.round(contract.pay * 1.25) : contract.pay;
  profile.credits += pay;
  profile.xp += 40;
  refreshRank(profile);
  saveProfile(profile);
  return { ok: true, text: `Contract complete: +${pay} CR.`, pay };
}

export function progressSummary(profile) {
  return {
    missionsDone: profile.completed.length,
    missionsTotal: MISSIONS.length,
    aircraftOwned: profile.aircraftOwned.length,
    aircraftTotal: AIRCRAFT.length,
    upgradesOwned: profile.upgradesOwned.length,
    upgradesTotal: SHOP.length,
    ringsFlown: profile.ringsFlown,
    landings: profile.landings,
    flights: profile.flights,
  };
}
