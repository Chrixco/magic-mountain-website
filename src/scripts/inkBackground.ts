// Page background: ink sketches of shuffled mountains, drawn like a blueprint on white paper.
// Each sketch draws its construction lines, then the hexagon edges elevation by elevation;
// it rests, fades, and a new mountain is sketched somewhere else.
import { randomLayout, slotsFor, type Elev, type Slot } from './board';

const INK = '91, 58, 36'; // ink brown
const PHI = 1.618;

/** Overall strength. The drawing sits behind body text, so it stays a whisper. */
const INK_ALPHA = 0.55;
/** On small screens the sketches sit behind most of the text, so they are fainter there. */
const inkAlpha = () => INK_ALPHA * (window.innerWidth < 720 ? 0.55 : 1);
const SQ3 = Math.sqrt(3);

const TIMING = {
  guides: 2.6, // construction lines draw in
  perElevation: 1.618, // each elevation starts this long after the one below
  edge: 0.618, // one edge takes this long to draw
  life: 17, // fade starts
  fade: 3.8,
  every: 9.5, // a new sketch starts this often
};

interface Segment { x1: number; y1: number; x2: number; y2: number; bend: number; start: number; w: number; a: number }
interface Sketch {
  born: number;
  guides: Segment[];
  edges: Segment[];
  dots: { x: number; y: number; r: number; start: number; summit: boolean }[];
}

const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;

function makeSketch(now: number, vw: number, vh: number, avoid?: { x: number; y: number }): Sketch {
  const layout = randomLayout();
  const unit = slotsFor(layout, 1);
  const xs = unit.map((s) => s.x), ys = unit.map((s) => s.y);
  const w = Math.max(...xs) - Math.min(...xs) + 2, h = Math.max(...ys) - Math.min(...ys) + 2;

  // Tile radius: large and airy, never more than ~85% of the screen.
  const S = Math.max(12, Math.min(42, (vw * 0.854) / w, (vh * 0.854) / h));
  const angle = rand(-0.26, 0.26);
  const cos = Math.cos(angle), sin = Math.sin(angle);

  // Place it on the other side of the screen from the previous sketch.
  let ox = 0, oy = 0;
  for (let i = 0; i < 12; i++) {
    ox = rand(vw * 0.18, vw * 0.82);
    oy = rand(vh * 0.2, vh * 0.8);
    if (!avoid || Math.hypot(ox - avoid.x, oy - avoid.y) > Math.min(vw, vh) * 0.45) break;
  }
  const mx = (Math.max(...xs) + Math.min(...xs)) / 2, my = (Math.max(...ys) + Math.min(...ys)) / 2;
  const P = (x: number, y: number) => {
    const dx = (x - mx) * S, dy = (y - my) * S;
    return { x: ox + dx * cos - dy * sin, y: oy + dx * sin + dy * cos };
  };

  const slots: (Slot & { px: number; py: number; frame: number })[] = unit.map((s, i) => {
    const p = P(s.x, s.y);
    return { ...s, px: p.x, py: p.y, frame: Math.floor(i / 7) };
  });
  const frames = slots.filter((_, i) => i % 7 === 0); // the first slot of each frame is its centre
  const elevOrder = (e: Elev) => [...new Set(frames.map((f) => f.e))].sort().indexOf(e);

  // Construction lines: frame centre to every neighbouring frame centre, plus long guides through the Summit.
  const guides: Segment[] = [];
  const link = Math.sqrt(21) * S * 1.05;
  frames.forEach((a, i) =>
    frames.slice(i + 1).forEach((b) => {
      if (Math.hypot(a.px - b.px, a.py - b.py) < link)
        guides.push({ x1: a.px, y1: a.py, x2: b.px, y2: b.py, bend: 0, start: rand(0, TIMING.guides * 0.7), w: 0.8, a: 0.42 });
    }),
  );
  const summit = slots.find((s) => s.kind === 'summit')!;
  for (const t of [angle, angle + Math.PI / 3, angle - Math.PI / 3]) {
    const L = Math.max(w, h) * S * 0.62;
    guides.push({
      x1: summit.px - Math.cos(t) * L, y1: summit.py - Math.sin(t) * L,
      x2: summit.px + Math.cos(t) * L, y2: summit.py + Math.sin(t) * L,
      bend: 0, start: rand(0.4, 1.4), w: 0.6, a: 0.22,
    });
  }

  // Hexagon edges, de-duplicated. Edges on a frame's border are drawn heavier than the edges inside it.
  const edgeMap = new Map<string, { x1: number; y1: number; x2: number; y2: number; frames: Set<number>; e: Elev; count: number }>();
  const key = (x: number, y: number) => `${Math.round(x * 2)},${Math.round(y * 2)}`;
  for (const s of slots) {
    for (let k = 0; k < 6; k++) {
      const t1 = (Math.PI / 3) * k, t2 = (Math.PI / 3) * (k + 1);
      const a = P(s.x + Math.cos(t1), s.y + Math.sin(t1)), b = P(s.x + Math.cos(t2), s.y + Math.sin(t2));
      const id = [key(a.x, a.y), key(b.x, b.y)].sort().join('|');
      const hit = edgeMap.get(id);
      if (hit) { hit.count++; hit.frames.add(s.frame); hit.e = Math.min(hit.e, s.e) as Elev; }
      else edgeMap.set(id, { x1: a.x, y1: a.y, x2: b.x, y2: b.y, frames: new Set([s.frame]), e: s.e, count: 1 });
    }
  }
  const edges: Segment[] = [...edgeMap.values()].map((g) => {
    const border = g.count === 1 || g.frames.size > 1;
    return {
      x1: g.x1, y1: g.y1, x2: g.x2, y2: g.y2,
      bend: gauss() * S * 0.06,
      start: TIMING.guides * 0.6 + elevOrder(g.e) * TIMING.perElevation + rand(0, TIMING.perElevation * 1.2),
      w: border ? 1.6 : 0.85,
      a: border ? 0.62 : 0.34,
    };
  });

  const dots = frames.map((f) => ({ x: f.px, y: f.py, r: 2.6, start: rand(0.3, TIMING.guides), summit: false }));
  dots.push({ x: summit.px, y: summit.py, r: 5, start: TIMING.guides, summit: true });

  return { born: now, guides, edges, dots };
}

