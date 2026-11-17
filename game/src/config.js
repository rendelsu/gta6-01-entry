// Solmar — shared tuning, palette and constants.
// One place for every number the rest of the game balances against.
export const WORLD_W = 2560;
export const WORLD_H = 2560;
export const ROAD_SPACING = 320;
export const ROAD_WIDTH = 72;
export const SIDEWALK = 26;
export const LANE = 18; // distance from road centre line to a lane centre
export const ROAD_XS = [160, 480, 800, 1120, 1440, 1760, 2080, 2400];
export const ROAD_YS = [160, 480, 800, 1120, 1440, 1760, 2080, 2400];

export const DT = 1 / 60; // fixed simulation step, decoupled from rendering
export const VIEW_W = 1280;
export const VIEW_H = 720;

export const PLAYER_WALK = 175;
export const PLAYER_RUN = 265;
export const PLAYER_RADIUS = 13;

export const CAR_LENGTH = 52;
export const CAR_WIDTH = 26;
export const CAR_MAX_SPEED = 540;
export const CAR_ACCEL = 420;
export const CAR_BRAKE = 620;
export const CAR_DRAG = 0.55;
export const CAR_STEER = 2.6;

export const MAX_WANTED = 5;
export const BULLET_SPEED = 900;
export const PISTOL_DAMAGE = 34;

export const SAVE_KEY = 'solmar-save-v1';
export const GAME_TITLE = 'SOLMAR';
export const GAME_SUBTITLE = 'Vice Harbor';
// Where Danny starts and respawns: the pavement in front of the garage,
// not inside the building.
export const PLAYER_SPAWN = { x: 640, y: 745 };
export const GARAGE_DOOR = { x: 640, y: 745 };

// Golden-hour, sun-soaked palette. Every colour in the game comes from here.
export const PAL = {
  grass: '#8fae62',
  grassDark: '#7d9c54',
  parkGrass: '#79a85c',
  sand: '#e8cf9a',
  sandWet: '#d9bd85',
  water: '#2e8fa8',
  waterDeep: '#1f6f8c',
  asphalt: '#3d4149',
  asphaltDark: '#34383f',
  sidewalk: '#c8bda1',
  sidewalkLine: '#b3a887',
  laneDash: '#e8d878',
  curb: '#9a8f78',
  buildingRoof: ['#e8a87c', '#d98880', '#a8c8b8', '#e8c87c', '#b8a8d8', '#f0e0c0', '#98b8d8', '#d8a0a8'],
  buildingWall: ['#c98a64', '#b87068', '#88a898', '#c8a860', '#9888b8', '#d0c0a0', '#7898b8', '#b88088'],
  windowLit: '#ffe9a8',
  windowDark: '#4a5568',
  plaza: '#b8a888',
  tree: '#4a7c3a',
  treeLight: '#5d9448',
  carColors: ['#c0392b', '#2e86c1', '#f1c40f', '#e67e22', '#7d3c98', '#1abc9c', '#ecf0f1', '#2c3e50', '#e84393', '#00cec9'],
  policeWhite: '#f4f6f7',
  policeBlue: '#1f4e9c',
  taxiYellow: '#f7c948',
};

export const CAR_MODELS = [
  { name: 'Comet', top: 560, accel: 460, grip: 2.9, color: '#c0392b' },
  { name: 'Sedan', top: 470, accel: 380, grip: 2.4, color: '#2e86c1' },
  { name: 'Taxi', top: 480, accel: 390, grip: 2.5, color: '#f7c948' },
  { name: 'Van', top: 400, accel: 320, grip: 2.1, color: '#ecf0f1' },
  { name: 'Muscle', top: 540, accel: 440, grip: 2.6, color: '#e67e22' },
  { name: 'Coupe', top: 520, accel: 430, grip: 2.7, color: '#7d3c98' },
  { name: 'Pickup', top: 450, accel: 360, grip: 2.3, color: '#1abc9c' },
  { name: 'Police', top: 580, accel: 500, grip: 3.1, color: '#f4f6f7' },
];

export const PED_NAMES = ['Maya', 'Tomas', 'Lena', 'Rico', 'Ana', 'Diego', 'Sofia', 'Marco', 'Luz', 'Paco', 'Nina', 'Omar'];
export const PED_SHIRTS = ['#e74c3c', '#3498db', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22', '#ecf0f1', '#2ecc71', '#fd79a8', '#00cec9'];

// Fixed landmarks, so missions, the minimap and the save file all agree.
export const LANDMARKS = {
  garage: { x: 640, y: 640, name: "Mama Lou's Garage" },
  docks: { x: 2460, y: 1120, name: 'Solmar Docks' },
  marina: { x: 2460, y: 1760, name: 'Marina Bay' },
  plaza: { x: 960, y: 960, name: 'Plaza del Sol' },
  market: { x: 1280, y: 640, name: 'Mercado Viejo' },
  cityHall: { x: 1600, y: 1600, name: 'City Hall' },
  beach: { x: 1280, y: 2430, name: 'Playa Solmar' },
  safehouse: { x: 640, y: 640, name: 'Safehouse' },
};

export const HIDDEN_PACKAGES = [
  { x: 300, y: 300 }, { x: 2280, y: 300 }, { x: 300, y: 2280 }, { x: 2280, y: 2280 },
  { x: 960, y: 300 }, { x: 1600, y: 2280 }, { x: 300, y: 1600 }, { x: 2280, y: 1600 },
];
