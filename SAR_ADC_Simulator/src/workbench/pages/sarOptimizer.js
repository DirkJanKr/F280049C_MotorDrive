// Optimizer card of the SAR ADC page: weights built from what each decision
// needs (mismatch, offset after calibration, optionally comparator noise), shown
// step by step, compared with the current weights, and applied with one button.

import { fill, widthOf, num, esc, eng } from '../kit.js';
import { optimise } from '../optimizer.js';
import { changed } from '../store.js';

const O = { key: '', r: null };

function opts(store) {
  const u = store.ui;
  return { smallest: u.optSmallest || 1, k: u.optK || 3, margin: u.optMargin || 0, noise: !!u.optNoise };
}

export function optimizerCard(store) {
  const o = opts(store);
  return `<section class="card wide"><header><h3>Weight optimizer: from the redundancy each step needs</h3><span class="ctl">
      <span class="mini-l">smallest step</span><span class="seg sm2"><button class="${o.smallest === 1 ? 'on' : ''}" data-optsmall="1">1 LSB</button><button class="${o.smallest === 0.5 ? 'on' : ''}" data-optsmall="0.5">½ LSB</button></span>
      <label class="mini-l">σ multiple <input type="number" id="optK" value="${o.k}" min="1" max="6" step="0.5" class="numin"/></label>
      <label class="mini-l">extra margin <input type="number" id="optMargin" value="${o.margin}" min="0" max="10" step="0.25" class="numin"/> LSB</label>
      <label class="mini-l"><input type="checkbox" id="optNoise" ${o.noise ? 'checked' : ''}/> also cover comparator noise</label></span></header>
    <div class="grid2 inner"><div id="optSteps" class="cbody"></div><div id="optCmp" class="cbody"></div></div><p class="cap" id="optCap"></p></section>`;
}

export function mountOptimizer(store) {
  const rerun = () => {
    O.key = '';
    drawOptimizer(store, store.ctx);
  };
  document.querySelectorAll('[data-optsmall]').forEach((b) => {
    b.onclick = () => {
      store.ui.optSmallest = Number(b.dataset.optsmall);
      document.querySelectorAll('[data-optsmall]').forEach((x) => x.classList.toggle('on', x === b));
      rerun();
    };
  });
  document.getElementById('optK').onchange = (e) => {
    store.ui.optK = Math.max(1, Number(e.target.value) || 3);
    rerun();
  };
  document.getElementById('optMargin').onchange = (e) => {
    store.ui.optMargin = Math.max(0, Number(e.target.value) || 0);
    rerun();
  };
  document.getElementById('optNoise').onchange = (e) => {
    store.ui.optNoise = e.target.checked;
    rerun();
  };
  document.getElementById('optCmp').onclick = (e) => {
    if (!e.target.closest('#optApply') || !O.r || !O.r.steps) return;
    store.ui.weightMode = 'custom';
    store.ui.customWeights = O.r.d.weights.map((w) => +w.toFixed(4)).join(', ');
    store.values.find((x) => x.id === 'halvingOn').value = 'charge halving';
    changed('values');
    changed('side');
  };
}

