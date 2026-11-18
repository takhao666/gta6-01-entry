// Solmar City layout: a road grid, building blocks, a park, a plaza, a beach
// and a marina. Generation is seeded, so the city is identical every load.
// Also owns the collision and road queries the cars and pedestrians need.
import { WORLD, ROAD_W, BLOCK, ROAD0, ROADS, PALETTE } from './config.js';
import { mulberry32, pick, range, chance } from './random.js';

export function roadCentres() {
  const list = [];
  for (let i = 0; i < ROADS; i += 1) list.push(ROAD0 + i * BLOCK);
  return list;
}

export function nearestRoadCoord(v) {
  let best = roadCentres()[0];
  let bestD = Infinity;
  for (const c of roadCentres()) {
    const d = Math.abs(v - c);
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}

export function onRoad(x, y) {
  for (const c of roadCentres()) {
    if (Math.abs(x - c) < ROAD_W / 2 || Math.abs(y - c) < ROAD_W / 2) return true;
  }
  return false;
}

export function buildCity(seed = 20261117) {
  const rng = mulberry32(seed);
  const buildings = [];
  const trees = [];
  const centres = roadCentres();
  // Blocks sit between neighbouring road centrelines.
  for (let bx = 0; bx < ROADS - 1; bx += 1) {
    for (let by = 0; by < ROADS - 1; by += 1) {
      const x0 = centres[bx] + ROAD_W / 2 + 14;
      const y0 = centres[by] + ROAD_W / 2 + 14;
      const x1 = centres[bx + 1] - ROAD_W / 2 - 14;
      const y1 = centres[by + 1] - ROAD_W / 2 - 14;
      // The centre block is the park; the block north-east of it is the plaza.
      if (bx === 3 && by === 3) {
        for (let t = 0; t < 26; t += 1) {
          trees.push({ x: range(rng, x0 + 10, x1 - 10), y: range(rng, y0 + 10, y1 - 10), r: range(rng, 9, 15) });
        }
        continue;
      }
      if (bx === 4 && by === 2) continue; // plaza: open paving, no buildings
      const n = chance(rng, 0.45) ? 1 : chance(rng, 0.6) ? 2 : 4;
      if (n === 1) {
        buildings.push(makeBuilding(rng, x0, y0, x1, y1));
      } else if (n === 2) {
        const mid = (x0 + x1) / 2;
        buildings.push(makeBuilding(rng, x0, y0, mid - 8, y1));
        buildings.push(makeBuilding(rng, mid + 8, y0, x1, y1));
      } else {
        const mx = (x0 + x1) / 2;
        const my = (y0 + y1) / 2;
        buildings.push(makeBuilding(rng, x0, y0, mx - 8, my - 8));
        buildings.push(makeBuilding(rng, mx + 8, y0, x1, my - 8));
        buildings.push(makeBuilding(rng, x0, my + 8, mx - 8, y1));
        buildings.push(makeBuilding(rng, mx + 8, my + 8, x1, y1));
      }
      if (chance(rng, 0.5)) {
        trees.push({ x: range(rng, x0, x1), y: range(rng, y0, y1), r: range(rng, 8, 13) });
      }
    }
  }
  // Palm-lined beach road: a row of palms on the sidewalk strip just north
  // of the south road, at block centres so none lands on a road.
  const palms = [];
  for (const px of [450, 900, 1350, 1800, 2250, 2700, 3150]) {
    palms.push({ x: px + range(rng, -40, 40), y: 3312 + range(rng, -3, 3) });
  }
  // Boats moored off the pier in the sea, and the pier itself.
  const boats = [];
  const boatSpots = [[1450, 3490], [1900, 3535], [2150, 3480], [2600, 3520], [950, 3530]];
  for (const [bx, by] of boatSpots) {
    boats.push({ x: bx + range(rng, -30, 30), y: by + range(rng, -15, 15), angle: range(rng, -0.4, 0.4), color: pick(rng, ['#e8e4da', '#c0392b', '#2e86c1', '#f1c40f']) });
  }
  return {
    buildings,
    trees,
    palms,
    boats,
    pier: { x: 1700, y0: 3395, y1: 3560 },
    centres,
    park: { x: centres[3] + ROAD_W / 2, y: centres[3] + ROAD_W / 2, w: BLOCK - ROAD_W, h: BLOCK - ROAD_W },
    plaza: { x: centres[4] + ROAD_W / 2, y: centres[2] + ROAD_W / 2, w: BLOCK - ROAD_W, h: BLOCK - ROAD_W },
    beach: { y: 3300 },
    marina: { x: 3150, y: 2400 },
  };
}

function makeBuilding(rng, x0, y0, x1, y1) {
  const w = x1 - x0;
  const h = y1 - y0;
  const bw = range(rng, w * 0.55, w * 0.92);
  const bh = range(rng, h * 0.55, h * 0.92);
  const bx = x0 + (w - bw) / 2;
  const by = y0 + (h - bh) / 2;
  return {
    x: bx, y: by, w: bw, h: bh,
    color: pick(rng, PALETTE.buildingRoof),
    height: Math.floor(range(rng, 1, 4)), // storeys, drawn as a roof offset
    lit: chance(rng, 0.5),
  };
}

// True when the circle at (x, y) with radius r overlaps a building, the
// water, or the edge of the world. Roads, sidewalks, park and plaza are open.
export function hitsSolid(city, x, y, r) {
  if (x < r || y < r || x > WORLD.w - r || y > WORLD.h - r) return true;
  if (y > city.beach.y + 120) return true; // the sea
  for (const b of city.buildings) {
    if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return true;
  }
  return false;
}

// Push a circle out of any building it overlaps. Returns true if it moved.
export function resolveSolids(city, p, r) {
  let moved = false;
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(p.x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(p.y, b.y + b.h));
    const dx = p.x - cx;
    const dy = p.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      if (d2 > 0.01) {
        const d = Math.sqrt(d2);
        p.x = cx + (dx / d) * r;
        p.y = cy + (dy / d) * r;
      } else {
        p.y = b.y - r;
      }
      moved = true;
    }
  }
  if (p.y > city.beach.y + 120 - r) { p.y = city.beach.y + 120 - r; moved = true; }
  p.x = Math.max(r, Math.min(WORLD.w - r, p.x));
  p.y = Math.max(r, Math.min(WORLD.h - r, p.y));
  return moved;
}

// A random point on a road (used for spawning traffic and pedestrians).
export function randomRoadPoint(rng) {
  const centres = roadCentres();
  const vertical = chance(rng, 0.5);
  const c = pick(rng, centres);
  const along = range(rng, 300, WORLD.w - 300);
  return vertical ? { x: c, y: along } : { x: along, y: c };
}

// Nearest drivable point on a road centreline from anywhere.
export function snapToRoad(x, y) {
  return { x: nearestRoadCoord(x), y: nearestRoadCoord(y) };
}
