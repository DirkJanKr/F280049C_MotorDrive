// Optimizer page: the main design decision, how small Cu (and with it CM) can be
// while the converter still meets the ENOB aim. Run it to search Cu, the smallest
// step and the combiner output width with full simulation; use the result in one click.

import { group, knobs, fill, widthOf, plot, explain, eng, num, esc, COL } from '../kit.js';
import { runSearch, bestOf, CU_GRID, OUT_BITS } from '../designSearch.js';
import { changed } from '../store.js';

const R = { rows: null, key: '', stop: null };
const LINE = { '1-10': [COL.muted, ''], '1-11': [COL.an, '4 3'], '1-12': [COL.an, ''], '0.5-10': [COL.cal, '2 3'], '0.5-11': [COL.ref, '4 3'], '0.5-12': [COL.ref, ''] };

function keyOf(ctx) {
  const P = ctx.P;
  return JSON.stringify([P.vref, P.aC, P.compNoise, P.vosCal, P.temperature, P.jitter, P.enobAim, P.calMethod, P.lsbPerUnit, P.fs, P.tSample, P.tauDac, P.tLogic, P.ibias, P.gmId, P.cload, P.vfinal, P.seed, ctx.budget.arrayGain]);
}

export const page = {
  id: 'optimizer',
  title: 'Optimizer',
  side(store) {
    const used = new Set();
    return `<p class="ks pad">The search uses these values. Change them and run again.</p>` +
      group('Target', knobs(store.values, ['enobAim', 'bits'], used)) +
      group('Charge balance', knobs(store.values, ['alpha', 'fullScale', 'lsbPerUnit'], used)) +
      group('Errors to cover', knobs(store.values, ['pairSigma', 'vosCal', 'compNoise', 'calMethod'], used)) +
      group('Timing (illustrative)', knobs(store.values, ['fs', 'tSample', 'tauDac', 'ibias', 'gmId', 'cload', 'tLogic'], used), false);
  },
  main(store) {
    return `<section class="card wide"><header><h3>How small can Cu, and with it CM, be?</h3><span class="ctl">
        <label class="mini-l"><input type="checkbox" id="opNeedTime" ${store.ui.opNeedTime ? 'checked' : ''}/> must fit in 1 / fs (illustrative timing)</label>
        <label class="mini-l"><input type="checkbox" id="opPdk" ${store.ui.opPdk !== false ? 'checked' : ''}/> Cu at least the 35 fF PDK minimum</label>
        <button class="mini primary" id="opRun">▶ run the search</button></span></header>
        <div id="opBest" class="cbody"></div><p class="cap" id="opCap"></p></section>
      <div class="grid2"><section class="card"><header><h3>ENOB against Cu</h3></header><div class="cbody" id="opEnob"></div><p class="cap" id="opEnob-cap"></p></section>
        <section class="card"><header><h3>Memory cell CM and capacitor area against Cu</h3></header><div class="cbody" id="opCm"></div><p class="cap" id="opCm-cap"></p></section></div>
      <div class="grid2"><section class="card"><header><h3>Decisions and conversion time against Cu</h3></header><div class="cbody" id="opTime"></div><p class="cap" id="opTime-cap"></p></section>
        <section class="card"><header><h3>What sets the limit</h3></header><div class="cbody" id="opWhy"></div></section></div>
      ${explain('How the search works', [
        `For every Cu (${CU_GRID.join(', ')} fF) and every smallest step (1 or ½ LSB) the weights are built from what each step needs: the mismatch of that Cu, the offset left after trimming, with the range left over spread as margin. That design is simulated on 2 chips with the chosen calibration, and the noise budget is made for 10, 11 and 12 combiner output bits. A design passes when its ENOB meets the aim and every decision is covered by redundancy.`,
        'The charge balance choice changes CM for the same weights: with the total step charge, the cells must balance more charge than 2^N LSB because the redundant steps add up to more.',
      ])}`;
  },
  mount(store) {
    document.getElementById('opRun').onclick = () => run(store);
    document.getElementById('opNeedTime').onchange = (e) => {
      store.ui.opNeedTime = e.target.checked;
      page.update(store, store.ctx);
    };
    document.getElementById('opPdk').onchange = (e) => {
      store.ui.opPdk = e.target.checked;
      page.update(store, store.ctx);
    };
    document.getElementById('opBest').onclick = (e) => {
      const b = e.target.closest('[data-use]');
      if (!b || !R.rows) return;
      const [cu, s, ob] = b.dataset.use.split(',').map(Number);
      const row = R.rows.find((r) => r.cu === cu && r.smallest === s && r.outBits === ob);
      if (!row) return;
      const set = (id, v) => (store.values.find((x) => x.id === id).value = v);
      set('cm', +(row.cm * 1e15).toFixed(2));
      set('outBits', ob);
      set('halvingOn', 'charge halving');
      store.ui.weightMode = 'custom';
      store.ui.customWeights = row.stepW.map((w) => +w.toFixed(4)).join(', ');
      changed('values');
      changed('side');
    };
  },
  update(store, ctx) {
    if (R.rows && R.key !== keyOf(ctx)) {
      fill('opCap', 'Values changed since the last run: run the search again.');
    }
    draw(store, ctx);
  },
};

