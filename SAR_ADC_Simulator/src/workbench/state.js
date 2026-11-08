// The one source of state. Schematic, graphs, animations and the values bar
// all read from here and re-render on change.

import { createValues, SEED, today } from './values.js';
import { derive } from './derive.js';

const KEY = 'zaan-workbench-v1';
const VKEY = 'zaan-workbench-versions-v1';

export const store = {
  values: createValues(),
  overrides: {},
  ui: { sel: 'sys', level: 1, dock: 'system', pinned: [], overlays: [], theme: 'dark', anim: { input: 0.217 } },
  versions: [],
  ctx: null,
  listeners: [],
};

export function subscribe(fn) {
  store.listeners.push(fn);
}

let pending = 0;
export function changed(reason = 'values') {
  cancelAnimationFrame(pending);
  pending = requestAnimationFrame(() => {
    if (reason === 'values') store.ctx = derive(store.values, store.overrides);
    save();
    for (const fn of store.listeners) fn(reason);
  });
}

export function getValue(id) {
  return store.values.find((v) => v.id === id);
}

/** Typing a value: an unknown or assumed value becomes U with today's date. */
export function setValue(id, raw) {
  const v = getValue(id);
  if (!v) return;
  if (v.kind === 'num') {
    if (raw === '' || raw === null) v.value = null;
    else {
      const x = Number(raw);
      if (!Number.isFinite(x)) return;
      v.value = x;
    }
  } else v.value = raw === '' ? null : raw;
  if (v.value !== null && (v.status === '?' || v.status === 'A')) {
    v.status = 'U';
    v.date = today();
    if (!/typed in the workbench/.test(v.source)) v.source = `${v.source}; typed in the workbench`;
  }
  changed('values');
}

export function setSource(id, text) {
  const v = getValue(id);
  if (v) v.source = text;
  changed('meta');
}

export function resetValue(id) {
  const seed = SEED.find((s) => s.id === id);
  const i = store.values.findIndex((v) => v.id === id);
  if (seed && i >= 0) store.values[i] = { ...seed };
  changed('values');
}

export function setOverride(key, value) {
  if (value === null) delete store.overrides[key];
  else store.overrides[key] = value;
  changed('values');
}

export function setUi(patch, reason = 'ui') {
  Object.assign(store.ui, patch);
  changed(reason);
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify({ values: store.values, overrides: store.overrides, ui: { ...store.ui, anim: undefined } }));
  } catch {
    /* storage unavailable */
  }
}

export function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (s) {
      for (const sv of s.values || []) {
        const i = store.values.findIndex((v) => v.id === sv.id);
        if (i >= 0) store.values[i] = { ...store.values[i], value: sv.value, status: sv.status, source: sv.source, date: sv.date };
      }
      store.overrides = s.overrides || {};
      Object.assign(store.ui, s.ui || {}, { anim: store.ui.anim });
    }
    store.versions = JSON.parse(localStorage.getItem(VKEY) || '[]');
  } catch {
    /* start from the seed */
  }
  store.ctx = derive(store.values, store.overrides);
}

// ---- design versions -------------------------------------------------------
function snapshot(name) {
  return { name, date: new Date().toISOString(), values: store.values.map(({ id, value, status, source, date }) => ({ id, value, status, source, date })), overrides: { ...store.overrides } };
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
  changed('versions');
}

export function deleteVersion(name) {
  store.versions = store.versions.filter((v) => v.name !== name);
  store.ui.overlays = store.ui.overlays.filter((n) => n !== name);
  saveVersions();
  changed('versions');
}

export function loadVersion(name) {
  const ver = store.versions.find((v) => v.name === name);
  if (!ver) return;
  applySnapshot(ver);
}

function applySnapshot(ver) {
  store.values = createValues();
  for (const sv of ver.values) {
    const i = store.values.findIndex((v) => v.id === sv.id);
    if (i >= 0) store.values[i] = { ...store.values[i], ...sv };
  }
  store.overrides = { ...(ver.overrides || {}) };
  changed('values');
}

/** Values of a saved version, as a full value list (for overlays). */
export function versionValues(name) {
  const ver = store.versions.find((v) => v.name === name);
  if (!ver) return null;
  const vals = createValues();
  for (const sv of ver.values) {
    const i = vals.findIndex((v) => v.id === sv.id);
    if (i >= 0) vals[i] = { ...vals[i], ...sv };
  }
  return { values: vals, overrides: ver.overrides || {} };
}

export function exportJson() {
  return JSON.stringify({ format: 'zaan-workbench', version: 1, current: snapshot('current'), versions: store.versions }, null, 2);
}

export function importJson(text) {
  const data = JSON.parse(text);
  if (data.format !== 'zaan-workbench') throw new Error('Not a Zaan workbench file');
  for (const ver of data.versions || []) store.versions = store.versions.filter((v) => v.name !== ver.name).concat([ver]);
  saveVersions();
  if (data.current) applySnapshot(data.current);
  else changed('versions');
}

export function resetAll() {
  store.values = createValues();
  store.overrides = {};
  changed('values');
}
