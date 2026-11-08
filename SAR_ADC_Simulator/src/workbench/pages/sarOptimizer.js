// Optimizer card of the SAR ADC page: every candidate weight set as a dot
// (ENOB from the charge budget against CDAC size), the optimum for the chosen
// goal, the best few in a table, and a button to use one.

import { plot, fill, widthOf, num, esc, COL, eng } from '../kit.js';
import { search, best, GOALS } from '../optimizer.js';
import { changed } from '../store.js';

const O = { key: '', all: null };

export function optimizerCard(store) {
  const g = store.ui.optGoal || 'enob';
  return `<section class="card wide"><header><h3>Weight optimizer: weights and number of decisions</h3><span class="ctl">
      <label class="mini-l">goal <select id="optGoal">${Object.entries(GOALS).map(([k, t]) => `<option value="${k}" ${k === g ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>
      <label class="mini-l"><input type="checkbox" id="optRes" ${store.ui.optRes !== false ? 'checked' : ''}/> keep the simulated calibration residual</label></span></header>
    <div class="grid2 inner"><div id="optPlot" class="cbody"></div><div id="optTable" class="cbody"></div></div><p class="cap" id="optCap"></p></section>`;
}

export function mountOptimizer(store) {
  document.getElementById('optGoal').onchange = (e) => {
    store.ui.optGoal = e.target.value;
    drawOptimizer(store, store.ctx);
  };
  document.getElementById('optRes').onchange = (e) => {
    store.ui.optRes = e.target.checked;
    O.key = '';
    drawOptimizer(store, store.ctx);
  };
  document.getElementById('optTable').onclick = (e) => {
    const b = e.target.closest('[data-apply]');
    if (!b) return;
    const [radix, top, h] = b.dataset.apply.split(',').map(Number);
    const set = (id, v) => (store.values.find((x) => x.id === id).value = v);
    set('radix', radix);
    set('topUnits', top);
    set('halvings', h);
    store.ui.weightMode = 'generator';
    changed('values');
    setTimeout(() => changed('side'), 0);
  };
}

export function drawOptimizer(store, ctx) {
  const { P, budget } = ctx;
  const resLsb = store.ui.optRes !== false ? budget.lines.find((l) => l.id === 'cal').lsb : 0;
  const key = JSON.stringify([P, resLsb, budget.arrayGain, ctx.sigmaU]);
  if (key !== O.key) {
    O.key = key;
    O.all = search(P, P.memCells, { sigmaU: ctx.sigmaU, arrayGain: budget.arrayGain, residualLsb: resLsb });
  }
  const goal = store.ui.optGoal || 'enob';
  const ranked = best(O.all, goal, P.enobAim);
  const top = ranked[0];
  const cur = { units: ctx.d.units, enob: budget.enob };
  const ok = O.all.filter((c) => c.tolOk);
  const bad = O.all.filter((c) => !c.tolOk);
  const ys = O.all.map((c) => c.enob);
  const ylo = Math.min(...ys, P.enobAim) - 0.05;
  const yhi = Math.max(...ys, P.enobAim) + 0.05;
  const xs = O.all.map((c) => c.units);
  const xr = { min: Math.min(...xs) - 2, max: Math.max(...xs) + 2, label: 'unit capacitors in the CDAC' };
  const w = widthOf('optPlot');
  const mark = (yk) => (sx, sy) => `${top ? `<circle cx="${sx(top.units)}" cy="${sy(top[yk])}" r="9" fill="none" stroke="var(--dig)" stroke-width="2.5"/><text x="${sx(top.units) + 12}" y="${sy(top[yk]) - 8}" font-size="11" fill="var(--dig)">optimum</text>` : ''}<rect x="${sx(cur.units) - 5}" y="${sy(cur[yk]) - 5}" width="10" height="10" fill="none" stroke="var(--ink)" stroke-width="2"/><text x="${sx(cur.units) + 9}" y="${sy(cur[yk]) + 16}" font-size="11">current</text>`;
  const ms = O.all.map((c) => c.margin);
  cur.margin = Math.min(...ctx.tolNeed.filter((r) => !r.last).map((r) => r.have + 0.5 - r.need));
  fill('optPlot', plot({
    height: 200, x: xr, y: { min: Math.min(-0.5, ...ms) - 0.1, max: Math.max(...ms) + 0.7, label: 'tolerance margin [LSB]' },
    series: [
      { points: ok.map((c) => [c.units, c.margin]), color: COL.an, mode: 'dots', r: 3, opacity: 0.8, label: 'enough tolerance' },
      { points: bad.map((c) => [c.units, c.margin]), color: COL.bad, mode: 'dots', r: 4, label: 'too little: codes lost' },
    ],
    hlines: [{ y: 0, color: COL.bad, dash: '6 3', width: 1.5 }], legend: true, overlay: mark('margin'),
  }, w) + plot({
    height: 220, x: xr, y: { min: ylo, max: yhi, label: 'ENOB, charge budget [bit]' },
    series: [
      { points: ok.map((c) => [c.units, c.enob]), color: COL.an, mode: 'dots', r: 3, opacity: 0.8 },
      { points: bad.map((c) => [c.units, c.enob]), color: COL.bad, mode: 'dots', r: 4 },
    ],
    hlines: [{ y: P.enobAim, color: COL.ref, dash: '6 3', width: 1.5, label: 'aim' }], overlay: mark('enob'),
  }, w));
  const rows = ranked.slice(0, 6).map((c, i) => `<tr class="${i === 0 ? 'best' : ''}"><td class="num">${num(c.radix, 2)}</td><td class="num">${c.topUnits}</td><td class="num">${c.halvings}</td><td class="num">${c.decisions}</td><td class="num">${num(c.units, 0)}</td><td class="num">${num(c.enob, 3)}</td><td class="num">${num(c.margin, 2)}</td><td><button class="mini" data-apply="${c.radix},${c.topUnits},${c.halvings}">use</button></td></tr><tr class="wrow"><td colspan="8">${c.weights.map((x) => num(x, x < 10 ? 1 : 0)).join(' ')}</td></tr>`).join('');
  fill('optTable', ranked.length ? `<div class="tablewrap"><table class="tbl opt"><thead><tr><th>radix</th><th>first</th><th>½ steps</th><th>dec.</th><th>units</th><th>ENOB</th><th>margin [LSB]</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>` : `<p class="warnbox">No candidate meets the goal: ${goal === 'enob' ? 'none has enough tolerance' : `none reaches ENOB ${num(P.enobAim, 1)} with enough tolerance; try the goal highest ENOB to see how close the best gets`}.</p>`);
  const peak = ok.length ? ok.reduce((a, c) => (c.enob > a.enob ? c : a)) : null;
  fill('optCap', `${O.all.length} weight sets searched: radix 1.60 to 2.00, first step 16 to 48 units, 0 to 4 steps below one unit, ${esc(P.halvingOn)}; only sets that reach both ends and resolve 1 LSB are kept. Why there is an optimum: more redundancy (smaller radix, more decisions) gives tolerance against mismatch and offset, but every extra capacitor makes the node larger, so comparator noise and precharge noise grow as charge (${eng(P.compNoise, 'V')} × C node). Top: the tolerance margin (worst decision, need against tolerance + ½ LSB) rises with redundancy; below the red line codes are lost. Bottom: the ENOB falls as the CDAC grows. The optimum is where the margin just stays above zero.${peak ? ` Highest ENOB with enough tolerance: ${num(peak.enob, 3)} bit at ${peak.decisions} decisions, ${num(peak.units, 0)} units.` : ''} ENOB here is the charge budget${store.ui.optRes !== false ? `, with the calibration residual of the current chip (${num(resLsb, 3)} LSB) kept the same for every candidate (assumption)` : ' without the calibration residual'}; use a candidate to simulate it.`);
}
