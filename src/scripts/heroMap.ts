// Hero map: a blueprint of a shuffled mountain, inked in, then partly built with real tiles.
// About 61.8% of the slots get a tile; the rest stay as drawing, on purpose. The same function renders the
// first map on the server (seeded, so the page is never empty) and every later map in the browser.
import { randomLayout, buildBoard, neighbourIds, summitTile, START_TILES, type Elev, type Slot, type Layout } from './board';
import { terrain, tileSrc, type Terrain } from '../data/game';

const PHI = 1.618;
const S = 40;
const SQ3 = Math.sqrt(3);

/** Small seeded random generator, so the server and a given seed always produce the same map. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// How much each terrain is favoured on the hero, on top of its share of the bag: the striking ones come up more.
const FLAVOUR: Record<string, number> = {
  lava: 0.9, water: 1.8, 'deep-water': 2, 'clear-stream': 1.4, rock: 1.6, ridge: 1.7, 'snowy-rock': 1.6,
  'icy-rock': 1.6, 'ice-wall': 1.5, 'ice-field': 1.3, 'icy-shore': 1.5, 'snow-shore': 1.4,
};

const hexDist = (a: Slot, b: Slot) => (Math.abs(a.q - b.q) + Math.abs(a.r - b.r) + Math.abs(a.q + a.r - b.q - b.r)) / 2;

/** Pick the rotation whose outline is closest to a golden rectangle. */
function goldenRotation(l: Layout): Layout {
  let best = l, err = Infinity;
  for (let k = 0; k < 6; k++) {
    const cand = { ...l, rotate: k };
    const { slots } = buildBoard(cand);
    const xs = slots.map((s) => s.x), ys = slots.map((s) => s.y);
    const ratio = (Math.max(...xs) - Math.min(...xs)) / (Math.max(...ys) - Math.min(...ys));
    // the climb should run upward or across, so the Summit stays in the top half
    const summit = slots.find((s) => s.kind === 'summit')!;
    const up = (summit.y - Math.min(...ys)) / (Math.max(...ys) - Math.min(...ys));
    const e = Math.abs(Math.log(ratio / PHI)) + (up > 0.5 ? 1 : 0);
    if (e < err) { err = e; best = cand; }
  }
  return best;
}

export interface HeroMap { svg: string; viewBox: string; duration: number }

