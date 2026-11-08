// Graph dock: tabs per block, pinned graphs, overlays of saved versions,
// heavy graphs computed after a short pause.

import { SYSTEM_GRAPHS } from './graphs/system.js';
import { BEAM_GRAPHS } from './graphs/beam.js';
import { CDAC_GRAPHS, runMc, mc } from './graphs/cdac.js';
import { COMP_GRAPHS, drawConversionPanels } from './graphs/comp.js';
import { lp, needs } from './graphs/common.js';
import { startBeamAnim } from './anim/beamAnim.js';
import { playCalibration } from './anim/calAnim.js';
import { startRefAnim } from './anim/refAnim.js';
import { store, setUi, versionValues } from './state.js';
import { derive } from './derive.js';
import { esc } from '../zaan/ui/fmt.js';
import { termify } from './terms.js';

export const TABS = [
  ['system', 'System'], ['beamformer', 'Beamformer'], ['cdac', 'CDAC'], ['reference', 'Reference'], ['sampling', 'Sampling switch'],
  ['comparator', 'Comparator'], ['timing', 'SAR logic and timing'], ['iq', 'IQ and image'], ['conversion', 'Conversion'],
];

const BEAM_ANIM = { id: 'bfanim', tab: 'beamformer', title: 'Echo arriving, cells written on CLK and CLK 180°, delayed cells read and summed', anim: 'beam', html: (ctx, v, w) => `<canvas id="bfcv" width="${w}" height="300" class="cv"></canvas>` };
export const GRAPHS = [...SYSTEM_GRAPHS, BEAM_ANIM, ...BEAM_GRAPHS, ...CDAC_GRAPHS, ...COMP_GRAPHS];

const heavyCache = new Map();
let heavyTimer = 0;
let ctxStamp = 0;
let lastCtx = null;
const versionCtx = new Map();

function overlayCtx(name) {
  const vv = versionValues(name);
  if (!vv) return null;
  const key = name + JSON.stringify(vv.values.map((x) => x.value));
  if (!versionCtx.has(key)) versionCtx.set(key, derive(vv.values, vv.overrides));
  return versionCtx.get(key);
}

function body(def, ctx, values, w) {
  if (def.spec) {
    const spec = def.spec(ctx, values);
    if (!spec) return needs((def.needs || []).map((id) => values.find((x) => x.id === id)?.label || id));
    if (!def.heavy) {
      for (const name of store.ui.overlays) {
        const oc = overlayCtx(name);
        if (!oc) continue;
        const os = def.spec(oc, values);
        if (os) spec.series = spec.series.concat(os.series.filter((s) => s.mode !== 'dots').map((s) => ({ ...s, dash: '2 3', width: 1.3, opacity: 0.7, label: s.label ? `${name}: ${s.label}` : name })));
      }
    }
    return lp(spec, w);
  }
  return def.html(ctx, values, w);
}

function card(def, ctx, values, w, pinned) {
  let content;
  if (def.heavy) {
    const c = heavyCache.get(def.id);
    content = c && c.stamp === ctxStamp ? c.html : `<p class="cap busy">Computing…</p>`;
  } else content = body(def, ctx, values, w);
  const cap = def.caption && (!def.heavy || heavyCache.get(def.id)?.stamp === ctxStamp) ? def.caption(ctx, values) : '';
  const used = new Set();
  return `<section class="gcard ${pinned ? 'pinned' : ''}" data-g="${def.id}">
    <header><h3>${termify(def.title, used)}</h3><span class="gact">${def.button ? `<button class="mini" data-btn="${def.id}">${esc(def.button)}</button>` : ''}<button class="mini pin ${pinned ? 'on' : ''}" data-pin="${def.id}" title="${pinned ? 'Unpin' : 'Pin: keep this graph visible on every tab'}">${pinned ? 'pinned' : 'pin'}</button></span></header>
    <div class="gbody" id="gb-${def.id}">${content}</div>${cap ? `<p class="cap">${termify(cap, used)}</p>` : ''}</section>`;
}

function cardWidth(el, cols) {
  const wTot = el.clientWidth || 900;
  return Math.max(320, Math.floor((wTot - 24 - (cols - 1) * 12) / cols) - 26);
}

