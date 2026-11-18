// SOLMAR — Vice Harbor: the city map. A 3840x2880 grid city, 12 avenues by
// 9 streets, split into 5 districts with their own palettes and skylines.

const CITY_W = 3840;
const CITY_H = 2880;
const AVENUES = 12;          // vertical roads
const STREETS = 9;           // horizontal roads
const BLOCK = 320;           // avenue/street spacing
const ROAD_W = 68;           // road width
const SIDEWALK = 14;

function avenueX(i) { return i * BLOCK + BLOCK / 2; }
function streetY(j) { return j * BLOCK + BLOCK / 2; }

const DISTRICTS = [
  { id: 'portside', name: 'Portside', x0: 0, y0: 0, x1: 960, y1: 2880,
    ground: '#5d6b52', block: '#6d7a5e', roof: '#7d8a6e', accent: '#c98f2e',
    desc: 'Docks, cranes and warehouses on the harbor.' },
  { id: 'oldtown', name: 'Old Town', x0: 960, y0: 0, x1: 1920, y1: 1440,
    ground: '#8a7a5e', block: '#9a8a6a', roof: '#b08a5a', accent: '#a8542e',
    desc: 'Brick storefronts and the old plaza.' },
  { id: 'northhills', name: 'North Hills', x0: 1920, y0: 0, x1: 3840, y1: 1440,
    ground: '#6f7f5e', block: '#7d8f6a', roof: '#8a6a4a', accent: '#4a7a5a',
    desc: 'Quiet houses and pine trees above the bay.' },
  { id: 'downtown', name: 'Downtown', x0: 960, y0: 1440, x1: 2560, y1: 2880,
    ground: '#6a6a72', block: '#7a7a84', roof: '#4a4a58', accent: '#3aa0c8',
    desc: 'Glass towers, neon and the Vice Harbor strip.' },
  { id: 'marina', name: 'Marina Bay', x0: 2560, y0: 1440, x1: 3840, y1: 2880,
    ground: '#7a8a80', block: '#8a9a8c', roof: '#c8b890', accent: '#2e8a9a',
    desc: 'Yachts, beach bars and the boardwalk.' },
];

function districtAt(x, y) {
  for (const d of DISTRICTS) {
    if (x >= d.x0 && x < d.x1 && y >= d.y0 && y < d.y1) return d;
  }
  return DISTRICTS[3];
}

// A road's center line is at avenueX(i) / streetY(j); a point is on a road when
// it sits within ROAD_W/2 of one of those lines.
function onRoad(x, y) {
  const ax = ((x - BLOCK / 2) % BLOCK + BLOCK) % BLOCK;
  const ay = ((y - BLOCK / 2) % BLOCK + BLOCK) % BLOCK;
  const dx = Math.min(ax, BLOCK - ax);
  const dy = Math.min(ay, BLOCK - ay);
  return dx <= ROAD_W / 2 || dy <= ROAD_W / 2;
}
function nearestAvenue(x) { return clamp(Math.round((x - BLOCK / 2) / BLOCK), 0, AVENUES - 1); }
function nearestStreet(y) { return clamp(Math.round((y - BLOCK / 2) / BLOCK), 0, STREETS - 1); }

// Buildings: one deterministic set per block, generated once at load.
const BUILDINGS = [];
function buildCity() {
  const rng = mulberry32(20261119);
  BUILDINGS.length = 0;
  for (let i = 0; i < AVENUES; i++) {
    for (let j = 0; j < STREETS; j++) {
      const bx = i * BLOCK + ROAD_W / 2 + SIDEWALK;
      const by = j * BLOCK + ROAD_W / 2 + SIDEWALK;
      const bw = BLOCK - ROAD_W - SIDEWALK * 2;
      const bh = BLOCK - ROAD_W - SIDEWALK * 2;
      const cx = bx + bw / 2, cy = by + bh / 2;
      const d = districtAt(cx, cy);
      const isPark = rng() < 0.12;
      if (isPark) {
        BUILDINGS.push({ x: bx, y: by, w: bw, h: bh, kind: 'park', d });
        continue;
      }
      const downtown = d.id === 'downtown';
      const n = downtown ? (rng() < 0.5 ? 1 : 2) : randInt(2, 4);
      for (let k = 0; k < n; k++) {
        const w = downtown ? rand(90, 150) : rand(60, 110);
        const h = downtown ? rand(90, 150) : rand(60, 110);
        const px = bx + rng() * (bw - w);
        const py = by + rng() * (bh - h);
        const tall = downtown && rng() < 0.55;
        BUILDINGS.push({
          x: px, y: py, w, h,
          kind: tall ? 'tower' : (rng() < 0.3 ? 'shop' : 'house'),
          d, floors: tall ? randInt(8, 22) : randInt(1, 3),
          hue: rng(),
        });
      }
    }
  }
}

// Circle-vs-building collision: push the circle out, return true on hit.
function collideBuildings(x, y, r) {
  let hit = false;
  for (const b of BUILDINGS) {
    if (b.kind === 'park') continue;
    const nx = clamp(x, b.x, b.x + b.w);
    const ny = clamp(y, b.y, b.y + b.h);
    const dx = x - nx, dy = y - ny;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      hit = true;
      const d = Math.sqrt(d2) || 0.01;
      const push = (r - d) / d;
      x += dx * push; y += dy * push;
    }
  }
  return { x, y, hit };
}

// The harbor: water along the west edge and the south-east marina.
function inWater(x, y) {
  if (x < 90) return true;
  if (x > 3600 && y > 2500) return true;
  return false;
}

function randomRoadPoint() {
  if (chance(0.5)) return { x: avenueX(randInt(0, AVENUES - 1)), y: rand(80, CITY_H - 80) };
  return { x: rand(80, CITY_W - 80), y: streetY(randInt(0, STREETS - 1)) };
}
function randomSidewalkPoint() {
  const p = randomRoadPoint();
  return { x: clamp(p.x + rand(-70, 70), 40, CITY_W - 40), y: clamp(p.y + rand(-70, 70), 40, CITY_H - 40) };
}
