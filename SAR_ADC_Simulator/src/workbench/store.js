// One source of state for all pages.

import { createValues, SEED } from './values.js';
import { design } from './design.js';

const KEY = 'zaan-workbench-v3';
const VKEY = 'zaan-workbench-versions-v2';

export const store = {
  values: createValues(),
  ui: { page: 'system', showTop: true, showSide: true, weightMode: 'generator', customWeights: '256, 136, 72, 40, 24, 16, 8, 4, 2, 1, 1', compareA: null, theme: 'dark', vin: 0.217, arrayGain: true, alloc: {}, sarMode: 'diff', optGoal: 'enob', optRes: true, sweep: 'compNoise', bfDelays: true },
  versions: [],
  ctx: null,
  listeners: [],
};

export function subscribe(fn) {
  store.listeners.push(fn);
}

let raf = 0;
let pending = new Set();
/** Queue a redraw. Reasons collected in one frame are merged; a new design is computed once. */
export function changed(reason = 'values') {
  pending.add(reason);
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(() => {
    const rs = pending;
    pending = new Set();
    if (rs.has('values')) store.ctx = design(store.values, store.ui);
    save();
    const order = rs.has('page') ? ['page'] : ['values', 'side', 'layout', 'ui', 'meta'].filter((r) => rs.has(r));
    for (const r of order) for (const fn of store.listeners) fn(r);
  });
}

export function setValue(id, raw) {
  const v = store.values.find((x) => x.id === id);
  if (!v) return;
  if (v.kind === 'num') {
    if (raw === '' || raw === null) v.value = null;
    else if (Number.isFinite(Number(raw))) v.value = Number(raw);
    else return;
  } else v.value = raw;
  changed('values');
}

export function resetValues(group = null) {
  for (const s of SEED) {
    if (group && s.group !== group) continue;
    const i = store.values.findIndex((v) => v.id === s.id);
    store.values[i] = { ...s };
  }
  changed('values');
}

export function setUi(patch, reason = 'ui') {
  Object.assign(store.ui, patch);
  changed(reason);
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify({ values: store.values.map(({ id, value, source }) => ({ id, value, source })), ui: store.ui }));
  } catch {
    /* storage unavailable */
  }
}

export function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (s) {
      for (const sv of s.values || []) {
        const v = store.values.find((x) => x.id === sv.id);
        if (v) Object.assign(v, { value: sv.value, source: sv.source ?? v.source });
      }
      Object.assign(store.ui, s.ui || {});
    }
    store.versions = JSON.parse(localStorage.getItem(VKEY) || '[]');
  } catch {
    /* start from the seed */
  }
  const h = location.hash.replace('#', '');
  if (h) store.ui.page = h;
  store.ctx = design(store.values, store.ui);
}

function snapshot(name) {
  return { name, date: new Date().toISOString(), values: store.values.map(({ id, value, source }) => ({ id, value, source })), ui: { weightMode: store.ui.weightMode, customWeights: store.ui.customWeights, arrayGain: store.ui.arrayGain, alloc: store.ui.alloc } };
}
function saveVersions() {
  try {
    localStorage.setItem(VKEY, JSON.stringify(store.versions));
  } catch {
    /* ignore */
  }
}
export function saveVersion(name) {
  store.versions = store.versions.filter((v) => v.name !== name).concat([snapshot(name)]);
  saveVersions();
  changed('ui');
}
export function deleteVersion(name) {
  store.versions = store.versions.filter((v) => v.name !== name);
  saveVersions();
  changed('ui');
}
export function loadVersion(name) {
  const ver = store.versions.find((v) => v.name === name);
  if (ver) applySnapshot(ver);
}
function applySnapshot(ver) {
  store.values = createValues();
  for (const sv of ver.values) {
    const v = store.values.find((x) => x.id === sv.id);
    if (v) Object.assign(v, sv);
  }
  Object.assign(store.ui, ver.ui || {});
  changed('values');
}
export function exportJson() {
  return JSON.stringify({ format: 'zaan-workbench', version: 2, current: snapshot('current'), versions: store.versions }, null, 2);
}
export function importJson(text) {
  const data = JSON.parse(text);
  if (data.format !== 'zaan-workbench') throw new Error('Not a Zaan workbench file');
  for (const ver of data.versions || []) store.versions = store.versions.filter((v) => v.name !== ver.name).concat([ver]);
  saveVersions();
  if (data.current) applySnapshot(data.current);
}
