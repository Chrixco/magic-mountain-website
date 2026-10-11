// Pointer tilt for physical objects (cards, tiles, photos): the object leans toward the pointer and a soft
// glare follows it. Mark an element with data-tilt="card" | "tile" | "photo" | "holo".
// Styles live in global.css ([data-tilt], .tilt-glare); the Golden Tickets add their own foil on top.

const STRENGTH: Record<string, [x: number, y: number]> = {
  card: [16, 20],
  holo: [18, 22],
  tile: [26, 26],
  photo: [5, 7],
};

export function initTilt(root: ParentNode = document) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  for (const el of root.querySelectorAll<HTMLElement>('[data-tilt]')) {
    if (el.dataset.tiltReady) continue;
    el.dataset.tiltReady = '1';
    const kind = el.dataset.tilt || 'card';
    const [sx, sy] = STRENGTH[kind] ?? STRENGTH.card;

    // Cards get a glare layer; images can't hold children, and tiles read better without it.
    if ((kind === 'card') && !el.querySelector('.tilt-glare, .glare')) {
      const g = document.createElement('span');
      g.className = 'tilt-glare';
      g.setAttribute('aria-hidden', 'true');
      el.append(g);
    }

    const set = (x: number, y: number, on: number) => {
      el.style.setProperty('--mx', `${(x * 100).toFixed(1)}%`);
      el.style.setProperty('--my', `${(y * 100).toFixed(1)}%`);
      el.style.setProperty('--on', String(on));
      el.style.setProperty('--rx', reduce.matches ? '0deg' : `${((0.5 - y) * sx).toFixed(2)}deg`);
      el.style.setProperty('--ry', reduce.matches ? '0deg' : `${((x - 0.5) * sy).toFixed(2)}deg`);
    };
    // While the pointer moves the object follows it closely; component styles may set slower transitions.
    const FOLLOW = 'transform 80ms linear, scale 382ms ease, filter 382ms ease, rotate 618ms ease, translate 618ms ease';
    const rest = () => {
      el.classList.remove('tilting');
      el.style.transition = '';
      set(0.5, 0.5, 0);
    };

    el.addEventListener('pointermove', (ev) => {
      const r = el.getBoundingClientRect();
      el.classList.add('tilting');
      el.style.transition = FOLLOW;
      set(Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (ev.clientY - r.top) / r.height)), 1);
    });
    el.addEventListener('pointerleave', rest);
    el.addEventListener('pointercancel', rest);
    if (el.tabIndex >= 0) {
      el.addEventListener('focus', () => set(0.3, 0.25, 0.7));
      el.addEventListener('blur', rest);
    }
  }
}