export function drawOptimizer(store, ctx) {
  const { P, budget } = ctx;
  const o = opts(store);
  const key = JSON.stringify([P, o, budget.arrayGain, ctx.sigmaU]);
  if (key !== O.key) {
    O.key = key;
    O.r = optimise(P, P.memCells, { ...o, sigmaU: ctx.sigmaU, arrayGain: budget.arrayGain, residualLsb: 0 });
  }
  const r = O.r;
  if (!r.steps) {
    fill('optSteps', `<p class="warnbox">${esc(r.error)}</p>`);
    fill('optCmp', '');
    return;
  }
  const rows = r.need.filter((x) => !x.last);
  const w = Math.max(320, widthOf('optSteps'));
  const xmax = Math.max(4, ...rows.map((x) => Math.min(x.have + 0.5, 12)), ...rows.map((x) => x.need + (o.noise ? x.noise : 0))) * 1.08;
  const L = 118;
  const sx = (v) => L + (Math.min(v, xmax) / xmax) * (w - L - 54);
  const rh = 24;
  const svg = [`<svg viewBox="0 0 ${w} ${rows.length * rh + 40}" class="tsvg tolc" role="img" aria-label="Need and tolerance per step">`];
  rows.forEach((x, i) => {
    const y = 6 + i * rh;
    const wt = r.d.weights[i];
    svg.push(`<text x="6" y="${y + 15}" class="lbl">${num(wt, wt < 10 ? 2 : 0)} LSB</text>`);
    svg.push(`<rect x="${sx(0)}" y="${y + 3}" width="${sx(x.mismatch) - sx(0)}" height="${rh - 8}" class="tn-mis"/><rect x="${sx(x.mismatch)}" y="${y + 3}" width="${Math.max(0, sx(x.mismatch + x.offset) - sx(x.mismatch))}" height="${rh - 8}" class="tn-off"/>`);
    if (o.noise) svg.push(`<rect x="${sx(x.need)}" y="${y + 3}" width="${Math.max(0, sx(x.need + x.noise) - sx(x.need))}" height="${rh - 8}" class="tn-noise"/>`);
    const hx = sx(x.have + 0.5);
    svg.push(`<line x1="${hx}" x2="${hx}" y1="${y}" y2="${y + rh - 2}" class="tn-have"/>`);
    if (x.have + 0.5 > xmax) svg.push(`<text x="${w - 50}" y="${y + 15}" class="tiny">${num(x.have, 0)}+½ →</text>`);
  });
  const ty = rows.length * rh + 14;
  for (const t of [0, 1, 2, 4, 8, 12].filter((t) => t <= xmax)) svg.push(`<text x="${sx(t)}" y="${ty + 12}" class="tiny" text-anchor="middle">${t}</text>`);
  svg.push(`<text x="${w - 6}" y="${ty + 12}" class="tiny" text-anchor="end">LSB</text></svg>`);
  fill('optSteps', svg.join(''));
  const cur = ctx.d;
  const curB = ctx.budget.lines.filter((l) => l.id !== 'cal').reduce((a, l) => a + l.sigma ** 2, 0);
  const newB = r.budget.lines.filter((l) => l.id !== 'cal').reduce((a, l) => a + l.sigma ** 2, 0);
  const qFs = (dd) => dd.qFs / 2 / Math.SQRT2;
  const enobOf = (dd, v2) => (20 * Math.log10(qFs(dd) / Math.sqrt(v2)) - 1.76) / 6.02;
  const row = (k, a, b) => `<tr><td>${k}</td><td class="num">${a}</td><td class="num">${b}</td></tr>`;
  const margin = (nd) => Math.min(...nd.filter((x) => !x.last).map((x) => x.have + 0.5 - x.need));
  fill('optCmp', `<p class="wlist"><b>From the needs:</b> ${r.d.weights.map((x) => num(x, 2)).join(' · ')} LSB<br/><span class="dim">Current: ${cur.weights.map((x) => num(x, 2)).join(' · ')} LSB</span></p><div class="tablewrap"><table class="tbl"><thead><tr><th></th><th>current</th><th>from the needs</th></tr></thead><tbody>
    ${row('decisions', cur.decisions, r.d.decisions)}
    ${row('unit capacitors', num(cur.units, 0), num(r.d.units, 0))}
    ${row('CDAC', eng(cur.cdac, 'F'), eng(r.d.cdac, 'F'))}
    ${row('node at the last decision', eng(cur.cNode[cur.decisions - 1], 'F'), eng(r.d.cNode[r.d.decisions - 1], 'F'))}
    ${row('worst tolerance margin', `${num(margin(ctx.tolNeed), 2)} LSB`, `${num(margin(r.need), 2)} LSB`)}
    ${row('ENOB, budget without simulated residual', num(enobOf(cur, curB), 3), num(enobOf(r.d, newB), 3))}
  </tbody></table></div><button class="mini primary" id="optApply">use these weights</button>`);
  fill('optCap', `How it works: start from the steps below one unit (charge halving down to ${o.smallest === 1 ? '1' : '½'} LSB). Then, going up, every next step gets the largest whole number of unit capacitors whose tolerance (sum of the steps below + 1 − w) plus ½ LSB still covers what that decision needs: ${num(o.k, 1)}σ DAC mismatch (pink), the part of the calibrated offset that differs from the last decision (amber)${o.noise ? ', comparator noise (violet)' : ''}${o.margin ? ` and ${num(o.margin, 2)} LSB margin` : ''}. Green line: tolerance + ½ LSB. It stops as soon as the steps reach both ends of the range (${2 ** (P.bits - 1) - 1} LSB), which gives the fewest decisions for these errors. The range left over is then spread over all steps as extra margin (${num(r.extra, 2)} LSB each). More redundancy than this only adds decisions and capacitance, and a larger node makes comparator and precharge noise larger as charge. Using the weights runs the full simulation, including the calibration residual.`);
}
