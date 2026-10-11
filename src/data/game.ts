// Game data for the website. Sources: Magic_Mountain_Rulebook.pdf and Final Design/README.md.
// When the rulebook changes, update the numbers here — every section of the page reads from this file.

import tileDesigns from './tiles.json';

export type Gear = 'axe' | 'rope' | 'boots' | 'crampons' | 'tent' | 'helmet' | 'boat' | 'camera';
export type Elevation = 1 | 2 | 3 | 4;

export const PHI = 1.618;

export const facts = {
  players: '2–4 players',
  age: 'Ages 10+',
  time: '45–60 minutes',
};

export const elevations: {
  level: Elevation;
  frame: string;
  cost: number;
  terrain: string;
}[] = [
  { level: 4, frame: 'White', cost: 8, terrain: 'Ice walls and ice fields. Crampons and Helmet country.' },
  { level: 3, frame: 'Blue', cost: 4, terrain: 'Snowfields, icy rock, ridges and deep water. The Tent comes out.' },
  { level: 2, frame: 'Teal', cost: 2, terrain: 'Snow, slopes and rock. Boots first, then Rope and Axe.' },
  { level: 1, frame: 'Green', cost: 2, terrain: 'Meadows and streams. Three in four tiles need no gear at all.' },
];

/** Terrain tile masters. `copies` and `file` match the Final Design export. */
export interface Terrain {
  id: string;
  elevation: Elevation;
  name: string;
  copies: number;
  viewpoint: number; // extra copies carrying the camera icon
  gear: Gear[] | 'lava';
}

const t = (elevation: Elevation, id: string, name: string, copies: number, viewpoint: number, gear: Gear[] | 'lava'): Terrain =>
  ({ id, elevation, name, copies, viewpoint, gear });

export const terrain: Terrain[] = [
  t(1, 'clear-meadow', 'Clear meadow', 13, 1, []),
  t(1, 'clear-stream', 'Clear stream', 11, 1, []),
  t(1, 'water', 'Water', 6, 1, ['boat']),
  t(1, 'lava', 'Lava', 2, 0, 'lava'),
  t(2, 'snow', 'Snow', 10, 1, ['boots']),
  t(2, 'snow-slope', 'Snow slope', 5, 0, ['rope', 'boots']),
  t(2, 'rock', 'Rock', 4, 1, ['axe', 'rope']),
  t(2, 'clear', 'Clear ground', 4, 0, []),
  t(2, 'water', 'Water', 5, 0, ['boat']),
  t(2, 'snowy-rock', 'Snowy rock', 2, 1, ['axe', 'rope', 'boots']),
  t(2, 'lava', 'Lava', 2, 0, 'lava'),
  t(3, 'snowfield', 'Snowfield', 8, 0, ['rope', 'boots', 'tent']),
  t(3, 'icy-rock', 'Icy rock', 5, 1, ['axe', 'rope', 'boots', 'tent']),
  t(3, 'ridge', 'Ridge', 5, 0, ['axe', 'rope', 'boots']),
  t(3, 'deep-water', 'Deep water', 3, 1, ['boat']),
  t(3, 'snow-shore', 'Snow shore', 3, 0, ['boots', 'tent', 'boat']),
  t(3, 'icy-shore', 'Icy shore', 3, 0, ['rope', 'boots', 'boat']),
  t(3, 'snow-patch', 'Snow patch', 3, 0, ['boots', 'tent']),
  t(3, 'lava', 'Lava', 3, 0, 'lava'),
  t(4, 'ice-wall', 'Ice wall', 17, 1, ['axe', 'rope', 'crampons', 'tent', 'helmet']),
  t(4, 'ice-field', 'Ice field', 9, 0, ['rope', 'crampons', 'tent', 'helmet']),
  t(4, 'water', 'Water', 4, 1, ['boat']),
  t(4, 'lava', 'Lava', 3, 0, 'lava'),
];

/** Every printed tile design (artwork + symbols), from Final Design/Tiles; generated into tiles.json. */
export interface TileDesign { src: string; copies: number; viewpoint: boolean }
export const designsOf = (x: Terrain): TileDesign[] => (tileDesigns as Record<string, TileDesign[]>)[`${x.elevation}:${x.id}`] ?? [];

/** One design of a terrain: `pick` chooses among its artworks (wraps around), `viewpoint` the camera version. */
export const tileSrc = (x: Terrain, viewpoint = false, pick = 0) => {
  const all = designsOf(x);
  const pool = all.filter((d) => d.viewpoint === viewpoint);
  const list = pool.length ? pool : all;
  return list[((pick % list.length) + list.length) % list.length].src;
};

/** START tiles in the four player colours. */
export const startTiles = ['tiles/start_1_red.webp', 'tiles/start_2_blue.webp', 'tiles/start_3_yellow.webp', 'tiles/start_4_purple.webp'];

