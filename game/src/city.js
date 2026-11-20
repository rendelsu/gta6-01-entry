// SOLMAR — Vice Harbor (r6): the city itself. A fixed 3840x2880 map with
// 12 avenues, 9 streets, 5 districts, a beach and a marina. Generation is
// seeded so every playthrough (and every screenshot) sees the same city.
import { mulberry32, pick, randRange } from './util.js';

export const WORLD_W = 3840;
export const WORLD_H = 2880;
export const ROAD_W = 64;

export const DISTRICTS = [
  { id: 'marina', name: 'Marina Bay', x0: 0, y0: 0, x1: 960, y1: 1440, tint: '#3f7d8c', sky: 'harbour' },
  { id: 'oldtown', name: 'Old Town', x0: 0, y0: 1440, x1: 1280, y1: 2880, tint: '#b98a4a', sky: 'warm' },
  { id: 'downtown', name: 'Downtown', x0: 960, y0: 0, x1: 2560, y1: 1440, tint: '#5a6b8a', sky: 'glass' },
  { id: 'beach', name: 'Vice Beach', x0: 2560, y0: 0, x1: 3840, y1: 1440, tint: '#e8c98a', sky: 'sun' },
  { id: 'hills', name: 'North Hills', x0: 1280, y0: 1440, x1: 3840, y1: 2880, tint: '#6f8f5a', sky: 'green' },
];

export const SHOP_NAMES = [
  'TACOS EL SOL', 'VICE PAWN', 'NEON NAILS', 'BURGER BAY', 'DONUT DOCK',
  'LAUNDR-O-MATIC', 'PIER PIZZA', 'SOLMAR MOTORS', 'HOTEL PALMA', 'CAFÉ LUNA',
  'BAR LA OLA', 'GYM IRON', 'PHARMACIA', 'LIQUOR KING', 'SURF SHACK',
];

export function avenueX(i) { return 160 + i * 320; }
export function streetY(j) { return 160 + j * 320; }

export function districtAt(x, y) {
  for (const d of DISTRICTS) {
    if (x >= d.x0 && x < d.x1 && y >= d.y0 && y < d.y1) return d;
  }
  return DISTRICTS[2];
}

export function isWater(x, y) {
  // Open sea east of the beach, and the marina basin in the south-west.
  if (x > 3720) return true;
  if (x < 320 && y > 2560) return true;
  return false;
}
export function isSand(x, y) {
  return x > 3520 && x <= 3720 && y < 1440;
}

export function onRoad(x, y) {
  for (let i = 0; i < 12; i++) if (Math.abs(x - avenueX(i)) < ROAD_W / 2 + 8) return true;
  for (let j = 0; j < 9; j++) if (Math.abs(y - streetY(j)) < ROAD_W / 2 + 8) return true;
  return false;
}

export function generateCity(seed) {
  const rng = mulberry32(seed);
  const buildings = [];
  const palms = [];
  const lamps = [];
  const shops = [];
  const palettes = {
    marina: ['#7fa8b5', '#5d8a96', '#93b7c2', '#4a6f7d'],
    oldtown: ['#c98f5a', '#b57a45', '#d9a86c', '#a06a3e'],
    downtown: ['#6b7fa3', '#55688a', '#8494b5', '#46586f'],
    beach: ['#f2d49b', '#e8c07a', '#ffd9a0', '#e0b56a'],
    hills: ['#8aa06b', '#74905c', '#a3b57f', '#5f7d4e'],
  };
  for (let i = 0; i < 11; i++) {
    for (let j = 0; j < 8; j++) {
      const bx0 = avenueX(i) + ROAD_W / 2 + 10;
      const by0 = streetY(j) + ROAD_W / 2 + 10;
      const bw = 320 - ROAD_W - 20;
      const bh = 320 - ROAD_W - 20;
      const cx = bx0 + bw / 2, cy = by0 + bh / 2;
      const d = districtAt(cx, cy);
      const n = 1 + Math.floor(rng() * 3);
      for (let k = 0; k < n; k++) {
        const w = randRange(rng, 60, bw / (n === 1 ? 1 : 2) - 8);
        const h = randRange(rng, 60, bh - 8);
        const x = bx0 + randRange(rng, 0, Math.max(1, bw - w));
        const y = by0 + randRange(rng, 0, Math.max(1, bh - h));
        const tall = d.id === 'downtown' && rng() < 0.45;
        const b = {
          x, y, w, h,
          height: tall ? randRange(rng, 90, 170) : randRange(rng, 14, 42),
          color: pick(rng, palettes[d.id]),
          roof: pick(rng, ['#3a3f4a', '#4a4038', '#2f3a44', '#5a4a3a']),
          district: d.id,
          shop: null,
        };
        if (rng() < 0.30) {
          b.shop = pick(rng, SHOP_NAMES);
          shops.push({ x: b.x + b.w / 2, y: b.y + b.h + 4, name: b.shop, w: b.w });
        }
        buildings.push(b);
      }
      if (d.id === 'beach' || d.id === 'marina') {
        for (let p = 0; p < 3; p++) {
          palms.push({ x: bx0 + rng() * bw, y: by0 + rng() * bh, s: randRange(rng, 0.8, 1.3) });
        }
      }
    }
  }
  // Street lamps along every avenue / street corner.
  for (let i = 0; i < 12; i++) {
    for (let j = 0; j < 9; j++) {
      lamps.push({ x: avenueX(i) + 40, y: streetY(j) + 40 });
      lamps.push({ x: avenueX(i) - 40, y: streetY(j) - 40 });
    }
  }
  // Beach palms row + marina docks.
  for (let y = 120; y < 1400; y += 130) palms.push({ x: 3560 + rng() * 120, y, s: randRange(rng, 0.9, 1.4) });
  const docks = [];
  for (let x = 420; x < 900; x += 160) docks.push({ x, y: 2620, w: 110, h: 26 });
  return { buildings, palms, lamps, shops, docks, seed };
}

export function collidesBuilding(city, x, y, r) {
  for (const b of city.buildings) {
    if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return b;
  }
  return null;
}

export function randomRoadPoint(rng) {
  if (rng() < 0.5) return { x: avenueX(Math.floor(rng() * 12)), y: randRange(rng, 120, WORLD_H - 120) };
  return { x: randRange(rng, 120, WORLD_W - 120), y: streetY(Math.floor(rng() * 9)) };
}
