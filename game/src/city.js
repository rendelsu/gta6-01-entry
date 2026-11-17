// City generation for Solmar: a road grid, blocks full of buildings, a central
// park, a beach along the south edge and docks on the east edge. The layout is
// generated once from a fixed seed, so every session plays the same city.
import { WORLD_W, WORLD_H, ROAD_XS, ROAD_YS, ROAD_WIDTH, SIDEWALK, PAL, LANDMARKS } from './config.js';
import { mulberry32, range, rangeInt, pick, chance } from './random.js';

export function generateCity(seed = 20261117) {
  const rng = mulberry32(seed);
  const buildings = [];
  const trees = [];
  const parkedSpots = [];
  const roadSetX = new Set(ROAD_XS);
  const roadSetY = new Set(ROAD_YS);

  // Blocks sit between neighbouring roads. A block is (x0,y0)-(x1,y1).
  const xs = [0, ...ROAD_XS, WORLD_W];
  const ys = [0, ...ROAD_YS, WORLD_H];
  for (let bi = 0; bi < xs.length - 1; bi++) {
    for (let bj = 0; bj < ys.length - 1; bj++) {
      const x0 = xs[bi] + (bi === 0 ? 0 : ROAD_WIDTH / 2 + SIDEWALK);
      const x1 = xs[bi + 1] - (bi + 1 === xs.length - 1 ? 0 : ROAD_WIDTH / 2 + SIDEWALK);
      const y0 = ys[bj] + (bj === 0 ? 0 : ROAD_WIDTH / 2 + SIDEWALK);
      const y1 = ys[bj + 1] - (bj + 1 === ys.length - 1 ? 0 : ROAD_WIDTH / 2 + SIDEWALK);
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      const w = x1 - x0;
      const h = y1 - y0;
      if (w < 40 || h < 40) continue;

      // South strip is the beach, east strip is the docks, centre block is the park.
      if (y0 >= 2360) continue; // beach: no buildings
      if (x0 >= 2360) continue; // docks: containers handled as buildings below
      const isPark = cx > 800 && cx < 1120 && cy > 800 && cy < 1120;
      const isPlaza = cx > 800 && cx < 1120 && cy > 1280 && cy < 1600;
      if (isPark) {
        for (let t = 0; t < 26; t++) {
          trees.push({ x: range(rng, x0 + 14, x1 - 14), y: range(rng, y0 + 14, y1 - 14), r: range(rng, 7, 12) });
        }
        continue;
      }
      if (isPlaza) {
        for (let t = 0; t < 8; t++) {
          trees.push({ x: range(rng, x0 + 14, x1 - 14), y: range(rng, y0 + 14, y1 - 14), r: range(rng, 6, 9) });
        }
        continue;
      }

      // One to three buildings per block, with a margin for pavement.
      const count = chance(rng, 0.45) ? 1 : chance(rng, 0.6) ? 2 : 3;
      const margin = 14;
      if (count === 1) {
        addBuilding(buildings, rng, x0 + margin, y0 + margin, w - margin * 2, h - margin * 2);
      } else if (count === 2) {
        const vertical = w > h;
        if (vertical) {
          addBuilding(buildings, rng, x0 + margin, y0 + margin, w / 2 - margin * 1.5, h - margin * 2);
          addBuilding(buildings, rng, x0 + w / 2 + margin / 2, y0 + margin, w / 2 - margin * 1.5, h - margin * 2);
        } else {
          addBuilding(buildings, rng, x0 + margin, y0 + margin, w - margin * 2, h / 2 - margin * 1.5);
          addBuilding(buildings, rng, x0 + margin, y0 + h / 2 + margin / 2, w - margin * 2, h / 2 - margin * 1.5);
        }
      } else {
        const bw = w / 2 - margin * 1.5;
        const bh = h / 2 - margin * 1.5;
        addBuilding(buildings, rng, x0 + margin, y0 + margin, bw, bh);
        addBuilding(buildings, rng, x0 + w / 2 + margin / 2, y0 + margin, bw, bh);
        addBuilding(buildings, rng, x0 + margin, y0 + h / 2 + margin / 2, bw, bh);
      }
      // A few street trees along the block edge.
      for (let t = 0; t < 3; t++) {
        trees.push({ x: range(rng, x0 + 8, x1 - 8), y: chance(rng, 0.5) ? y0 + 6 : y1 - 6, r: range(rng, 5, 8) });
      }
    }
  }

  // Docks: shipping containers stacked as low solid blocks.
  for (let i = 0; i < 10; i++) {
    const cx = range(rng, 2420, 2520);
    const cy = 200 + i * 210 + range(rng, -20, 20);
    buildings.push({
      x: cx - 26, y: cy - 16, w: 52, h: 32, height: rangeInt(rng, 10, 22),
      color: pick(rng, ['#b85450', '#4a7fb5', '#c8a03c', '#5a8a5a']), wall: '#6b5a4a',
      container: true, roof: '#00000000',
    });
  }
  // Marina piers are walkable; the water starts past them.
  // Landmark buildings: taller, named, drawn with a sign.
  const landmarkDefs = [
    { ...LANDMARKS.garage, w: 120, h: 80, height: 34, label: 'GARAGE' },
    { ...LANDMARKS.cityHall, w: 140, h: 100, height: 52, label: 'CITY HALL' },
    { ...LANDMARKS.market, w: 110, h: 70, height: 26, label: 'MERCADO' },
  ];
  for (const lm of landmarkDefs) {
    // Remove any generated building overlapping the landmark footprint.
    for (let i = buildings.length - 1; i >= 0; i--) {
      const b = buildings[i];
      if (b.x < lm.x + lm.w / 2 && b.x + b.w > lm.x - lm.w / 2 && b.y < lm.y + lm.h / 2 && b.y + b.h > lm.y - lm.h / 2) {
        buildings.splice(i, 1);
      }
    }
    buildings.push({
      x: lm.x - lm.w / 2, y: lm.y - lm.h / 2, w: lm.w, h: lm.h, height: lm.height,
      color: '#e8c87c', wall: '#c8a860', label: lm.label, landmark: true,
    });
  }

  // Parked cars along the roads, some of them stealable rides.
  for (const rx of ROAD_XS) {
    for (const ry of ROAD_YS) {
      if (chance(rng, 0.55)) {
        parkedSpots.push({ x: rx + ROAD_WIDTH / 2 + 12, y: ry + range(rng, 60, 260), angle: Math.PI / 2, vertical: true });
      }
      if (chance(rng, 0.55)) {
        parkedSpots.push({ x: rx + range(rng, 60, 260), y: ry + ROAD_WIDTH / 2 + 12, angle: 0, vertical: false });
      }
    }
  }

  return { buildings, trees, parkedSpots, roadSetX, roadSetY, seed };
}