export const gear: { id: Gear; name: string; cost: number; text: string }[] = [
  { id: 'boots', name: 'Snow Boots', cost: 2, text: 'Snow and mixed ground on Elevations 1 to 3. The item the mountain asks for most.' },
  { id: 'camera', name: 'Camera', cost: 2, text: 'Optional. Photograph a viewpoint for a Golden Ticket.' },
  { id: 'rope', name: 'Rope', cost: 3, text: 'Slopes, ice and ridges. Required for every Summit.' },
  { id: 'axe', name: 'Ice Axe', cost: 3, text: 'Cuts steps in rock and hard ice. Often you can route around it.' },
  { id: 'tent', name: 'Tent', cost: 4, text: 'Shelter from Elevation 3 upward.' },
  { id: 'crampons', name: 'Crampons', cost: 5, text: 'Ice at Elevation 4 and the Expedition Summit. They replace the Snow Boots on the ice.' },
  { id: 'boat', name: 'Boat', cost: 6, text: 'Open water at any elevation. Never needed for a Summit.' },
  { id: 'helmet', name: 'Helmet', cost: 6, text: 'Elevation 4 and the Expedition Summit.' },
];

export const gearName = Object.fromEntries(gear.map((g) => [g.id, g.name])) as Record<Gear, string>;

export const mountains = [
  {
    name: 'Short',
    frame: 2 as Elevation,
    summit: 6,
    gear: ['axe', 'rope', 'boots'] as Gear[],
    note: 'The first climb. Teaches every rule in about 30 minutes with four pieces of gear.',
    budget: { movement: 12, food: 14, equipment: 8, terrain: 6, summit: 6 },
  },
  {
    name: 'Standard',
    frame: 3 as Elevation,
    summit: 8,
    gear: ['axe', 'rope', 'boots', 'tent'] as Gear[],
    note: 'The full game. Snowfields, ridges and the Tent come into play.',
    budget: { movement: 22, food: 20, equipment: 12, terrain: 10, summit: 8 },
  },
  {
    name: 'Expedition',
    frame: 4 as Elevation,
    summit: 10,
    gear: ['axe', 'rope', 'crampons', 'tent', 'helmet'] as Gear[],
    note: 'The longest route, up to the white frames. Ice walls and the Helmet come into play.',
    budget: { movement: 36, food: 28, equipment: 18, terrain: 14, summit: 10 },
  },
];

export const budgetKeys = [
  { key: 'movement', label: 'Movement', color: '#0E83A6' },
  { key: 'food', label: 'Food', color: '#7CA236' },
  { key: 'equipment', label: 'Equipment', color: '#4A55A0' },
  { key: 'terrain', label: 'Terrain', color: '#C4552B' },
  { key: 'summit', label: 'Summit', color: '#D49A1E' },
] as const;

export const goldenTickets = [
  { name: 'Helicopter Lift', text: 'Fly to any tile of Elevation 2 or lower, ignoring cost and gear.' },
  { name: 'Sponsor’s Gift', text: 'Take any one equipment card for free.' },
  { name: 'Sherpa’s Blessing', text: 'Your next move uphill costs half energy.' },
  { name: 'Weather Charm', text: 'Ignore today’s Day card for the whole round.' },
  { name: 'Cartographer’s Map', text: 'Look at four tiles from a bag and place two for free.' },
  { name: 'Hidden Energy Cache', text: 'Gain 6 Energy this turn.' },
  { name: 'Master Negotiator', text: 'Force one food trade with any player.' },
  { name: 'Expedition Backpack', text: 'Keep four provisions in play instead of three.' },
  { name: 'Guardian Spirit', text: 'Cancel any negative effect aimed at you.' },
  { name: 'Summit Permit', text: 'Step onto the Summit with one item fewer.' },
];

export const components = [
  ['Terrain tiles, sculpted in relief', '140', '35 per elevation in 69 designs, 10 of them viewpoints'],
  ['Frame hexagons', '14', '5 green, 4 teal, 3 blue, 2 white; 7 tiles each'],
  ['Summit and START tiles', '3 + 4', 'One Summit per mountain length; START tiles in four player colours'],
  ['Draw bags', '4', 'Colour-matched to the frames'],
  ['Food cards', '50', '18 provisions, 32 rations'],
  ['Day cards', '40', 'Weather and events'],
  ['Golden Tickets', '10', 'One of each'],
  ['Base Camp cards', '4', 'One per player: +4 Energy every turn'],
  ['Equipment pieces, 3D printed', '8 × 4', 'Boots, Crampons, Rope, Axe, Tent, Boat, Helmet, Camera; one of each per player'],
  ['Climbers, markers, dice', '4 + 10 + 2', ''],
];

export const contact = {
  email: 'magicmountain@gmail.com',
  designer: 'Christian Corral Burau',
};
