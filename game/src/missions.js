// Missions and story: six jobs for Lena Cross against Viktor Hale's crew,
// each a list of stages (go somewhere, take out a gang, deliver a car,
// escape the police, collect crates). The engine is generic; the story is
// data, so adding a job means adding an object, not new code.
import { makePed } from './people.js';
import { makeCar } from './vehicles.js';

export const MISSIONS = [
  {
    id: 1, name: 'First Fare', reward: 300,
    brief: 'Lena Cross needs a driver she can trust. Pick her up at the plaza and drive her to the marina meeting — smooth, no cops, no scratches.',
    stages: [
      { type: 'goto', x: 2025, y: 1125, radius: 70, text: 'Pick up Lena at the plaza (drive or walk to the yellow marker)' },
      { type: 'goto', x: 3150, y: 2400, radius: 80, needCar: true, text: 'Drive Lena to the marina meeting' },
    ],
  },
  {
    id: 2, name: 'Hot Wheels', reward: 500,
    brief: 'Hale’s crew parks a cherry-red Comet by the north beach road every night. Take it — quietly if you can — and bring it to the Pay & Spray.',
    stages: [
      { type: 'goto', x: 1575, y: 675, radius: 90, text: 'Find the red Comet parked by the north road' },
      { type: 'steal', model: 1, x: 1575, y: 675, text: 'Steal the Comet (press E beside it)' },
      { type: 'deliver', x: 2925, y: 1125, radius: 90, needCar: true, text: 'Deliver the Comet to the Pay & Spray' },
    ],
  },
  {
    id: 3, name: 'Dockside Payback', reward: 700,
    brief: 'Hale’s enforcers are shaking down the dock workers. Lena wants them gone. Bring a gun — the Gun Shop on the north-west block sells pistols.',
    stages: [
      { type: 'goto', x: 675, y: 2925, radius: 90, text: 'Reach the docks on the south-west side' },
      { type: 'kill', count: 4, at: { x: 675, y: 2925 }, text: 'Take out Hale’s enforcers (4 left)' },
      { type: 'goto', x: 2475, y: 2475, radius: 80, text: 'Lay low at the safehouse' },
    ],
  },
  {
    id: 4, name: 'The Getaway', reward: 900,
    brief: 'The pickup went loud. Three stars, half the city’s cruisers on your tail. Lose them — stay out of sight until the heat dies, then reach the safehouse.',
    stages: [
      { type: 'heat', level: 3, text: 'The cops are on you — break line of sight!' },
      { type: 'escape', text: 'Lose the wanted level, then get to the safehouse' },
      { type: 'goto', x: 2475, y: 2475, radius: 80, needClean: true, text: 'Reach the safehouse with no wanted level' },
    ],
  },
  {
    id: 5, name: 'Harbor Heist', reward: 1200,
    brief: 'A truck of Hale’s “imports” sits in the container yard. Grab the crates — four of them — and get out before his crew clocks you. You have three minutes.',
    stages: [
      { type: 'goto', x: 2925, y: 2925, radius: 100, text: 'Reach the container yard' },
      { type: 'collect', count: 4, at: { x: 2925, y: 2925 }, time: 180, text: 'Grab the crates (4 left)' },
      { type: 'goto', x: 1125, y: 675, radius: 90, text: 'Deliver the crates to Lena’s garage' },
    ],
  },
  {
    id: 6, name: 'King of Solmar', reward: 2000,
    brief: 'It ends tonight. Hale is at the marina with his whole crew. Take them down, then take his Interceptor and drive it to the plaza — the city will know who runs Solmar now.',
    stages: [
      { type: 'goto', x: 3150, y: 2400, radius: 100, text: 'Reach the marina — Hale is waiting' },
      { type: 'kill', count: 6, at: { x: 3150, y: 2400 }, text: 'Take down Hale’s crew (6 left)' },
      { type: 'steal', model: 4, x: 3150, y: 2400, text: 'Take Hale’s black Interceptor (press E beside it)' },
      { type: 'deliver', x: 2025, y: 1125, radius: 100, needCar: true, text: 'Drive the Interceptor to the plaza — claim the city' },
    ],
  },
];

export function createMissionState() {
  return {
    index: 0, // which mission of MISSIONS is active (0-based)
    active: false,
    stage: 0,
    stageTimer: 0,
    spawned: [], // peds spawned for the current stage
    targetCar: null,
    crates: [],
    cratesTaken: 0,
    killsLeft: 0,
    done: false,
    failed: false,
  };
}

export function startMission(world, index) {
  const m = world.mission;
  const def = MISSIONS[index];
  if (!def) return;
  m.index = index;
  m.active = true;
  m.stage = 0;
  m.done = false;
  m.failed = false;
  m.spawned = [];
  m.crates = [];
  m.cratesTaken = 0;
  m.killsLeft = 0;
  m.targetCar = null;
  world.notify(`MISSION: ${def.name} — ${def.brief}`);
  world.objective = def.stages[0].text;
  enterStage(world);
}

export function currentMission(world) {
  return MISSIONS[world.mission.index];
}

