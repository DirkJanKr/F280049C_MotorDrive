// Zaan workbench controller: page routing (#name), input handling, live refresh.

import { computeBudget } from '../budget.js';
import { createState, saveState, resetParam } from './state.js';
import { BLOCKS } from './chain.js';
import { healthStrip } from './health.js';
import { overviewPage } from './overviewPage.js';
import { blockPage } from './blockPage.js';
import { budgetPage, budgetRefresh } from './budgetPage.js';
import { decisionsPage } from './decisionsPage.js';
import { specsPage } from './specsPage.js';
import { exportPage } from './exportPage.js';
import { termsPage } from './termsPage.js';

const NAV = [
  ['overview', 'Overview'],
  ['budget', 'Budget'],
  ['decisions', 'Decisions'],
  ['specs', 'Specs'],
  ['terms', 'Terms'],
  ['export', 'Export'],
];

const state = createState();
const $ = (id) => document.getElementById(id);

function route() {
  const h = location.hash.replace('#', '');
  if (NAV.some(([id]) => id === h) || BLOCKS.some((b) => b.id === h)) return h;
  return 'overview';
}

function budget() {
  return computeBudget(state);
}

function renderHealth(b = budget()) {
  $('health').innerHTML = healthStrip(state, b);
}

function render() {
  const page = route();
  const b = budget();
  $('nav').innerHTML = NAV.map(([id, label]) => `<a href="#${id}" class="${page === id ? 'on' : ''}" ${page === id ? 'aria-current="page"' : ''}>${label}</a>`).join('');
  let html;
  if (page === 'overview') html = overviewPage(state, b);
  else if (page === 'budget') html = budgetPage(state);
  else if (page === 'decisions') html = decisionsPage(state);
  else if (page === 'specs') html = specsPage(state);
  else if (page === 'terms') html = termsPage();
  else if (page === 'export') html = exportPage(state, b);
  else html = blockPage(state, page);
  $('page').innerHTML = html;
  if (page === 'budget') budgetRefresh(state, b);
  renderHealth(b);
  saveState(state);
}

/** Live update without rebuilding the page (keeps sliders and focus). */
function refresh() {
  const b = budget();
  if (route() === 'budget') budgetRefresh(state, b);
  renderHealth(b);
  saveState(state);
}

window.addEventListener('hashchange', () => {
  render();
  window.scrollTo(0, 0);
});

document.addEventListener('input', (e) => {
  const el = e.target;
  const x = Number(el.value);
  if (el.value === '' || !Number.isFinite(x)) return;
  if (el.dataset.share) state.shares[el.dataset.share] = Math.max(0, x);
  else if (el.dataset.param) state.reg.find((p) => p.id === el.dataset.param).value = x;
  else return;
  refresh();
});

document.addEventListener('change', (e) => {
  const el = e.target;
  if (el.dataset.level) {
    state.levels[el.dataset.level] = el.value;
    refresh();
  } else if (el.id === 'wideTable') {
    state.wideTable = el.checked;
    render();
  } else if (el.dataset.param && el.type === 'number') {
    render();
    const again = document.getElementById(el.id);
    if (again) again.focus();
  }
});

document.addEventListener('click', (e) => {
  const el = e.target.closest('button');
  if (!el) return;
  if (el.dataset.decide) {
    const raw = el.dataset.value;
    state.decisions[el.dataset.decide] = Number.isFinite(Number(raw)) ? Number(raw) : raw;
    render();
  } else if (el.dataset.undecide) {
    delete state.decisions[el.dataset.undecide];
    render();
  } else if (el.dataset.reset) {
    resetParam(state, el.dataset.reset);
    render();
  } else if (el.dataset.copy) {
    const ta = $(el.dataset.copy);
    const done = () => (el.textContent = 'Copied');
    if (navigator.clipboard) navigator.clipboard.writeText(ta.value).then(done, () => ta.select());
    else ta.select();
  }
});

render();
