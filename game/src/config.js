// AZURE REACH — game data: the Meridian Isles, its airfields, aircraft,
// missions, shop and pilot ranks. Every number here is real game content:
// 5 airfields, 6 aircraft, 12 missions, 40 rings, 3 storm fronts,
// 12 shop items, 8 pilot ranks, 3 daily contracts.

export const WORLD = {
  name: 'Meridian Isles',
  // Flyable corridor: x runs 0..12000 m east, y runs -1600..1600 m.
  length: 12000,
  halfWidth: 1600,
  seaLevel: 0,
  // Ring counts per mission sum to exactly 40 (see MISSIONS).
  totalRings: 40,
};

// Five airfields, each a named island with its own runway, character and
// weather. The runway heading is the direction a pilot lands on.
export const AIRFIELDS = [
  {
    id: 'meridian',
    name: 'Port Meridian',
    short: 'MERIDIAN',
    x: 0, y: 0,
    runwayHeading: 90, // degrees, east
    runwayLength: 700,
    runwayWidth: 46,
    elevation: 0,
    kind: 'home',
    blurb: 'Home base. Long tarmac, tower, fuel farm and the whole Reach watching.',
    lights: true,
  },
  {
    id: 'coral',
    name: 'Coral Cay',
    short: 'CORAL CAY',
    x: 2500, y: -620,
    runwayHeading: 70,
    runwayLength: 520,
    runwayWidth: 34,
    elevation: 0,
    kind: 'beach',
    blurb: 'A sand-and-coral strip ringed by turquoise shallows. Short: land long and you swim.',
    lights: false,
  },
  {
    id: 'gull',
    name: 'Gull Rock',
    short: 'GULL ROCK',
    x: 5000, y: 540,
    runwayHeading: 110,
    runwayLength: 460,
    runwayWidth: 30,
    elevation: 0,
    kind: 'cliff',
    blurb: 'A cliff-top strip on a guano-white rock. Crosswinds shove you sideways on final.',
    lights: false,
  },
  {
    id: 'turtle',
    name: 'Turtle Bay',
    short: 'TURTLE BAY',
    x: 7500, y: -480,
    runwayHeading: 90,
    runwayLength: 560,
    runwayWidth: 36,
    elevation: 0,
    kind: 'beach',
    blurb: 'Palm-fringed bay strip. Turtles nest beside the threshold; the locals keep count.',
    lights: true,
  },
  {
    id: 'beacon',
    name: 'North Beacon',
    short: 'N. BEACON',
    x: 10000, y: 300,
    runwayHeading: 60,
    runwayLength: 640,
    runwayWidth: 40,
    elevation: 0,
    kind: 'mountain',
    blurb: 'The far light. Mountain air, a lit runway, and the storm fronts rolling in from the north.',
    lights: true,
  },
];