function enterStage(world) {
  const m = world.mission;
  const def = MISSIONS[m.index];
  const stage = def.stages[m.stage];
  if (!stage) { completeMission(world); return; }
  m.stageTimer = stage.time || 0;
  world.objective = stage.text;
  // Clear last stage's spawns.
  for (const ped of m.spawned) {
    if (!ped.dead) { ped.dead = true; ped.deathTimer = 0; }
  }
  m.spawned = [];
  if (stage.type === 'kill') {
    m.killsLeft = stage.count;
    for (let i = 0; i < stage.count; i += 1) {
      const ped = makePed(stage.at.x + (Math.random() - 0.5) * 260, stage.at.y + (Math.random() - 0.5) * 260, { hostile: true });
      world.peds.push(ped);
      m.spawned.push(ped);
    }
  }
  if (m.index === 0 && m.stage === 0) {
    // Lena herself waits at the plaza so the pickup is a visible story
    // beat, not a walk to an empty ring.
    const lena = makePed(2075, 1210, { label: 'LENA', stand: true });
    lena.shirt = '#ff4d8d';
    lena.skin = '#f2c89b';
    world.peds.push(lena);
    m.spawned.push(lena);
  }
  if (stage.type === 'collect') {
    m.crates = [];
    m.cratesTaken = 0;
    for (let i = 0; i < stage.count; i += 1) {
      // The crate IS the pickup: collecting it marks it taken here too.
      const crate = { x: stage.at.x + (Math.random() - 0.5) * 300, y: stage.at.y + (Math.random() - 0.5) * 300, kind: 'crate', value: 0, taken: false };
      m.crates.push(crate);
      world.pickups.push(crate);
    }
  }
  if (stage.type === 'steal') {
    // Park the target car at the stage location.
    const car = makeCar(stage.model, stage.x, stage.y, 0, { parked: true, occupied: false });
    world.cars.push(car);
    m.targetCar = car;
  }
  if (stage.type === 'heat') {
    world.setWanted(stage.level, 'the pickup went loud');
  }
}

export function updateMission(world, dt) {
  const m = world.mission;
  if (!m.active || m.done || m.failed) return;
  const def = MISSIONS[m.index];
  const stage = def.stages[m.stage];
  if (!stage) return;
  const p = world.player;
  const px = p.car ? p.car.x : p.x;
  const py = p.car ? p.car.y : p.y;

  if (stage.time) {
    m.stageTimer -= dt;
    if (m.stageTimer <= 0) { failMission(world, 'Out of time.'); return; }
  }

  const distTo = (x, y) => Math.hypot(px - x, py - y);

  switch (stage.type) {
    case 'goto': {
      if (stage.needClean && world.wanted.level > 0) {
        world.objective = `${stage.text} (lose the cops first!)`;
        break;
      }
      if (distTo(stage.x, stage.y) < stage.radius) {
        if (stage.needCar && !p.car) {
          world.objective = `${stage.text} (you need a car!)`;
          break;
        }
        advanceStage(world);
      }
      break;
    }
    case 'steal': {
      if (p.car === m.targetCar) advanceStage(world);
      break;
    }
    case 'deliver': {
      if (p.car === m.targetCar && distTo(stage.x, stage.y) < stage.radius) advanceStage(world);
      break;
    }
    case 'kill': {
      const left = m.spawned.filter((ped) => !ped.dead).length;
      m.killsLeft = left;
      world.objective = stage.text.replace(/\(\d+ left\)/, `(${left} left)`);
      if (left === 0) advanceStage(world);
      break;
    }
    case 'heat': {
      if (world.wanted.level >= stage.level) advanceStage(world);
      break;
    }
    case 'escape': {
      if (world.wanted.level === 0) advanceStage(world);
      break;
    }
    case 'collect': {
      const taken = m.crates.filter((c) => c.taken).length;
      m.cratesTaken = taken;
      world.objective = stage.text.replace(/\(\d+ left\)/, `(${stage.count - taken} left)`);
      if (taken >= stage.count) advanceStage(world);
      break;
    }
    default:
      break;
  }
}

function advanceStage(world) {
  const m = world.mission;
  world.audio.pickup();
  m.stage += 1;
  enterStage(world);
}

export function completeMission(world) {
  const m = world.mission;
  const def = MISSIONS[m.index];
  m.active = false;
  m.done = true;
  world.money += def.reward;
  world.stats.missionsDone += 1;
  world.audio.missionDone();
  world.notify(`MISSION PASSED: ${def.name} — +$${def.reward}`);
  world.floaters.push({ x: world.player.x, y: world.player.y - 40, text: `MISSION PASSED +$${def.reward}`, life: 2.5, color: '#ffd76a' });
  world.saveGame();
  if (m.index + 1 < MISSIONS.length) {
    world.nextMissionAvailable = true;
    world.objective = `Next job available — press L at the plaza to start “${MISSIONS[m.index + 1].name}”`;
  } else {
    world.objective = 'You run Solmar now. Free roam — the city is yours.';
    world.storyComplete = true;
  }
}

export function failMission(world, why) {
  const m = world.mission;
  m.active = false;
  m.failed = true;
  for (const ped of m.spawned) {
    if (!ped.dead) { ped.dead = true; ped.deathTimer = 0; }
  }
  m.spawned = [];
  world.audio.missionFail();
  world.notify(`MISSION FAILED: ${why} Press L to retry.`);
  world.objective = 'Mission failed — press L at the plaza to retry.';
}
