// City generation for SOLMAR — Vice Harbor.
// World: 3840 x 2880. 12 avenues (vertical) x 9 streets (horizontal), 5 districts.
import { hash2, rand, pick } from './util.js';

export const WORLD_W = 3840;
export const WORLD_H = 2880;
export const ROAD_W = 64;
export const AVENUES = 12;
export const STREETS = 9;

export function avenueX(i) { return 200 + i * 320; }
export function streetY(j) { return 200 + j * 320; }

export const DISTRICTS = [
  { name: 'MARINA BAY',   x: 0,    y: 0,    w: 1280, h: 960,  ground: '#c9b183', accent: '#2e7f9e' },
  { name: 'DOWNTOWN',     x: 1280, y: 0,    w: 1280, h: 960,  ground: '#8f8f96', accent: '#c8a24a' },
  { name: 'OLD TOWN',     x: 2560, y: 0,    w: 1280, h: 960,  ground: '#b59a7a', accent: '#7e4a3a' },
  { name: 'HARBOR DOCKS', x: 0,    y: 960,  w: 1920, h: 1920, ground: '#7d8a86', accent: '#3a6e8f' },
  { name: 'VICE HARBOR',  x: 1920, y: 960,  w: 1920, h: 1920, ground: '#a89a7d', accent: '#e07b39' },
];

export function districtAt(x, y) {
  for (const d of DISTRICTS) {
    if (x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h) return d;
  }
  return DISTRICTS[4];
}

const BUILDING_COLORS = ['#b08d6e', '#9a8f7a', '#7e8ba0', '#a06e5a', '#8a7a5c', '#6e7f8a', '#b59a7a', '#96705a'];
const SHOP_NAMES = [
  'TACOS EL SOL', 'VICE LIQUOR', 'DONUTS 24H', 'BARBER JOE', 'LAUNDRY LUNA',
  'PIZZA MARINA', 'PAWN SHOP', 'BURGER BAY', 'PHARMACY+', 'CLUB NEON',
  'GYM IRON', 'FISH MARKET', 'HOTEL PALMA', 'ARCADE PIXEL', 'BAKERY SOL',
  'TATTOO INK', 'AUTO REPAIR', 'FLOWER ROSA', 'CAFE AMANECER', 'SUSHI KAI',
];
const SHOP_COLORS = ['#e74c3c', '#f39c12', '#2ecc71', '#9b59b6', '#3498db', '#e67e22', '#1abc9c', '#d35400'];

export function buildCity() {
  const buildings = [];
  const shops = [];
  const parks = [];
  const parking = [];
  let shopIdx = 0;
  // One building (or park) per block between roads.
  for (let i = 0; i < AVENUES - 1; i++) {
    for (let j = 0; j < STREETS - 1; j++) {
      const bx0 = avenueX(i) + ROAD_W / 2 + 14;
      const by0 = streetY(j) + ROAD_W / 2 + 14;
      const bw = 320 - ROAD_W - 28;
      const bh = 320 - ROAD_W - 28;
      const h = hash2(i, j);
      const d = districtAt(bx0 + bw / 2, by0 + bh / 2);
      if (h < 0.12) {
        parks.push({ x: bx0, y: by0, w: bw, h: bh, trees: 6 + Math.floor(h * 40) });
        continue;
      }
      // Split some blocks into two buildings.
      const split = h > 0.55;
      const parts = split ? 2 : 1;
      for (let p = 0; p < parts; p++) {
        const w2 = split ? bw / 2 - 6 : bw;
        const x2 = split ? bx0 + p * (bw / 2 + 6) : bx0;
        const tall = d.name === 'DOWNTOWN' ? 5 + Math.floor(hash2(i * 7, j * 3 + p) * 9) : 1 + Math.floor(hash2(i * 3, j * 5 + p) * 4);
        const b = {
          x: x2, y: by0, w: w2, h: bh,
          color: pick(BUILDING_COLORS), tall,
          district: d.name,
          seed: hash2(i * 11 + p, j * 13),
        };
        buildings.push(b);
        // Ground-floor shop facing the avenue on the west edge of the block.
        if (hash2(i * 17 + p, j * 19) < 0.42) {
          shops.push({
            x: x2, y: by0 + bh - 26, w: Math.min(w2, 150), h: 26,
            name: SHOP_NAMES[shopIdx % SHOP_NAMES.length],
            color: SHOP_COLORS[shopIdx % SHOP_COLORS.length],
          });
          shopIdx++;
        }
      }
      // A few parked cars along the block edge.
      if (hash2(i * 23, j * 29) < 0.5) {
        parking.push({ x: avenueX(i) + ROAD_W / 2 + 8, y: streetY(j) + ROAD_W / 2 + 60 + hash2(i, j * 3) * 120, vertical: true });
      }
    }
  }
  return { buildings, shops, parks, parking };
}

// Is a point on a road (drivable)? Roads are the avenue/street bands.
export function onRoad(x, y) {
  for (let i = 0; i < AVENUES; i++) {
    if (Math.abs(x - avenueX(i)) <= ROAD_W / 2) return true;
  }
  for (let j = 0; j < STREETS; j++) {
    if (Math.abs(y - streetY(j)) <= ROAD_W / 2) return true;
  }
  return false;
}
export function nearestRoadPoint(x, y) {
  let best = null, bestD = Infinity;
  for (let i = 0; i < AVENUES; i++) {
    const ax = avenueX(i);
    const d = Math.abs(x - ax);
    if (d < bestD) { bestD = d; best = { x: ax, y, vertical: true }; }
  }
  for (let j = 0; j < STREETS; j++) {
    const sy = streetY(j);
    const d = Math.abs(y - sy);
    if (d < bestD) { bestD = d; best = { x, y: sy, vertical: false }; }
  }
  return best;
}
// Nearest avenue/street centre, clamped into the world.
export function nearestAvenue(x) {
  let best = avenueX(0), bd = Infinity;
  for (let i = 0; i < AVENUES; i++) { const d = Math.abs(x - avenueX(i)); if (d < bd) { bd = d; best = avenueX(i); } }
  return best;
}
export function nearestStreet(y) {
  let best = streetY(0), bd = Infinity;
  for (let j = 0; j < STREETS; j++) { const d = Math.abs(y - streetY(j)); if (d < bd) { bd = d; best = streetY(j); } }
  return best;
}
// Circle vs building collision: returns push-out offset or null.
export function collideBuildings(x, y, r, buildings) {
  let px = 0, py = 0;
  for (const b of buildings) {
    const cx = Math.max(b.x, Math.min(x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(y, b.y + b.h));
    const dx = x - cx, dy = y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      const d = Math.sqrt(d2) || 0.001;
      const push = r - d;
      px += (dx / d) * push;
      py += (dy / d) * push;
    }
  }
  return { x: px, y: py };
}