// Six flyable aircraft. Each one is a different machine in the hangar:
// speed, climb, turn and fuel change how every mission feels.
export const AIRCRAFT = [
  {
    id: 'kite', name: 'Kite', maker: 'Reach Aviation',
    kind: 'prop', price: 0,
    maxSpeed: 62, climb: 9, turn: 1.15, fuel: 100, stall: 24,
    color: '#e8b64c', accent: '#7a4a21',
    blurb: 'The trainer. Forgiving, slow, sips fuel. Every Reach pilot starts here.',
  },
  {
    id: 'albatross', name: 'Albatross', maker: 'Coral Works',
    kind: 'prop', price: 800,
    maxSpeed: 74, climb: 11, turn: 1.0, fuel: 130, stall: 26,
    color: '#4c8fd6', accent: '#e8e8e8',
    blurb: 'Bush plane on tundra tyres. Lands short, carries mail, shrugs at crosswinds.',
  },
  {
    id: 'courier', name: 'Meridian Courier', maker: 'Port Meridian Aero',
    kind: 'twin', price: 2000,
    maxSpeed: 88, climb: 13, turn: 0.92, fuel: 160, stall: 30,
    color: '#c94c4c', accent: '#f2e6c9',
    blurb: 'Twin-engine workhorse. Fast on the straight, thirsty in the climb.',
  },
  {
    id: 'stormpetrel', name: 'Stormpetrel', maker: 'Gull Rock Racing',
    kind: 'prop', price: 3500,
    maxSpeed: 96, climb: 16, turn: 1.45, fuel: 110, stall: 32,
    color: '#8a4cd6', accent: '#ffd94c',
    blurb: 'Aerobatic rocket. Turns on a coin, climbs like it is angry, drinks fuel doing it.',
  },
  {
    id: 'gullwing', name: 'Gullwing Jet', maker: 'Beacon Dynamics',
    kind: 'jet', price: 6000,
    maxSpeed: 132, climb: 22, turn: 0.8, fuel: 150, stall: 42,
    color: '#3a3f4a', accent: '#ff5a3c',
    blurb: 'The Reach\'s first jet. Outruns weather, outruns its own fuel gauge.',
  },
  {
    id: 'aurora', name: 'Aurora X', maker: 'Meridian Skunkworks',
    kind: 'jet', price: 10000,
    maxSpeed: 148, climb: 26, turn: 1.05, fuel: 180, stall: 44,
    color: '#e8e8e8', accent: '#2ec4b6',
    blurb: 'Prototype. Everything the Reach knows about flying, in one silver dart.',
  },
];

// Weather presets. Three named storm fronts roll across the Reach.
export const WEATHER = {
  clear:  { sky: ['#7ec8f2', '#cfeefb', '#fdf3d8'], sun: 0.9,  fog: 0,    wind: 2,  gust: 1,  rain: 0,  light: 1.0 },
  golden: { sky: ['#f2a65a', '#f7c98b', '#ffe9c4'], sun: 0.55, fog: 0.06, wind: 4,  gust: 2,  rain: 0,  light: 0.95 },
  dusk:   { sky: ['#5a5a9e', '#c97a5a', '#ffd9a0'], sun: 0.25, fog: 0.12, wind: 5,  gust: 3,  rain: 0,  light: 0.8 },
  night:  { sky: ['#0b1030', '#1c2a55', '#3a4a7a'], sun: 0.0,  fog: 0.15, wind: 3,  gust: 2,  rain: 0,  light: 0.55 },
  storm:  { sky: ['#3a4552', '#5a6a7a', '#8a9aaa'], sun: 0.15, fog: 0.35, wind: 14, gust: 9,  rain: 1,  light: 0.6 },
};

export const STORM_FRONTS = [
  { id: 'front-1', name: 'Front Halcyon', x: 4200, strength: 0.7 },
  { id: 'front-2', name: 'Front Tempest', x: 7800, strength: 1.0 },
  { id: 'front-3', name: 'Front Widowmaker', x: 10400, strength: 0.85 },
];

