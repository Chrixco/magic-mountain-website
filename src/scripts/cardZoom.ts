// Click a card to lift it off the table and look at it closely; click outside (or press Escape) and it
// glides back to its place. Works for any element marked data-zoom (Day, Food and Golden Ticket cards).
//
// The enlarged card is two-sided: the front keeps its own light (holo foil on Golden Tickets, a soft glare on
// the others), the back is the shared card back with a light gloss. It only turns over when asked: the
// "Flip card" button (or the F key).
//
// Technique: the enlarged copy is laid out at its final size and animated from the original card's
// position and scale (FLIP), so it is rendered sharp when it arrives.

const OPEN_EASE = 'cubic-bezier(.22, 1, .36, 1)'; // glides in and settles, no bounce
const CLOSE_EASE = 'cubic-bezier(.45, 0, .2, 1)';
const FLIP_EASE = 'cubic-bezier(.65, 0, .35, 1)'; // even turn: eases in and out, steady in the middle
const OPEN_TIME = 1100;
const BACK = `${import.meta.env.BASE_URL.replace(/\/?$/, '/')}cards/card-back.webp`;

/** Rotation of an element or its close ancestors, from the CSS `rotate` property or a 2D transform. */
function restingAngle(el: Element): number {
  let total = 0;
  for (let n: Element | null = el, i = 0; n && i < 3; n = n.parentElement, i++) {
    const cs = getComputedStyle(n);
    if (cs.rotate && cs.rotate !== 'none') total += parseFloat(cs.rotate);
    const m = cs.transform.match(/^matrix\(([^)]+)\)/);
    if (m) {
      const [a, b] = m[1].split(',').map(Number);
      total += (Math.atan2(b, a) * 180) / Math.PI;
    }
  }
  return total;
}

interface Open {
  source: HTMLElement;
  layer: HTMLElement;
  holder: HTMLElement;
  flipper: HTMLElement;
  backdrop: HTMLElement;
  angle: number; // current turn of the card, in degrees (0, 180, 360 …)
}

