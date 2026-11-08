// Zaan workbench: one screen. Values bar on top, parameters left, schematic centre,
// inspector right, graph dock below. Everything reads the same store.

import { store, load, subscribe, setValue, setSource, setUi, setOverride, changed } from './state.js';
import { buildSchematic, BOXES, PARENT } from './schematic.js';
import { mountSchematic, zoomLevel, highlight, zoomTo, fitAll } from './schemView.js';
import { valuesBar, paramsPanel, inspector, openQuestions } from './panels.js';
import { renderDock, bindDock } from './dock.js';
import { ELEMENTS } from './elements.js';
import { anim, buildPlan, drawAt, play, pause, decisionStart } from './convAnim.js';
import { drawConversionPanels } from './graphs/comp.js';
import { ioPanel, bindIo } from './io.js';
import { num } from '../zaan/ui/fmt.js';

const $ = (id) => document.getElementById(id);

function select(id) {
  const el = ELEMENTS[id];
  const patch = { sel: id };
  if (el && el.dock && !id.startsWith('val:') && !id.startsWith('der:')) patch.dock = el.dock;
  setUi(patch, 'select');
}

function renderAll(reason) {
  const ctx = store.ctx;
  if (reason === 'values' || reason === 'init' || reason === 'versions') {
    mountSchematic($('schem-host'), buildSchematic(ctx, store.values), select);
    rebuildPlan();
  }
  $('vbar').innerHTML = valuesBar(ctx);
  if (reason !== 'select' || !$('params').innerHTML) {
    withFocus($('params'), () => ($('params').innerHTML = store.ui.leftTab === 'oq' ? openQuestions(ctx) : paramsPanel(ctx)));
  }
  $('ltab-p').classList.toggle('on', store.ui.leftTab !== 'oq');
  $('ltab-q').classList.toggle('on', store.ui.leftTab === 'oq');
  $('qn').textContent = String(store.values.filter((v) => v.value === null || v.status === '?').length + ctx.conflicts.length);
  withFocus($('insp'), () => ($('insp').innerHTML = inspector(ctx)));
  const sel = store.ui.sel || 'sys';
  const elId = sel.includes(':') ? null : sel;
  if (elId) highlight(elId);
  document.documentElement.dataset.theme = store.ui.theme;
  if (reason !== 'select' || store.ui.dock) renderDock($('dock'), ctx, store.values, reason === 'values' || reason === 'init' || reason === 'versions');
  if (reason === 'versions' && $('io').classList.contains('open')) $('io').innerHTML = ioPanel();
}

/** Re-render a panel and put the focus back on the same field (by its data attribute). */
function withFocus(panel, render) {
  const a = document.activeElement;
  const inside = a && panel.contains(a);
  const key = inside ? ['val', 'src', 'ovr'].map((k) => (a.dataset[k] ? `[data-${k}="${a.dataset[k]}"]` : '')).join('') : '';
  const scroll = panel.scrollTop;
  render();
  panel.scrollTop = scroll;
  if (key) panel.querySelector(key)?.focus();
}

function rebuildPlan() {
  const keepT = anim.plan ? anim.t / anim.plan.tEnd : 0;
  anim.plan = buildPlan(store.ctx, store.ui.anim.input);
  anim.t = Math.min(keepT * anim.plan.tEnd, anim.plan.tEnd);
  drawAt(anim.plan, store.ctx, anim.t);
  $('ain-v').textContent = `${num(store.ui.anim.input, 3)} V`;
}

function frame() {
  drawConversionPanels(store.ctx);
  $('aplay').textContent = anim.playing ? '❚❚ pause' : '▶ play';
  const k = anim.plan.phases.filter((p) => p.kind === 'decide' && p.t1 <= anim.t).length;
  $('astate').textContent = `decision ${Math.min(k + 1, store.ctx.d.decisions)} of ${store.ctx.d.decisions}`;
}

