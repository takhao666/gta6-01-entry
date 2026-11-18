// The wanted system: stars, police cars and foot officers, busts and the
// slow cool-down when the player stays out of sight.
import { WORLD, WANTED_DECAY_SECONDS, COP_BUST_SECONDS } from './config.js';
import { resolveSolids } from './city.js';
import { spawnPoliceCar, updatePoliceCar } from './vehicles.js';

export function createWanted() {
  return {
    level: 0,
    unseenTimer: 0,
    reason: '',
    flash: 0,
  };
}

export function addWanted(world, amount, reason) {
  const w = world.wanted;
  const before = w.level;
  w.level = Math.max(0, Math.min(5, w.level + amount));
  w.reason = reason || '';
  w.unseenTimer = 0;
  if (w.level > before) {
    w.flash = 1;
    world.notify(`WANTED LEVEL ${w.level} — ${reason || 'the police are after you'}`);
  }
}

export function updateWanted(world, dt) {
  const w = world.wanted;
  const p = world.player;
  w.flash = Math.max(0, w.flash - dt);
  if (w.level <= 0) return;

  // How many police cars should be hunting the player.
  const wantCars = Math.min(w.level, 4);
  const cars = world.cars.filter((c) => c.police);
  if (cars.length < wantCars && Math.random() < dt * 0.8) spawnPoliceCar(world);
  // Extra cars at high wanted levels despawn when the heat dies down.
  if (cars.length > wantCars && w.level < 3) {
    const far = cars.filter((c) => Math.hypot(c.x - p.x, c.y - p.y) > 1200);
    if (far.length) world.cars.splice(world.cars.indexOf(far[0]), 1);
  }
  for (const car of cars) updatePoliceCar(world, car, dt);

  // Foot officers appear when the player is on foot.
  if (!p.car) {
    const wantCops = w.level >= 2 ? Math.min(3, w.level - 1) : 0;
    const alive = world.cops.filter((c) => !c.dead).length;
    if (alive < wantCops && Math.random() < dt * 0.5) spawnCop(world);
  }
  for (const cop of world.cops) updateCop(world, cop, dt);
  world.cops = world.cops.filter((c) => !c.dead || c.deathTimer > 0);
  for (const cop of world.cops) {
    if (cop.dead) cop.deathTimer = (cop.deathTimer || 1.5) - dt;
  }

  // Cool down: if no police can see the player for a while, lose a star.
  const nearestPolice = nearestPoliceDistance(world);
  const seen = nearestPolice < 420;
  if (!seen) {
    w.unseenTimer += dt;
    if (w.unseenTimer > WANTED_DECAY_SECONDS) {
      w.unseenTimer = 0;
      w.level -= 1;
      world.notify(w.level > 0 ? `Heat dying down — wanted level ${w.level}` : 'You lost the cops. Clean.');
    }
  } else {
    w.unseenTimer = 0;
  }
}

function nearestPoliceDistance(world) {
  const p = world.player;
  let best = Infinity;
  for (const c of world.cars) {
    if (!c.police) continue;
    best = Math.min(best, Math.hypot(c.x - p.x, c.y - p.y));
  }
  for (const cop of world.cops) {
    if (cop.dead) continue;
    best = Math.min(best, Math.hypot(cop.x - p.x, cop.y - p.y));
  }
  return best;
}

function spawnCop(world) {
  const p = world.player;
  const angle = Math.random() * Math.PI * 2;
  const x = p.x + Math.cos(angle) * 380;
  const y = p.y + Math.sin(angle) * 380;
  world.cops.push({
    x: Math.max(60, Math.min(WORLD.w - 60, x)),
    y: Math.max(60, Math.min(WORLD.h - 60, y)),
    angle: 0,
    health: 50,
    dead: false,
    deathTimer: 0,
    shootTimer: 1 + Math.random(),
    bustHold: 0,
    walkPhase: Math.random() * 6,
  });
}

function updateCop(world, cop, dt) {
  if (cop.dead) return;
  const p = world.player;
  const d = Math.hypot(p.x - cop.x, p.y - cop.y);
  cop.walkPhase += dt * 9;
  cop.angle = Math.atan2(p.y - cop.y, p.x - cop.x);
  if (d > 34) {
    const speed = d > 260 ? 250 : 165;
    cop.x += Math.cos(cop.angle) * speed * dt;
    cop.y += Math.sin(cop.angle) * speed * dt;
    resolveSolids(world.city, cop, 12);
  } else {
    // Close enough to make the arrest: hold still near the player.
    cop.bustHold += dt;
    if (cop.bustHold > COP_BUST_SECONDS && p.health > 0) {
      world.busted();
      cop.bustHold = 0;
    }
  }
  // Officers shoot when the player is armed and far, or when wanted is high.
  if (d > 90 && d < 460 && (p.weapon === 'pistol' || world.wanted.level >= 3)) {
    cop.shootTimer -= dt;
    if (cop.shootTimer <= 0) {
      cop.shootTimer = 1.6 + Math.random();
      world.enemyShots.push({ x: cop.x, y: cop.y, angle: cop.angle + (Math.random() - 0.5) * 0.3, speed: 640, life: 1.1, from: 'enemy' });
      world.audio.noise(0.08, 0.1, 1200);
    }
  }
  // A fast car hitting an officer knocks him down.
  if (p.car && Math.abs(p.car.speed) > 120 && d < 30) {
    cop.health = 0;
    cop.dead = true;
    cop.deathTimer = 1.5;
    addWanted(world, 1, 'officer down');
    world.stats.copsDown += 1;
  }
}
