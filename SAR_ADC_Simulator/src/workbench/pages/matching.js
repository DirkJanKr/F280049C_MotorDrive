// CDAC matching: does a binary CDAC of this size meet 3 sigma DNL < 1/2 LSB, with MOM and with MIM?
// The rule is formula B of MATLAB step 5 (simulated there): sigma DNL = 2^(B-1) A C / sqrt(C DAC in fF).
// The Monte Carlo converts a fine ramp with a binary charge-sharing SAR (first decision against zero,
// then steps 2^(B-2) ... 1, the last three by charge halving) and measures the width of every code.

import { fill, widthOf, plot, readouts, explain, eng, num, COL, statusChip } from '../kit.js';
import { siOf, mismatchCoefficient } from '../design.js';
import { createRng } from '../../model/rng.js';

const memo = {};

/** Binary steps in LSB with their relative sigma: whole units sigma u / sqrt(units), halving steps sigma u / sqrt 2. */
function binarySteps(bits, lsbPerUnit, sigmaU) {
  const out = [];
  for (let k = 1; k < bits; k++) {
    const w = 2 ** (bits - 1 - k);
    const units = w / lsbPerUnit;
    out.push({ w, units, rel: units >= 1 ? sigmaU / Math.sqrt(units) : sigmaU / Math.SQRT2 });
  }
  return out;
}

/** Monte Carlo of the input width of every code. Returns per chip: DNL of the mid code, worst |DNL|, missing codes. */
export function binaryDnlMonteCarlo({ bits, lsbPerUnit, sigmaU, chips, seed, step = 0.05 }) {
  const steps = binarySteps(bits, lsbPerUnit, sigmaU);
  const codes = 2 ** bits;
  const half = codes / 2;
  const rng = createRng(seed);
  const mid = [], worst = [], miss = [];
  const cnt = new Float64Array(codes);
  const W = new Float64Array(steps.length);
  for (let c = 0; c < chips; c++) {
    steps.forEach((s, i) => { W[i] = s.w * (1 + s.rel * rng.gaussian()); });
    cnt.fill(0);
    for (let x = -half + step / 2; x < half; x += step) {
      let est = 0, code = 0;
      for (let i = 0; i < W.length; i++) {
        const s = x >= est ? 1 : -1;
        est += s * W[i];
        code += s * steps[i].w;
      }
      const last = x >= est ? 0.5 : -0.5;
      const idx = Math.round(code + last + half - 0.5);
      if (idx >= 0 && idx < codes) cnt[idx] += step;
    }
    let wst = 0, ms = 0;
    for (let k = 1; k < codes - 1; k++) { const dnl = cnt[k] - 1; wst = Math.max(wst, Math.abs(dnl)); if (cnt[k] === 0) ms++; }
    mid.push(cnt[half] - 1); worst.push(wst); miss.push(ms);
  }
  return { mid, worst, miss };
}

const sigmaDnl = (bits, aC, cFf) => (2 ** (bits - 1) * aC) / Math.sqrt(cFf);
const cdacFor3Sigma = (bits, aC) => (6 * 2 ** (bits - 1) * aC) ** 2 * 1e-15;

function histogram(values, lo, hi, bins) {
  const h = new Array(bins).fill(0);
  for (const v of values) { const k = Math.floor(((v - lo) / (hi - lo)) * bins); if (k >= 0 && k < bins) h[k]++; }
  const pts = [];
  h.forEach((c, i) => pts.push([lo + ((hi - lo) * i) / bins, c], [lo + ((hi - lo) * (i + 1)) / bins, c]));
  return pts;
}