const ease = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : 1 - Math.pow(1 - t, 3));

function drawSegment(ctx: CanvasRenderingContext2D, s: Segment, p: number, alpha: number, dashed = false) {
  if (p <= 0) return;
  const mx = (s.x1 + s.x2) / 2, my = (s.y1 + s.y2) / 2;
  const len = Math.hypot(s.x2 - s.x1, s.y2 - s.y1) || 1;
  const cx = mx + (-(s.y2 - s.y1) / len) * s.bend, cy = my + ((s.x2 - s.x1) / len) * s.bend;
  ctx.strokeStyle = `rgba(${INK}, ${s.a * alpha * inkAlpha()})`;
  ctx.lineWidth = s.w;
  ctx.setLineDash(dashed ? [4, 5] : []);
  ctx.beginPath();
  ctx.moveTo(s.x1, s.y1);
  if (p >= 1) ctx.quadraticCurveTo(cx, cy, s.x2, s.y2);
  else {
    // De Casteljau split of the quadratic at p
    const ax = s.x1 + (cx - s.x1) * p, ay = s.y1 + (cy - s.y1) * p;
    const bx = cx + (s.x2 - cx) * p, by = cy + (s.y2 - cy) * p;
    ctx.quadraticCurveTo(ax, ay, ax + (bx - ax) * p, ay + (by - ay) * p);
  }
  ctx.stroke();
}

export function startInkBackground(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  let vw = 0, vh = 0, dpr = 1;
  let sketches: Sketch[] = [];
  let last = 0, nextAt = 0, raf = 0;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    vw = window.innerWidth;
    vh = window.innerHeight;
    canvas.width = Math.round(vw * dpr);
    canvas.height = Math.round(vh * dpr);
  }

  function render(t: number) {
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx!.clearRect(0, 0, vw, vh);
    for (const s of sketches) {
      const age = t - s.born;
      const life = 1 - ease((age - TIMING.life) / TIMING.fade);
      for (const g of s.guides) drawSegment(ctx!, g, ease((age - g.start) / 1.6), life, true);
      for (const e of s.edges) drawSegment(ctx!, e, ease((age - e.start) / TIMING.edge), life);
      ctx!.setLineDash([]);
      for (const d of s.dots) {
        const p = ease((age - d.start) / 0.6);
        if (p <= 0) continue;
        ctx!.strokeStyle = `rgba(${INK}, ${0.55 * life * inkAlpha()})`;
        ctx!.lineWidth = 0.9;
        ctx!.beginPath();
        ctx!.arc(d.x, d.y, d.r * p, 0, Math.PI * 2);
        ctx!.stroke();
        if (d.summit) {
          ctx!.beginPath();
          ctx!.arc(d.x, d.y, d.r * PHI * p, 0, Math.PI * 2);
          ctx!.stroke();
        }
      }
    }
  }

  function frame(ms: number) {
    raf = requestAnimationFrame(frame);
    if (ms - last < 33) return; // ~30 fps is plenty for a slow drawing
    last = ms;
    const t = ms / 1000;
    if (t >= nextAt) {
      const prev = sketches[sketches.length - 1];
      const avoid = prev ? { x: prev.dots[prev.dots.length - 1].x, y: prev.dots[prev.dots.length - 1].y } : undefined;
      sketches.push(makeSketch(t, vw, vh, avoid));
      nextAt = t + TIMING.every;
    }
    sketches = sketches.filter((s) => t - s.born < TIMING.life + TIMING.fade);
    render(t);
  }

  /** Reduced motion: two finished sketches, no animation. */
  function still() {
    sketches = [makeSketch(-100, vw, vh)];
    const d = sketches[0].dots;
    sketches.push(makeSketch(-100, vw, vh, d[d.length - 1]));
    render(-100 + TIMING.life - 0.01);
  }

  function start() {
    cancelAnimationFrame(raf);
    if (reduce.matches) return still();
    sketches = [];
    nextAt = 0;
    raf = requestAnimationFrame(frame);
  }

  resize();
  start();

  let resizeTimer = 0;
  addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      const wChanged = Math.abs(window.innerWidth - vw) > 40; // ignore mobile toolbar height jitter
      resize();
      if (wChanged || reduce.matches) start();
    }, 200);
  });
  reduce.addEventListener('change', start);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) cancelAnimationFrame(raf);
    else if (!reduce.matches) raf = requestAnimationFrame(frame);
  });
}
