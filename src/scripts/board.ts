// Mountain layouts for the "build the mountain" board.
// Shared by the server render (default layout) and the browser (switching and shuffling layouts).
//
// Geometry: tiles are flat-top hexes in axial coordinates (q, r). A frame holds 7 tiles (a centre and its ring),
// and frames tile the plane on the lattice a·(2,1) + b·(−1,3). A layout is written in rows of frames,
// bottom to top: row n holds frames (a, −n−a), and neighbouring rows touch. Rotating a layout by 60° keeps
// it on the lattice, which is how a climb can run upward or across the table.

export type Elev = 1 | 2 | 3 | 4;
export type Segment = [elevation: Elev, centreX: number, frames: number];

export interface Layout {
  id: string;
  name: string;
  blurb: string;
  rows: Segment[][]; // bottom row first
  rotate?: number; // multiples of 60°
}

export interface Slot {
  id: number;
  q: number;
  r: number;
  frame: number;
  x: number;
  y: number;
  e: Elev;
  kind: 'slot' | 'summit' | 'start';
  nearSummit: boolean;
}

/** Energy to enter a tile, by elevation (rulebook §6). */
export const ENTER_COST: Record<Elev, number> = { 1: 2, 2: 2, 3: 4, 4: 8 };

/** How far every START tile is from the Summit, on the shortest route over an empty board. */
export interface StartInfo { count: number; steps: number; energy: number }

/** Frames in the box (rulebook §2): 5 green, 4 teal, 3 blue, 2 white. */
export const BOX: Record<Elev, number> = { 1: 5, 2: 4, 3: 3, 4: 2 };
export const SUMMIT_NAME: Record<Elev, string> = { 1: 'Short', 2: 'Short', 3: 'Standard', 4: 'Expedition' };

/** The Summit tile artwork for a mountain whose highest frame has this elevation (in public/tiles). */
export const summitTile = (top: Elev, large = false) => `tiles/summit_${SUMMIT_NAME[top].toLowerCase()}${large ? '_large' : ''}.webp`;

export const layouts: Layout[] = [
  {
    id: 'peak',
    name: 'Classic peak',
    blurb: 'Every elevation stacked into one broad peak. Wide ground everywhere, so there is always a way round.',
    rows: [[[1, 0, 5]], [[2, 0, 4]], [[3, 0, 3]], [[4, 0, 2]]],
  },
  {
    id: 'traverse',
    name: 'The long traverse',
    blurb: 'A ridge that runs from the meadows across to the ice. Few ways round, so a single lava tile can force a detour.',
    rows: [[[1, 3, 3]], [[1, 1.5, 2]], [[2, 5, 2]], [[2, 9, 2]], [[3, 12, 2]], [[3, 15, 1]], [[4, 15, 2]]],
    rotate: 1,
  },
  {
    id: 'valleys',
    name: 'Twin valleys',
    blurb: 'Two climbers start in each valley. The valleys meet on one teal shelf below a blue Summit.',
    rows: [[[1, -7.5, 2], [1, 7.5, 2]], [[2, 0, 4]], [[3, 0, 3]]],
  },
  {
    id: 'pass',
    name: 'Winding pass',
    blurb: 'The route doubles back on itself through a teal pass only two frames wide.',
    rows: [[[1, 6, 4]], [[1, 4, 1]], [[2, 8, 2]], [[2, 3, 2]], [[3, -2, 3]], [[4, -4, 2]]],
  },
  {
    id: 'first',
    name: 'First climb',
    blurb: 'A small mountain for a first game: two elevations, the Short Summit and about 30 minutes.',
    rows: [[[1, -1.5, 3]], [[1, -4.5, 2]], [[2, 0, 2]]],
  },
];

const RING: [number, number][] = [[0, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1], [1, 0]];
const SQ3 = Math.sqrt(3);