export function initCardZoom() {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  let open: Open | null = null;
  let busy = false;
  new Image().src = BACK; // ready before the first flip

  function geometry(source: HTMLElement) {
    const r = source.getBoundingClientRect();
    const w0 = source.offsetWidth, h0 = source.offsetHeight;
    const vw = innerWidth, vh = innerHeight;
    // Final size: as large as fits in a golden share of the screen, leaving room for the button below.
    const s = Math.min((vw * 0.854) / w0, (vh * 0.69) / h0, 900 / w0);
    const w = w0 * s, h = h0 * s;
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    return {
      w, h,
      from: `translate(${cx - vw / 2}px, ${cy - vh / 2}px) rotate(${restingAngle(source)}deg) scale(${1 / s})`,
    };
  }

  function show(source: HTMLElement) {
    if (open || busy) return;
    busy = true;
    const backdrop = document.createElement('div');
    backdrop.className = 'zoom-backdrop';
    const layer = document.createElement('div');
    layer.className = 'zoom-layer';
    layer.setAttribute('role', 'dialog');
    layer.setAttribute('aria-modal', 'true');
    layer.setAttribute('aria-label', source.querySelector('img')?.alt ?? 'Card');
    layer.tabIndex = -1;

    const g = geometry(source);
    const landscape = g.w > g.h;
    const holder = document.createElement('div');
    holder.className = 'zoom-holder';
    holder.style.width = `${g.w}px`;
    holder.style.height = `${g.h}px`;

    // holder (flies in and out) › tilt (leans toward the pointer) › flipper (turns over) › front + back
    const tilt = document.createElement('div');
    tilt.className = 'zoom-tilt';
    const flipper = document.createElement('div');
    flipper.className = 'zoom-flipper';

    // Front: a copy of the card, with an image source sized for the big view.
    const front = source.cloneNode(true) as HTMLElement;
    for (const a of ['data-tilt', 'data-tilt-ready', 'data-zoom', 'aria-haspopup', 'tabindex', 'role', 'aria-label', 'style']) front.removeAttribute(a);
    front.querySelector('.tilt-glare')?.remove();
    front.classList.add('zoom-copy', 'zoom-face');
    if (!front.querySelector('.foil')) {
      const glare = document.createElement('span');
      glare.className = 'tilt-glare';
      front.append(glare);
    }
    const img = front.querySelector('img');
    if (img) { img.sizes = `${Math.ceil(g.w)}px`; img.loading = 'eager'; }

    // Back: the shared card back (turned sideways for landscape cards) with a light gloss, no foil.
    const back = document.createElement('div');
    back.className = `zoom-face zoom-back${landscape ? ' landscape' : ''}`;
    back.innerHTML = `<img src="${BACK}" alt="" draggable="false"><span class="back-gloss" aria-hidden="true"></span>`;

    flipper.append(front, back);
    tilt.append(flipper);
    holder.append(tilt);

    const bar = document.createElement('div');
    bar.className = 'zoom-bar';
    bar.innerHTML = `
      <button type="button" class="zoom-flip" aria-pressed="false">
        <svg viewBox="0 0 24 24" width="1.272em" height="1.272em" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12a8 8 0 0 1 13.7-5.6L20 8.7"/><path d="M20 4v4.7h-4.7"/><path d="M20 12a8 8 0 0 1-13.7 5.6L4 15.3"/><path d="M4 20v-4.7h4.7"/></svg>
        <span>Flip card</span>
      </button>
      <p class="zoom-hint">Click outside the card to put it back</p>`;
    layer.append(holder, bar);
    document.body.append(backdrop, layer);

    // Pointer light: the card leans toward the pointer; the front's foil/glare and the back's gloss follow it.
    const faces = [front, back];
    const setLight = (x: number, y: number, on: number) => {
      for (const f of faces) {
        f.style.setProperty('--mx', `${(x * 100).toFixed(1)}%`);
        f.style.setProperty('--my', `${(y * 100).toFixed(1)}%`);
        f.style.setProperty('--on', String(on));
      }
      if (!reduce.matches) {
        tilt.style.setProperty('--rx', `${((0.5 - y) * 16).toFixed(2)}deg`);
        tilt.style.setProperty('--ry', `${((x - 0.5) * 20).toFixed(2)}deg`);
      }
    };
    front.style.setProperty('--rx', '0deg');
    front.style.setProperty('--ry', '0deg');
    setLight(0.5, 0.5, 0);
    holder.addEventListener('pointermove', (ev) => {
      const r = holder.getBoundingClientRect();
      tilt.classList.add('tilting');
      setLight(Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (ev.clientY - r.top) / r.height)), 1);
    });
    holder.addEventListener('pointerleave', () => {
      tilt.classList.remove('tilting');
      setLight(0.5, 0.5, 0);
      tilt.style.setProperty('--rx', '0deg');
      tilt.style.setProperty('--ry', '0deg');
    });
    bar.querySelector('.zoom-flip')!.addEventListener('click', () => flip());

    source.style.visibility = 'hidden';
    open = { source, layer, holder, flipper, backdrop, angle: 0 };

    const t = reduce.matches ? 1 : 618;
    backdrop.animate([{ opacity: 0 }, { opacity: 1 }], { duration: t * 0.618, easing: 'ease-out', fill: 'both' });
    holder.animate(
      [
        { transform: g.from, boxShadow: '0 4px 12px rgb(34 48 60 / .2)' },
        { transform: 'none', boxShadow: '0 1.618rem 4.236rem -1rem rgb(34 48 60 / .45)' },
      ],
      { duration: reduce.matches ? 1 : OPEN_TIME, easing: OPEN_EASE, fill: 'both' },
    ).finished.then(() => { busy = false; });
    bar.animate([{ opacity: 0, transform: 'translate(-50%, 6px)' }, { opacity: 1, transform: 'translate(-50%, 0)' }], { duration: t, delay: t * 0.618, easing: 'ease-out', fill: 'both' });
    layer.focus({ preventScroll: true });
  }

  function flip() {
    if (!open) return;
    const o = open;
    const from = o.angle, to = from + 180;
    o.angle = to;
    const btn = o.layer.querySelector<HTMLButtonElement>('.zoom-flip')!;
    const showingBack = (to / 180) % 2 === 1;
    btn.setAttribute('aria-pressed', String(showingBack));
    btn.querySelector('span')!.textContent = showingBack ? 'Show the front' : 'Flip card';
    o.flipper.style.transform = `rotateY(${to}deg)`;
    if (!reduce.matches) {
      o.flipper.animate(
        [
          { transform: `rotateY(${from}deg)` },
          { transform: `translateZ(24px) rotateY(${from + 90}deg)`, offset: 0.5 },
          { transform: `rotateY(${to}deg)` },
        ],
        { duration: 900, easing: FLIP_EASE },
      );
    }
  }

  async function hide() {
    if (!open || busy) return;
    busy = true;
    const { source, layer, holder, flipper, backdrop, angle } = open;
    const g = geometry(source); // where the card is now, even if the page scrolled meanwhile
    const t = reduce.matches ? 1 : 560;
    layer.querySelector('.zoom-bar')?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: t * 0.382, fill: 'both' });
    backdrop.animate([{ opacity: 1 }, { opacity: 0 }], { duration: t, easing: 'ease-in-out', fill: 'both' });
    // If the back is showing, the card turns face up again on its way home.
    if (angle % 360 !== 0 && !reduce.matches) {
      flipper.animate([{ transform: `rotateY(${angle}deg)` }, { transform: `rotateY(${angle + 180}deg)` }], { duration: t, easing: FLIP_EASE, fill: 'both' });
    }
    await holder.animate(
      [
        { transform: 'none' },
        { transform: g.from },
      ],
      { duration: t, easing: CLOSE_EASE, fill: 'both' },
    ).finished;
    source.style.visibility = '';
    layer.remove();
    backdrop.remove();
    open = null;
    busy = false;
    source.focus({ preventScroll: true });
  }

  for (const card of document.querySelectorAll<HTMLElement>('[data-zoom]')) {
    if (!card.hasAttribute('tabindex')) card.tabIndex = 0;
    card.setAttribute('aria-haspopup', 'dialog');
    card.addEventListener('click', () => show(card));
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); show(card); }
    });
  }

  // Outside the card (and its button) closes it; the card itself keeps responding to the pointer.
  document.addEventListener('click', (e) => {
    const t = e.target as Element;
    if (open && !open.holder.contains(t) && !t.closest?.('[data-zoom], .zoom-bar')) hide();
  });
  document.addEventListener('keydown', (e) => {
    if (!open) return;
    if (e.key === 'Escape') hide();
    if ((e.key === 'f' || e.key === 'F') && !e.metaKey && !e.ctrlKey && !e.altKey) flip();
  });
}
