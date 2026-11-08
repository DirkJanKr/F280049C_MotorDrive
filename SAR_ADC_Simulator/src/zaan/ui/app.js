// Zaan workbench controller: routing (#name), chapter layout, live updates.

import { createState, saveState, resetParam, resetAll } from './state.js';
import { context } from './ctx.js';
import { showValue } from './knobs.js';
import { eng, num } from './fmt.js';
import { startPage } from './startPage.js';
import { specsPage } from './specsPage.js';
import { exportPage } from './exportPage.js';
import { termsPage } from './termsPage.js';
import { chapter as specs } from './chapters/specs.js';
import { chapter as beam } from './chapters/beam.js';
import { chapter as sharing } from './chapters/sharing.js';
import { chapter as cdac } from './chapters/cdac.js';
import { chapter as redundancy } from './chapters/redundancy.js';
import { chapter as reference } from './chapters/reference.js';
import { chapter as budget } from './chapters/budget.js';
import { chapter as chain } from './chapters/chain.js';

const CHAPTERS = [specs, beam, sharing, cdac, redundancy, reference, budget, chain];
const PAGES = ['start', 'list', 'export', 'terms'];
const state = createState();
const $ = (id) => document.getElementById(id);

function route() {
  const h = location.hash.replace('#', '');
  return CHAPTERS.some((c) => c.id === h) || PAGES.includes(h) ? h : 'start';
}

function nav(page) {
  $('rail').innerHTML =
    CHAPTERS.map((c) => `<a href="#${c.id}" class="${page === c.id ? 'on' : ''}" ${page === c.id ? 'aria-current="page"' : ''}><span class="rn">${c.n}</span><span class="rt">${c.short}</span></a>`).join('');
}

function health() {
  const { d, cells } = context(state);
  $('health').innerHTML = [
    ['CDAC', eng(d.cdac, 'F')],
    ['Memory cell', eng(d.cm, 'F')],
    ['Cells per channel', `${cells.m}`],
    ['Decisions', `${d.decisions}`],
    ['Area', `${num(d.area * 1e6, 3)} mm²`],
  ].map(([k, v]) => `<span class="hm"><span class="hk">${k}</span><span class="hv">${v}</span></span>`).join('') +
    `<span class="hlinks"><a href="#list">All values</a><a href="#export">Export</a><a href="#terms">Terms</a></span>`;
}

function render() {
  const page = route();
  nav(page);
  const ch = CHAPTERS.find((c) => c.id === page);
  if (ch) {
    const i = CHAPTERS.indexOf(ch);
    const view = ch.view(state);
    const prev = CHAPTERS[i - 1];
    const next = CHAPTERS[i + 1];
    $('page').innerHTML = `<header class="ch-head"><div class="eyebrow">Chapter ${ch.n} of ${CHAPTERS.length}</div><h1>${ch.title}</h1><p class="lede">${ch.lede}</p></header>
      <div class="ch-body"><aside class="knobs" aria-label="Design knobs">${view.knobs}<button class="linkbtn reset" data-resetpage="1">Reset these knobs</button></aside><div class="ch-main">${view.main}</div></div>
      <nav class="ch-next">${prev ? `<a href="#${prev.id}">← ${prev.n}. ${prev.short}</a>` : '<a href="#start">← Start</a>'}${next ? `<a href="#${next.id}">${next.n}. ${next.short} →</a>` : '<a href="#export">Export →</a>'}</nav>`;
    ch.update(state);
  } else if (page === 'list') $('page').innerHTML = specsPage(state);
  else if (page === 'export') $('page').innerHTML = exportPage(state);
  else if (page === 'terms') $('page').innerHTML = termsPage();
  else $('page').innerHTML = startPage(state, CHAPTERS);
  health();
  saveState(state);
}

let frame = 0;
function refresh() {
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(() => {
    const ch = CHAPTERS.find((c) => c.id === route());
    if (ch) ch.update(state);
    health();
    saveState(state);
  });
}

let lastW = window.innerWidth;
window.addEventListener('resize', () => {
  if (Math.abs(window.innerWidth - lastW) < 40) return;
  lastW = window.innerWidth;
  refresh();
});

window.addEventListener('hashchange', () => {
  render();
  window.scrollTo(0, 0);
});

document.addEventListener('input', (e) => {
  const el = e.target;
  if (el.id === 'useChip') return;
  const x = Number(el.value);
  if (el.value === '' || !Number.isFinite(x)) return;
  if (el.dataset.param) {
    const p = state.reg.find((q) => q.id === el.dataset.param);
    p.value = x;
    const o = $(`o-${p.id}`);
    if (o) o.textContent = showValue(x, p.step, p.unit);
  } else if (el.dataset.ui) {
    state.ui[el.dataset.ui] = x;
    const o = $(`o-${el.dataset.ui}`);
    if (o) o.textContent = showValue(x, el.step, el.dataset.unit);
  } else return;
  if (el.type === 'range') refresh();
});

document.addEventListener('change', (e) => {
  const el = e.target;
  if (el.id === 'useChip') {
    state.ui.useChip = el.checked;
    refresh();
  } else if (el.id === 'wideTable') {
    state.wideTable = el.checked;
    render();
  } else if (el.dataset.param && el.type === 'number') render();
});

document.addEventListener('click', (e) => {
  const el = e.target.closest('button');
  if (!el) return;
  if (el.dataset.reset) {
    resetParam(state, el.dataset.reset);
    render();
  } else if (el.dataset.resetpage) {
    for (const k of document.querySelectorAll('.knobs [data-param]')) resetParam(state, k.dataset.param);
    render();
  } else if (el.dataset.resetall) {
    resetAll(state);
    render();
  } else if (el.dataset.copy) {
    const ta = $(el.dataset.copy);
    const done = () => (el.textContent = 'Copied');
    if (navigator.clipboard) navigator.clipboard.writeText(ta.value).then(done, () => ta.select());
    else ta.select();
  }
});

render();