/** Frames (a, b, elevation) for a layout. Row n holds frames (a, −n−a), whose centres sit at x = 4.5a + 1.5n (in tile radii). */
function frames(l: Layout): { a: number; b: number; e: Elev; row: number }[] {
  const out: { a: number; b: number; e: Elev; row: number }[] = [];
  l.rows.forEach((segs, n) => {
    for (const [e, cx, count] of segs) {
      let best = 0, err = Infinity;
      for (let a0 = -30; a0 <= 30; a0++) {
        const d = Math.abs(4.5 * (a0 + (count - 1) / 2) + 1.5 * n - cx);
        if (d < err) { err = d; best = a0; }
      }
      for (let i = 0; i < count; i++) {
        let a = best + i, b = -n - a;
        for (let k = 0; k < ((l.rotate ?? 0) % 6 + 6) % 6; k++) [a, b] = [-b, a + b];
        out.push({ a, b, e, row: n });
      }
    }
  });
  return out;
}

const hexDist = (q1: number, r1: number, q2: number, r2: number) =>
  (Math.abs(q1 - q2) + Math.abs(r1 - r2) + Math.abs(q1 + r1 - q2 - r2)) / 2;

/** Tile slots of a layout, with the Summit at the centre of the highest frame. */
export function slotsFor(l: Layout, S = 40, rand?: () => number): Slot[] {
  return buildBoard(l, S, rand).slots;
}

export const NEIGHBOURS: [number, number][] = [[1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1], [1, 0]];

/** Neighbouring slot ids for every slot. */
export function neighbourIds(slots: Slot[]): number[][] {
  const at = new Map(slots.map((s) => [`${s.q},${s.r}`, s.id]));
  return slots.map((s) => NEIGHBOURS.map(([dq, dr]) => at.get(`${s.q + dq},${s.r + dr}`)).filter((n): n is number => n !== undefined));
}

/**
 * Slots plus fair START tiles. Every START tile sits on the outer edge of a different green frame, and all of
 * them are exactly the same number of steps AND the same movement Energy from the Summit on the shortest route,
 * so no seat at the table starts closer to winning.
 */
export function buildBoard(l: Layout, S = 40, rand?: () => number): { slots: Slot[]; start: StartInfo } {
  const fs = frames(l);
  const top = Math.max(...fs.map((f) => f.e)) as Elev;
  const topRow = Math.max(...fs.filter((f) => f.e === top).map((f) => f.row));
  const crown = fs.filter((f) => f.e === top && f.row === topRow);
  const summitFrame = crown[Math.floor((crown.length - 1) / 2)];
  const sq = 2 * summitFrame.a - summitFrame.b, sr = summitFrame.a + 3 * summitFrame.b;

  const slots: Slot[] = [];
  fs.forEach((f, fi) => {
    const q0 = 2 * f.a - f.b, r0 = f.a + 3 * f.b;
    for (const [dq, dr] of RING) {
      const q = q0 + dq, r = r0 + dr;
      slots.push({
        id: slots.length, q, r, frame: fi,
        x: 1.5 * S * q, y: SQ3 * S * (r + q / 2), e: f.e,
        kind: q === sq && r === sr ? 'summit' : 'slot',
        nearSummit: hexDist(q, r, sq, sr) === 1,
      });
    }
  });
  const nb = neighbourIds(slots);
  const summit = slots.find((s) => s.kind === 'summit')!;

  // Shortest routes back from the Summit: Energy (entering a tile costs its elevation) and plain steps.
  const energy = slots.map(() => Infinity), steps = slots.map(() => Infinity);
  energy[summit.id] = 0;
  steps[summit.id] = 0;
  const queue = [summit.id];
  while (queue.length) {
    queue.sort((a, b) => energy[a] - energy[b]);
    const u = queue.shift()!;
    const enter = slots[u].kind === 'summit' ? 0 : ENTER_COST[slots[u].e];
    for (const v of nb[u]) {
      const d = energy[u] + enter, st = steps[u] + 1;
      if (d < energy[v] || (d === energy[v] && st < steps[v])) {
        energy[v] = d;
        steps[v] = st;
        if (!queue.includes(v)) queue.push(v);
      }
    }
  }

  // Candidates: any green slot in an outer green frame (a frame that touches the edge of the mountain),
  // grouped by (steps, Energy) to the Summit. Every START tile of a game comes from one group, each on a
  // different frame, so all seats are exactly as far from the Summit as each other.
  const outerFrame = new Set(slots.filter((s) => nb[s.id].length < 6).map((s) => s.frame));
  const groups = new Map<string, Slot[]>();
  for (const s of slots) {
    if (s.e !== 1 || s.kind !== 'slot' || !outerFrame.has(s.frame) || !isFinite(energy[s.id])) continue;
    const k = `${steps[s.id]}|${energy[s.id]}`;
    (groups.get(k) ?? groups.set(k, []).get(k)!).push(s);
  }
  const far = Math.max(0, ...[...groups.values()].flat().map((s) => energy[s.id]));
  const options: { slots: Slot[][]; seats: number; e: number }[] = [];
  for (const g of groups.values()) {
    const byFrame = new Map<number, Slot[]>();
    for (const s of g) (byFrame.get(s.frame) ?? byFrame.set(s.frame, []).get(s.frame)!).push(s);
    const e = energy[g[0].id];
    if (byFrame.size < 2 || e < far * 0.55) continue; // never start close to the Summit
    options.push({ slots: [...byFrame.values()], seats: Math.min(4, byFrame.size), e });
  }
  // As many seats as the mountain allows (up to 4). Without a random source: the farthest option, first slots.
  // With one: any fair option, any frames, any slot in them, so the starts land in different spots each time.
  const most = Math.max(0, ...options.map((o) => o.seats));
  const fair = options.filter((o) => o.seats === most).sort((x, y) => y.e - x.e);
  let best: Slot[] = [];
  const pickOf = <T,>(xs: T[]) => (rand ? xs[Math.floor(rand() * xs.length)] : xs[0]);
  // A few random tries; keep the arrangement with the most seats (START tiles never touch each other).
  for (let attempt = 0; attempt < (rand ? 40 : 1) && fair.length; attempt++) {
    const opt = rand ? fair[Math.floor(Math.pow(rand(), 1.6) * fair.length)] : fair[0]; // farther options a bit likelier
    const frames = rand ? [...opt.slots].sort(() => rand() - 0.5) : opt.slots;
    const chosen: Slot[] = [];
    for (const f of frames) {
      if (chosen.length === 4) break;
      const apart = f.filter((s) => chosen.every((o) => hexDist(s.q, s.r, o.q, o.r) >= 2));
      if (apart.length) chosen.push(pickOf(apart));
    }
    if (chosen.length > best.length) best = chosen;
    if (best.length === Math.min(4, most)) break;
  }
  for (const s of best) s.kind = 'start';
  const info: StartInfo = best.length
    ? { count: best.length, steps: steps[best[0].id], energy: energy[best[0].id] }
    : { count: 0, steps: 0, energy: 0 };
  return { slots, start: info };
}