export const page = {
  id: 'matching',
  title: 'CDAC matching',
  main() {
    return `<section class="card wide"><header><h3>Does a binary CDAC of this size match well enough?</h3></header><div class="cbody" id="cmRead"></div></section>
      <div class="grid2"><section class="card"><header><h3>3σ DNL against the CDAC size</h3></header><div class="cbody" id="cmCurve"></div><p class="cap" id="cmCurve-cap"></p></section>
      <section class="card"><header><h3>Monte Carlo: width of the mid-scale code</h3></header><div class="cbody" id="cmMc"></div><p class="cap" id="cmMc-cap"></p></section></div>
      <section class="card wide"><header><h3>Theory against simulation</h3></header><div class="cbody" id="cmTab"></div></section>
      ${explain('Why 2^(B−1) and not 2^B', [
        'The DNL is the width of a code. At mid-scale, the code just above zero runs from the first decision (against zero, no capacitor) to the point where the first step equals all the others. Every step error counts once: δw 1 − δw 2 − … − δw last.',
        'A step of k units has σ = n u · σ u · √k LSB, so all units together give n u · σ u · √units = 2^(B−1) A C / √C DAC (formula B, MATLAB step 5: 0.111 predicted, 0.108 simulated with MOM).',
        'Twice that, 2^B A C / √C DAC, is the jump between the outputs on either side of mid-scale read with the real weights. That is an error of the output value, not a code width, so it is not the DNL. The old version of this page used it, which overstated the capacitance needed by a factor of 4.',
      ])}
      ${explain('What this does not include', [
        'Random mismatch only, as the PDK Monte Carlo. Gradients across the array come on top: common-centroid layout and dummies, checked after layout.',
        'Parasitics and charge halving errors are fixed per chip and act as weight errors (MATLAB step 7g); they are not in this check.',
        'The Monte Carlo of the PDK applies one random value to an instance with a multiplier m: build large steps from separate instances when simulating the CDAC in Cadence.',
      ])}`;
  },
  update(store, ctx) {
    const { P } = ctx;
    const v = store.values;
    const aMom = siOf(v, 'aMom');
    const aMim = mismatchCoefficient(siOf(v, 'pairSigma'), siOf(v, 'density')) / 100;
    const cdac = P.cdacBalance;
    const cFf = cdac * 1e15;
    const cuFf = P.cu * 1e15;
    const rows = [['MOM', aMom, COL.an], ['MIM', aMim, COL.ref]].map(([name, a, col]) => ({ name, a, col, sig: sigmaDnl(P.bits, a, cFf), need: cdacFor3Sigma(P.bits, a) }));
    const used = P.aC / 100;
    fill('cmRead', readouts(rows.map((r) => [`${r.name}: 3σ DNL at ${eng(cdac, 'F')}`, `${num(3 * r.sig, 2)} LSB`, `${3 * r.sig < 0.5 ? 'below' : 'above'} ½ LSB; binary needs ${eng(r.need, 'F')}`]).concat([['CDAC capacitor in use', siOf(v, 'capCdac'), `A C = ${num(used, 4)} √fF`]]))
      + `<p class="cap">σ DNL = 2<sup>B−1</sup> · A<sub>C</sub> / √C<sub>DAC</sub> &nbsp;(D, formula B, checked by simulation in MATLAB step 5). A<sub>C</sub> MOM = ${num(aMom, 4)} √fF ${statusChip('U')} stand-in value; A<sub>C</sub> MIM = ${num(aMim, 4)} √fF ${statusChip('S')} from the PDK pair figure. C<sub>DAC</sub> = ${eng(cdac, 'F')} from the charge balance (α = ${num(P.alphaIn, 2)}), not from matching.</p>`);
    const w = Math.max(320, widthOf('cmCurve'));
    const xs = Array.from({ length: 120 }, (_, i) => 0.1e-12 * 1.06 ** i).filter((c) => c <= 40e-12);
    const yMax = Math.min(3, Math.max(1, 3 * rows[1].sig * 1.2));
    fill('cmCurve', plot({ height: 220, x: { min: 0, max: 30, label: 'C DAC [pF]' }, y: { min: 0, max: yMax, label: '3σ DNL [LSB]' }, legend: true,
      series: rows.map((r) => ({ points: xs.map((c) => [c * 1e12, 3 * sigmaDnl(P.bits, r.a, c * 1e15)]), color: r.col, width: 2, label: r.name })),
      hlines: [{ y: 0.5, color: COL.bad, label: '½ LSB' }], vlines: [{ x: cdac * 1e12, color: COL.ink, label: 'this design' }] }, w),
    `MOM crosses ½ LSB at ${eng(rows[0].need, 'F')}, MIM at ${eng(rows[1].need, 'F')}. The CDAC of this design is ${eng(cdac, 'F')}.`);
    const chips = Math.min(400, Math.max(100, P.chips || 200));
    const key = JSON.stringify([aMom, aMim, cuFf, P.bits, P.lsbPerUnit, chips, P.seed]);
    if (!memo.k || memo.k !== key) {
      memo.k = key;
      memo.r = rows.map((r) => binaryDnlMonteCarlo({ bits: P.bits, lsbPerUnit: P.lsbPerUnit, sigmaU: r.a / Math.sqrt(cuFf), chips, seed: P.seed + 11 }));
    }
    const mc = memo.r;
    const sd = (a) => Math.sqrt(a.reduce((s, x) => s + x * x, 0) / a.length);
    const span = Math.max(1, 4 * rows[1].sig);
    const hs = mc.map((m) => histogram(m.mid, -span, span, 40));
    const hMax = Math.max(...hs.flat().map((q) => q[1])) * 1.1;
    const w2 = Math.max(320, widthOf('cmMc'));
    fill('cmMc', plot({ height: 220, x: { min: -span, max: span, label: 'DNL of the mid-scale code [LSB]' }, y: { min: 0, max: hMax, label: 'chips' }, legend: true,
      series: hs.map((pts, i) => ({ points: pts, color: rows[i].col, width: 1.8, label: rows[i].name })),
      vlines: [{ x: -0.5, color: COL.bad }, { x: 0.5, color: COL.bad, label: '±½' }] }, w2),
    `${chips} chips per capacitor, binary weights, unit ${eng(P.cu, 'F')} (${P.lsbPerUnit} LSB per unit), ramp of 20 points per code, no noise.`);
    const pct = (a, f) => `${num((100 * a.filter(f).length) / a.length, 0)} %`;
    fill('cmTab', `<div class="tablewrap"><table class="tbl"><thead><tr><th></th><th>MOM</th><th>MIM</th><th>Status</th></tr></thead><tbody>
      <tr><td>σ DNL, formula B</td>${rows.map((r) => `<td class="num">${num(r.sig, 3)} LSB</td>`).join('')}<td>D</td></tr>
      <tr><td>σ DNL, Monte Carlo (mid-scale code)</td>${mc.map((m) => `<td class="num">${num(sd(m.mid), 3)} LSB</td>`).join('')}<td>simulated here</td></tr>
      <tr><td>Median worst |DNL| over all codes</td>${mc.map((m) => `<td class="num">${num([...m.worst].sort((a, b) => a - b)[m.worst.length >> 1], 2)} LSB</td>`).join('')}<td>simulated here</td></tr>
      <tr><td>Chips with every |DNL| below ½ LSB</td>${mc.map((m) => `<td class="num">${pct(m.worst, (x) => x < 0.5)}</td>`).join('')}<td>simulated here</td></tr>
      <tr><td>Chips with a missing code</td>${mc.map((m) => `<td class="num">${pct(m.miss, (x) => x > 0)}</td>`).join('')}<td>simulated here</td></tr>
      <tr><td>Binary CDAC needed for 3σ &lt; ½ LSB</td>${rows.map((r) => `<td class="num">${eng(r.need, 'F')}</td>`).join('')}<td>D</td></tr>
    </tbody></table></div><p class="cap">The 3σ rule looks at one code; over all 1022 codes the worst one is larger, so fewer chips keep every code inside ½ LSB than the 99.7 % of one code. With MOM, matching alone no longer asks for redundancy or calibration (see SAR ADC, Why redundancy).</p>`);
  },
};
