// Zaan workbench: pages for the system, beamformer, SAR ADC, mismatch and area,
// timing, SAR logic and values. Summary bar and side panel can be shown or hidden.

import { store, load, subscribe, setValue, setUi, changed, resetValues, saveVersion, deleteVersion, loadVersion, exportJson, importJson } from './store.js';
import { PRESETS } from './weights.js';
import { eng, num, esc, fq } from './kit.js';
import { page as system } from './pages/system.js';
import { page as budgetPage } from './pages/budget.js';
import { formulaHtml } from './formulas.js';
import { page as beamformer } from './pages/beamformer.js';
import { page as sar } from './pages/sar.js';
import { page as mismatch } from './pages/mismatch.js';
import { page as timing } from './pages/timing.js';
import { page as logic } from './pages/logic.js';
import { page as valuesPage } from './pages/values.js';
import { page as iqPage } from './pages/iq.js';
import { designSide } from './designSide.js';
import { leadHtml } from './leads.js';
import { page as balancePage } from './pages/balance.js';
import { page as levelsPage } from './pages/levels.js';
import { page as chenPage } from './pages/chen.js';
import { page as refPage } from './pages/reference.js';
import { page as powerPage } from './pages/power.js';
import { page as matchingPage } from './pages/matching.js';
import { page as offsetPage } from './pages/offset.js';
import { page as sourcesPage } from './pages/sources.js';
import { page as redPage } from './pages/redundancy.js';

/** Several pages behind one entry of the rail, as tabs. The address of a tab is the id of its page. */
function tabs(id, title, subs) {
  const cur = () => subs.find(([p]) => p.id === store.ui.tab?.[id])?.[0] || subs[0][0];
  return {
    id, title, subs: subs.map(([p]) => p), cur,
    side: (s, c) => cur().side(s, c),
    main: (s, c) => `<div class="seg tabs">${subs.map(([p, label]) => `<button class="${p === cur() ? 'on' : ''}" data-tab="${p.id}">${label}</button>`).join('')}</div>${cur().main(s, c)}`,
    mount(s, c) {
      document.querySelectorAll('[data-tab]').forEach((b) => { b.onclick = () => { location.hash = b.dataset.tab; }; });
      if (cur().mount) cur().mount(s, c);
    },
    update: (s, c) => cur().update(s, c),
  };
}
const PAGES = [
  system,
  balancePage,
  tabs('g-budget', 'Noise and power', [[budgetPage, 'Noise budget'], [powerPage, 'Power estimate']]),
  tabs('g-sar', 'SAR ADC', [[redPage, 'Weights'], [sar, 'Conversion'], [levelsPage, 'Levels and rounding']]),
  tabs('g-mismatch', 'Mismatch', [[matchingPage, 'The 3σ rule'], [mismatch, 'Monte Carlo and area']]),
  offsetPage, beamformer,
  tabs('g-timing', 'Timing', [[chenPage, 'Clock sequence after Chen'], [logic, 'Self-timed logic'], [timing, 'Decision time']]),
  refPage, iqPage, valuesPage, sourcesPage,
];
// The rail: pages grouped, the blocks in the order the signal passes them. checks: ids whose state marks the page.
const NAV = [
  ['Overview', [['system', []]]],
  ['Design', [['balance', []], ['g-budget', ['enob']], ['g-sar', ['cover', 'tol', 'small', 'dec']], ['g-mismatch', []], ['offset', []]]],
  ['Blocks', [['beamformer', ['cells']], ['g-timing', ['time']], ['reference', []], ['iq', []]]],
  ['Record', [['values', []], ['sources', []]]],
];
const TAPEOUT = Date.UTC(2027, 2, 31);
const $ = (id) => document.getElementById(id);
let current = null;

function pageOf(id) {
  const top = PAGES.find((p) => p.id === id);
  if (top) return top;
  const g = PAGES.find((p) => p.subs?.some((x) => x.id === id));
  if (!g) return system;
  store.ui.tab = { ...store.ui.tab, [g.id]: id };
  return g;
}