/** A random mountain: elevations in order, each at least two frames wide, never more frames than the box holds. */
export function randomLayout(rand: () => number = Math.random): Layout {
  const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)];
  for (let attempt = 0; attempt < 200; attempt++) {
    const top = pick([4, 4, 4, 3, 3]) as Elev;
    const rows: Segment[][] = [];
    let cx = 0;
    let prev: number[] = [];
    let ok = true;
    for (let e = 1 as Elev; e <= top; e = (e + 1) as Elev) {
      let left = 2 + Math.floor(rand() * (BOX[e] - 1)); // 2 … box limit
      const twoRows = left >= 3 && rand() < 0.55;
      const sizes = twoRows ? [Math.max(2, left - 1 - Math.floor(rand() * (left - 2))), 0] : [left];
      if (twoRows) sizes[1] = left - sizes[0];
      for (const size of sizes) {
        if (size <= 0) continue;
        // Shift the row sideways: big shifts make narrow passes, as long as it still touches the row below.
        let placed = false;
        for (const shift of [pick([-6, -4.5, -3, 0, 3, 4.5, 6]), 0, 3, -3]) {
          const n = rows.length;
          const c = cx + shift;
          const xs = rowXs(n, c, size);
          if (n === 0 || xs.some((x) => prev.some((p) => Math.abs(x - p - 1.5) < 0.01 || Math.abs(x - p + 3) < 0.01))) {
            rows.push([[e, c, size]]);
            prev = xs;
            cx = c;
            placed = true;
            break;
          }
        }
        if (!placed) { ok = false; break; }
      }
      if (!ok) break;
    }
    if (ok) {
      const candidate: Layout = { id: 'random', name: '', blurb: '', rows, rotate: 0 };
      if (buildBoard(candidate).start.count < (attempt < 120 ? 4 : attempt < 170 ? 3 : 2)) continue;
      return {
        id: 'random',
        name: 'A new mountain',
        blurb: 'Shuffled from the frames in the box. Every elevation follows the one below it; the shape is up to the table.',
        rows,
        rotate: pick([0, 0, 1, 5]),
      };
    }
  }
  return layouts[0];
}

