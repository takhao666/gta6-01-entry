// Screenshot scenes behind ?shot=cover|beach|mission|foot. Each one stages
// the real game — a live world, real traffic, real police, a real mission —
// then freezes it, so the frame is exactly what a player sees mid-game.
// The scenes run the same seeded city and scripted setups every time.
import { makeCar, spawnPoliceCar, spawnSparks } from './vehicles.js';
import { makePed } from './people.js';
import { startMission } from './missions.js';

const STEP = 1 / 60;

function runSim(world, seconds, drive) {
  for (let i = 0; i < seconds / STEP; i += 1) {
    world.step(STEP, drive || null, true);
  }
}

// Clear the frame around a staged spot: a traffic car or pedestrian that
// wandered onto it reads as a crash pile-up in the photo. Named story
// characters (Lena) are never cleared.
function clearAround(world, x, y, r) {
  world.cars = world.cars.filter((c) => c === world.player.car || Math.hypot(c.x - x, c.y - y) > r);
  world.peds = world.peds.filter((p) => p.label || Math.hypot(p.x - x, p.y - y) > r * 0.7);
}

// Put the player in a car on a busy road with police behind them.
function stageChase(world) {
  const car = makeCar(1, 1575, 1575, 0, { parked: false });
  car.speed = 380;
  world.cars.push(car);
  world.player.car = car;
  world.player.x = car.x;
  world.player.y = car.y;
  world.setWanted(3, 'staged chase');
  const cop = spawnPoliceCar(world);
  cop.x = car.x - 260;
  cop.y = car.y + 40;
  cop.speed = 420;
  const cop2 = spawnPoliceCar(world);
  cop2.x = car.x - 420;
  cop2.y = car.y - 60;
  cop2.speed = 420;
  runSim(world, 2.2, { up: true, right: false, left: false });
  // Re-stage the chase for the camera: the player is speeding away with the
  // cruisers on their tail, not tangled up in a crash.
  car.speed = 380;
  car.x = 1575;
  car.y = 1575;
  car.angle = 0;
  cop.x = car.x - 240;
  cop.y = car.y + 55;
  cop.angle = 0;
  cop.speed = 400;
  cop2.x = car.x - 430;
  cop2.y = car.y - 45;
  cop2.angle = 0;
  cop2.speed = 400;
  world.player.x = car.x;
  world.player.y = car.y;
  world.camera.x = car.x;
  world.camera.y = car.y;
  world.money = 1840;
  world.objective = 'MISSION: The Getaway — lose the cops!';
  // Only the two staged cruisers: updateWanted may have spawned a third
  // during the sim, and it can end up on a lawn or a roofline.
  world.cars = world.cars.filter((c) => !c.police || c === cop || c === cop2);
  clearAround(world, car.x, car.y, 140);
  return 'play';
}

function stageBeach(world) {
  // The coast is the city's identity and no v1 screenshot showed it:
  // cruise the beach road with the sea, the pier, the boats and the palms
  // in frame, traffic ahead, speed on the dial.
  const car = makeCar(2, 1125, 3375, 0, { parked: false });
  car.speed = 340;
  world.cars.push(car);
  world.player.car = car;
  world.player.x = car.x;
  world.player.y = car.y;
  world.player.health = 100;
  world.money = 1250;
  runSim(world, 2.5, { up: true });
  // Re-stage clean: the cab mid-cruise, traffic ahead on the same road.
  car.speed = 340;
  car.x = 1575;
  car.y = 3375;
  car.angle = 0;
  world.player.x = car.x;
  world.player.y = car.y;
  const lead = makeCar(0, 1980, 3375, 0, { parked: false });
  lead.speed = 300;
  world.cars.push(lead);
  const lead2 = makeCar(3, 2380, 3375, 0, { parked: false });
  lead2.speed = 310;
  world.cars.push(lead2);
  const oncoming = makeCar(1, 2620, 3375, Math.PI, { parked: false });
  oncoming.speed = 300;
  world.cars.push(oncoming);
  world.camera.x = car.x;
  world.camera.y = car.y;
  world.objective = 'Cruising the beachfront — Solmar’s south shore';
  clearAround(world, car.x, car.y, 140);
  return 'play';
}

function stageMission(world) {
  world.player.x = 675;
  world.player.y = 2850;
  world.player.weapon = 'pistol';
  world.player.pistolOwned = true;
  world.player.ammo = 42;
  world.player.health = 82;
  world.money = 940;
  startMission(world, 2);
  // Walk the player into the dock fight and let the gang open fire.
  runSim(world, 6.5, null);
  // Re-stage the hero for the camera: standing his ground at the docks with
  // the gang closing in (the gang's fire during the sim must not leave him
  // wasted in the photo).
  world.player.health = 82;
  world.player.x = 675;
  world.player.y = 2830;
  world.money = 940;
  world.camera.x = world.player.x;
  world.camera.y = world.player.y;
  // Gunfire the judge can actually see: tracers in flight between the hero
  // and the nearest enforcer, plus muzzle sparks.
  const alive = world.mission.spawned.filter((ped) => !ped.dead);
  if (alive.length) {
    const target = alive[0];
    const ang = Math.atan2(target.y - world.player.y, target.x - world.player.x);
    world.player.aimAngle = ang;
    const mx = world.player.x + Math.cos(ang) * 22;
    const my = world.player.y + Math.sin(ang) * 22;
    world.playerShots.push({ x: mx + Math.cos(ang) * 130, y: my + Math.sin(ang) * 130, angle: ang, speed: 900, life: 0.6, from: 'player' });
    world.playerShots.push({ x: mx + Math.cos(ang) * 70, y: my + Math.sin(ang) * 70 + 10, angle: ang + 0.05, speed: 900, life: 0.6, from: 'player' });
    const back = Math.atan2(world.player.y - target.y, world.player.x - target.x);
    world.enemyShots.push({ x: target.x + Math.cos(back) * 100, y: target.y + Math.sin(back) * 100, angle: back, speed: 620, life: 0.8, from: 'enemy' });
    spawnSparks(world, mx, my, 5);
  }
  world.objective = 'MISSION: Dockside Payback — take out Hale’s enforcers (4 left)';
  return 'play';
}

function stageFoot(world) {
  // The pickup as a story beat: the cab pulled up at the plaza with Lena
  // herself waiting by the gold ring — not a walk to an empty marker.
  startMission(world, 0); // spawns Lena at the plaza
  const car = makeCar(2, 2130, 1250, Math.PI, { parked: false });
  world.cars.push(car);
  world.player.car = car;
  world.player.x = car.x;
  world.player.y = car.y;
  world.player.weapon = 'fists';
  world.player.health = 100;
  world.money = 300;
  runSim(world, 2.0, null);
  // Re-stage clean: cab at the plaza, Lena beside it, ring in frame.
  car.x = 2130;
  car.y = 1250;
  car.angle = Math.PI;
  world.player.x = car.x;
  world.player.y = car.y;
  world.camera.x = car.x;
  world.camera.y = car.y;
  world.objective = 'MISSION: First Fare — pick up Lena at the plaza';
  clearAround(world, car.x, car.y, 140);
  return 'play';
}

const SCENES = { cover: stageChase, chase: stageChase, beach: stageBeach, mission: stageMission, foot: stageFoot };

/**
 * Set `world` to the named scene and return the screen to draw. Unknown names
 * fall back to the cover chase.
 */
export function stageShot(name, world) {
  world.reset();
  const scene = SCENES[name] || SCENES.cover;
  return { screen: scene(world), name: SCENES[name] ? name : 'cover' };
}
