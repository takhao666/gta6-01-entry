// Cars: definitions, spawning, traffic AI that follows the road grid, and
// arcade driving physics for the car the player is in. Police cars are cars
// too, with a chase steering mode.
import { WORLD, ROAD_W, CAR_MODELS } from './config.js';
import { roadCentres, onRoad, resolveSolids, randomRoadPoint } from './city.js';
import { mulberry32, pick, range } from './random.js';

let nextCarId = 1;

export function makeCar(modelIndex, x, y, angle, opts = {}) {
  const model = CAR_MODELS[modelIndex % CAR_MODELS.length];
  return {
    id: nextCarId += 1,
    model: modelIndex % CAR_MODELS.length,
    name: model.name,
    color: opts.color || model.color,
    x, y, angle,
    speed: 0,
    w: 46, h: 24,
    top: model.top, accel: model.accel, grip: model.grip,
    police: !!opts.police,
    traffic: !!opts.traffic,
    parked: !!opts.parked,
    occupied: opts.occupied !== false,
    driver: opts.driver || null, // pedestrian id driving it, or null
    // traffic AI state
    cruise: range(Math.random, 120, 190),
    turnAt: null,
    stuck: 0,
    siren: false,
    health: 100,
    smoke: 0,
  };
}

export function spawnTraffic(world, count) {
  const rng = mulberry32(world.seed + 77);
  for (let i = 0; i < count; i += 1) {
    const p = randomRoadPoint(rng);
    const vertical = Math.abs(p.x - Math.round(p.x / 450) * 450) < 5;
    const angle = vertical ? (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (rng() < 0.5 ? 0 : Math.PI);
    const model = Math.floor(rng() * 4); // never the police Interceptor in traffic
    const car = makeCar(model, p.x, p.y, angle, { traffic: true });
    car.speed = car.cruise;
    world.cars.push(car);
  }
}

export function spawnParked(world, count) {
  const rng = mulberry32(world.seed + 31);
  const centres = roadCentres();
  for (let i = 0; i < count; i += 1) {
    const c = pick(rng, centres);
    const along = range(rng, 320, WORLD.w - 320);
    const vertical = rng() < 0.5;
    const lane = (rng() < 0.5 ? -1 : 1) * (ROAD_W / 2 - 16);
    const x = vertical ? c + lane : along;
    const y = vertical ? along : c + lane;
    const angle = vertical ? (lane > 0 ? Math.PI / 2 : -Math.PI / 2) : (lane > 0 ? 0 : Math.PI);
    const car = makeCar(Math.floor(rng() * 5), x, y, angle, { parked: true, occupied: false });
    world.cars.push(car);
  }
}

// --- driving physics (player car) -------------------------------------------
export function driveCar(world, car, input, dt) {
  const up = input.down('w', 'arrowup');
  const down = input.down('s', 'arrowdown');
  const left = input.down('a', 'arrowleft');
  const right = input.down('d', 'arrowright');
  const handbrake = input.down(' ', 'shift');
  if (up) car.speed += car.accel * dt;
  if (down) car.speed -= car.accel * 0.75 * dt;
  if (!up && !down) car.speed *= Math.pow(0.4, dt); // coast
  if (handbrake) car.speed *= Math.pow(0.05, dt);
  car.speed = Math.max(-car.top * 0.45, Math.min(car.top, car.speed));
  const steer = (left ? -1 : 0) + (right ? 1 : 0);
  const grip = handbrake ? car.grip * 0.45 : car.grip;
  car.angle += steer * grip * dt * Math.min(1, Math.abs(car.speed) / 120) * Math.sign(car.speed || 1);
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const before = { x: car.x, y: car.y };
  car.x = nx;
  car.y = ny;
  const hitWall = resolveSolids(world.city, car, 22);
  if (hitWall) {
    const lost = Math.abs(car.speed);
    if (lost > 220) {
      world.audio.crash();
      world.shake = Math.min(14, lost / 40);
      car.health -= Math.min(30, lost / 18);
      if (car.health < 40) car.smoke = 1;
      spawnSparks(world, car.x, car.y, 10);
    }
    car.speed *= 0.35;
    car.x = before.x;
    car.y = before.y;
    resolveSolids(world.city, car, 22);
  }
  // Bumping other cars slows both and nudges them apart.
  for (const other of world.cars) {
    if (other === car) continue;
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const d = Math.hypot(dx, dy);
    if (d < 48 && d > 0.01) {
      const push = (48 - d) / 2;
      const ux = dx / d;
      const uy = dy / d;
      other.x += ux * push;
      other.y += uy * push;
      car.x -= ux * push * 0.4;
      car.y -= uy * push * 0.4;
      if (Math.abs(car.speed) > 160) {
        world.audio.crash();
        other.speed = car.speed * 0.4;
        other.traffic = false;
        car.speed *= 0.6;
      }
    }
  }
  return Math.abs(car.speed) / car.top;
}

// --- traffic AI ---------------------------------------------------------------
function trafficTarget(car) {
  // Drive along the current road; at an intersection, maybe turn.
  const centres = roadCentres();
  const vertical = Math.abs(Math.sin(car.angle)) > Math.abs(Math.cos(car.angle));
  if (vertical) {
    const c = nearestCentre(car.x, centres);
    const ahead = car.y + Math.sin(car.angle) * 90;
    const crossing = centres.find((cc) => Math.abs(ahead - cc) < 60);
    if (crossing !== undefined && car.turnAt !== crossing) {
      car.turnAt = crossing;
      if (Math.random() < 0.45) {
        car.angle = Math.random() < 0.5 ? 0 : Math.PI;
        car.y = crossing;
        car.x = c;
      }
    }
    return { x: c + (Math.cos(car.angle) > 0 ? 0 : 0), y: car.y + Math.sin(car.angle) * 100 };
  }
  const c = nearestCentre(car.y, centres);
  const ahead = car.x + Math.cos(car.angle) * 90;
  const crossing = centres.find((cc) => Math.abs(ahead - cc) < 60);
  if (crossing !== undefined && car.turnAt !== crossing) {
    car.turnAt = crossing;
    if (Math.random() < 0.45) {
      car.angle = Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
      car.x = crossing;
      car.y = c;
    }
  }
  return { x: car.x + Math.cos(car.angle) * 100, y: c };
}

function nearestCentre(v, centres) {
  let best = centres[0];
  let bd = Infinity;
  for (const c of centres) {
    const d = Math.abs(v - c);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}

export function updateTraffic(world, dt) {
  for (const car of world.cars) {
    if (!car.traffic || car === world.player.car) continue;
    const target = trafficTarget(car);
    const want = Math.atan2(target.y - car.y, target.x - car.x);
    let diff = want - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    car.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
    // Slow down for the car ahead.
    let slow = false;
    for (const other of world.cars) {
      if (other === car) continue;
      const dx = other.x - car.x;
      const dy = other.y - car.y;
      const ahead = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
      const side = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
      if (ahead > 0 && ahead < 90 && side < 30) { slow = true; break; }
    }
    const targetSpeed = slow ? 0 : car.cruise;
    car.speed += Math.max(-260 * dt, Math.min(260 * dt, targetSpeed - car.speed));
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    if (!onRoad(car.x, car.y)) {
      // Drifted off the grid (after a shove): steer back to the nearest road.
      const snap = { x: nearestCentre(car.x, roadCentres()), y: nearestCentre(car.y, roadCentres()) };
      car.angle = Math.atan2(snap.y - car.y, snap.x - car.x);
    }
    resolveSolids(world.city, car, 22);
  }
  // Remove traffic that wandered far from the player; top it back up.
  const px = world.player.x;
  const py = world.player.y;
  world.cars = world.cars.filter((c) => {
    if (c.traffic && Math.hypot(c.x - px, c.y - py) > 1500) return false;
    return true;
  });
  const trafficCount = world.cars.filter((c) => c.traffic).length;
  if (trafficCount < 14) spawnTraffic(world, 14 - trafficCount);
}

// --- police cars ---------------------------------------------------------------
export function spawnPoliceCar(world) {
  const angle = Math.random() * Math.PI * 2;
  const dist = 700;
  const x = world.player.x + Math.cos(angle) * dist;
  const y = world.player.y + Math.sin(angle) * dist;
  const snapped = { x: Math.max(260, Math.min(WORLD.w - 260, x)), y: Math.max(260, Math.min(WORLD.h - 260, y)) };
  const car = makeCar(4, snapped.x, snapped.y, 0, { police: true, color: '#20242e' });
  car.siren = true;
  world.cars.push(car);
  return car;
}

export function updatePoliceCar(world, car, dt) {
  const p = world.player;
  const tx = p.car ? p.car.x : p.x;
  const ty = p.car ? p.car.y : p.y;
  const want = Math.atan2(ty - car.y, tx - car.x);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  car.angle += Math.max(-3.4 * dt, Math.min(3.4 * dt, diff));
  const dist = Math.hypot(tx - car.x, ty - car.y);
  const targetSpeed = dist > 120 ? car.top * 0.92 : car.top * 0.5;
  car.speed += Math.max(-700 * dt, Math.min(700 * dt, targetSpeed - car.speed));
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  resolveSolids(world.city, car, 22);
  // Ram the player's car.
  if (p.car) {
    const d = Math.hypot(p.car.x - car.x, p.car.y - car.y);
    if (d < 50) {
      const push = (50 - d) / 2;
      const ux = (p.car.x - car.x) / (d || 1);
      const uy = (p.car.y - car.y) / (d || 1);
      p.car.x += ux * push;
      p.car.y += uy * push;
      p.car.speed *= 0.82;
      car.speed *= 0.7;
      if (Math.abs(car.speed) > 200) world.audio.crash();
      world.shake = Math.max(world.shake, 5);
    }
  }
  return dist;
}

export function spawnSparks(world, x, y, n) {
  for (let i = 0; i < n; i += 1) {
    world.particles.push({
      x, y,
      vx: (Math.random() - 0.5) * 320,
      vy: (Math.random() - 0.5) * 320,
      life: 0.4 + Math.random() * 0.3,
      max: 0.7,
      color: '#ffd76a',
      size: 2 + Math.random() * 3,
    });
  }
}