/** Centre x of each frame in row n (same snapping as frames()). */
function rowXs(n: number, cx: number, count: number): number[] {
  let best = 0, err = Infinity;
  for (let a0 = -30; a0 <= 30; a0++) {
    const d = Math.abs(4.5 * (a0 + (count - 1) / 2) + 1.5 * n - cx);
    if (d < err) { err = d; best = a0; }
  }
  return Array.from({ length: count }, (_, i) => 4.5 * (best + i) + 1.5 * n);
}

export function frameCounts(slots: Slot[]): Record<Elev, number> {
  const c: Record<Elev, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const s of slots) c[s.e] += 1 / 7;
  for (const k of [1, 2, 3, 4] as Elev[]) c[k] = Math.round(c[k]);
  return c;
}

/** ViewBox around the slots, padded out to the golden rectangle so the board never jumps in size. */
export function viewBox(slots: Slot[], S = 40): string {
  const pad = S * 1.3;
  const xs = slots.map((s) => s.x), ys = slots.map((s) => s.y);
  let x0 = Math.min(...xs) - pad, x1 = Math.max(...xs) + pad;
  let y0 = Math.min(...ys) - pad, y1 = Math.max(...ys) + pad;
  let w = x1 - x0, h = y1 - y0;
  const phi = 1.618;
  if (w / h < phi) { const nw = h * phi; x0 -= (nw - w) / 2; w = nw; }
  else { const nh = w / phi; y0 -= (nh - h) / 2; h = nh; }
  return [x0, y0, w, h].map((v) => v.toFixed(1)).join(' ');
}

const FRAME_FILL: Record<Elev, string> = { 1: 'var(--e1)', 2: 'var(--e2)', 3: 'var(--e3)', 4: 'var(--e4-face)' };

const hexPoints = (r: number) =>
  Array.from({ length: 6 }, (_, k) => `${(r * Math.cos((Math.PI / 3) * k)).toFixed(2)},${(r * Math.sin((Math.PI / 3) * k)).toFixed(2)}`).join(' ');

/** SVG markup for the frames, Summit and START tiles. Placed tiles go in a separate layer between the two. */
/** START tiles in the four player colours (public/tiles), handed out in seat order. */
export const START_TILES = ['tiles/start_1_red.webp', 'tiles/start_2_blue.webp', 'tiles/start_3_yellow.webp', 'tiles/start_4_purple.webp'];

export function frameMarkup(slots: Slot[], S = 40, base = ''): { frames: string; fixed: string } {
  const hex = hexPoints(S);
  const h = SQ3 * S;
  const tile = (src: string) => `<image href="${base}${src}" x="${-S}" y="${(-h / 2).toFixed(1)}" width="${2 * S}" height="${h.toFixed(1)}"/>`;
  const frames = slots
    .map((s) => {
      const stroke = s.e === 4 ? 'var(--line)' : FRAME_FILL[s.e];
      const hole = s.kind === 'slot' ? `<circle r="${(S * 0.56).toFixed(1)}" class="hole"/>` : '';
      return `<g class="slot e${s.e}" data-e="${s.e}" transform="translate(${s.x.toFixed(1)} ${s.y.toFixed(1)})"><polygon points="${hex}" fill="${FRAME_FILL[s.e]}" stroke="${stroke}" stroke-width="3" stroke-linejoin="round"/>${hole}</g>`;
    })
    .join('');
  let seat = 0;
  const fixed = slots
    .filter((s) => s.kind !== 'slot')
    .map((s) => {
      const t = `translate(${s.x.toFixed(1)} ${s.y.toFixed(1)})`;
      // the real Summit tile for this mountain (Short, Standard or Expedition) and the players' START tiles
      if (s.kind === 'summit') return `<g class="fixed-summit summit-tile" data-e="${s.e}" transform="${t}">${tile(summitTile(s.e))}<polygon class="summit-ring" points="${hex}"/></g>`;
      return `<g class="fixed-start start-tile" data-e="1" transform="${t}">${tile(START_TILES[seat++ % 4])}</g>`;
    })
    .join('');
  return { frames, fixed };
}