export function renderDock(el, ctx, values, fresh) {
  if (fresh) {
    ctxStamp++;
    lastCtx = ctx;
    scheduleHeavy(values);
  }
  const tab = store.ui.dock;
  const pinned = store.ui.pinned.map((id) => GRAPHS.find((g) => g.id === id)).filter(Boolean);
  const list = GRAPHS.filter((g) => g.tab === tab && !store.ui.pinned.includes(g.id));
  const cols = el.clientWidth > 1250 ? 3 : el.clientWidth > 760 ? 2 : 1;
  const w = cardWidth(el, cols);
  const tabs = TABS.map(([id, label]) => `<button class="dtab ${id === tab ? 'on' : ''}" data-tab="${id}">${label}</button>`).join('');
  el.innerHTML = `<nav class="dtabs">${tabs}<span class="dsp"></span>${overlayPicker()}</nav>
    <div class="dgrid" style="grid-template-columns: repeat(${cols}, minmax(0, 1fr))">${pinned.map((g) => card(g, ctx, values, w, true)).join('')}${list.map((g) => card(g, ctx, values, w, false)).join('')}</div>`;
  afterRender(ctx, values, w);
}

function overlayPicker() {
  if (!store.versions.length) return '<span class="dhint">Save a design version to overlay it on the graphs</span>';
  return `<span class="dhint">Overlay:</span>${store.versions.map((v) => `<label class="ov"><input type="checkbox" data-overlay="${esc(v.name)}" ${store.ui.overlays.includes(v.name) ? 'checked' : ''}/> ${esc(v.name)}</label>`).join('')}`;
}

function afterRender(ctx, values, w) {
  const bf = document.getElementById('bfcv');
  if (bf) startBeamAnim(bf, ctx);
  const rc = document.getElementById('refcv');
  if (rc) startRefAnim(rc, ctx, values.find((v) => v.id === 'refVariant').value, false);
  drawConversionPanels(ctx);
}

function scheduleHeavy(values) {
  clearTimeout(heavyTimer);
  const stamp = ctxStamp;
  heavyTimer = setTimeout(() => {
    const queue = GRAPHS.filter((g) => g.heavy);
    const next = () => {
      if (stamp !== ctxStamp) return;
      const def = queue.shift();
      if (!def) return;
      const el = document.getElementById(`gb-${def.id}`);
      const w = el ? el.clientWidth - 4 : 600;
      try {
        heavyCache.set(def.id, { stamp, html: body(def, lastCtx, values, Math.max(320, w)) });
      } catch (err) {
        heavyCache.set(def.id, { stamp, html: `<p class="cap bad">Could not compute: ${esc(err.message)}</p>` });
      }
      const box = document.querySelector(`[data-g="${def.id}"]`);
      if (box) box.outerHTML = card(def, lastCtx, values, Math.max(320, w), store.ui.pinned.includes(def.id));
      setTimeout(next, 0);
    };
    next();
  }, 500);
}

export function bindDock(el, getCtx) {
  el.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.tab) setUi({ dock: b.dataset.tab });
    else if (b.dataset.pin) {
      const id = b.dataset.pin;
      setUi({ pinned: store.ui.pinned.includes(id) ? store.ui.pinned.filter((x) => x !== id) : [...store.ui.pinned, id] });
    } else if (b.dataset.btn === 'mc') {
      b.textContent = 'Running…';
      runMc(getCtx(), () => setUi({}, 'ui'));
      setUi({}, 'ui');
    } else if (b.dataset.btn === 'calanim') {
      const box = document.getElementById('calbox');
      if (box) playCalibration(box, getCtx(), box.clientWidth - 4);
    } else if (b.dataset.btn === 'refPulses') {
      startRefAnim(document.getElementById('refcv'), getCtx(), store.values.find((v) => v.id === 'refVariant').value, true);
    }
  });
  el.addEventListener('change', (e) => {
    const o = e.target.dataset.overlay;
    if (o === undefined) return;
    setUi({ overlays: e.target.checked ? [...store.ui.overlays, o] : store.ui.overlays.filter((x) => x !== o) });
  });
}

export { mc };
