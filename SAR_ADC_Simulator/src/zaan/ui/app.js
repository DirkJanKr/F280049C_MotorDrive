// Zaan page controller: module and tab navigation, input handling.

import { computeBudget } from '../budget.js';
import { createState, saveState } from './store.js';
import { registryUnderstand, registryDesign, registrySimulate } from './registryView.js';
import { conflictsView } from './conflictsView.js';
import { budgetUnderstand } from './budgetUnderstand.js';
import { budgetDesign } from './budgetDesign.js';
import { budgetSimulate } from './budgetSimulate.js';
import { termsView } from './termsView.js';
import { DEFAULT_PARAMS } from '../params.js';
import { esc } from './fmt.js';

const MODULES = [
  { id: 'registry', label: 'A Registry', tabs: true },
  { id: 'conflicts', label: 'Conflicts', tabs: false },
  { id: 'budget', label: 'Budget', tabs: true },
  { id: 'cdac', label: 'B CDAC', later: 'phase 2, from 9 Nov' },
  { id: 'comparator', label: 'C Comparator', later: 'phase 3, 16 Nov' },
  { id: 'sampling', label: 'D Sampling and noise', later: 'phase 4, 23 Nov' },
  { id: 'beamformer', label: 'E Beamformer', later: 'phase 5' },
  { id: 'calibration', label: 'F Calibration', later: 'phase 6, 30 Nov block' },
  { id: 'iq', label: 'G IQ demodulator', later: 'phase 7, 30 Nov block' },
  { id: 'chain', label: 'H Full chain', later: 'phase 7' },
  { id: 'terms', label: 'Terms', tabs: false },
];
const TABS = [
  ['understand', 'Understand'],
  ['design', 'Design'],
  ['simulate', 'Simulate'],
];

const state = createState();
const $ = (id) => document.getElementById(id);

function render() {
  const mod = MODULES.find((m) => m.id === state.module) || MODULES[0];
  $('modules').innerHTML = MODULES.map((m) => `<button data-module="${m.id}" class="${m.id === mod.id ? 'on' : ''} ${m.later ? 'later' : ''}">${esc(m.label)}</button>`).join('');
  $('tabs').hidden = !mod.tabs;
  $('tabs').innerHTML = TABS.map(([id, label]) => `<button role="tab" data-tab="${id}" class="${state.tab === id ? 'on' : ''}" aria-selected="${state.tab === id}">${label}</button>`).join('');
  $('view').innerHTML = viewHtml(mod);
  saveState(state);
}

function viewHtml(mod) {
  if (mod.later) return `<div class="card"><h2>${esc(mod.label)}</h2><p>Arrives in ${esc(mod.later)}.</p></div>`;
  if (mod.id === 'conflicts') return conflictsView(state);
  if (mod.id === 'terms') return termsView();
  if (mod.id === 'registry') {
    if (state.tab === 'design') return registryDesign(state);
    if (state.tab === 'simulate') return registrySimulate(state);
    return registryUnderstand();
  }
  const b = computeBudget(state);
  if (state.tab === 'design') return budgetDesign(state, b);
  if (state.tab === 'simulate') return budgetSimulate(state, b);
  return budgetUnderstand(state, b);
}

/** Re-render but keep focus and caret in the input being edited. */
function renderKeepFocus(el) {
  const key = el && (el.dataset.param || el.dataset.share);
  const attr = el && (el.dataset.param ? 'data-param' : 'data-share');
  render();
  if (key) {
    const again = document.querySelector(`[${attr}="${key}"]`);
    if (again) again.focus();
  }
}

document.addEventListener('click', (e) => {
  const t = e.target.closest('button');
  if (!t) return;
  if (t.dataset.module) {
    state.module = t.dataset.module;
    render();
  } else if (t.dataset.tab) {
    state.tab = t.dataset.tab;
    render();
  } else if (t.dataset.reset) {
    const d = DEFAULT_PARAMS.find((x) => x.id === t.dataset.reset);
    state.reg.find((x) => x.id === d.id).value = d.value;
    render();
  } else if (t.dataset.copy) {
    const ta = $(t.dataset.copy);
    navigator.clipboard?.writeText(ta.value).then(
      () => (t.textContent = 'Copied'),
      () => ta.select()
    ) ?? ta.select();
  }
});

document.addEventListener('change', (e) => {
  const t = e.target;
  if (t.dataset.level) {
    state.levels[t.dataset.level] = t.value;
    render();
  } else if (t.name === 'enobBasis') {
    state.enobBasis = Number(t.value);
    render();
  } else if (t.id === 'wideTable') {
    state.wideTable = t.checked;
    render();
  } else if (t.dataset.param || t.dataset.share) {
    renderKeepFocus(t);
  }
});

document.addEventListener('input', (e) => {
  const t = e.target;
  const v = Number(t.value);
  if (t.value === '' || !Number.isFinite(v)) return;
  if (t.dataset.param) state.reg.find((x) => x.id === t.dataset.param).value = v;
  else if (t.dataset.share) state.shares[t.dataset.share] = Math.max(0, v);
  else return;
  saveState(state);
});

render();
