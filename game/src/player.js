// The player: on-foot movement, getting in and out of cars, stealing them,
// shooting, punching, health and pickups. The car itself is driven by
// vehicles.js; this file decides when the player is in one.
import { PLAYER } from './config.js';
import { resolveSolids } from './city.js';
import { killPed } from './people.js';
import { spawnSparks } from './vehicles.js';

export function createPlayer(x, y) {
  return {
    x, y, angle: -Math.PI / 2,
    health: PLAYER.maxHealth,
    money: 0,
    car: null, // the car object the player is driving, or null
    weapon: 'fists', // fists | pistol
    ammo: 0,
    pistolOwned: false,
    punchTimer: 0,
    shootCooldown: 0,
    bustTimer: 0,
    invulnerable: 0,
    moving: false,
  };
}

export function updatePlayer(world, input, dt) {
  const p = world.player;
  p.punchTimer = Math.max(0, p.punchTimer - dt);
  p.shootCooldown = Math.max(0, p.shootCooldown - dt);
  p.invulnerable = Math.max(0, p.invulnerable - dt);

  // Enter / exit a car.
  if (input.consume('e')) {
    if (p.car) exitCar(world);
    else tryEnterCar(world);
  }

  if (p.car) {
    p.x = p.car.x;
    p.y = p.car.y;
    p.angle = p.car.angle;
    p.moving = Math.abs(p.car.speed) > 20;
    // Shooting from a car is not allowed; the wheel is the weapon.
    return;
  }

  // On foot.
  const up = input.down('w', 'arrowup');
  const down = input.down('s', 'arrowdown');
  const left = input.down('a', 'arrowleft');
  const right = input.down('d', 'arrowright');
  const run = input.down('shift');
  const speed = run ? PLAYER.runSpeed : PLAYER.walkSpeed;
  let mx = (right ? 1 : 0) - (left ? 1 : 0);
  let my = (down ? 1 : 0) - (up ? 1 : 0);
  if (mx || my) {
    const len = Math.hypot(mx, my);
    mx /= len;
    my /= len;
    p.x += mx * speed * dt;
    p.y += my * speed * dt;
    p.moving = true;
    p.angle = Math.atan2(my, mx);
  } else {
    p.moving = false;
  }
  resolveSolids(world.city, p, PLAYER.radius);
  // Aim at the mouse; the body faces where it walks, the gun faces the mouse.
  const aim = world.screenToWorld(input.mouse.x, input.mouse.y);
  p.aimAngle = Math.atan2(aim.y - p.y, aim.x - p.x);

  // Punch (F or Space) — short range, knocks a pedestrian down.
  if ((input.consume('f') || input.consume(' ')) && p.punchTimer <= 0) {
    p.punchTimer = 0.45;
    world.audio.noise(0.07, 0.12, 500);
    for (const ped of world.peds) {
      if (ped.dead) continue;
      const d = Math.hypot(ped.x - p.x, ped.y - p.y);
      if (d < 46) {
        killPed(world, ped, 'punch');
        world.shake = Math.max(world.shake, 4);
      }
    }
  }

  // Shoot (left click) with the pistol.
  if (input.mouse.down && p.weapon === 'pistol' && p.shootCooldown <= 0) {
    if (p.ammo > 0) {
      p.shootCooldown = 0.22;
      p.ammo -= 1;
      world.audio.gunshot();
      world.gunfireTimer = 1.5;
      world.shake = Math.max(world.shake, 3);
      const muzzleX = p.x + Math.cos(p.aimAngle) * 22;
      const muzzleY = p.y + Math.sin(p.aimAngle) * 22;
      world.playerShots.push({ x: muzzleX, y: muzzleY, angle: p.aimAngle, speed: 900, life: 0.9, from: 'player' });
      spawnSparks(world, muzzleX, muzzleY, 4);
    } else if (p.pistolOwned) {
      p.shootCooldown = 0.4;
      world.notify('Out of ammo — buy more at the Gun Shop (G)');
    }
  }

  // Switch weapon (1 fists, 2 pistol).
  if (input.consume('1')) p.weapon = 'fists';
  if (input.consume('2') && p.pistolOwned) p.weapon = 'pistol';

  // Pickups: cash and health lying on the street.
  for (const pk of world.pickups) {
    if (pk.taken) continue;
    if (Math.hypot(pk.x - p.x, pk.y - p.y) < 30) {
      pk.taken = true;
      if (pk.kind === 'cash') {
        world.money += pk.value;
        world.floaters.push({ x: p.x, y: p.y - 24, text: `+$${pk.value}`, life: 1.2, color: '#7CFC00' });
      } else if (pk.kind === 'health') {
        p.health = Math.min(PLAYER.maxHealth, p.health + 50);
        world.floaters.push({ x: p.x, y: p.y - 24, text: '+50 HP', life: 1.2, color: '#ff6b6b' });
      }
      world.audio.pickup();
    }
  }
  world.pickups = world.pickups.filter((pk) => !pk.taken);
}