function run(store) {
  if (R.stop) R.stop();
  const ctx = store.ctx;
  R.key = keyOf(ctx);
  const btn = document.getElementById('opRun');
  btn.textContent = 'running…';
  R.stop = runSearch(ctx.P, { arrayGain: ctx.budget.arrayGain }, (i, n, rows) => {
    R.rows = rows;
    fill('opCap', `Simulating ${i} of ${n} designs…`);
    draw(store, ctx);
  }, (rows) => {
    R.rows = rows;
    R.stop = null;
    btn.textContent = '▶ run the search again';
    draw(store, ctx);
  });
}

function draw(store, ctx) {
  const { P } = ctx;
  if (!R.rows || !R.rows.length) {
    fill('opBest', '<p class="cap">Press run. It takes a few seconds: 30 designs, each simulated on 2 chips.</p>');
    fill('opWhy', why(ctx));
    return;
  }
  const rows = R.rows;
  const best = bestOf(rows, { needTime: !!store.ui.opNeedTime, pdkOnly: store.ui.opPdk !== false });
  const overall = best.filter((b) => b.best).sort((a, b) => a.best.cm - b.best.cm || a.best.decisions - b.best.decisions)[0];
  const tr = best.map((b) => {
    const r = b.best;
    const isTop = overall && r && overall.best === r;
    if (!r) return `<tr><td>${b.smallest === 1 ? '1' : '½'} LSB</td><td class="num">${b.outBits}</td><td colspan="8" class="dim">no Cu in the grid passes</td></tr>`;
    return `<tr class="${isTop ? 'best' : ''}"><td>${b.smallest === 1 ? '1' : '½'} LSB</td><td class="num">${b.outBits}</td><td class="num">${r.cu} fF</td><td class="num">${eng(r.cm, 'F')}</td><td class="num">${num(r.area * 1e6, 4)} mm²</td><td class="num">${r.decisions}</td><td class="num">${num(r.enob, 2)}</td><td class="num ${r.timeOk ? '' : 'badc'}">${eng(r.tConv, 's')}</td><td><button class="mini" data-use="${r.cu},${r.smallest},${r.outBits}">use</button></td></tr>`;
  }).join('');
  fill('opBest', `<div class="tablewrap"><table class="tbl opt"><thead><tr><th>smallest step</th><th>output bits</th><th>smallest Cu that passes</th><th>CM</th><th>capacitor area</th><th>decisions</th><th>ENOB</th><th>conversion time</th><th></th></tr></thead><tbody>${tr}</tbody></table></div>`);
  if (R.key === keyOf(ctx)) fill('opCap', overall ? `Smallest CM that passes: ${eng(overall.best.cm, 'F')} with Cu = ${overall.best.cu} fF, smallest step ${overall.smallest === 1 ? '1' : '½'} LSB and ${overall.outBits} output bits (${overall.best.decisions} decisions, ENOB ${num(overall.best.enob, 2)}). Conversion times use the illustrative timing values; the target is 1 / fs = ${eng(1 / P.fs, 's')}.` : `No design in the grid meets ENOB ${num(P.enobAim, 1)} with these values. The plots show how close each option gets.`);
  const series = [];
  for (const s of [1, 0.5]) {
    for (const ob of OUT_BITS) {
      const pts = rows.filter((r) => r.smallest === s && r.outBits === ob && r.enob).map((r) => [r.cu, r.enob]);
      const [col, dash] = LINE[`${s}-${ob}`];
      if (pts.length) series.push({ points: pts, color: col, dash, width: 2, label: `${s === 1 ? '1' : '½'} LSB, ${ob} bit` });
    }
  }
  const ys = rows.map((r) => r.enob).filter(Number.isFinite);
  const w = widthOf('opEnob');
  fill('opEnob', plot({ height: 270, x: { min: 5, max: 155, label: 'Cu [fF]' }, y: { min: Math.min(...ys, P.enobAim) - 0.1, max: Math.max(...ys, P.enobAim) + 0.1, label: 'ENOB [bit]' }, series, hlines: [{ y: P.enobAim, color: COL.bad, dash: '6 3', width: 1.5 }], vlines: [{ x: 35, color: COL.muted, label: 'PDK min' }], legend: true }, w), 'Each line: one smallest step and one output width. Above the red line the ENOB aim is met.');
  const one = rows.filter((r) => r.outBits === 10);
  const cmPts = (s) => one.filter((r) => r.smallest === s).map((r) => [r.cu, r.cm * 1e15]);
  fill('opCm', plot({ height: 270, x: { min: 5, max: 155, label: 'Cu [fF]' }, y: { min: 0, max: Math.max(...one.map((r) => r.cm * 1e15)) * 1.1, label: 'CM [fF]' }, series: [{ points: cmPts(1), color: COL.an, width: 2.2, label: 'CM' }, { points: one.filter((r) => r.smallest === 1).map((r) => [r.cu, (r.area * 1e6 * Math.max(...one.map((q) => q.cm * 1e15))) / Math.max(...one.map((q) => q.area * 1e6))]), color: COL.ref, width: 1.8, dash: '5 3', label: 'area, scaled to the same top' }], legend: true }, widthOf('opCm')), `CM grows in proportion to Cu (and to VREF): one LSB is 2 VREF Cu / ${P.lsbPerUnit}, and the cells must hold 2^N of them over the full scale. Capacitor area at ${eng(P.cu, 'F')} now: ${num(ctx.areaTotal * 1e6, 4)} mm²; the memory cells are most of it.`);
  const tPts = (s) => rows.filter((r) => r.smallest === s && r.outBits === 10).map((r) => [r.cu, r.tConv * 1e9]);
  const dPts = (s) => rows.filter((r) => r.smallest === s && r.outBits === 10).map((r) => [r.cu, r.decisions]);
  fill('opTime', plot({ height: 270, x: { min: 5, max: 155, label: 'Cu [fF]' }, y: { min: 0, max: Math.max(1e9 / P.fs, ...rows.map((r) => r.tConv * 1e9)) * 1.15, label: 'conversion time [ns]' }, series: [{ points: tPts(1), color: COL.an, width: 2.2, label: 'smallest step 1 LSB' }, { points: tPts(0.5), color: COL.ref, width: 2.2, label: '½ LSB' }], hlines: [{ y: 1e9 / P.fs, color: COL.bad, dash: '6 3', width: 1.5 }], legend: true }, widthOf('opTime')),
    `Red: 1 / fs. Decisions with a 1 LSB smallest step: ${dPts(1).map((p) => p[1]).join(', ')}; with ½ LSB: ${dPts(0.5).map((p) => p[1]).join(', ')} (for Cu ${CU_GRID.join(', ')} fF). A smaller Cu matches worse, so the weights need more redundancy and more decisions. Timing values are illustrative; set them on the side or on the Timing page.`);
  fill('opWhy', why(ctx));
}

