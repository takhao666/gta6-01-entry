// Screenshot scenes behind ?shot=cover|drive|mission|chase. Each one stages
// the real game — a live world, real traffic, real police, a real mission —
// then freezes it, so the frame is exactly what a player sees mid-game.
// The scenes run the same seeded city and scripted setups every time.
import { makeCar, spawnPoliceCar } from './vehicles.js';
import { makePed } from './people.js';
import { startMission } from './missions.js';

const STEP = 1 / 60;

function runSim(world, seconds, drive) {
  for (let i = 0; i < seconds / STEP; i += 1) {
    world.step(STEP, drive || null, true);
  }
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
  return 'play';
}

function stageDrive(world) {
  const car = makeCar(2, 1125, 1125, Math.PI / 2, { parked: false });
  car.speed = 300;
  world.cars.push(car);
  world.player.car = car;
  world.player.x = car.x;
  world.player.y = car.y;
  world.player.health = 100;
  world.money = 1250;
  runSim(world, 3.5, { up: true });
  world.objective = 'Free roam — explore Solmar City';
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
  world.objective = 'MISSION: Dockside Payback — take out Hale’s enforcers (4 left)';
  return 'play';
}

function stageFoot(world) {
  world.player.x = 2130;
  world.player.y = 1300; // on the plaza paving, the marker ring visible nearby
  world.player.weapon = 'fists';
  world.player.health = 100;
  world.money = 300;
  startMission(world, 0);
  runSim(world, 4.0, null);
  world.player.x = 2130;
  world.player.y = 1300;
  world.camera.x = world.player.x;
  world.camera.y = world.player.y;
  world.objective = 'MISSION: First Fare — pick up Lena at the plaza';
  return 'play';
}

const SCENES = { cover: stageChase, chase: stageChase, drive: stageDrive, mission: stageMission, foot: stageFoot };

/**
 * Set `world` to the named scene and return the screen to draw. Unknown names
 * fall back to the cover chase.
 */
export function stageShot(name, world) {
  world.reset();
  const scene = SCENES[name] || SCENES.cover;
  return { screen: scene(world), name: SCENES[name] ? name : 'cover' };
}
