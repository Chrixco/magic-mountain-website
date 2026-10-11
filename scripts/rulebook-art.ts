// Print art for the rulebook, in the style of the website's hero map and ink background.
// Renders golden-ratio PNGs at 300 dpi (transparent background) from the full-resolution tile exports.
//
//   node scripts/rulebook-art.ts            → writes to ../Final Design/Rulebook Art/
//   node scripts/rulebook-art.ts --preview  → small previews in ./art-preview/ (to choose seeds)
//
// Uses the same layout generator as the site (src/scripts/board.ts), so the mountains follow the same rules:
// frames from the box, elevations in order, fair START tiles, Summit on the highest frame.
import { readFileSync, readdirSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { randomLayout, buildBoard, neighbourIds, type Layout, type Slot, type Elev } from '../src/scripts/board.ts';

const here = dirname(fileURLToPath(import.meta.url));
const MM = join(here, '..', '..'); // Magic Mountain/
const TILES = join(MM, 'Final Design', 'Tiles');
const OUT = process.argv.includes('--preview') ? join(here, '..', 'art-preview') : join(MM, 'Final Design', 'Rulebook Art');
const PREVIEW = process.argv.includes('--preview');
const DATE = '20261011';

const PHI = 1.618;
const SQ3 = Math.sqrt(3);
const INK = '#5b3a24';

// Page sizes at 300 dpi: 210 mm wide, golden ratio.
const LONG = 2480, SHORT = Math.round(2480 / PHI); // 2480 × 1533 px = 210 × 130 mm

// ---------- seeded random ----------
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- tile designs from Final Design/Tiles ----------
type Design = { file: string; copies: number; vp: boolean };
const designs = new Map<string, Design[]>();
let startFiles: string[] = [];
const summitFiles: Record<string, string> = {};
for (const f of readdirSync(TILES).sort()) {
  if (f.startsWith('._')) continue;
  let m = f.match(/^\d+_Tile_E(\d)_([A-Za-z-]+)_([A-Z])(_Viewpoint)?_x(\d+)\.png$/);
  if (m) {
    const key = `${m[1]}:${m[2].toLowerCase()}`;
    (designs.get(key) ?? designs.set(key, []).get(key)!).push({ file: f, copies: Number(m[5]), vp: !!m[4] });
    continue;
  }
  if (/^\d+_Tile_Start_Player\d_/.test(f)) startFiles.push(f);
  m = f.match(/^\d+_Tile_Summit_([A-Za-z]+)_x1\.png$/);
  if (m) summitFiles[m[1].toLowerCase()] = f;
}
const SUMMIT_BY_TOP: Record<number, string> = { 1: 'short', 2: 'short', 3: 'standard', 4: 'expedition' };

const dataUri = new Map<string, string>();
const uri = (f: string) => {
  if (!dataUri.has(f)) dataUri.set(f, 'data:image/png;base64,' + readFileSync(join(TILES, f)).toString('base64'));
  return dataUri.get(f)!;
};

// The striking terrain comes up more often than its share of the bag, as on the website.
const FLAVOUR: Record<string, number> = {
  lava: 0.9, water: 1.8, 'deep-water': 2, 'clear-stream': 1.4, rock: 1.6, ridge: 1.7, 'snowy-rock': 1.6,
  'icy-rock': 1.6, 'ice-wall': 1.5, 'ice-field': 1.3, 'icy-shore': 1.5, 'snow-shore': 1.4,
};

const hexDist = (a: Slot, b: Slot) => (Math.abs(a.q - b.q) + Math.abs(a.r - b.r) + Math.abs(a.q + a.r - b.q - b.r)) / 2;

/** Rotation whose outline best matches the page (wide or tall), Summit in the upper half. */
function fitRotation(l: Layout, aspect: number): { layout: Layout; err: number } {
  let best = l, err = Infinity;
  for (let k = 0; k < 6; k++) {
    const cand = { ...l, rotate: k };
    const { slots } = buildBoard(cand);
    const xs = slots.map((s) => s.x), ys = slots.map((s) => s.y);
    const ratio = (Math.max(...xs) - Math.min(...xs)) / (Math.max(...ys) - Math.min(...ys));
    const summit = slots.find((s) => s.kind === 'summit')!;
    const up = (summit.y - Math.min(...ys)) / (Math.max(...ys) - Math.min(...ys));
    const e = Math.abs(Math.log(ratio / aspect)) + (up > 0.5 ? 1 : 0);
    if (e < err) { err = e; best = cand; }
  }
  return { layout: best, err };
}

type Style = 'map' | 'sketch';

function compose(seed: number, W: number, H: number, style: Style): string {
  const rand = rng(seed);
  const aspect = W / H;

  // A big mountain (all four elevations, 11+ frames) whose outline suits the page, so it fills it.
  let layout = randomLayout(rand), bestErr = Infinity;
  for (let i = 0; i < 120; i++) {
    const cand = randomLayout(rand);
    const b = buildBoard(cand);
    if (b.slots.length < 77 || !b.slots.some((s) => s.e === 4)) continue;
    const fit = fitRotation(cand, aspect);
    if (fit.err < bestErr) { bestErr = fit.err; layout = fit.layout; }
    if (bestErr < 0.12) break;
  }
  const S = 40;
  const { slots } = buildBoard(layout, S, rand);
  const nb = neighbourIds(slots);
  const summit = slots.find((s) => s.kind === 'summit')!;

  // Fit the drawing to the page with a golden margin.
  const xs = slots.map((s) => s.x), ys = slots.map((s) => s.y);
  const bw = Math.max(...xs) - Math.min(...xs) + 2 * S, bh = Math.max(...ys) - Math.min(...ys) + 2 * S;
  const scale = Math.min((W * 0.854) / bw, (H * 0.854) / bh);
  const cx = (Math.max(...xs) + Math.min(...xs)) / 2, cy = (Math.max(...ys) + Math.min(...ys)) / 2;
  const tr = (x: number, y: number) => [W / 2 + (x - cx) * scale, H / 2 + (y - cy) * scale] as const;
  const R = S * scale; // tile radius in px
  const lw = (px: number) => (px * W) / 2480; // line widths scale with the page

  // --- ink: hexagon edges, heavier on frame borders, with a slight hand-drawn wobble in the sketch style
  const key = (x: number, y: number) => `${Math.round(x)},${Math.round(y)}`;
  const edges = new Map<string, { a: readonly [number, number]; b: readonly [number, number]; frames: Set<number>; n: number }>();
  for (const s of slots) {
    for (let k = 0; k < 6; k++) {
      const t1 = (Math.PI / 3) * k, t2 = (Math.PI / 3) * (k + 1);
      const a = tr(s.x + S * Math.cos(t1), s.y + S * Math.sin(t1)), b = tr(s.x + S * Math.cos(t2), s.y + S * Math.sin(t2));
      const id = [key(...a), key(...b)].sort().join('|');
      const hit = edges.get(id);
      if (hit) { hit.n++; hit.frames.add(s.frame); }
      else edges.set(id, { a, b, frames: new Set([s.frame]), n: 1 });
    }
  }
  const seg = (a: readonly [number, number], b: readonly [number, number]) => {
    if (style === 'map') return `M${a[0].toFixed(1)} ${a[1].toFixed(1)}L${b[0].toFixed(1)} ${b[1].toFixed(1)}`;
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const bend = (rand() + rand() + rand() - 1.5) * R * 0.05;
    const qx = mx - ((b[1] - a[1]) / len) * bend, qy = my + ((b[0] - a[0]) / len) * bend;
    return `M${a[0].toFixed(1)} ${a[1].toFixed(1)}Q${qx.toFixed(1)} ${qy.toFixed(1)} ${b[0].toFixed(1)} ${b[1].toFixed(1)}`;
  };
  let fine = '', bold = '';
  for (const e of edges.values()) {
    if (e.n === 2 && e.frames.size === 1) fine += seg(e.a, e.b);
    else bold += seg(e.a, e.b);
  }

  // --- construction lines between neighbouring frame centres, long guides through the Summit
  const centres = slots.filter((_, i) => i % 7 === 0).map((c) => tr(c.x, c.y));
  let guides = '';
  centres.forEach((a, i) =>
    centres.slice(i + 1).forEach((b) => {
      if (Math.hypot(a[0] - b[0], a[1] - b[1]) < Math.sqrt(21) * R * 1.05) guides += `M${a[0].toFixed(1)} ${a[1].toFixed(1)}L${b[0].toFixed(1)} ${b[1].toFixed(1)}`;
    }),
  );
  const [sx, sy] = tr(summit.x, summit.y);
  if (style === 'sketch') {
    const L = Math.max(W, H) * 0.42;
    for (const t of [0, Math.PI / 3, -Math.PI / 3]) {
      guides += `M${(sx - Math.cos(t) * L).toFixed(1)} ${(sy - Math.sin(t) * L).toFixed(1)}L${(sx + Math.cos(t) * L).toFixed(1)} ${(sy + Math.sin(t) * L).toFixed(1)}`;
    }
  }
  const dots = centres.map(([x, y]) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${lw(6).toFixed(1)}"/>`).join('');
  const summitDots = style === 'sketch'
    ? `<circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="${lw(11).toFixed(1)}"/><circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="${lw(18).toFixed(1)}"/>`
    : '';

  // --- tiles (map style): routes from every START to the Summit, then branches, until 61.8% of the slots are built
  let tiles = '', marks = '';
  if (style === 'map') {
    const open = slots.filter((s) => s.kind === 'slot');
    const target = Math.round(open.length / PHI);
    const placed: Slot[] = [];
    const has = new Set<number>(slots.filter((s) => s.kind !== 'slot').map((s) => s.id));
    const put = (s: Slot) => { if (!has.has(s.id) && s.kind === 'slot') { placed.push(s); has.add(s.id); } };
    const pick = (pool: Slot[], w: number[]) => {
      let r = rand() * w.reduce((a, b) => a + b, 0);
      for (let i = 0; i < pool.length; i++) if ((r -= w[i]) <= 0) return pool[i];
      return pool[pool.length - 1];
    };
    for (const start of slots.filter((s) => s.kind === 'start')) {
      let cur = start;
      for (let g = 0; g < 160 && hexDist(cur, summit) > 1; g++) {
        const next = nb[cur.id].map((n) => slots[n]).filter((n) => n.kind === 'slot' || n.kind === 'summit');
        if (!next.length) break;
        const d0 = hexDist(cur, summit);
        cur = pick(next, next.map((n) => { const dd = hexDist(n, summit) - d0; return (dd < 0 ? 3 : dd === 0 ? 1.1 : 0.15) * (has.has(n.id) ? 0.5 : 1) * (0.4 + rand()); }));
        if (cur.kind === 'summit') break;
        put(cur);
        if (placed.length >= target) break;
      }
    }
    while (placed.length < target) {
      const pool = open.filter((s) => !has.has(s.id) && nb[s.id].some((n) => has.has(n)));
      if (!pool.length) break;
      put(pick(pool, pool.map((s) => { const k = nb[s.id].filter((n) => has.has(n)).length; return (k <= 2 ? 1.6 : k === 3 ? 0.7 : 0.25) * (0.3 + rand()); })));
    }

    const lavaAt = new Set<number>();
    const w = 2 * R, h = SQ3 * R;
    const img = (file: string, x: number, y: number) =>
      `<image href="${uri(file)}" x="${(x - w / 2).toFixed(1)}" y="${(y - h / 2).toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" preserveAspectRatio="none"/>`;
    for (const s of placed) {
      const types = [...designs.keys()].filter((k) => k.startsWith(`${s.e}:`)).map((k) => k.split(':')[1]);
      const noLava = s.nearSummit || nb[s.id].some((n) => lavaAt.has(n)) || lavaAt.size >= Math.ceil(placed.length * 0.09);
      const pool = types.filter((t) => !(t === 'lava' && noLava));
      const weights = pool.map((t) => Math.sqrt(designs.get(`${s.e}:${t}`)!.reduce((a, d) => a + d.copies, 0)) * (FLAVOUR[t] ?? 1));
      let r = rand() * weights.reduce((a, b) => a + b, 0);
      let type = pool[pool.length - 1];
      for (let i = 0; i < pool.length; i++) if ((r -= weights[i]) <= 0) { type = pool[i]; break; }
      if (type === 'lava') lavaAt.add(s.id);
      const all = designs.get(`${s.e}:${type}`)!;
      const vp = all.some((d) => d.vp) && rand() < 0.18;
      const list = all.filter((d) => d.vp === vp);
      const [x, y] = tr(s.x, s.y);
      tiles += img(list[Math.floor(rand() * list.length)].file, x, y);
    }
    let seat = 0;
    for (const s of slots.filter((s) => s.kind !== 'slot')) {
      const [x, y] = tr(s.x, s.y);
      if (s.kind === 'summit') {
        const top = Math.max(...slots.map((q) => q.e)) as Elev;
        marks += img(summitFiles[SUMMIT_BY_TOP[top]], x, y);
        const ring = Array.from({ length: 6 }, (_, k) => `${(x + R * Math.cos((Math.PI / 3) * k)).toFixed(1)},${(y + R * Math.sin((Math.PI / 3) * k)).toFixed(1)}`).join(' ');
        marks += `<polygon points="${ring}" fill="none" stroke="#c8842b" stroke-width="${lw(7).toFixed(1)}" stroke-linejoin="round"/>`;
      } else marks += img(startFiles[seat++ % startFiles.length], x, y);
    }
  }

  const dash = style === 'sketch' ? ` stroke-dasharray="${lw(10)} ${lw(12)}"` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs><filter id="relief" x="-10%" y="-10%" width="120%" height="130%">
  <feGaussianBlur in="SourceAlpha" stdDeviation="${lw(6)}"/><feOffset dy="${lw(7)}" result="b"/>
  <feComponentTransfer><feFuncA type="linear" slope="0.32"/></feComponentTransfer>
  <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
<g fill="none" stroke-linecap="round" stroke-linejoin="round">
  <path d="${guides}" stroke="${INK}" stroke-opacity="${style === 'sketch' ? 0.42 : 0.3}" stroke-width="${lw(1.8)}"${dash}/>
  <g stroke="${INK}" stroke-opacity="0.6" stroke-width="${lw(2)}">${dots}${summitDots}</g>
  <path d="${fine}" stroke="${INK}" stroke-opacity="0.45" stroke-width="${lw(2.2)}"/>
  <path d="${bold}" stroke="${INK}" stroke-opacity="0.82" stroke-width="${lw(4.4)}"/>
</g>
<g filter="url(#relief)">${tiles}${marks}</g>
</svg>`;
}

const jobs: { name: string; seed: number; W: number; H: number; style: Style }[] = [
  { name: 'Map_Horizontal_A', seed: 1618, W: LONG, H: SHORT, style: 'map' },
  { name: 'Map_Horizontal_B', seed: 2584, W: LONG, H: SHORT, style: 'map' },
  { name: 'Map_Vertical_A', seed: 4181, W: SHORT, H: LONG, style: 'map' },
  { name: 'Map_Vertical_B', seed: 6765, W: SHORT, H: LONG, style: 'map' },
  { name: 'Sketch_Horizontal_A', seed: 377, W: LONG, H: SHORT, style: 'sketch' },
  { name: 'Sketch_Horizontal_B', seed: 610, W: LONG, H: SHORT, style: 'sketch' },
  { name: 'Sketch_Vertical_A', seed: 987, W: SHORT, H: LONG, style: 'sketch' },
  { name: 'Sketch_Vertical_B', seed: 1597, W: SHORT, H: LONG, style: 'sketch' },
];

// Optional seed overrides: --seed Map_Horizontal_A=1234
for (const arg of process.argv.slice(2)) {
  const m = arg.match(/^(\w+)=(\d+)$/);
  if (m) { const j = jobs.find((x) => x.name === m[1]); if (j) j.seed = Number(m[2]); }
}

mkdirSync(OUT, { recursive: true });
for (const j of jobs) {
  const svg = compose(j.seed, j.W, j.H, j.style);
  const file = join(OUT, `${DATE}_RulebookArt_${j.name}.png`);
  let img = sharp(Buffer.from(svg), { density: 72 });
  if (PREVIEW) img = img.resize({ width: Math.round(j.W / 4) });
  await img.png({ compressionLevel: 9 }).withMetadata({ density: 300 }).toFile(file);
  console.log(`${j.name}  seed ${j.seed}  ${j.W}×${j.H}px  →  ${file}`);
}