// Twelve missions. `rings` lists [x, y, z, radius] target rings in order;
// the ring counts sum to 40. `stops` are airfield ids to land at, in order.
export const MISSIONS = [
  {
    id: 'm01', name: 'First Solo', type: 'rings', weather: 'golden',
    from: 'meridian', reward: 120, xp: 100,
    briefing: 'Tower clears you for your first solo. Thread the four practice rings over the harbour, then bring her home to Meridian.',
    rings: [[900, -120, 120, 26], [1500, 180, 150, 26], [2000, -60, 130, 24], [2300, 120, 110, 24]],
    stops: ['meridian'],
  },
  {
    id: 'm02', name: 'Coral Cay Hop', type: 'rings', weather: 'clear',
    from: 'meridian', reward: 180, xp: 140,
    briefing: 'Mail for Coral Cay. Five rings mark the reef route — fly them clean, then put down on the sand strip.',
    rings: [[800, 200, 140, 24], [1300, -200, 160, 24], [1800, 100, 130, 24], [2200, -350, 120, 22], [2450, -580, 90, 22]],
    stops: ['coral'],
  },
  {
    id: 'm03', name: 'Gull Rock Mail', type: 'deliver', weather: 'clear',
    from: 'coral', reward: 220, xp: 170,
    briefing: 'Three stops, one bag of mail. Coral Cay to Gull Rock to Turtle Bay — rings mark the way, the clock marks you.',
    rings: [[3300, -300, 150, 24], [4200, 300, 170, 24], [5900, 100, 140, 24]],
    stops: ['gull', 'turtle'],
  },
  {
    id: 'm04', name: 'Turtle Bay Rescue', type: 'rescue', weather: 'dusk',
    from: 'turtle', reward: 300, xp: 220,
    briefing: 'A sailor is stranded on the reef off Turtle Bay. Fly the rings to the pickup beach, land, wait for him aboard, then fly him home.',
    rings: [[7700, -100, 120, 24], [8000, 300, 140, 24], [8300, -200, 110, 22], [8600, 150, 100, 22]],
    stops: ['turtle'],
    pickup: { x: 8800, y: 0, z: 0, holdSeconds: 4 },
  },
  {
    id: 'm05', name: 'Front Halcyon', type: 'storm', weather: 'storm',
    from: 'gull', reward: 380, xp: 280,
    briefing: 'Front Halcyon is sitting on the route to North Beacon. Punch through the wall, hold her steady in the gusts, land in the rain.',
    rings: [[6200, 400, 180, 26], [7400, -100, 200, 26], [9000, 200, 170, 24]],
    stops: ['beacon'],
    front: 'front-1',
  },
  {
    id: 'm06', name: 'Night Beacon', type: 'night', weather: 'night',
    from: 'meridian', reward: 420, xp: 300,
    briefing: 'The Beacon light is the only thing out there. Fly the lit rings by instruments, then a black runway with only its edge lights.',
    rings: [[3000, 0, 160, 26], [5500, 200, 180, 26], [7800, -150, 160, 24], [9500, 100, 140, 24]],
    stops: ['beacon'],
  },
  {
    id: 'm07', name: 'Canyon Pass', type: 'rings', weather: 'golden',
    from: 'coral', reward: 360, xp: 260,
    briefing: 'Low and fast through the rock pass between the isles. Three rings, no room to climb out — throttle discipline or a swim.',
    rings: [[3600, -500, 70, 22], [4300, 100, 60, 20], [4900, 500, 80, 22]],
    stops: ['gull'],
  },
  {
    id: 'm08', name: 'Photo Run', type: 'photo', weather: 'clear',
    from: 'turtle', reward: 340, xp: 250,
    briefing: 'The Reach tourism board wants postcards. Fly each photo gate low and level — a steady wing makes a sharp picture.',
    rings: [[5600, -600, 90, 24], [6800, 400, 110, 24], [8200, -300, 100, 24]],
    stops: ['beacon'],
  },
  {
    id: 'm09', name: 'Banner Tow', type: 'tow', weather: 'clear',
    from: 'meridian', reward: 300, xp: 230,
    briefing: 'Tow the Meridian Regatta banner over the harbour. Slow, heavy, and the crowd is watching — keep it level through the gates.',
    rings: [[1200, 0, 100, 26], [1900, -200, 110, 26], [2600, 150, 100, 24]],
    stops: ['coral'],
  },
  {
    id: 'm10', name: 'Island Hopper', type: 'deliver', weather: 'dusk',
    from: 'meridian', reward: 480, xp: 340,
    briefing: 'Four airfields before dark. Meridian, Coral, Gull, Turtle — one landing each, fuel is the question and the answer.',
    rings: [[1800, 300, 150, 24], [4200, -200, 160, 24], [6800, 200, 140, 24]],
    stops: ['coral', 'gull', 'turtle'],
  },
  {
    id: 'm11', name: 'Storm Rescue', type: 'rescue', weather: 'storm',
    from: 'beacon', reward: 560, xp: 400,
    briefing: 'Front Tempest has a fishing boat aground near Gull Rock. Fly out in the storm, land on the rock, take the crew aboard, bring them home.',
    rings: [[9000, 0, 170, 26], [7400, 300, 150, 24], [5800, 400, 120, 24]],
    stops: ['gull'],
    pickup: { x: 5400, y: 540, z: 0, holdSeconds: 5 },
    front: 'front-2',
  },
  {
    id: 'm12', name: 'Meridian Grand Tour', type: 'tour', weather: 'golden',
    from: 'meridian', reward: 900, xp: 600,
    briefing: 'The whole Reach in one sortie: every airfield, every ring, one tank of fuel if you fly it right. The Grand Tour is the pilot\'s exam.',
    rings: [[2000, -300, 150, 24], [9000, 300, 170, 24]],
    stops: ['coral', 'gull', 'turtle', 'beacon', 'meridian'],
  },
];