function summary() {
  const c = store.ctx;
  const { P, d } = c;
  const fails = c.checks.filter((k) => k.state === 'bad');
  const warns = c.checks.filter((k) => k.state === 'warn');
  const items = [
    ['ENOB, converter', `${num(c.budget.enob, 2)} / ${num(P.enobAim, 1)}`, 'budget', c.budget.ok ? '' : 'bad'],
    ['checks', fails.length ? `${fails.length} fail` : warns.length ? `${warns.length} to look at` : 'all pass', 'budget', fails.length ? 'bad' : warns.length ? 'warn' : 'ok'],
    [store.ui.qUnit === 'V' ? 'noise at the input' : 'noise as charge', fq(c, c.budget.total, true), 'budget', c.budget.ok ? '' : 'bad'],
    ['1 LSB', eng(d.qLsb, 'C'), 'budget'],
    ['delay step', eng(P.delayStep, 's'), 'beamformer'],
    ['cells per channel', `${P.memCells}`, 'beamformer', c.need.m > P.memCells ? 'bad' : ''],
    ['decisions', `${d.decisions}`, 'sar', d.decisions !== P.rawDecisions ? 'warn' : ''],
    ['CDAC', eng(d.cdac, 'F'), 'sar'],
    ['memory cell', eng(d.cm, 'F'), 'sar'],
    ['capacitor area', `${num(c.areaTotal * 1e6, 3)} mm²`, 'mismatch'],
    ['conversion', `${eng(c.timing.median, 's')} / ${eng(c.tw, 's')}`, 'timing', c.timing.median > c.tw ? 'warn' : ''],
  ];
  $('summary').innerHTML = items.map(([k, v, go, cls]) => `<a class="sm ${cls || ''}" href="#${go}" title="${esc(cls === 'bad' || cls === 'warn' ? (c.checks.find((x) => x.go === go && x.state !== 'ok')?.why || '').replace(/<[^>]+>/g, '') : '')}"><span>${esc(k)}</span><b>${esc(v)}</b></a>`).join('');
}

function rail() {
  const state = (ids) => {
    const c = store.ctx.checks.filter((k) => ids.includes(k.id));
    return c.some((k) => k.state === 'bad') ? 'bad' : c.some((k) => k.state === 'warn') ? 'warn' : '';
  };
  $('pages').innerHTML = NAV.map(([title, items]) => `<span class="rg">${esc(title)}</span>` + items.map(([id, ids]) => {
    const p = pageOf(id);
    const st = state(ids);
    return `<a href="#${id}" class="${id === current.id ? 'on' : ''}" ${id === current.id ? 'aria-current="page"' : ''}>${esc(p.title)}${st ? `<i class="nd ${st}" title="a check on this page ${st === 'bad' ? 'fails' : 'asks for a look'}"></i>` : ''}</a>`;
  }).join('')).join('');
  const days = Math.ceil((TAPEOUT - Date.now()) / 864e5);
  $('tapeout').innerHTML = days >= 0 ? `tape-out 31 March 2027 · <b>${days} days</b>` : 'tape-out 31 March 2027';
}

