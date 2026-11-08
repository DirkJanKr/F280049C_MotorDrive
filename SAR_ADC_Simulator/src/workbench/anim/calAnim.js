// Calibration mode animation: a ramp enters, raw decisions come out, the least
// squares weights converge on the true weights of this chip, and the DNL improves.

import { convert, combine } from '../../zaan/model/chargeSar.js';
import { leastSquaresWeights } from '../../zaan/model/calibrate.js';
import { rampLinearity } from '../../zaan/model/analysis.js';
import { createRng } from '../../model/rng.js';
import { lp, COL } from '../graphs/common.js';
import { num } from '../../zaan/ui/fmt.js';

let timer = 0;

export function playCalibration(el, ctx, w) {
  clearTimeout(timer);
  const { d, P, sim } = ctx;
  const rng = createRng(P.seed + 5);
  const xs = [];
  for (let j = 0; j < d.codes * 8; j++) xs.push((j + 0.5) / 8);
  const dec = xs.map((x) => convert(sim.chip, d, x - d.codes / 2, { vos: P.vosCal, noise: P.compNoise, rng }));
  const order = xs.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng.uniform() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const sizes = [32, 64, 128, 256, 512, 1024, 2048, 4096, 8192];
  const errs = [];
  let f = 0;
  const frame = () => {
    const m = sizes[f];
    const idx = order.slice(0, m);
    const cal = leastSquaresWeights(idx.map((i) => dec[i]), idx.map((i) => xs[i]));
    const e = [0, 1, 2, 3].map((i) => Math.abs(cal.w[i] - sim.chip.wTrue[i]));
    errs.push([Math.log2(m), ...e.map((x) => Math.log10(Math.max(x, 1e-4)))]);
    const lin = rampLinearity(dec.map((q) => combine(q, cal, d.codes)), d.codes);
    const k = Array.from({ length: d.codes - 2 }, (_, i) => i + 1);
    const cols = [COL.an, COL.ref, COL.cal, COL.clk];
    el.innerHTML =
      lp({ height: 170, x: { min: 5, max: 13, label: 'calibration samples (log2)', ticks: [5, 7, 9, 11, 13] }, y: { min: -4, max: 2, label: 'log10 |w cal − w true|' }, series: [0, 1, 2, 3].map((i) => ({ points: errs.map((p) => [p[0], p[i + 1]]), color: cols[i], width: 2, label: `w${i + 1}` })), legend: true }, w) +
      lp({ height: 160, x: { min: 0, max: d.codes, label: 'code' }, y: { min: -1.5, max: 1.5, label: 'DNL [LSB]' }, series: [{ points: k.map((i) => [i, lin.dnl[i]]), color: COL.an, width: 1 }] }, w) +
      `<p class="cap">${m} ramp samples: weight 1 = ${num(cal.w[0], 3)} (true ${num(sim.chip.wTrue[0], 3)}), peak |DNL| ${num(lin.peakDnl, 2)} LSB.</p>`;
    f++;
    if (f < sizes.length && el.isConnected) timer = setTimeout(frame, 450);
  };
  frame();
}
