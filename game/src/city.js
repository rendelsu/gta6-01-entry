// Vice Harbor: the city itself. A fixed 3840 x 2880 grid, 12 avenues by
// 9 streets, split into 5 districts. Buildings, parks, docks and landmarks
// are generated once from a seeded RNG so the map never changes.
import { makeRng, pick, clamp } from './util.js';

export const WORLD_W = 3840;
export const WORLD_H = 2880;
export const AVENUES = 12;
export const STREETS = 9;
export const BLOCK = 320;
export const ROAD_W = 56;

export const DISTRICTS = [
  { name: 'Old Harbor', x0: 0, y0: 1920, x1: 1280, y1: 2880, base: '#3d5a66', accent: '#d8a24a' },
  { name: 'Marina Bay', x0: 1280, y0: 1920, x1: 2560, y1: 2880, base: '#2e6f7a', accent: '#7fd4c1' },
  { name: 'Eastside', x0: 2560, y0: 1920, x1: 3840, y1: 2880, base: '#6b4a3a', accent: '#e07840' },
  { name: 'Downtown', x0: 1280, y0: 640, x1: 2560, y1: 1920, base: '#4a4a58', accent: '#e8c85a' },
  { name: 'North Hills', x0: 0, y0: 0, x1: 3840, y1: 640, base: '#3f5a3a', accent: '#9ccb6a' },
];

const PALETTES = {
  'Old Harbor': ['#5a4632', '#6b5844', '#4a3a2c', '#7a5c38'],
  'Marina Bay': ['#3a6a72', '#2f5a66', '#4a7a82', '#35606a'],
  'Eastside': ['#7a4a38', '#6b4030', '#8a5540', '#5f382c'],
  'Downtown': ['#55556a', '#484858', '#62627a', '#3e3e50'],
  'North Hills': ['#4a5a44', '#3e4e38', '#566650', '#46543e'],
};

export function districtAt(x, y) {
  for (const d of DISTRICTS) {
    if (x >= d.x0 && x < d.x1 && y >= d.y0 && y < d.y1) return d;
  }
  return DISTRICTS[3];
}

export function avenueX(i) {
  return i * BLOCK + BLOCK / 2;
}

export function streetY(j) {
  return j * BLOCK + BLOCK / 2;
}

// Nearest road point: snap an x/y onto the closest avenue or street centre.
export function nearestRoadPoint(x, y) {
  let bestX = avenueX(0);
  let bestD = Infinity;
  for (let i = 0; i < AVENUES; i++) {
    const d = Math.abs(avenueX(i) - x);
    if (d < bestD) { bestD = d; bestX = avenueX(i); }
  }
  let bestY = streetY(0);
  bestD = Infinity;
  for (let j = 0; j < STREETS; j++) {
    const d = Math.abs(streetY(j) - y);
    if (d < bestD) { bestD = d; bestY = streetY(j); }
  }
  // Pick the closer axis: drive along avenues (vertical) or streets (horizontal).
  if (Math.abs(bestX - x) <= Math.abs(bestY - y)) return { x: bestX, y, vertical: true };
  return { x, y: bestY, vertical: false };
}

export function buildCity() {
  const rng = makeRng(20261119);
  const buildings = [];
  const parks = [];
  const landmarks = [
    { name: 'Voss Garage', x: avenueX(5), y: streetY(4) + 90, kind: 'garage' },
    { name: 'Ferrante Tower', x: avenueX(6), y: streetY(3) - 90, kind: 'tower' },
    { name: 'Harbor Pier 9', x: avenueX(2), y: streetY(7) + 100, kind: 'pier' },
    { name: 'Bayview Hotel', x: avenueX(8), y: streetY(6) - 80, kind: 'hotel' },
    { name: 'North Hills Park', x: avenueX(3), y: streetY(1), kind: 'park' },
  ];
  for (let a = 0; a < AVENUES - 1; a++) {
    for (let s = 0; s < STREETS - 1; s++) {
      const cx = a * BLOCK + BLOCK;
      const cy = s * BLOCK + BLOCK;
      const d = districtAt(cx, cy);
      if (rng() < 0.12) {
        parks.push({ x: cx - 90, y: cy - 90, w: 180, h: 180, name: d.name + ' Green' });
        continue;
      }
      const n = 2 + Math.floor(rng() * 3);
      for (let k = 0; k < n; k++) {
        const w = 60 + rng() * 90;
        const h = 60 + rng() * 90;
        const bx = cx - 110 + rng() * (220 - w);
        const by = cy - 110 + rng() * (220 - h);
        const tall = d.name === 'Downtown' ? 0.55 + rng() * 0.45 : 0.12 + rng() * 0.3;
        buildings.push({
          x: bx, y: by, w, h,
          color: pick(rng, PALETTES[d.name] || PALETTES.Downtown),
          tall,
          windows: Math.floor(w / 18) * Math.floor(h / 22),
          district: d.name,
        });
      }
    }
  }
  return { buildings, parks, landmarks };
}

export function randomRoadPoint(rng) {
  if (rng() < 0.5) {
    return { x: avenueX(Math.floor(rng() * AVENUES)), y: rng() * WORLD_H, vertical: true };
  }
  return { x: rng() * WORLD_W, y: streetY(Math.floor(rng() * STREETS)), vertical: false };
}

export function clampToWorld(x, y) {
  return { x: clamp(x, 24, WORLD_W - 24), y: clamp(y, 24, WORLD_H - 24) };
}
