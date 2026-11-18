// Solmar City — shared constants: world size, colours, tuning.
// Every number that more than one system needs lives here so the rest of the
// game can stay small and consistent.
export const WORLD = { w: 3600, h: 3600 };
export const ROAD_W = 110;
export const BLOCK = 450; // distance between road centrelines
export const ROAD0 = 225; // first road centreline (x and y)
export const ROADS = 8; // roads each way

export const PALETTE = {
  grass: '#7fae5a',
  sand: '#e8d29a',
  water: '#2e7fa8',
  waterDeep: '#1f5f84',
  road: '#3a3a40',
  roadLine: '#d8c95a',
  sidewalk: '#b9b3a4',
  buildingRoof: ['#c96f4a', '#d9a441', '#7fa3b8', '#b8576a', '#8a7fb8', '#5f9e7a', '#c9b18a', '#4a6f8e'],
  buildingSide: '#00000033',
  park: '#5d9b4a',
  plaza: '#cbbfa5',
};

export const PLAYER = {
  walkSpeed: 230,
  runSpeed: 350,
  radius: 14,
  maxHealth: 100,
};

export const CAR_MODELS = [
  { name: 'Pinto', color: '#b8b0a0', top: 300, accel: 420, grip: 3.2, seats: 1 },
  { name: 'Comet', color: '#c0392b', top: 430, accel: 560, grip: 3.8, seats: 1 },
  { name: 'Sunrunner', color: '#f1c40f', top: 360, accel: 480, grip: 3.5, seats: 1 },
  { name: 'Vagabond', color: '#2e86c1', top: 330, accel: 440, grip: 3.4, seats: 1 },
  { name: 'Interceptor', color: '#1a1a22', top: 520, accel: 700, grip: 4.4, seats: 1 }, // police-style, rare in traffic
  { name: 'Hauler', color: '#7d8a99', top: 260, accel: 330, grip: 2.8, seats: 1 },
];

export const WANTED_DECAY_SECONDS = 26;
export const COP_BUST_SECONDS = 1.6;

export const SHOPS = {
  gun: { x: 675, y: 675, label: 'Gun Shop', icon: 'G' },
  spray: { x: 2925, y: 1125, label: 'Pay & Spray', icon: 'S' },
  hospital: { x: 1125, y: 2925, label: 'Hospital', icon: 'H' },
  safehouse: { x: 2475, y: 2475, label: 'Safehouse', icon: '$' },
};

export const STORY = {
  city: 'Solmar City',
  title: 'SOLMAR',
  subtitle: 'Streets of Gold',
  hero: 'Jax Marlow',
  fixer: 'Lena Cross',
  boss: 'Viktor Hale',
};