function addBuilding(buildings, rng, x, y, w, h) {
  if (w < 34 || h < 34) return;
  const ci = Math.floor(rng() * PAL.buildingRoof.length);
  buildings.push({
    x, y, w, h,
    height: rangeInt(rng, 18, 64),
    color: PAL.buildingRoof[ci],
    wall: PAL.buildingWall[ci],
    windows: rangeInt(rng, 2, 5),
  });
}

// --- Geometry queries shared by physics, AI and the minimap -----------------

export function isOnRoad(city, x, y) {
  for (const rx of ROAD_XS) if (Math.abs(x - rx) <= ROAD_WIDTH / 2) return true;
  for (const ry of ROAD_YS) if (Math.abs(y - ry) <= ROAD_WIDTH / 2) return true;
  return false;
}

export function isOnSidewalk(city, x, y) {
  if (isOnRoad(city, x, y)) return false;
  for (const rx of ROAD_XS) if (Math.abs(x - rx) <= ROAD_WIDTH / 2 + SIDEWALK) return true;
  for (const ry of ROAD_YS) if (Math.abs(y - ry) <= ROAD_WIDTH / 2 + SIDEWALK) return true;
  return false;
}

export function isBeach(x, y) {
  return y >= 2368 && y < 2480;
}

export function isWater(x, y) {
  return y >= 2480 || x >= 2540;
}

export function buildingAt(city, x, y) {
  for (const b of city.buildings) {
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
  }
  return null;
}

// Push a circle out of every building it overlaps. Returns true if it hit one.
export function collideBuildings(city, e, r) {
  let hit = false;
  for (const b of city.buildings) {
    const nx = Math.max(b.x, Math.min(e.x, b.x + b.w));
    const ny = Math.max(b.y, Math.min(e.y, b.y + b.h));
    const dx = e.x - nx;
    const dy = e.y - ny;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      hit = true;
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        e.x = nx + (dx / d) * r;
        e.y = ny + (dy / d) * r;
      } else {
        e.y = b.y - r; // shoved out the south face
      }
    }
  }
  return hit;
}

export function nearestRoadX(x) {
  let best = ROAD_XS[0];
  for (const rx of ROAD_XS) if (Math.abs(rx - x) < Math.abs(best - x)) best = rx;
  return best;
}

export function nearestRoadY(y) {
  let best = ROAD_YS[0];
  for (const ry of ROAD_YS) if (Math.abs(ry - y) < Math.abs(best - y)) best = ry;
  return best;
}
