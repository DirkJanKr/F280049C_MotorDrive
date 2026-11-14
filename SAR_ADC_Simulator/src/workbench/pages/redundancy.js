// Item 4: redundancy and total CDAC charge.
//   Q_DAC,total = Q_LSB * sum(w)                       (w: workbench weights, each step added or subtracted)
//   4 V_REF C_DAC = N V_in,max C_M * 2 sum(w) / 2^B    (verified in test/workbench.test.mjs)
//   alpha = (2 V_REF / V_in,max) * 2^B / (2 sum(w))
// A redundant list adds up to more than the binary 2^(B-1) - 1, so the CDAC holds more charge than
// the input full scale: that is overrange, not an error. Tolerance: t_i = sum of later steps
// + last step - w_i (standard for a redundant search, for example Chang 2013).

import { fill, readouts, explain, eng, num, esc, knobs } from '../kit.js';
import { PRESETS } from '../weights.js';
import { designCdac } from '../../zaan/model/cdac.js';
import { buildSteps } from '../../zaan/model/steps.js';
import { chargeBudget, toleranceNeeds } from '../budget.js';
import { residualEstimate } from '../residual.js';
import { changed } from '../store.js';

/**
 * Search for the weight list with the highest ENOB at a 10-bit output.
 * Family: first step T units, each next step the previous divided by the radix, then halving steps.
 * A list is kept when it reaches both ends of the range, every tolerance covers mismatch (3 sigma)
 * and offset, and it has no more decisions than allowed. ENOB from the charge budget, with the
 * quantisation taken as (smallest step) / sqrt 12 and the rounding as 1 / sqrt 12 LSB (estimates).
 */
function searchLists(ctx, maxDec) {
  const { P, budget } = ctx;
  const P10 = { ...P, outBits: P.bits };
  const seen = new Set();
  const out = [];
  for (let top = 16; top <= 36; top++) for (let r = 1.5; r <= 2.001; r += 0.05) for (const h of [3, 4]) {
    const d = designCdac(P, P.memCells, buildSteps({ topUnits: top, radix: r, halvings: h, halvingOn: true }));
    const key = d.weights.join(' ');
    if (seen.has(key) || !d.cover.ok || d.decisions > maxDec) continue;
    seen.add(key);
    if (toleranceNeeds(P, d, ctx.sigmaU).some((x) => !x.ok)) continue;
    out.push({ d, enob: chargeBudget(P10, d, { arrayGain: budget.arrayGain, res: residualEstimate(d, P10) }).enob });
  }
  return out.sort((a, b) => b.enob - a.enob || a.d.decisions - b.d.decisions).slice(0, 8);
}

const SETS = [
  ['binary', { radix: 2, topUnits: 32, halvings: 3 }],
  ['radix 2, first step 33', { radix: 2, topUnits: 33, halvings: 3 }],
  ['radix 1.9', { radix: 1.9, topUnits: 32, halvings: 3 }],
  ['radix 1.8', { radix: 1.8, topUnits: 32, halvings: 3 }],
  ['radix 1.7', { radix: 1.7, topUnits: 32, halvings: 3 }],
  ['radix 1.9, last step ½ LSB', { radix: 1.9, topUnits: 32, halvings: 4 }],
];

