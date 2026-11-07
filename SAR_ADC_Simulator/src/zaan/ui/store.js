// UI state for the Zaan page. Edits are kept in this browser only (localStorage).

import { createRegistry, DEFAULT_PARAMS } from '../params.js';
import { DEFAULT_SHARES } from '../noiseBudget.js';
import { defaultLevels } from '../sourceLevels.js';

const KEY = 'zaan-workbench-v1';

export function createState() {
  const state = {
    reg: createRegistry(),
    shares: { ...DEFAULT_SHARES },
    levels: defaultLevels(),
    enobBasis: 9,
    module: 'registry',
    tab: 'understand',
    wideTable: true,
  };
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (saved) {
      for (const [id, v] of Object.entries(saved.values || {})) {
        const p = state.reg.find((x) => x.id === id);
        if (p && Number.isFinite(v)) p.value = v;
      }
      Object.assign(state.shares, saved.shares || {});
      Object.assign(state.levels, saved.levels || {});
      if (saved.enobBasis) state.enobBasis = saved.enobBasis;
      if (saved.module) state.module = saved.module;
      if (saved.tab) state.tab = saved.tab;
    }
  } catch {
    /* storage unavailable: defaults */
  }
  return state;
}

export function saveState(state) {
  const values = {};
  for (const p of state.reg) {
    const d = DEFAULT_PARAMS.find((x) => x.id === p.id);
    if (d && d.value !== p.value) values[p.id] = p.value;
  }
  try {
    localStorage.setItem(KEY, JSON.stringify({ values, shares: state.shares, levels: state.levels, enobBasis: state.enobBasis, module: state.module, tab: state.tab }));
  } catch {
    /* ignore */
  }
}

export function isEdited(p) {
  const d = DEFAULT_PARAMS.find((x) => x.id === p.id);
  return d && d.value !== p.value;
}
