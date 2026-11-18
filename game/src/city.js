// Vice Harbor: a fixed, seeded city. Avenues run north-south, streets east-west;
// the east edge is the beach and the sea, the south-west corner is the old docks.
import { mulberry32, randRange, randInt, pick, clamp } from './utils.js';

export const WORLD_W = 3840;
export const WORLD_H = 2880;
export const ROAD_W = 72;
export const PITCH = 320;
export const AVENUES = 12; // x = 160 + i*320
export const STREETS = 9;   // y = 160 + j*320

export const DISTRICTS = [
  { name: 'Old Port', x0: 0, y0: 1900, x1: 1500, y1: 2880, tint: '#8a6f4d' },
  { name: 'Downtown', x0: 1300, y0: 300, x1: 2900, y1: 1900, tint: '#5a6b8a' },
  { name: 'Neon Strip', x0: 300, y0: 1900, x1: 2900, y1: 2400, tint: '#a04a7a' },
  { name: 'Coral Heights', x0: 300, y0: 0, x1: 3600, y1: 500, tint: '#7a9a6a' },
  { name: 'Vice Beach', x0: 3450, y0: 0, x1: 3840, y1: 2880, tint: '#d9b380' },
];

export function avenueX(i) { return 160 + i * PITCH; }
export function streetY(j) { return 160 + j * PITCH; }
export function districtAt(x, y) {
  for (const d of DISTRICTS) if (x >= d.x0 && x < d.x1 && y >= d.y0 && y < d.y1) return d;
  return DISTRICTS[1];
}
export function isWater(x, y) { return x > 3560; }
export function isBeach(x, y) { return x > 3400 && x <= 3560; }
export function onRoad(x, y) {
  for (let i = 0; i < AVENUES; i++) if (Math.abs(x - avenueX(i)) < ROAD_W / 2 + 6) return true;
  for (let j = 0; j < STREETS; j++) if (Math.abs(y - streetY(j)) < ROAD_W / 2 + 6) return true;
  return false;
}
// Nearest road centre point (used to snap spawns onto asphalt).
export function nearestRoadPoint(x, y) {
  let best = null, bd = 1e18;
  for (let i = 0; i < AVENUES; i++) {
    const d = Math.abs(x - avenueX(i));
    if (d < bd) { bd = d; best = { x: avenueX(i), y, vertical: true }; }
  }
  for (let j = 0; j < STREETS; j++) {
    const d = Math.abs(y - streetY(j));
    if (d < bd) { bd = d; best = { x, y: streetY(j), vertical: false }; }
  }
  return best;
}

const BUILDING_COLORS = ['#7a5a4a', '#5a6b7a', '#8a7a5a', '#6a5a7a', '#4a6a6a', '#9a6a4a', '#5a5a6a', '#7a6a3a'];
const ROOF_COLORS = ['#3a3f4a', '#4a3a3f', '#2f3a2f', '#3f3a2a'];