export const page = {
  id: 'redundancy',
  title: 'Weights',
  side() {
    return '';
  },
  main(store) {
    return `<section class="card wide"><header><h3>The weights in use</h3></header><div class="cbody" id="rdNow"></div></section><div id="rdRo"></div>
      <section class="card wide"><header><h3>Search for the weight list with the highest ENOB</h3><span class="ctl"><label class="mini-l">at most <select id="rdMax">${[11, 12, 13, 14].map((k) => `<option ${k === (store.ui.rdMax || 13) ? 'selected' : ''}>${k}</option>`).join('')}</select> decisions</label> <button class="mini primary" id="rdRun">▶ search</button></span></header><div class="cbody" id="rdBest"><p class="cap">Press search. It tries first steps from 16 to 36 unit capacitors, radix 1.5 to 2.0, and a last step of 1 or ½ LSB, and keeps the lists whose redundancy covers mismatch and offset.</p></div><p class="cap" id="rdBest-cap"></p></section>
      <section class="card wide"><header><h3>How the steps below one unit are made: charge halving in the precharge</h3><span class="ctl"><button class="mini" id="hvBack">◀ step</button><button class="mini primary" id="hvNext">step ▶</button></span></header><div class="cbody" id="hvView"></div><p class="cap" id="hvView-cap"></p></section>
      <section class="card wide"><header><h3>Or set the weights by hand</h3></header><div class="cbody" id="rdHand">${handControls(store)}</div></section>
      <section class="card wide"><header><h3>Candidate weight lists: what the extra charge costs</h3></header><div class="cbody" id="rdTab"></div><p class="cap" id="rdTab-cap"></p></section>
      ${explain('Why the CDAC holds more than the full scale', [
        'In a binary list every step is exactly as large as all later steps together plus one LSB. Nothing is left over: one wrong decision cannot be repaired. A redundant list makes the early steps smaller than that, so the later steps reach further than needed. Added up, the steps then reach beyond the input range. That surplus is the overrange.',
        'The extra reach is charge that must be on the CDAC. At the same V REF the CDAC needs more capacitance, so alpha drops and one LSB is smaller at the comparator. At the same capacitance V REF must go up instead. Either way redundancy is paid for with reference charge, and with one or two more decisions.',
      ])}`;
  },
  mount(store) {
    halving(store, 0);
    document.getElementById('hvNext').onclick = () => halving(store, (store.ui.hvStep || 0) + 1);
    document.getElementById('hvBack').onclick = () => halving(store, (store.ui.hvStep || 0) - 1);
    document.getElementById('rdRun').onclick = () => {
      const ctx = store.ctx;
      store.ui.rdMax = +document.getElementById('rdMax').value;
      store.ui.rdRan = true;
      const best = searchLists(ctx, store.ui.rdMax);
      const now = ctx.budget.enob;
      const tr = best.map(({ d, enob }, i) => `<tr><td class="num">${d.weights.map((w) => num(w, 2)).join(' ')}</td><td class="num">${d.decisions}</td><td class="num">${num(d.sumW, 1)}</td><td class="num">${num(d.alpha, 3)}</td><td class="num">${num(Math.min(...d.tol.slice(0, -1)), 1)}</td><td class="num"><b>${num(enob, 2)}</b></td><td><button class="mini" data-rduse="${i}">use</button></td></tr>`).join('');
      fill('rdBest', best.length ? `<div class="tablewrap"><table class="tbl"><thead><tr><th>Weights [LSB]</th><th>Decisions</th><th>Σw</th><th>alpha of the list</th><th>Smallest tolerance [LSB]</th><th>ENOB (estimate)</th><th></th></tr></thead><tbody>${tr}</tbody></table></div>` : '<p class="cap">No list in the family passes. Allow more decisions, or lower the mismatch or the offset.</p>',
        `The present weights give ENOB ${num(now, 2)} in the budget. What moves the ENOB: a last step of ½ LSB halves the quantisation by the levels; every LSB of extra Σw is extra capacitance on the node, which makes the comparator noise and the precharge noise larger in LSB. So the best list is the one with a ½ LSB last step and the least redundancy that still covers the errors. The first step does not have to be 256: it only may not be larger than all later steps together plus the last step, and the whole list must reach 511. A smaller first step gives the first decision more tolerance but needs more or larger later steps. "use" loads the list as custom weights.`);
      document.querySelectorAll('[data-rduse]').forEach((b) => {
        b.onclick = () => {
          store.ui.weightMode = 'custom';
          store.ui.customWeights = best[+b.dataset.rduse].d.weights.map((w) => +w.toFixed(4)).join(', ');
          store.values.find((x) => x.id === 'halvingOn').value = 'charge halving';
          changed('values');
          changed('side');
        };
      });
    };
    if (store.ui.rdRan) document.getElementById('rdRun').click();
  },
  update(store, ctx) {
    fill('rdNow', `<p style="font:600 16px var(--mono);margin:2px 0 6px">${ctx.d.weights.map((x) => num(x, 2)).join(' &nbsp; ')}</p><p class="cap">In LSB, largest first. ${ctx.d.decisions} decisions; ${store.ui.weightMode === 'custom' ? 'a typed or searched list' : `generated from first step ${ctx.P.topUnits} units and radix ${num(ctx.P.radix, 2)}`}. Budget ENOB with these weights: <b>${num(ctx.budget.enob, 2)}</b>. Every page uses this list.</p>`);
    const { P, d } = ctx;
    const tDecOf = (n) => ((1 / P.fs) * 0.78) / (n + 1);
    const rows = SETS.map(([name, o]) => [name, designCdac(P, P.memCells, buildSteps({ ...o, halvingOn: true }))]);
    rows.push(['present weights', d]);
    const bin = rows[0][1];
    fill('rdRo', readouts([
      ['Present weights: sum', `${num(d.sumW, 1)} LSB`, `binary: ${num(bin.sumW, 0)}`],
      ['Overrange', `${num(d.cover.overrange * 100, 1)} %`, `inputs up to ±${num(d.cover.reach, 0)} LSB convert correctly`],
      ['CDAC charge', eng(d.sumW * d.qLsb, 'C'), `Q LSB · Σw; half the full scale is ${eng(d.qFs / 2, 'C')}`],
      ['alpha', num(d.alpha, 3), `binary: ${num(bin.alpha, 3)}`],
    ]));
    const tr = rows.map(([name, x]) => {
      const f = x.sumW / bin.sumW;
      const td = tDecOf(x.decisions);
      return `<tr><td>${esc(name)}</td><td class="num wrap">${x.weights.map((w) => num(w, 1)).join(' ')}</td><td class="num">${x.decisions}</td><td class="num">${num(x.sumW, 1)}</td><td class="num">${num(x.cover.overrange * 100, 1)} %</td><td class="num">${eng(x.cdacEff, 'F')} (× ${num(f, 3)})</td><td class="num">${eng(P.vref * f, 'V')}</td><td class="num">${num(x.alpha, 3)}</td><td class="num">${num(Math.min(...x.tol.slice(0, -1)), 1)}</td><td class="num ${td < 1.5e-9 ? 'badc' : ''}">${eng(td, 's')}</td></tr>`;
    }).join('');
    fill('rdTab', `<div class="tablewrap"><table class="tbl"><thead><tr><th>List</th><th>Weights [LSB]</th><th>Decisions</th><th>Σw</th><th>Overrange</th><th>C DAC at V REF = ${eng(P.vref, 'V')}</th><th>or V REF at the binary C DAC</th><th>alpha</th><th>Smallest tolerance [LSB]</th><th>Time per decision</th></tr></thead><tbody>${tr}</tbody></table></div>`,
      `C DAC is the capacitance that carries reference charge; the halving capacitors start empty. Time per decision: 78 % of the ${eng(1 / P.fs, 's')} period shared by the decisions and the offset-calibration comparison (the rest is charge redistribution and reset, read off Chen Fig. 4(b), an assumption); Chen has 2.4 ns. Red: below 1.5 ns, which is my assumption for what 0.18 µm logic and a comparator can do, not a paper value.`);
  },
};

