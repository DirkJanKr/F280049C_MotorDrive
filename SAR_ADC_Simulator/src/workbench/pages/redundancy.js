// Item 4: redundancy and total CDAC charge.
//   Q_DAC,total = Q_LSB * sum(w)                       (w: workbench weights, each step added or subtracted)
//   4 V_REF C_DAC = N V_in,max C_M * 2 sum(w) / 2^B    (verified in test/workbench.test.mjs)
//   alpha = (2 V_REF / V_in,max) * 2^B / (2 sum(w))
// A redundant list adds up to more than the binary 2^(B-1) - 1, so the CDAC holds more charge than
// the input full scale: that is overrange, not an error. Tolerance: t_i = sum of later steps
// + last step - w_i (standard for a redundant search, for example Chang 2013).

import { fill, readouts, explain, eng, num, esc } from '../kit.js';
import { designCdac } from '../../zaan/model/cdac.js';
import { buildSteps } from '../../zaan/model/steps.js';

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
  title: 'Redundancy',
  side() {
    return '';
  },
  main() {
    return `<div id="rdRo"></div>
      <section class="card wide"><header><h3>Candidate weight lists: what the extra charge costs</h3></header><div class="cbody" id="rdTab"></div><p class="cap" id="rdTab-cap"></p></section>
      ${explain('Why the CDAC holds more than the full scale', [
        'In a binary list every step is exactly as large as all later steps together plus one LSB. Nothing is left over: one wrong decision cannot be repaired. A redundant list makes the early steps smaller than that, so the later steps reach further than needed. Added up, the steps then reach beyond the input range. That surplus is the overrange.',
        'The extra reach is charge that must be on the CDAC. At the same V REF the CDAC needs more capacitance, so alpha drops and one LSB is smaller at the comparator. At the same capacitance V REF must go up instead. Either way redundancy is paid for with reference charge, and with one or two more decisions.',
      ])}`;
  },
  update(store, ctx) {
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
      return `<tr><td>${esc(name)}</td><td class="num">${x.weights.map((w) => num(w, 1)).join(' ')}</td><td class="num">${x.decisions}</td><td class="num">${num(x.sumW, 1)}</td><td class="num">${num(x.cover.overrange * 100, 1)} %</td><td class="num">${eng(x.cdacEff, 'F')} (× ${num(f, 3)})</td><td class="num">${eng(P.vref * f, 'V')}</td><td class="num">${num(x.alpha, 3)}</td><td class="num">${num(Math.min(...x.tol.slice(0, -1)), 1)}</td><td class="num ${td < 1.5e-9 ? 'badc' : ''}">${eng(td, 's')}</td></tr>`;
    }).join('');
    fill('rdTab', `<div class="tablewrap"><table class="tbl"><thead><tr><th>List</th><th>Weights [LSB]</th><th>Decisions</th><th>Σw</th><th>Overrange</th><th>C DAC at V REF = ${eng(P.vref, 'V')}</th><th>or V REF at the binary C DAC</th><th>alpha</th><th>Smallest tolerance [LSB]</th><th>Time per decision</th></tr></thead><tbody>${tr}</tbody></table></div>`,
      `C DAC is the capacitance that carries reference charge; the halving capacitors start empty. Time per decision: 78 % of the ${eng(1 / P.fs, 's')} period shared by the decisions and the offset-calibration comparison (the rest is charge redistribution and reset, read off Chen Fig. 4(b), an assumption); Chen has 2.4 ns. Red: below 1.5 ns, which is my assumption for what 0.18 µm logic and a comparator can do, not a paper value.`);
  },
};