export function composeMap(seed: number, base: string): HeroMap {
  const rand = rng(seed);

  // A big mountain: all four elevations and at least ten frames.
  let layout = randomLayout(rand);
  for (let i = 0; i < 40; i++) {
    const b = buildBoard(layout);
    if (b.slots.length >= 70 && b.slots.some((s) => s.e === 4)) break;
    layout = randomLayout(rand);
  }
  layout = goldenRotation(layout);
  const { slots } = buildBoard(layout, S, rand);
  const nb = neighbourIds(slots);
  const summit = slots.find((s) => s.kind === 'summit')!;
  const far = Math.max(...slots.map((s) => hexDist(s, summit))) || 1;

  // Routes first: from every START tile a wandering walk climbs to the Summit. Then side branches grow off
  // the routes until 61.8% of the slots hold a tile, preferring thin spurs over solid blobs, so gaps remain.
  const open = slots.filter((s) => s.kind === 'slot');
  const target = Math.round(open.length / PHI);
  const placed: Slot[] = [];
  const has = new Set<number>(slots.filter((s) => s.kind !== 'slot').map((s) => s.id));
  const put = (s: Slot) => { if (!has.has(s.id) && s.kind === 'slot') { placed.push(s); has.add(s.id); } };
  const weightedPick = (pool: Slot[], w: number[]) => {
    let r = rand() * w.reduce((a, b) => a + b, 0);
    for (let i = 0; i < pool.length; i++) if ((r -= w[i]) <= 0) return pool[i];
    return pool[pool.length - 1];
  };

  for (const start of slots.filter((s) => s.kind === 'start')) {
    let cur = start;
    for (let guard = 0; guard < 160 && hexDist(cur, summit) > 1; guard++) {
      const next = nb[cur.id].map((n) => slots[n]).filter((n) => n.kind === 'slot' || n.kind === 'summit');
      if (!next.length) break;
      const d0 = hexDist(cur, summit);
      // mostly uphill, sometimes sideways, rarely back: a route that wanders but arrives
      const w = next.map((n) => {
        const dd = hexDist(n, summit) - d0;
        return (dd < 0 ? 3 : dd === 0 ? 1.1 : 0.15) * (has.has(n.id) ? 0.5 : 1) * (0.4 + rand());
      });
      cur = weightedPick(next, w);
      if (cur.kind === 'summit') break;
      put(cur);
      if (placed.length >= target) break;
    }
  }
  while (placed.length < target) {
    const pool = open.filter((s) => !has.has(s.id) && nb[s.id].some((n) => has.has(n)));
    if (!pool.length) break;
    const w = pool.map((s) => {
      const around = nb[s.id].filter((n) => has.has(n)).length;
      return (around <= 2 ? 1.6 : around === 3 ? 0.7 : 0.25) * (0.3 + rand());
    });
    put(weightedPick(pool, w));
  }

  // Terrain for each placed tile, weighted towards the interesting ones. Lava never next to the Summit.
  const byElev = (e: Elev) => terrain.filter((t) => t.elevation === e);
  const lavaAt = new Set<number>();
  const chooseTerrain = (s: Slot): { t: Terrain; vp: boolean } => {
    const noLava = s.nearSummit || nb[s.id].some((n) => lavaAt.has(n)) || lavaAt.size >= Math.ceil(placed.length * 0.09);
    const pool = byElev(s.e).filter((t) => !(t.gear === 'lava' && noLava));
    const w = pool.map((t) => Math.sqrt(t.copies + t.viewpoint) * (FLAVOUR[t.id] ?? 1));
    let r = rand() * w.reduce((a, b) => a + b, 0);
    let t = pool[pool.length - 1];
    for (let i = 0; i < pool.length; i++) if ((r -= w[i]) <= 0) { t = pool[i]; break; }
    if (t.gear === 'lava') lavaAt.add(s.id);
    return { t, vp: t.viewpoint > 0 && rand() < 0.18 };
  };

  // Timing: guides, then the ink elevation by elevation, then the tiles in the order the paths grew.
  const elevs = [...new Set(slots.map((s) => s.e))].sort();
  const INK_START = 0.3, PER_ELEV = 0.618, TILE_START = INK_START + elevs.length * PER_ELEV + 0.4, TILE_STEP = 0.07;

  // Ink: tile edges inside a frame are fine lines, edges between frames or at the rim are heavier.
  const key = (x: number, y: number) => `${Math.round(x)},${Math.round(y)}`;
  const edges = new Map<string, { d: string; frames: Set<number>; n: number; e: Elev }>();
  for (const s of slots) {
    for (let k = 0; k < 6; k++) {
      const a = (Math.PI / 3) * k, b = (Math.PI / 3) * (k + 1);
      const x1 = s.x + S * Math.cos(a), y1 = s.y + S * Math.sin(a), x2 = s.x + S * Math.cos(b), y2 = s.y + S * Math.sin(b);
      const id = [key(x1, y1), key(x2, y2)].sort().join('|');
      const hit = edges.get(id);
      if (hit) { hit.n++; hit.frames.add(s.frame); hit.e = Math.min(hit.e, s.e) as Elev; }
      else edges.set(id, { d: `M${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}`, frames: new Set([s.frame]), n: 1, e: s.e });
    }
  }
  let ink = '';
  for (const [i, e] of elevs.entries()) {
    const fine = [...edges.values()].filter((g) => g.e === e && g.n === 2 && g.frames.size === 1).map((g) => g.d).join('');
    const bold = [...edges.values()].filter((g) => g.e === e && !(g.n === 2 && g.frames.size === 1)).map((g) => g.d).join('');
    const d = (INK_START + i * PER_ELEV).toFixed(2);
    ink += `<path class="ink fine" pathLength="1" style="--d:${d}s" d="${fine}"/><path class="ink bold" pathLength="1" style="--d:${d}s" d="${bold}"/>`;
  }

  // Construction lines between neighbouring frame centres.
  const centres = slots.filter((_, i) => i % 7 === 0);
  let guides = '';
  centres.forEach((a, i) =>
    centres.slice(i + 1).forEach((b) => {
      if (Math.hypot(a.x - b.x, a.y - b.y) < Math.sqrt(21) * S * 1.05)
        guides += `M${a.x.toFixed(1)} ${a.y.toFixed(1)}L${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
    }),
  );
  const dots = centres.map((c) => `<circle class="dot" cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="3"/>`).join('');

  const W = 2 * S, H = SQ3 * S;
  const tiles = placed
    .map((s, i) => {
      const { t, vp } = chooseTerrain(s);
      const d = (TILE_START + i * TILE_STEP).toFixed(2);
      return `<image class="tile" style="--d:${d}s" href="${base}${tileSrc(t, vp, Math.floor(rand() * 99))}" x="${(s.x - W / 2).toFixed(1)}" y="${(s.y - H / 2).toFixed(1)}" width="${W}" height="${H.toFixed(1)}"/>`;
    })
    .join('');

  const hexPts = (r: number) => Array.from({ length: 6 }, (_, k) => `${(r * Math.cos((Math.PI / 3) * k)).toFixed(1)},${(r * Math.sin((Math.PI / 3) * k)).toFixed(1)}`).join(' ');
  const end = TILE_START + placed.length * TILE_STEP;
  let seat = 0;
  const fixed = slots
    .filter((s) => s.kind !== 'slot')
    .map((s) => {
      const tr = `translate(${s.x.toFixed(1)} ${s.y.toFixed(1)})`;
      if (s.kind === 'summit') {
        return `<g transform="${tr}"><g class="mark summit" style="--d:${(end + 0.2).toFixed(2)}s"><image href="${base}${summitTile(s.e)}" x="${-S}" y="${(-H / 2).toFixed(1)}" width="${W}" height="${H.toFixed(1)}"/><polygon points="${hexPts(S)}"/></g></g>`;
      }
      return `<g transform="${tr}"><g class="mark start" style="--d:${(TILE_START - 0.3).toFixed(2)}s"><image href="${base}${START_TILES[seat++ % 4]}" x="${-S}" y="${(-H / 2).toFixed(1)}" width="${W}" height="${H.toFixed(1)}"/></g></g>`;
    })
    .join('');

  // Golden frame around the drawing.
  const xs = slots.map((s) => s.x), ys = slots.map((s) => s.y);
  let x0 = Math.min(...xs) - S * 1.6, x1 = Math.max(...xs) + S * 1.6, y0 = Math.min(...ys) - S * 1.6, y1 = Math.max(...ys) + S * 1.6;
  let w = x1 - x0, h = y1 - y0;
  if (w / h < PHI) { const nw = h * PHI; x0 -= (nw - w) / 2; w = nw; } else { const nh = w / PHI; y0 -= (nh - h) / 2; h = nh; }

  const svg =
    `<path class="guides" pathLength="1" d="${guides}"/>${dots}` +
    `<g class="inks">${ink}</g>` +
    `<g class="tiles">${tiles}</g>` +
    `<g class="marks">${fixed}</g>`;
  return { svg, viewBox: [x0, y0, w, h].map((v) => v.toFixed(1)).join(' '), duration: end + 1.5 };
}