export class City {
  constructor() {
    const rng = mulberry32(20261118);
    this.buildings = [];   // {x,y,w,h,color,roof,h,windows,district,neon}
    this.trees = [];       // {x,y,r}
    this.lamps = [];       // {x,y}
    this.props = [];       // {x,y,kind} benches, crates, containers, hydrants
    this.parkingSpots = []; // {x,y,angle}
    this.landmarks = {};   // named places for missions
    for (let ci = 0; ci < AVENUES - 1; ci++) {
      for (let cj = 0; cj < STREETS - 1; cj++) {
        const bx0 = avenueX(ci) + ROAD_W / 2 + 14;
        const by0 = streetY(cj) + ROAD_W / 2 + 14;
        const bw = PITCH - ROAD_W - 28;
        const bh = PITCH - ROAD_W - 28;
        const cx = bx0 + bw / 2, cy = by0 + bh / 2;
        const d = districtAt(cx, cy);
        if (isBeach(cx, cy)) continue; // beach blocks stay open sand
        if (d.name === 'Old Port' && rng() < 0.4) {
          // dockyard: containers instead of buildings
          for (let k = 0; k < 5; k++) {
            this.props.push({ x: bx0 + 30 + rng() * (bw - 60), y: by0 + 30 + rng() * (bh - 60), kind: 'container', color: pick(rng, ['#a34a2a', '#2a6a8a', '#7a8a2a', '#8a2a4a']) });
          }
          continue;
        }
        const kind = rng();
        if (kind < 0.18) {
          // park block
          for (let k = 0; k < 6; k++) this.trees.push({ x: bx0 + 25 + rng() * (bw - 50), y: by0 + 25 + rng() * (bh - 50), r: randRange(rng, 12, 20) });
          this.props.push({ x: cx, y: cy, kind: 'fountain' });
          continue;
        }
        const n = randInt(rng, 1, 3);
        if (n === 1) {
          this.addBuilding(bx0 + 14, by0 + 14, bw - 28, bh - 28, rng, d);
        } else {
          const vertical = rng() < 0.5;
          for (let k = 0; k < n; k++) {
            if (vertical) this.addBuilding(bx0 + 10, by0 + 10 + k * (bh / n), bw - 20, bh / n - 20, rng, d);
            else this.addBuilding(bx0 + 10 + k * (bw / n), by0 + 10, bw / n - 20, bh - 20, rng, d);
          }
        }
        // trees + lamps around the block edge
        for (let k = 0; k < 3; k++) {
          this.trees.push({ x: bx0 + 8 + rng() * (bw - 16), y: by0 + 6, r: randRange(rng, 10, 15) });
        }
        this.lamps.push({ x: bx0 + 4, y: by0 + 4 });
        this.lamps.push({ x: bx0 + bw - 4, y: by0 + bh - 4 });
      }
    }
    // Parked cars along avenues, off the driving lane.
    for (let i = 0; i < AVENUES; i++) {
      for (let j = 0; j < STREETS; j++) {
        if (rng() < 0.55) {
          const vertical = rng() < 0.5;
          this.parkingSpots.push({
            x: avenueX(i) + (vertical ? 26 : 0) + (rng() - 0.5) * 40,
            y: streetY(j) + (vertical ? 0 : 26) + (rng() - 0.5) * 40,
            angle: vertical ? Math.PI / 2 : 0,
          });
        }
      }
    }
    // Named landmarks (mission anchors).
    this.landmarks = {
      garage: { x: avenueX(2), y: streetY(6) + 120, name: "Rico's Garage" },
      docks: { x: avenueX(1), y: streetY(7) + 130, name: 'Old Port Docks' },
      strip: { x: avenueX(6), y: streetY(6), name: 'Neon Strip' },
      warehouse: { x: avenueX(1), y: streetY(5) + 120, name: 'Warehouse 9' },
      marina: { x: 3400, y: streetY(3), name: 'Vice Marina' },
      beach: { x: 3480, y: streetY(5), name: 'Vice Beach' },
      plaza: { x: avenueX(5), y: streetY(3), name: 'Solmar Plaza' },
      hospital: { x: avenueX(8), y: streetY(1) + 120, name: 'Harbor General' },
    };
  }
  addBuilding(x, y, w, h, rng, d) {
    const tall = d.name === 'Downtown';
    const b = {
      x, y, w, h,
      color: pick(rng, BUILDING_COLORS),
      roof: pick(rng, ROOF_COLORS),
      height: tall ? randInt(rng, 26, 60) : randInt(rng, 8, 22),
      neon: d.name === 'Neon Strip' && rng() < 0.6,
      neonColor: pick(rng, ['#ff2a7a', '#2affd9', '#ffe14a', '#ff7a2a']),
      windows: [],
    };
    const cols = Math.max(2, Math.floor(w / 34));
    const rows = Math.max(2, Math.floor(h / 34));
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      if (rng() < 0.55) b.windows.push({ x: x + 10 + i * ((w - 20) / cols), y: y + 10 + j * ((h - 20) / rows), lit: rng() < 0.5 });
    }
    this.buildings.push(b);
  }
  // Circle vs buildings: push the circle out, return true on hit.
  collideCircle(px, py, r) {
    let x = px, y = py, hit = false;
    for (const b of this.buildings) {
      const nx = clamp(x, b.x, b.x + b.w);
      const ny = clamp(y, b.y, b.y + b.h);
      const dx = x - nx, dy = y - ny;
      const d2 = dx * dx + dy * dy;
      if (d2 < r * r) {
        hit = true;
        if (d2 > 0.01) {
          const d = Math.sqrt(d2);
          x = nx + (dx / d) * r;
          y = ny + (dy / d) * r;
        } else {
          y = b.y - r;
        }
      }
    }
    return { x, y, hit };
  }
  insideBuilding(x, y) {
    for (const b of this.buildings) if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
    return null;
  }
}
