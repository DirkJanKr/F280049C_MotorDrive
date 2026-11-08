// Pan and zoom of the schematic. Level follows the zoom: system blocks,
// block level, component detail. Clicking an element selects it.

import { WORLD, BOXES, PARENT } from './schematic.js';

const view = { x: 0, y: 0, w: WORLD.w, h: WORLD.h };
let host = null;
let onSelect = () => {};

export function levelOf() {
  if (!host) return 1;
  const scale = host.clientWidth / view.w;
  return scale < 0.75 ? 1 : scale < 1.7 ? 2 : 3;
}

function apply() {
  const svg = host?.querySelector('svg');
  if (!svg) return;
  svg.setAttribute('viewBox', `${view.x} ${view.y} ${view.w} ${view.h}`);
  svg.dataset.level = String(levelOf());
  const lv = document.getElementById('lvl');
  if (lv) for (const b of lv.querySelectorAll('button')) b.classList.toggle('on', Number(b.dataset.level) === levelOf());
}

export function fitAll() {
  const ar = host.clientHeight / host.clientWidth || 0.5;
  view.w = WORLD.w;
  view.h = Math.max(WORLD.h, WORLD.w * ar);
  view.x = 0;
  view.y = (WORLD.h - view.h) / 2;
  apply();
}

/** Zoom so that a box fills the view, at a given minimum level. */
export function zoomTo(box, minScale = 0) {
  const [bx, by, bw, bh] = box;
  const ar = host.clientHeight / host.clientWidth || 0.5;
  let w = Math.max(bw * 1.1, (bh * 1.1) / ar);
  if (minScale) w = Math.min(w, host.clientWidth / minScale);
  view.w = w;
  view.h = w * ar;
  view.x = bx + bw / 2 - view.w / 2;
  view.y = by + bh / 2 - view.h / 2;
  apply();
}

export function zoomLevel(level, selId) {
  if (level === 1) return fitAll();
  const id = BOXES[selId] && selId !== 'sys' ? selId : 'node';
  const parent = BOXES[PARENT[id] || id];
  if (level === 2) zoomTo(parent, 0.8);
  else {
    const box = BOXES[id];
    zoomTo([box[0] + box[2] / 4, box[1] + box[3] / 4, box[2] / 2, box[3] / 2], 1.8);
  }
}

export function highlight(id) {
  const r = document.getElementById('hilite');
  const b = BOXES[id];
  if (!r || !b) return;
  r.setAttribute('x', b[0] - 8);
  r.setAttribute('y', b[1] - 8);
  r.setAttribute('width', b[2] + 16);
  r.setAttribute('height', b[3] + 16);
}

export function mountSchematic(el, html, select) {
  const first = !host;
  host = el;
  onSelect = select;
  el.innerHTML = html;
  if (first) {
    bind();
    requestAnimationFrame(fitAll);
  } else apply();
}

function bind() {
  let drag = null;
  host.addEventListener('wheel', (e) => {
    e.preventDefault();
    const r = host.getBoundingClientRect();
    const fx = (e.clientX - r.left) / r.width;
    const fy = (e.clientY - r.top) / r.height;
    const k = Math.exp(e.deltaY * 0.0015);
    const nw = Math.min(WORLD.w * 1.6, Math.max(200, view.w * k));
    const nh = (nw / view.w) * view.h;
    view.x += (view.w - nw) * fx;
    view.y += (view.h - nh) * fy;
    view.w = nw;
    view.h = nh;
    apply();
  }, { passive: false });
  host.addEventListener('pointerdown', (e) => {
    drag = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y, moved: false };
    host.setPointerCapture(e.pointerId);
  });
  host.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const s = view.w / host.clientWidth;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
    view.x = drag.vx - dx * s;
    view.y = drag.vy - dy * s;
    apply();
  });
  host.addEventListener('pointerup', (e) => {
    const wasDrag = drag && drag.moved;
    drag = null;
    if (wasDrag) return;
    const target = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-el]');
    if (target) onSelect(target.dataset.el);
  });
  window.addEventListener('resize', () => apply());
}