function bind() {
  // values typed on the left or in the inspector
  const onInput = (e) => {
    const t = e.target;
    if (t.dataset.val) setValue(t.dataset.val, t.value);
    else if (t.dataset.src) setSource(t.dataset.src, t.value);
    else if (t.dataset.ovr) setOverride(t.dataset.ovr, t.value === '' ? null : Number(t.value) * (t.dataset.unit === 'F' ? 1e-15 : 1));
  };
  for (const id of ['params', 'insp']) {
    $(id).addEventListener('change', onInput);
    $(id).addEventListener('toggle', (e) => {
      const g = e.target.dataset?.group;
      if (!g) return;
      const open = new Set(store.ui.openGroups || ['system', 'cdac']);
      if (e.target.open) open.add(g);
      else open.delete(g);
      store.ui.openGroups = [...open];
    }, true);
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-sel],[data-unlock],[data-lvl],#ltab-p,#ltab-q,#themeBtn,#ioBtn,#aplay,#astep,#aback,#arestart,#fitBtn');
    if (!b) return;
    if (b.dataset.unlock) {
      const key = b.dataset.unlock;
      setOverride(key, store.overrides[key] === undefined ? Number(b.dataset.cur) : null);
    } else if (b.dataset.sel) {
      select(b.dataset.sel);
      const id = b.dataset.sel;
      if (BOXES[id] && id !== 'sys' && b.closest('#params,#vbar,#insp')) zoomTo(BOXES[PARENT[id] || id], 0.8);
      if (b.dataset.focus) setTimeout(() => $(`row-${b.dataset.focus}`)?.scrollIntoView({ block: 'center' }), 50);
    } else if (b.dataset.lvl) zoomLevel(Number(b.dataset.lvl), store.ui.sel);
    else if (b.id === 'fitBtn') fitAll();
    else if (b.id === 'ltab-p') setUi({ leftTab: 'p' }, 'tab');
    else if (b.id === 'ltab-q') setUi({ leftTab: 'oq' }, 'tab');
    else if (b.id === 'themeBtn') setUi({ theme: store.ui.theme === 'dark' ? 'light' : 'dark' }, 'theme');
    else if (b.id === 'ioBtn') {
      $('io').classList.add('open');
      $('io').innerHTML = ioPanel();
    } else if (b.id === 'aplay') {
      if (anim.playing) pause();
      else {
        if (anim.t >= anim.plan.tEnd) anim.t = 0;
        if (store.ui.dock !== 'conversion' && !store.ui.pinned.includes('scope')) setUi({ dock: 'conversion' });
        play(store.ctx);
      }
      frame();
    } else if (b.id === 'astep' || b.id === 'aback') {
      pause();
      const k = anim.plan.phases.filter((p) => p.kind === 'decide' && p.t1 <= anim.t).length;
      const next = b.id === 'astep' ? Math.min(k, store.ctx.d.decisions - 1) : Math.max(k - 2, -1);
      anim.t = next < 0 ? 0 : decisionStart(anim.plan, next);
      drawAt(anim.plan, store.ctx, anim.t);
      frame();
    } else if (b.id === 'arestart') {
      pause();
      anim.t = 0;
      drawAt(anim.plan, store.ctx, 0);
      frame();
    }
  });
  $('aspeed').addEventListener('change', (e) => (anim.speed = Number(e.target.value)));
  $('ain').addEventListener('input', (e) => {
    store.ui.anim.input = Number(e.target.value);
    rebuildPlan();
    frame();
  });
  bindDock($('dock'), () => store.ctx);
  bindIo($('io'), () => $('io').classList.remove('open'));
  anim.onFrame = frame;
  let rz = 0;
  window.addEventListener('resize', () => {
    clearTimeout(rz);
    rz = setTimeout(() => renderDock($('dock'), store.ctx, store.values, false), 200);
  });
}

load();
const fs = store.ctx.P.fullScale;
$('ain').min = String(-fs / 2);
$('ain').max = String(fs / 2);
$('ain').value = String(store.ui.anim.input);
bind();
subscribe((reason) => renderAll(reason));
renderAll('init');
frame();