/** The manual controls: generate from a rule, or type the list. Handled by the listeners in app.js. */
function handControls(store) {
  const ui = store.ui;
  const used = new Set();
  const gen = ui.weightMode !== 'custom';
  return `<div class="grid2 inner"><div><div class="seg"><button class="${gen ? 'on' : ''}" data-mode="generator">from a rule: first step and radix</button><button class="${gen ? '' : 'on'}" data-mode="custom">type the list</button></div>
    <label class="kl">Start from a preset</label><select id="preset" class="sel"><option value="">choose…</option>${Object.keys(PRESETS).map((p) => `<option>${esc(p)}</option>`).join('')}</select>
    ${knobs(store.values, ['halvingOn'], used)}</div>
    <div>${gen ? knobs(store.values, ['topUnits', 'radix', 'halvings'], used) : `<label class="kl" for="wlist">Weights in LSB, largest first</label><textarea id="wlist" class="wl-in" rows="3">${esc(ui.customWeights)}</textarea><p class="ks">Steps of one unit or more are whole capacitors; smaller steps are made by charge halving.</p>`}</div></div>`;
}

// Charge halving in the precharge (multi-step LSB precharge, Craninckx 2007; Rabuske 2017, p. 41 and Fig. 3.10).
// The principle as a sequence of precharge steps; the exact switching order of Rabuske Fig. 3.10 is still to be checked.
// Level = voltage as a fraction of V PC. Caps: A, B, C (unit capacitors) and X (the equal auxiliary capacitor).
const HV = [
  { lv: [0, 0, 0, 0], on: [], t: 'Start of the precharge: the three unit capacitors A, B, C and an equal auxiliary capacitor X are empty.' },
  { lv: [1, 1, 1, 0], on: [0, 1, 2], t: 'A, B and C are charged to V PC, like every other CDAC capacitor.' },
  { lv: [0.5, 1, 1, 0.5], on: [0, 3], t: 'A is connected to the empty X: the charge divides equally, so A keeps half.' },
  { lv: [0.5, 0.25, 1, 0.25], on: [1, 3], t: 'X is emptied and B shares with it twice: B keeps a quarter.' },
  { lv: [0.5, 0.25, 0.125, 0.125], on: [2, 3], t: 'X is emptied and C shares with it three times: C keeps an eighth.' },
  { lv: [0.5, 0.25, 0.125, 0], on: [], t: 'Precharge done. A, B and C now carry a half, a quarter and an eighth of a unit charge: the three smallest steps of the search, without any capacitor smaller than the unit. During the conversion they are used like every other step.' },
];
function halving(store, k) {
  const step = Math.max(0, Math.min(HV.length - 1, k));
  store.ui.hvStep = step;
  const { d, P } = store.ctx;
  const unitLsb = P.lsbPerUnit;
  const st = HV[step];
  const w = 720;
  const H = 230;
  const tank = 70;
  const th = 120;
  const y0 = 40;
  const names = ['A', 'B', 'C', 'X'];
  const xs = [80, 220, 360, 560];
  const p = [`<svg viewBox="0 0 ${w} ${H}" class="dsvg hv" role="img" aria-label="Charge halving, step ${step + 1} of ${HV.length}">`];
  p.push(`<line x1="40" x2="${w - 40}" y1="${y0 + th + 34}" y2="${y0 + th + 34}" stroke="var(--line)"/>`);
  st.on.forEach((i) => { if (st.on.length === 2) p.push(`<path d="M${xs[st.on[0]] + tank / 2} ${y0 - 8} H${xs[st.on[1]] + tank / 2}" stroke="var(--ref)" stroke-width="3" fill="none"/>`); });
  names.forEach((n, i) => {
    const lv = st.lv[i];
    const x = xs[i];
    p.push(`<rect x="${x}" y="${y0}" width="${tank}" height="${th}" rx="4" fill="var(--panel2)" stroke="${st.on.includes(i) ? 'var(--ref)' : 'var(--border)'}" stroke-width="${st.on.includes(i) ? 3 : 1.5}"/>`);
    p.push(`<rect class="hvf" x="${x + 3}" y="${y0 + 3}" width="${tank - 6}" height="${th - 6}" rx="2" fill="${i === 3 ? 'var(--muted)' : 'var(--ref)'}" style="transform: scaleY(${lv}); transform-origin: ${x + tank / 2}px ${y0 + th - 3}px"/>`);
    p.push(`<text x="${x + tank / 2}" y="${y0 + th + 22}" text-anchor="middle" class="lbl" style="font-weight:600">${n}</text>`);
    const lsb = lv * unitLsb;
    if (i < 3) p.push(`<text x="${x + tank / 2}" y="${y0 + th + 54}" text-anchor="middle" class="tiny">${lv ? `${num(lsb, 2)} LSB = ${eng(lsb * d.qLsb, 'C')}` : 'empty'}</text>`);
    else p.push(`<text x="${x + tank / 2}" y="${y0 + th + 54}" text-anchor="middle" class="tiny">auxiliary</text>`);
    p.push(`<text x="${x + tank / 2}" y="${y0 - 16}" text-anchor="middle" class="tiny">${lv ? `${lv === 1 ? '' : `${num(lv * 100, 1)} % of `}V PC` : ''}</text>`);
  });
  p.push(`<text x="${w - 40}" y="22" text-anchor="end" class="tiny">step ${step + 1} of ${HV.length}</text></svg>`);
  fill('hvView', p.join(''), `${st.t} One unit capacitor is worth ${unitLsb} LSB here, so the three steps are ${unitLsb / 2}, ${unitLsb / 4} and ${unitLsb / 8} LSB. The principle of multi-step LSB precharge (Craninckx 2007; Rabuske 2017, p. 41, Fig. 3.10); the exact switching order of that figure is still to be checked. Charges with the present design: one LSB = ${eng(d.qLsb, 'C')}.`);
  document.getElementById('hvBack').disabled = step === 0;
  document.getElementById('hvNext').disabled = step === HV.length - 1;
}
