// Page state. Edits stay in this browser (localStorage); nothing is sent anywhere.

import { createRegistry, DEFAULT_PARAMS } from '../params.js';

const KEY = 'zaan-workbench-v3';

export const UI_DEFAULTS = { vin: 0.217, useChip: false, z1: 8, z2: 14, z3: 20, weak: -20, bone: 26, level: -6 };

export function createState() {
  const state = { reg: createRegistry(), ui: { ...UI_DEFAULTS }, wideTable: true };
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (saved) {
      for (const [id, v] of Object.entries(saved.values || {})) {
        const p = state.reg.find((x) => x.id === id);
        if (p && Number.isFinite(v)) p.value = v;
      }
      Object.assign(state.ui, saved.ui || {});
    }
  } catch {
    /* storage unavailable: start from defaults */
  }
  return state;
}

export function saveState(state) {
  const values = {};
  for (const p of state.reg) if (isEdited(p)) values[p.id] = p.value;
  try {
    localStorage.setItem(KEY, JSON.stringify({ values, ui: state.ui }));
  } catch {
    /* ignore */
  }
}

export function isEdited(p) {
  const d = DEFAULT_PARAMS.find((x) => x.id === p.id);
  return !!d && d.value !== p.value;
}

export function resetParam(state, id) {
  const d = DEFAULT_PARAMS.find((x) => x.id === id);
  state.reg.find((x) => x.id === id).value = d.value;
}

export function resetAll(state) {
  for (const p of state.reg) resetParam(state, p.id);
  state.ui = { ...UI_DEFAULTS };
}