function tryEnterCar(world) {
  const p = world.player;
  let best = null;
  let bestD = 70;
  for (const car of world.cars) {
    const d = Math.hypot(car.x - p.x, car.y - p.y);
    if (d < bestD) { bestD = d; best = car; }
  }
  if (!best) return;
  if (best.police) {
    world.notify('That is a police cruiser — stealing it is a bad idea.');
    return;
  }
  if (best.occupied && best.traffic) {
    // Carjacking: the driver bails out and runs, the law notices.
    best.traffic = false;
    best.occupied = true;
    world.addWanted(1, 'carjacking');
    world.notify(`You jacked a ${best.name}! The law saw that.`);
    world.audio.crash();
    const driver = best.driver;
    if (driver) {
      driver.flee = 3;
      best.driver = null;
    }
  }
  best.parked = false;
  p.car = best;
  world.audio.blip(220, 0.12, 'triangle', 0.12);
}

function exitCar(world) {
  const p = world.player;
  const car = p.car;
  car.speed *= 0.3;
  // Step out on the driver's side.
  const side = car.angle + Math.PI / 2;
  p.x = car.x + Math.cos(side) * 34;
  p.y = car.y + Math.sin(side) * 34;
  resolveSolids(world.city, p, PLAYER.radius);
  p.car = null;
  world.audio.blip(180, 0.1, 'triangle', 0.1);
}

// Bullets fly, hit peds, cops, cars and buildings.
export function updateShots(world, dt) {
  for (const list of [world.playerShots, world.enemyShots]) {
    for (const s of list) {
      s.x += Math.cos(s.angle) * s.speed * dt;
      s.y += Math.sin(s.angle) * s.speed * dt;
      s.life -= dt;
      // Buildings stop bullets.
      const bx = Math.round(s.x);
      const by = Math.round(s.y);
      if (world.city.buildings.some((b) => bx > b.x && bx < b.x + b.w && by > b.y && by < b.y + b.h)) {
        s.life = 0;
        spawnSparks(world, s.x, s.y, 3);
      }
    }
  }
  // Player shots vs peds and cops.
  for (const s of world.playerShots) {
    if (s.life <= 0) continue;
    for (const ped of world.peds) {
      if (ped.dead) continue;
      if (Math.hypot(ped.x - s.x, ped.y - s.y) < 18) {
        s.life = 0;
        ped.health -= 34;
        if (ped.health <= 0) killPed(world, ped, 'shot');
        else { ped.flee = 2; }
        break;
      }
    }
    if (s.life <= 0) continue;
    for (const cop of world.cops) {
      if (cop.dead) continue;
      if (Math.hypot(cop.x - s.x, cop.y - s.y) < 18) {
        s.life = 0;
        cop.health -= 34;
        if (cop.health <= 0) {
          cop.dead = true;
          world.addWanted(1, 'officer down');
          world.money += 40;
          world.floaters.push({ x: cop.x, y: cop.y - 20, text: '+$40', life: 1.2, color: '#7CFC00' });
        }
        break;
      }
    }
    if (s.life <= 0) continue;
    for (const car of world.cars) {
      if (car === world.player.car) continue;
      if (Math.hypot(car.x - s.x, car.y - s.y) < 26) {
        s.life = 0;
        car.health -= 12;
        spawnSparks(world, s.x, s.y, 3);
        if (car.health <= 0 && !car.burning) {
          car.burning = true;
          world.addWanted(1, 'vehicle destroyed');
        }
        break;
      }
    }
  }
  // Enemy shots vs the player.
  const p = world.player;
  for (const s of world.enemyShots) {
    if (s.life <= 0) continue;
    const px = p.car ? p.car.x : p.x;
    const py = p.car ? p.car.y : p.y;
    if (Math.hypot(px - s.x, py - s.y) < (p.car ? 26 : 16)) {
      s.life = 0;
      hurtPlayer(world, 6);
    }
  }
  world.playerShots = world.playerShots.filter((s) => s.life > 0);
  world.enemyShots = world.enemyShots.filter((s) => s.life > 0);
}

export function hurtPlayer(world, amount) {
  const p = world.player;
  if (p.invulnerable > 0 || p.health <= 0) return;
  p.health -= amount;
  world.shake = Math.max(world.shake, 6);
  world.audio.noise(0.12, 0.2, 300);
  if (p.health <= 0) {
    p.health = 0;
    world.wasted();
  }
}
