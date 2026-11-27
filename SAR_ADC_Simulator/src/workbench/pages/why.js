// Why redundancy, now that MOM matching no longer needs it: three reasons, each computed with the
// weight builder of MATLAB step 7b (weightBuilder.js) and the current values.
//   speed   conversion time T / tau = N dec r + N steps n tau, redundant lists against binary (7.6 tau per step)
//   offset  the largest raw comparator offset a list can absorb, against 0.98 mV for binary (Rabuske eq. 4.60)
//   need    what every decision of the current weights needs: mismatch, offset, settling

import { fill, widthOf, plot, readouts, explain, num, COL } from '../kit.js';
import { builderConstants, buildWeights, timeTable, fixedErrors } from '../../zaan/model/weightBuilder.js';

const memo = {};
const VOS = [0.15, 0.5, 1, 2, 3, 5, 8, 12];
const NTAU = [4.6, 3.7, 3.0];

export const page = {
  id: 'why',
  title: 'Why redundancy',
  main() {
    return `<section class="card wide"><header><h3>With MOM, mismatch no longer needs redundancy. What does?</h3></header><div class="cbody" id="whyRead"></div></section>
      <div class="grid2"><section class="card"><header><h3>1. Speed: conversion time against r</h3></header><div class="cbody" id="whySpeed"></div><p class="cap" id="whySpeed-cap"></p></section>
      <section class="card"><header><h3>2. Comparator offset it can absorb</h3></header><div class="cbody" id="whyOff"></div><p class="cap" id="whyOff-cap"></p></section></div>
      <section class="card wide"><header><h3>3. What each decision of the current weights needs</h3></header><div class="cbody" id="whyNeed"></div><p class="cap" id="whyNeed-cap"></p></section>
      ${explain('The reasons in one story', [
        'Speed: a binary CDAC must settle every step to ½ LSB of 10 bits, 7.6 τ, because no later step can repair it. Redundant weights accept a few percent of unsettled charge and repair it later, so each step needs only 2.4 to 3.7 τ. The gain is largest when settling dominates, so when r = (comparator + logic delay) / τ is small. The same gain can be spent as smaller switches instead: τ = R on C, so for the same time the switches may be about 2.9 times narrower.',
        'Offset: in charge sharing the node capacitance grows with every decision, so a fixed offset voltage is a different charge at every step. Binary tolerates 0.98 mV; redundant lists tolerate several mV, possibly enough to drop the background offset calibration.',
        'Also (not computed here): a forced decision on metastability (Chang 2016 p. 3, Liu 2011 p. 2668), a cheaper comparator for the early decisions, and charge halving and parasitic errors that end up in the calibrated weights.',
      ])}`;
  },
  update(store, ctx) {
    const { P, d } = ctx;
    const K = builderConstants(P, d);
    const opts = { vos: P.vosCal, gMargin: P.gainMargin || 0, dMargin: P.decMargin || 0 };
    const key = JSON.stringify([K, opts]);
    if (memo.k !== key) {
      memo.k = key;
      memo.tt = timeTable(opts, K, [4.6, 4, 3.7, 3.4, 3.2, 3, 2.8, 2.6, 2.4], [1, 2, 3, 5, 7, 10, 15]);
      memo.off = VOS.map((mv) => NTAU.map((nTau) => { const w = buildWeights({ nTau, ...opts, vos: mv * 1e-3 }, K); return w ? w.length + 1 : null; }));
    }
    const tt = memo.tt;
    const binT = (r) => P.bits * r + (P.bits - 1) * Math.log(2 ** (P.bits + 1));
    const best = (j) => Math.min(...tt.rows.filter((row) => row.T[j] !== null).map((row) => row.T[j]));
    const rs = tt.rList;
    const gain = rs.map((r, j) => 1 - best(j) / binT(r));
    const binOff = (1e3 * P.alphaIn * P.fullScale) / 2 ** P.bits;
    const maxOff = NTAU.map((_, j) => { let m = null; VOS.forEach((mv, i) => { if (memo.off[i][j]) m = mv; }); return m; });
    fill('whyRead', readouts([
      ['Speed gain at r = 2', `${num(gain[1] * 100, 0)} %`, 'shorter conversion than binary'],
      ['Speed gain at r = 5', `${num(gain[3] * 100, 0)} %`, `at r = 10: ${num(gain[5] * 100, 0)} %`],
      ['Offset absorbed', `${maxOff[0] ?? '<0.15'} mV`, `at 4.6 τ (binary about ${num(binOff, 2)} mV)`],
      ['Mismatch share, first decision', `${num((100 * ctx.tolNeed[0].mismatch) / Math.max(ctx.tolNeed[0].need, 1e-9), 0)} %`, 'of what decision 1 needs'],
    ]));
    const w1 = Math.max(320, widthOf('whySpeed'));
    const rr = Array.from({ length: 29 }, (_, i) => 1 + i * 0.5);
    const bestCurve = rr.map((r) => [r, Math.min(...tt.rows.filter((row) => row.w).map((row) => row.decisions * r + row.w.length * row.nTau))]);
    fill('whySpeed', plot({ height: 210, x: { min: 1, max: 15, label: 'r = (comparator + logic) / τ' }, y: { min: 0, max: binT(15) * 1.05, label: 'T / τ' }, legend: true,
      series: [{ points: rr.map((r) => [r, binT(r)]), color: COL.ref, width: 2, label: 'binary' }, { points: bestCurve, color: COL.an, width: 2, label: 'redundant' }] }, w1),
    `Binary: ${P.bits} decisions, ${P.bits - 1} steps of 7.6 τ. Redundant: the fastest list of the weight builder (MATLAB 7b) for each r, with the offset after calibration (${num(P.vosCal * 1e3, 2)} mV) and the margins. Once the comparator delay is measured, r is known.`);
    fill('whyOff', `<div class="tablewrap"><table class="tbl"><thead><tr><th>raw offset</th>${NTAU.map((n) => `<th>${n} τ</th>`).join('')}</tr></thead><tbody>${VOS.map((mv, i) => `<tr><td class="num">${mv} mV</td>${memo.off[i].map((x) => `<td class="num">${x ? `${x} decisions` : 'no list'}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`,
    `Decisions the weight builder needs when the comparator offset is not calibrated away. Binary allows about ${num(binOff, 2)} mV (α V LSB, Rabuske eq. 4.60). Compare with a Monte Carlo of the comparator (3σ raw offset).`);
    const tn = ctx.tolNeed;
    const f = (x) => num(x, 2);
    fill('whyNeed', `<div class="tablewrap"><table class="tbl"><thead><tr><th>decision</th><th>step [LSB]</th><th>tolerance</th><th>mismatch (3σ)</th><th>offset</th><th>settling</th><th>need</th><th>used</th></tr></thead><tbody>${tn.map((t, i) => {
      const lim = t.have > 0 ? t.have : 0.5;
      const used = (t.need + (t.have > 0 ? t.margin : 0)) / lim;
      return `<tr><td class="num">${i + 1}</td><td class="num">${i < d.weights.length ? num(d.weights[i], 1) : 'last'}</td><td class="num">${t.have > 0 ? f(t.have) : '0 (need < ½)'}</td><td class="num">${f(t.mismatch)}</td><td class="num">${f(t.offset)}</td><td class="num">${f(t.settling)}</td><td class="num">${f(t.need)}</td><td class="num" style="color:${used > 1 ? 'var(--bad)' : 'inherit'}">${num(used * 100, 0)} %</td></tr>`;
    }).join('')}</tbody></table></div>`,
    'In LSB. Used = (need + margin) / tolerance; a decision without tolerance must keep its need below ½ LSB (MATLAB 7c). Settling and offset take most of the room in the middle decisions; mismatch only matters in the first ones.');
  },
};
