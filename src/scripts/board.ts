// Mountain layouts for the "build the mountain" board.
// Shared by the server render (default layout) and the browser (switching and shuffling layouts).
//
// Geometry: tiles are flat-top hexes in axial coordinates (q, r). A frame holds 7 tiles (a centre and its ring),
// and frames tile the plane on the lattice a·(2,1) + b·(−1,3). A layout is written in rows of frames,
// bottom to top: row n holds frames (a, −n−a), and neighbouring rows touch. Rotating a layout by 60° keeps
// it on the lattice, which is how a climb can run upward or across the table.

export type Elev = 1 | 2 | 3 | 4;
export type Segment = [elevation: Elev, centreX: number, frames: number];
/** One frame on the lattice: position (a, b) and its elevation. */
export type FrameSpec = [a: number, b: number, elevation: Elev];

export interface Layout {
  id: string;
  name: string;
  blurb: string;
  rows?: Segment[][]; // bottom row first
  rotate?: number; // multiples of 60°
  frames?: FrameSpec[]; // a mountain built frame by frame (Build your own, shared links); used instead of rows
  summit?: [q: number, r: number]; // the Summit slot chosen by the builder; must be in a highest frame, else placed automatically
  by?: string; // who built it, for shared mountains
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

/**
 * The climb every START tile faces, on an empty board. Tiles are drawn from the bag of each elevation, so the
 * elevations a route crosses decide which terrain and gear a climber meets; two seats are only equal when they
 * are the same steps away, cross the same elevations and need the same Energy.
 */
export interface StartInfo {
  count: number;
  steps: number; // fewest tiles to the Summit
  energy: number; // cheapest movement Energy to the Summit's edge
  mix: [number, number, number, number]; // slots of each elevation on that route (green, teal, blue, white)
  width: number; // fewest slots any step of the shortest routes can use: 1 = single file, one lava tile blocks it
  equalWidth: boolean; // every seat is as easy to block as the others
  same: boolean; // false: the mountain only allows equal distance, not the same climb
}

/** Frames in the box (rulebook §2): 5 green, 4 teal, 3 blue, 2 white. */
export const BOX: Record<Elev, number> = { 1: 5, 2: 4, 3: 3, 4: 2 };
export const SUMMIT_NAME: Record<Elev, string> = { 1: 'Short', 2: 'Short', 3: 'Standard', 4: 'Expedition' };

/** The Summit tile artwork for a mountain whose highest frame has this elevation (in public/tiles). */
export const summitTile = (top: Elev, large = false) => `tiles/summit_${SUMMIT_NAME[top].toLowerCase()}${large ? '_large' : ''}.webp`;

export const layouts: Layout[] = [
  {
    id: 'peak',
    name: 'Classic peak',
    blurb: 'A broad peak with a white spire. Wide below, narrow at the top.',
    rows: [[[1, 0, 5]], [[2, 0, 4]], [[3, 1.5, 3]], [[4, -3, 1]], [[4, -3, 1]]],
  },
  {
    id: 'traverse',
    name: 'The long traverse',
    blurb: 'One long ridge from meadow to ice. A single lava tile can force a detour.',
    rows: [[[1, 3, 3]], [[1, 1.5, 2]], [[2, 5, 2]], [[2, 9, 2]], [[3, 12, 2]], [[3, 15, 1]], [[4, 15, 2]]],
    rotate: 1,
  },
  {
    id: 'valleys',
    name: 'Twin valleys',
    blurb: 'Two valleys, two climbers in each. They meet below a blue Summit.',
    rows: [[[1, -7.5, 2], [1, 7.5, 2]], [[2, 0, 4]], [[3, 0, 3]]],
  },
  {
    id: 'pass',
    name: 'Winding pass',
    blurb: 'A switchback through a pass two frames wide.',
    rows: [[[1, 6, 4]], [[1, 4, 1]], [[2, 8, 2]], [[2, 3, 2]], [[3, -2, 3]], [[4, -4, 1]], [[4, -4, 1]]],
  },
  {
    id: 'first',
    name: 'First climb',
    blurb: 'Two elevations, about 30 minutes. Start here.',
    rows: [[[1, 0, 3]], [[1, 0, 2]], [[2, -4.5, 1]], [[2, -3, 1]]],
  },
];

const RING: [number, number][] = [[0, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1], [1, 0]];
const SQ3 = Math.sqrt(3);

/** Frames (a, b, elevation) for a layout. Row n holds frames (a, −n−a), whose centres sit at x = 4.5a + 1.5n (in tile radii). */
function frames(l: Layout): { a: number; b: number; e: Elev; row: number }[] {
  if (l.frames) return l.frames.map(([a, b, e]) => ({ a, b, e, row: 0 }));
  const out: { a: number; b: number; e: Elev; row: number }[] = [];
  (l.rows ?? []).forEach((segs, n) => {
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

/** The six frames around a frame, as (a, b) offsets on the lattice. */
export const FRAME_NEIGHBOURS: [number, number][] = [[1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]];

/** The frames of a layout as [a, b, elevation], to edit one of ours or share it. */
export const framesOf = (l: Layout): FrameSpec[] => frames(l).map((f) => [f.a, f.b, f.e]);

/**
 * Where the Summit can go: for row layouts the middle of the top row; for a mountain built frame by frame any of the
 * highest frames, most surrounded by high ground first (buildBoard keeps the one that seats players most fairly).
 */
function summitFrames(l: Layout, fs: { a: number; b: number; e: Elev; row: number }[]): [number, number][] {
  const top = Math.max(...fs.map((f) => f.e)) as Elev;
  const centre = (f: { a: number; b: number }): [number, number] => [2 * f.a - f.b, f.a + 3 * f.b];
  if (l.summit && summitAllowed(fs, l.summit)) return [l.summit];
  if (!l.frames) {
    const topRow = Math.max(...fs.filter((f) => f.e === top).map((f) => f.row));
    const crown = fs.filter((f) => f.e === top && f.row === topRow);
    return [centre(crown[Math.floor((crown.length - 1) / 2)])];
  }
  const at = new Map(fs.map((f) => [`${f.a},${f.b}`, f.e as number]));
  const score = (f: { a: number; b: number }) => FRAME_NEIGHBOURS.reduce((t, [da, db]) => t + (at.get(`${f.a + da},${f.b + db}`) ?? 0), 0);
  return fs.filter((f) => f.e === top).sort((x, y) => score(y) - score(x) || Math.abs(x.a) + Math.abs(x.b) - Math.abs(y.a) - Math.abs(y.b)).map(centre);
}

/** Rulebook §2: the Summit tile goes in the highest frame of the layout (any of its seven slots). */
function summitAllowed(fs: { a: number; b: number; e: Elev }[], [q, r]: [number, number]): boolean {
  const top = Math.max(...fs.map((f) => f.e));
  return fs.some((f) => f.e === top && RING.some(([dq, dr]) => 2 * f.a - f.b + dq === q && f.a + 3 * f.b + dr === r));
}

/** Whether a Summit can go on slot (q, r) of this mountain. */
export const canHoldSummit = (fs: FrameSpec[], at: [number, number]) => summitAllowed(fs.map(([a, b, e]) => ({ a, b, e })), at);

/**
 * Slots plus fair START tiles. Every START tile sits on the outer edge of a different green frame, and every seat
 * faces the same climb: the same number of steps to the Summit, the same elevations on the way (so the same bags,
 * terrain and gear) and the same Energy. Seats that are equally easy to block (route width) are preferred.
 * This is the rule the balance simulator uses (Simulator/mmsim/mountain.py, route_profile).
 */
export function buildBoard(l: Layout, S = 40, rand?: () => number): { slots: Slot[]; start: StartInfo } {
  const fs = frames(l);
  const rank = (st: StartInfo) => st.count * 4 + (st.same ? 2 : 0) + (st.equalWidth ? 1 : 0);
  let best: { slots: Slot[]; start: StartInfo } | undefined;
  for (const top of summitFrames(l, fs)) {
    const board = seatBoard(fs, top, S, rand);
    if (!best || rank(board.start) > rank(best.start)) best = board;
  }
  return best!;
}

function seatBoard(fs: { a: number; b: number; e: Elev; row: number }[], [sq, sr]: [number, number], S: number, rand?: () => number): { slots: Slot[]; start: StartInfo } {

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
  const cost = (id: number) => (id === summit.id ? 0 : ENTER_COST[slots[id].e]);

  // Fewest steps back from the Summit.
  const steps = slots.map(() => Infinity);
  steps[summit.id] = 0;
  for (const queue = [summit.id]; queue.length;) {
    const u = queue.shift()!;
    for (const v of nb[u]) if (steps[v] === Infinity) { steps[v] = steps[u] + 1; queue.push(v); }
  }

  // Cheapest Energy back from the Summit (entering a tile costs its elevation; the Summit step is the same for all).
  const energy = slots.map(() => Infinity);
  energy[summit.id] = 0;
  for (const queue = [summit.id]; queue.length;) {
    queue.sort((a, b) => energy[a] - energy[b]);
    const u = queue.shift()!;
    for (const v of nb[u]) {
      const d = energy[u] + cost(u);
      if (d < energy[v]) { energy[v] = d; if (!queue.includes(v)) queue.push(v); }
    }
  }

  // Elevation mix of the route: among the fewest-step routes, the cheapest; on a tie, the one with more low ground.
  type Mix = [number, number, number, number];
  const route: { e: number; mix: Mix }[] = slots.map(() => ({ e: Infinity, mix: [0, 0, 0, 0] }));
  route[summit.id] = { e: 0, mix: [0, 0, 0, 0] };
  const outward = slots.map((s) => s.id).filter((id) => isFinite(steps[id])).sort((a, b) => steps[a] - steps[b]);
  for (const u of outward) {
    if (u === summit.id) continue;
    for (const v of nb[u]) {
      if (steps[v] !== steps[u] - 1) continue;
      const mix = [...route[v].mix] as Mix;
      if (v !== summit.id) mix[slots[v].e - 1]++;
      const e = route[v].e + cost(v);
      const cur = route[u];
      const better = e < cur.e || (e === cur.e && (mix[0] - cur.mix[0] || mix[1] - cur.mix[1] || mix[2] - cur.mix[2]) > 0);
      if (better) route[u] = { e, mix };
    }
  }
  // Route width: the narrowest step of all the fewest-step routes. 1 means one lava tile can block the way.
  const width = (src: number) => {
    let front = [src], w = Infinity;
    const seen = new Set(front);
    while (front.length) {
      const next: number[] = [];
      for (const u of front) for (const v of nb[u]) if (steps[v] === steps[u] - 1 && v !== summit.id && !seen.has(v)) { seen.add(v); next.push(v); }
      if (next.length) w = Math.min(w, next.length);
      front = next;
    }
    return isFinite(w) ? w : 0;
  };

  // Candidates: green slots on outer green frames (rulebook §2: "a slot on an outer frame, each player on a
  // different frame"), grouped by the climb.
  const outerFrame = new Set(slots.filter((s) => nb[s.id].length < 6).map((s) => s.frame));
  const candidates = slots.filter((s) => s.e === 1 && s.kind === 'slot' && outerFrame.has(s.frame) && isFinite(steps[s.id]));
  const far = Math.max(0, ...candidates.map((s) => energy[s.id]));
  const pickOf = <T,>(xs: T[]) => (rand ? xs[Math.floor(rand() * xs.length)] : xs[0]);

  type Choice = { slots: Slot[]; equalWidth: boolean; spread: number };
  /** Up to four seats from one group: different frames, never touching, spread out, equally wide routes if possible. */
  const seat = (group: Slot[]): Choice => {
    const byFrame = new Map<number, Slot[]>();
    for (const s of group) (byFrame.get(s.frame) ?? byFrame.set(s.frame, []).get(s.frame)!).push(s);
    let best: Choice = { slots: [], equalWidth: false, spread: 0 };
    for (let attempt = 0; attempt < (rand ? 40 : 1); attempt++) {
      const order = rand ? [...byFrame.values()].sort(() => rand() - 0.5) : [...byFrame.values()];
      const chosen: Slot[] = [];
      for (const f of order) {
        if (chosen.length === 4) break;
        const apart = f.filter((s) => chosen.every((o) => hexDist(s.q, s.r, o.q, o.r) >= 2));
        if (!apart.length) continue;
        // keep the route width of the first seat when the frame allows it
        const same = chosen.length ? apart.filter((s) => width(s.id) === width(chosen[0].id)) : apart;
        chosen.push(pickOf(same.length ? same : apart));
      }
      const equalWidth = new Set(chosen.map((s) => width(s.id))).size <= 1;
      const spread = chosen.length > 1 ? Math.min(...chosen.flatMap((a, i) => chosen.slice(i + 1).map((b) => hexDist(a.q, a.r, b.q, b.r)))) : 0;
      const better = chosen.length - best.slots.length || +equalWidth - +best.equalWidth || Math.min(spread, 6) - Math.min(best.spread, 6);
      if (better > 0) best = { slots: chosen, equalWidth, spread };
      if (best.slots.length === Math.min(4, byFrame.size) && best.equalWidth && best.spread >= 6) break;
    }
    return best;
  };

  /** Group candidates by `key`, seat each group, and keep the best: most seats, equal width, longer climb (with some chance). */
  const choose = (key: (s: Slot) => string) => {
    const groups = new Map<string, Slot[]>();
    for (const s of candidates) {
      if (energy[s.id] < far * 0.55) continue; // never start close to the Summit
      const k = key(s);
      (groups.get(k) ?? groups.set(k, []).get(k)!).push(s);
    }
    const options = [...groups.values()].map(seat).filter((c) => c.slots.length >= 2);
    const most = Math.max(0, ...options.map((c) => c.slots.length));
    const fair = options
      .filter((c) => c.slots.length === most)
      .sort((x, y) => +y.equalWidth - +x.equalWidth || energy[y.slots[0].id] - energy[x.slots[0].id]);
    const top = fair.filter((c) => c.equalWidth === fair[0]?.equalWidth);
    return rand ? top[Math.floor(Math.pow(rand(), 1.6) * top.length)] : top[0]; // farther options a bit likelier
  };

  // The same climb for every seat; if the mountain can't give that to two or more seats, at least the same distance.
  const sameClimb = (s: Slot) => `${steps[s.id]}|${route[s.id].mix.join(',')}|${energy[s.id]}`;
  let pick = choose(sameClimb);
  const strictSeats = pick?.slots.length ?? 0;
  const loose = strictSeats < 4 ? choose((s) => `${steps[s.id]}|${energy[s.id]}`) : undefined;
  const same = !(loose && loose.slots.length > strictSeats);
  if (!same) pick = loose;

  const best = pick?.slots ?? [];
  for (const s of best) s.kind = 'start';
  const first = best[0];
  const info: StartInfo = first
    ? { count: best.length, steps: steps[first.id], energy: energy[first.id], mix: route[first.id].mix, width: width(first.id), equalWidth: pick!.equalWidth, same }
    : { count: 0, steps: 0, energy: 0, mix: [0, 0, 0, 0], width: 0, equalWidth: true, same: true };
  return { slots, start: info };
}

/** One line for the page: how far every seat is and what it climbs through. */
export function describeStart(st: StartInfo): string {
  if (!st.count) return 'No fair start yet. Add green frames at the foot.';
  const names = ['green', 'teal', 'blue', 'white'];
  const mix = st.mix.map((n, i) => (n ? `${n} ${names[i]}` : '')).filter(Boolean).join(', ');
  const block = st.equalWidth ? '' : ' Some routes are easier to block.';
  return st.same
    ? `Fair for ${st.count} players: every seat climbs ${st.steps} steps (${mix}), ${st.energy} Energy.${block}`
    : `${st.count} seats at equal distance, but not the same climb. Move a green frame to fix it.`;
}

/**
 * What stops a mountain built frame by frame from being played. The rulebook has no connection rules,
 * so only the box limits it: frames it holds, a green frame to start on, and frames that clip together.
 */
export function layoutIssues(fs: FrameSpec[]): string[] {
  const errors: string[] = [];
  const names = ['green', 'teal', 'blue', 'white'];
  if (!fs.length) return ['Place a green frame to start.'];
  const count = [0, 0, 0, 0];
  for (const [, , e] of fs) count[e - 1]++;
  ([1, 2, 3, 4] as Elev[]).forEach((e) => { if (count[e - 1] > BOX[e]) errors.push(`The box has ${BOX[e]} ${names[e - 1]} frames; this uses ${count[e - 1]}.`); });
  if (!count[0]) errors.push('Climbers start on green frames: add at least one.');
  const at = new Map(fs.map(([a, b, e]) => [`${a},${b}`, e]));
  const seen = new Set([`${fs[0][0]},${fs[0][1]}`]);
  for (const queue = [fs[0]]; queue.length;) {
    const [a, b] = queue.shift()!;
    for (const [da, db] of FRAME_NEIGHBOURS) {
      const k = `${a + da},${b + db}`;
      if (at.has(k) && !seen.has(k)) { seen.add(k); queue.push([a + da, b + db, at.get(k)!]); }
    }
  }
  if (seen.size < fs.length) errors.push('Every frame must touch the rest of the mountain.');
  return errors;
}

/** Share a mountain in a link: "e.a.b" per frame, frames joined by "_", and "s.q.r" for a chosen Summit. */
export const encodeFrames = (fs: FrameSpec[], summit?: [number, number]) =>
  [...fs.map(([a, b, e]) => `${e}.${a}.${b}`), ...(summit ? [`s.${summit[0]}.${summit[1]}`] : [])].join('_');
export function decodeMountain(text: string): { frames: FrameSpec[]; summit?: [number, number] } | undefined {
  const out: FrameSpec[] = [];
  let summit: [number, number] | undefined;
  for (const part of text.split('_')) {
    const s = /^s\.(-?\d{1,3})\.(-?\d{1,3})$/.exec(part);
    if (s) { summit = [Number(s[1]), Number(s[2])]; continue; }
    const m = /^([1-4])\.(-?\d{1,2})\.(-?\d{1,2})$/.exec(part);
    if (!m) return undefined;
    out.push([Number(m[2]), Number(m[3]), Number(m[1]) as Elev]);
  }
  const keys = new Set(out.map(([a, b]) => `${a},${b}`));
  if (!out.length || out.length > 14 || keys.size !== out.length) return undefined;
  return { frames: out, summit: summit && canHoldSummit(out, summit) ? summit : undefined };
}
export const decodeFrames = (text: string) => decodeMountain(text)?.frames;

/** Empty lattice positions next to the mountain, where a frame can go (Build your own). */
export function openFrames(fs: FrameSpec[]): [number, number][] {
  const at = new Set(fs.map(([a, b]) => `${a},${b}`));
  const out = new Map<string, [number, number]>();
  for (const [a, b] of fs) for (const [da, db] of FRAME_NEIGHBOURS) {
    const k = `${a + da},${b + db}`;
    if (!at.has(k)) out.set(k, [a + da, b + db]);
  }
  return fs.length ? [...out.values()] : [[0, 0]];
}

/** SVG for empty frame positions: seven dashed hexes per frame. */
export function ghostMarkup(spots: [number, number][], S = 40): string {
  const hex = hexPoints(S * 0.94);
  return spots.map(([a, b]) => {
    const cells = frameCells(a, b, S);
    const polys = cells.map((c) => `<polygon points="${hex}" transform="translate(${c.x.toFixed(1)} ${c.y.toFixed(1)})"/>`).join('');
    return `<g class="spot" data-a="${a}" data-b="${b}" role="button" tabindex="0" aria-label="Add a frame here">${polys}<text x="${cells[0].x.toFixed(1)}" y="${(cells[0].y + 10).toFixed(1)}" text-anchor="middle">+</text></g>`;
  }).join('');
}

/** A random mountain: elevations in order, each at least two frames wide, never more frames than the box holds. */
export function randomLayout(rand: () => number = Math.random): Layout {
  const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)];
  for (let attempt = 0; attempt < 400; attempt++) {
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
      // Four seats with the same climb if the shuffle allows it; later attempts settle for less.
      const st = buildBoard(candidate).start;
      if (st.count < (attempt < 150 ? 4 : attempt < 185 ? 3 : 2) || (attempt < 120 && !(st.same && st.equalWidth)) || (attempt < 185 && !st.same)) continue;
      return {
        id: 'random',
        name: 'A new mountain',
        blurb: 'Shuffled from the frames in the box. Shuffle again for another.',
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

/** Centres of the seven tile slots of the frame at (a, b). */
export const frameCells = (a: number, b: number, S = 40) =>
  RING.map(([dq, dr]) => { const q = 2 * a - b + dq, r = a + 3 * b + dr; return { x: 1.5 * S * q, y: SQ3 * S * (r + q / 2) }; });

/** ViewBox around the slots (or any points), padded out to the golden rectangle so the board never jumps in size. */
export function viewBox(slots: { x: number; y: number }[], S = 40): string {
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
      const stroke = s.e === 4 ? 'var(--e4-edge)' : FRAME_FILL[s.e];
      const hole = s.kind === 'slot' ? `<circle r="${(S * 0.56).toFixed(1)}" class="hole"/>` : '';
      return `<g class="slot e${s.e}" data-e="${s.e}" data-frame="${s.frame}" data-slot="${s.id}" transform="translate(${s.x.toFixed(1)} ${s.y.toFixed(1)})"><polygon points="${hex}" fill="${FRAME_FILL[s.e]}" stroke="${stroke}" stroke-width="3" stroke-linejoin="round"/>${hole}</g>`;
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