// The hangar shop: 12 items. Credits earned flying are spent here —
// the economy closes: earn in the air, spend in the hangar.
export const SHOP = [
  { id: 'tank',   name: 'Aux Fuel Tank',      price: 400,  desc: '+40 fuel capacity. Fly farther between pumps.' },
  { id: 'engine', name: 'Tuned Engine',       price: 900,  desc: '+12% top speed and climb on every aircraft.' },
  { id: 'gear',   name: 'Reinforced Gear',    price: 500,  desc: 'Hard landings forgive you: +40% damage tolerance.' },
  { id: 'instr',  name: 'Glass Cockpit',      price: 700,  desc: 'Brighter instruments, clearer horizon ball, night landing aid.' },
  { id: 'lights', name: 'Landing Lights',     price: 350,  desc: 'Your own beam on night runways. The dark stops being dark.' },
  { id: 'winglets', name: 'Winglets',         price: 650,  desc: '+10% turn rate. Rings feel wider.' },
  { id: 'radio',  name: 'Long-Range Radio',   price: 450,  desc: 'Daily contracts pay +25%. Tower hears you everywhere.' },
  { id: 'prop',   name: 'Constant-Speed Prop', price: 800,  desc: 'Smoother throttle, -15% fuel burn at cruise.' },
  { id: 'seats',  name: 'Rescue Winch',       price: 600,  desc: 'Rescue pickups take half the time on the ground.' },
  { id: 'paint-gold', name: 'Gold Livery',    price: 1000, desc: 'Gold-and-cream paint. The crowd knows it is you.' },
  { id: 'paint-sea',  name: 'Sea Livery',     price: 1000, desc: 'Deep-sea blue with a white gull. Flies like it looks.' },
  { id: 'paint-ember', name: 'Ember Livery',  price: 1000, desc: 'Ember red over charcoal. The storm fronts notice.' },
];

// Eight pilot ranks, by lifetime XP.
export const RANKS = [
  { xp: 0,    name: 'Cadet' },
  { xp: 300,  name: 'Apprentice' },
  { xp: 800,  name: 'Island Pilot' },
  { xp: 1500, name: 'Mail Runner' },
  { xp: 2500, name: 'Storm Rider' },
  { xp: 4000, name: 'Reach Ace' },
  { xp: 6000, name: 'Beacon Keeper' },
  { xp: 9000, name: 'Sky Legend' },
];

// Three daily contracts, seeded by the calendar day: the retention loop.
export const CONTRACT_KINDS = [
  { kind: 'mail',    name: 'Airmail Run',    pay: 90,  desc: 'Carry the morning mail to a neighbouring isle.' },
  { kind: 'photo',   name: 'Postcard Run',   pay: 110, desc: 'One low photo pass over a named beach.' },
  { kind: 'banner',  name: 'Banner Tow',     pay: 100, desc: 'Tow the harbour banner for the afternoon crowd.' },
  { kind: 'rings',   name: 'Ring Practice',  pay: 80,  desc: 'Five practice rings, timed.' },
  { kind: 'rescue',  name: 'Standby Rescue', pay: 140, desc: 'Stand by for a callout; fly it if it comes.' },
];

export const GAME_TITLE = 'AZURE REACH';
export const GAME_SUBTITLE = '12 missions · 6 aircraft · 5 airfields · 40 rings · 3 storm fronts';
export const GAME_TAGLINE = 'Island-hopper flight campaign across the Meridian Isles';