function why(ctx) {
  const { P, d } = ctx;
  return `<ul class="whyl">
    <li><b>CM ∝ VREF · Cu.</b> One LSB is Q LSB = 2 VREF Cu / ${P.lsbPerUnit}; the memory cells must balance 2^N of them, so CM = 2^N Q LSB / (N V FS). Halving Cu halves CM and most of the area.</li>
    <li><b>Mismatch grows as Cu shrinks:</b> σu = A C / √(Cu / fF), now ${num(ctx.sigmaU * 100, 2)} %. The weights then need more redundancy, so more decisions and more time.</li>
    <li><b>kT/C grows relative to the LSB:</b> the cell noise is √(2kT N CM) while the LSB is ∝ CM, so in LSB it goes as 1 / √Cu. The same holds for the CDAC precharge noise.</li>
    <li><b>Comparator noise does not change with Cu:</b> C node and Q LSB both scale with Cu, so v n · C node / Q LSB stays ${num((d.cNode[d.decisions - 1] * P.compNoise) / d.qLsb, 3)} LSB. A larger VREF lowers it: the step capacitors stay the same while Q LSB grows.</li>
    <li><b>Rounding</b> to ${Math.round(P.outBits)} bits costs a fixed part of an LSB; more output bits or a smaller smallest step removes it.</li></ul>`;
}