function layout() {
  document.body.classList.toggle('no-top', !store.ui.showTop);
  document.body.classList.toggle('no-side', !store.ui.showSide || current?.id === 'values');
  $('togTop').classList.toggle('on', store.ui.showTop);
  $('togSide').classList.toggle('on', store.ui.showSide);
  $('togUnit').textContent = store.ui.qUnit === 'V' ? 'show in µV' : 'show in fC';
  const th = ['light', 'dark'].includes(store.ui.theme) ? store.ui.theme : 'auto';
  $('togTheme').textContent = { auto: 'theme: device', light: 'theme: day', dark: 'theme: night' }[th];
  if (th === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = th;
}

/** The inspector of the page (or tab) on screen. System and Values keep their own. */
function sideHtml() {
  const leaf = current.cur ? current.cur() : current;
  return ['system', 'values'].includes(leaf.id) ? leaf.side(store, store.ctx) : designSide(store, leaf.id);
}

function renderPage() {
  current = pageOf(store.ui.page);
  rail();
  layout();
  $('side').innerHTML = sideHtml();
  $('main').innerHTML = current.main(store, store.ctx);
  if (current.mount) current.mount(store, store.ctx);
  current.update(store, store.ctx);
  summary();
  lead();
}

/** The question of the page on screen and the number that answers it, above the page. */
function lead() {
  let el = $('lead');
  if (!el) {
    el = document.createElement('div');
    el.id = 'lead';
    el.className = 'lead';
    el.setAttribute('aria-live', 'polite');
    $('main').before(el);
  }
  const leaf = current.cur ? current.cur() : current;
  el.innerHTML = leadHtml(leaf.id, store.ctx, store);
}

function rebuildSide() {
  // the weight controls live in the page itself on the Weights tab: draw the whole page again there
  if (current.cur && current.cur().id === 'redundancy') return renderPage();
  const scroll = $('side').scrollTop;
  $('side').innerHTML = sideHtml();
  $('side').scrollTop = scroll;
}

subscribe((reason) => {
  if (reason === 'values') {
    current.update(store, store.ctx);
    summary();
    lead();
    rail();
  } else if (reason === 'layout') {
    layout();
    setTimeout(() => current.update(store, store.ctx), 50);
  } else if (reason === 'page') renderPage();
  else if (reason === 'side') {
    rebuildSide();
    current.update(store, store.ctx);
    summary();
    lead();
  }
});

window.addEventListener('hashchange', () => {
  store.ui.page = location.hash.replace('#', '') || 'system';
  renderPage();
  window.scrollTo(0, 0);
});

document.addEventListener('input', (e) => {
  const t = e.target;
  if (t.dataset.range) {
    const v = store.values.find((x) => x.id === t.dataset.range);
    const n = document.querySelector(`[data-num="${t.dataset.range}"]`);
    if (n) n.value = t.value;
    t.classList.remove('dim');
    t.closest('.knob')?.classList.remove('unset');
    setValue(v.id, t.value);
  } else if (t.dataset.num) {
    if (t.value === '' || Number.isFinite(Number(t.value))) {
      const r = document.querySelector(`[data-range="${t.dataset.num}"]`);
      if (r && t.value !== '') r.value = t.value;
      setValue(t.dataset.num, t.value);
    }
  }
});

document.addEventListener('change', (e) => {
  const t = e.target;
  if (t.dataset.alloc) {
    const x = Number(t.value);
    if (t.value !== '' && Number.isFinite(x)) {
      store.ui.alloc = { ...(store.ui.alloc || {}), [t.dataset.alloc]: Math.max(0, x) };
      changed('values');
    }
    return;
  }
  if (t.id === 'preset' && PRESETS[t.value]) {
    const p = PRESETS[t.value];
    for (const k of ['radix', 'topUnits', 'halvings', 'halvingOn']) store.values.find((v) => v.id === k).value = p[k];
    store.ui.weightMode = p.mode;
    changed('values');
    setTimeout(() => changed('side'), 0);
  } else if (t.id === 'wlist') {
    store.ui.customWeights = t.value;
    changed('values');
  } else if (['useOff', 'useNoise', 'useChip'].includes(t.id)) {
    store.ui[t.id] = t.checked;
    changed('values');
  } else if (t.dataset.choicesel) setValue(t.dataset.choicesel, t.value);
  else if (t.dataset.statv) {
    store.values.find((v) => v.id === t.dataset.statv).status = t.value;
    changed('meta');
    setTimeout(() => changed('page'), 0);
  } else if (t.dataset.srcv) {
    store.values.find((v) => v.id === t.dataset.srcv).source = t.value;
    changed('meta');
  } else if (t.id === 'jsonFile' && t.files[0]) {
    t.files[0].text().then((txt) => doImport(txt));
  }
});

function doImport(txt) {
  try {
    importJson(txt);
    setTimeout(() => changed('page'), 0);
  } catch (err) {
    const m = $('ioMsg');
    if (m) m.textContent = `Could not import: ${err.message}`;
  }
}

function closePop() {
  const p = $('pop');
  if (p) p.remove();
}

function openPop(el) {
  closePop();
  const html = formulaHtml(el.dataset.f, store.ctx);
  if (!html) return;
  const p = document.createElement('div');
  p.id = 'pop';
  p.className = 'pop';
  p.setAttribute('role', 'dialog');
  p.innerHTML = html;
  document.body.appendChild(p);
  const r = el.getBoundingClientRect();
  const narrow = window.innerWidth < 640;
  if (narrow) p.classList.add('sheet');
  else {
    const w = p.offsetWidth;
    const h = p.offsetHeight;
    let x = Math.min(window.innerWidth - w - 12, Math.max(12, r.left));
    let y = r.bottom + 8;
    if (y + h > window.innerHeight - 12) y = Math.max(12, r.top - h - 8);
    p.style.left = `${x}px`;
    p.style.top = `${y}px`;
  }
  p.querySelector('.pop-x').focus();
}

document.addEventListener('click', (e) => {
  const fEl = e.target.closest('[data-f]');
  if (fEl) {
    e.preventDefault();
    e.stopPropagation();
    openPop(fEl);
    return;
  }
  if (e.target.closest('.pop-x') || !e.target.closest('#pop')) closePop();
  const b = e.target.closest('button, a, [data-go]');
  if (!b) return;
  if (b.dataset.gain) {
    store.ui.arrayGain = store.ui.arrayGain === false;
    changed('values');
    changed('page');
    return;
  }
  if (b.dataset.split) {
    store.ui.splitRes = store.ui.splitRes === false;
    changed('values');
    changed('page');
    return;
  }
  if (b.dataset.sarmode) {
    store.ui.sarMode = b.dataset.sarmode;
    document.querySelectorAll('[data-sarmode]').forEach((x) => x.classList.toggle('on', x.dataset.sarmode === store.ui.sarMode));
    changed('values');
    return;
  }
  if (b.dataset.bfdelays) {
    store.ui.bfDelays = store.ui.bfDelays === false;
    b.classList.toggle('on', store.ui.bfDelays);
    b.textContent = store.ui.bfDelays ? 'delays on' : 'delays off';
    return;
  }
  if (b.dataset.go !== undefined && b.closest('.sysview')) {
    if (b.dataset.go) location.hash = b.dataset.go;
    return;
  }
  if (b.dataset.choice) {
    setValue(b.dataset.choice, b.dataset.opt);
    setTimeout(() => changed('side'), 0);
  } else if (b.dataset.mode) {
    store.ui.weightMode = b.dataset.mode;
    changed('values');
    setTimeout(() => changed('side'), 0);
  } else if (b.id === 'togTop') setUi({ showTop: !store.ui.showTop }, 'layout');
  else if (b.id === 'togSide') setUi({ showSide: !store.ui.showSide }, 'layout');
  else if (b.id === 'togTheme') setUi({ theme: { auto: 'light', light: 'dark', dark: 'auto' }[store.ui.theme] || 'light' }, 'layout');
  else if (b.id === 'togUnit') {
    store.ui.qUnit = store.ui.qUnit === 'V' ? 'fC' : 'V';
    changed('values');
    changed('page');
  }
  else if (b.dataset.resetg) {
    resetValues(b.dataset.resetg);
    setTimeout(() => changed('page'), 0);
  } else if (b.id === 'saveVer') {
    const name = $('verName').value.trim();
    if (name) {
      saveVersion(name);
      setTimeout(() => changed('page'), 0);
    }
  } else if (b.dataset.loadv) {
    loadVersion(b.dataset.loadv);
    setTimeout(() => changed('page'), 0);
  } else if (b.dataset.delv) {
    deleteVersion(b.dataset.delv);
    setTimeout(() => changed('page'), 0);
  } else if (b.dataset.copy) {
    const ta = $(b.dataset.copy);
    if (navigator.clipboard) navigator.clipboard.writeText(ta.value).then(() => (b.textContent = 'copied'), () => ta.select());
    else ta.select();
  } else if (b.id === 'jsonDl') {
    b.href = URL.createObjectURL(new Blob([exportJson()], { type: 'application/json' }));
  } else if (b.id === 'doImport') doImport($('jsonIn').value);
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closePop();
  if ((e.key === 'Enter' || e.key === ' ') && e.target.dataset?.go) location.hash = e.target.dataset.go;
});

let rz = 0;
window.addEventListener('resize', () => {
  clearTimeout(rz);
  rz = setTimeout(() => current && current.update(store, store.ctx), 150);
});

load();
renderPage();
