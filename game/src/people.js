// Pedestrians: ordinary Solmar residents walking the sidewalks, who flee
// from gunfire and from cars driven at them. Mission gang members are a
// separate, hostile kind handled here too.
import { WORLD, ROAD_W } from './config.js';
import { roadCentres, resolveSolids, randomRoadPoint } from './city.js';
import { mulberry32, pick, range } from './random.js';

const SKINS = ['#f2c89b', '#c98d5f', '#8a5a3b', '#e8b88a', '#6e4426'];
const SHIRTS = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#ecf0f1', '#1abc9c', '#e67e22'];

let nextPedId = 1;

export function makePed(x, y, opts = {}) {
  return {
    id: nextPedId += 1,
    x, y,
    angle: Math.random() * Math.PI * 2,
    speed: opts.speed || range(Math.random, 40, 75),
    skin: pick(Math.random, SKINS),
    shirt: pick(Math.random, SHIRTS),
    hostile: !!opts.hostile,
    health: opts.hostile ? 60 : 100,
    label: opts.label || null, // named story characters (Lena) get a tag
    stand: !!opts.stand, // stand still where placed (story characters)
    flee: 0,
    dead: false,
    shootTimer: 1 + Math.random(),
    walkPhase: Math.random() * 6,
    target: null,
  };
}

export function spawnPeds(world, count) {
  const rng = mulberry32((world.seed + 55 + Math.floor(world.time * 60) + count * 131) >>> 0);
  const centres = roadCentres();
  for (let i = 0; i < count; i += 1) {
    // Spawn on a sidewalk near the player, so the streets around them stay
    // busy without the population growing without bound across the city.
    const px = world.player.x;
    const py = world.player.y;
    const nearX = centres.filter((c) => Math.abs(c - px) < 800);
    const nearY = centres.filter((c) => Math.abs(c - py) < 800);
    const vertical = rng() < 0.5;
    const off = (ROAD_W / 2 + 18) * (rng() < 0.5 ? -1 : 1);
    let x;
    let y;
    if (vertical && nearX.length) {
      x = pick(rng, nearX) + off;
      y = Math.max(240, Math.min(WORLD.h - 240, py + range(rng, -700, 700)));
    } else if (nearY.length) {
      x = Math.max(240, Math.min(WORLD.w - 240, px + range(rng, -700, 700)));
      y = pick(rng, nearY) + off;
    } else {
      const pt = randomRoadPoint(rng);
      x = pt.x;
      y = pt.y;
    }
    world.peds.push(makePed(x, y));
  }
}

export function updatePeds(world, dt) {
  const p = world.player;
  for (const ped of world.peds) {
    if (ped.dead) continue;
    ped.walkPhase += dt * 8;
    if (ped.stand) continue; // story characters hold their spot
    const danger = world.gunfireTimer > 0 || (p.car && Math.hypot(ped.x - p.x, ped.y - p.y) < 130 && Math.abs(p.car.speed) > 200);
    if (danger) ped.flee = 2.5;
    if (ped.hostile) {
      // Gang members hold their ground and shoot at the player.
      const px = p.car ? p.car.x : p.x;
      const py = p.car ? p.car.y : p.y;
      const d = Math.hypot(p.x - px, p.y - py);
      if (d < 520) {
        ped.angle = Math.atan2(py - ped.y, px - ped.x);
        ped.shootTimer -= dt;
        if (ped.shootTimer <= 0 && d < 420) {
          ped.shootTimer = 1.5 + Math.random() * 1.2;
          world.enemyShots.push({ x: ped.x, y: ped.y, angle: ped.angle + (Math.random() - 0.5) * 0.35, speed: 620, life: 1.2, from: 'enemy' });
          world.audio.noise(0.08, 0.12, 1200);
        }
      }
      continue;
    }
    if (ped.flee > 0) {
      ped.flee -= dt;
      const away = Math.atan2(ped.y - p.y, ped.x - p.x);
      ped.angle = away;
      ped.x += Math.cos(away) * 150 * dt;
      ped.y += Math.sin(away) * 150 * dt;
    } else {
      // Stroll along the nearest sidewalk; turn at intersections.
      if (!ped.target || Math.hypot(ped.target.x - ped.x, ped.target.y - ped.y) < 20) {
        ped.target = pickSidewalkTarget(ped);
      }
      const a = Math.atan2(ped.target.y - ped.y, ped.target.x - ped.x);
      ped.angle = a;
      ped.x += Math.cos(a) * ped.speed * dt;
      ped.y += Math.sin(a) * ped.speed * dt;
    }
    resolveSolids(world.city, ped, 10);
    // Run over by a fast car: the pedestrian is hit.
    if (p.car && Math.abs(p.car.speed) > 120 && Math.hypot(ped.x - p.car.x, ped.y - p.car.y) < 30) {
      killPed(world, ped, 'car');
    }
  }
  world.peds = world.peds.filter((ped) => {
    if (ped.dead) return ped.deathTimer > 0;
    // Despawn ordinary pedestrians who wandered far from the player; the
    // top-up below keeps the streets near the player populated.
    if (!ped.hostile && Math.hypot(ped.x - p.x, ped.y - p.y) > 1600) return false;
    return true;
  });
  for (const ped of world.peds) {
    if (ped.dead) ped.deathTimer = (ped.deathTimer || 1.5) - dt;
  }
  // Keep the streets populated near the player (capped, so this can never
  // grow without bound).
  const near = world.peds.filter((ped) => !ped.dead && Math.hypot(ped.x - p.x, ped.y - p.y) < 1100).length;
  if (near < 22 && world.peds.length < 90) spawnPeds(world, Math.min(22 - near, 90 - world.peds.length));
}

function pickSidewalkTarget(ped) {
  const centres = roadCentres();
  const cx = centres.reduce((a, b) => (Math.abs(ped.x - a) < Math.abs(ped.x - b) ? a : b));
  const cy = centres.reduce((a, b) => (Math.abs(ped.y - a) < Math.abs(ped.y - b) ? a : b));
  const vertical = Math.abs(ped.x - cx) < Math.abs(ped.y - cy);
  const dir = Math.random() < 0.5 ? -1 : 1;
  if (vertical) {
    return { x: cx + (ped.x > cx ? 1 : -1) * (ROAD_W / 2 + 18), y: Math.max(240, Math.min(WORLD.h - 240, ped.y + dir * range(Math.random, 120, 420))) };
  }
  return { x: Math.max(240, Math.min(WORLD.w - 240, ped.x + dir * range(Math.random, 120, 420))), y: cy + (ped.y > cy ? 1 : -1) * (ROAD_W / 2 + 18) };
}

export function killPed(world, ped, cause) {
  if (ped.dead) return;
  ped.dead = true;
  ped.deathTimer = 1.5;
  world.particles.push({ x: ped.x, y: ped.y, vx: 0, vy: 0, life: 1.4, max: 1.4, color: '#c0392b', size: 14, ring: true });
  if (!ped.hostile) {
    world.addWanted(1, 'pedestrian down');
    world.stats.pedsDown += 1;
  } else {
    world.stats.gangDown += 1;
    world.money += 25;
    world.floaters.push({ x: ped.x, y: ped.y - 20, text: '+$25', life: 1.2, color: '#7CFC00' });
  }
  if (cause === 'shot') world.gunfireTimer = 1.5;
}
