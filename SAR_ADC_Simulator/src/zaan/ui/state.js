// Page state. Edits stay in this browser (localStorage); nothing is sent anywhere.

import { createRegistry, DEFAULT_PARAMS } from '../params.js';
import { DEFAULT_SHARES } from '../noiseBudget.js';
import { defaultLevels } from '../sourceLevels.js';

const KEY = 'zaan-workbench-v2';

export function createState() {
  const state = { reg: createRegistry(), shares: { ...DEFAULT_SHARES }, levels: defaultLevels(), decisions: {}, wideTable: true };
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (saved) {
      for (const [id, v] of Object.entries(saved.values || {})) {
        const p = state.reg.find((x) => x.id === id);
        if (p && Number.isFinite(v)) p.value = v;
      }
      Object.assign(state.shares, saved.shares || {});
      Object.assign(state.levels, saved.levels || {});
      Object.assign(state.decisions, saved.decisions || {});
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
    localStorage.setItem(KEY, JSON.stringify({ values, shares: state.shares, levels: state.levels, decisions: state.decisions }));
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
