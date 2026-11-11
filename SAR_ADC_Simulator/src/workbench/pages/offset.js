// Comparator offset in the charge-sharing search.
//   offset as charge at decision i:   Q_os,i = V_os * C_node,i
//   what the result is shifted by:    V_os * C_node,last / Q_LSB           (the last decisions agree)
//   error of decision i against it:   V_os * (C_node,last - C_node,i) / Q_LSB
//   repaired when that error <= tolerance_i + 1/2 LSB
// The ramp simulation uses ideal capacitors, so only the offset is at work.

import { fill, widthOf, plot, readouts, explain, eng, num, COL } from '../kit.js';
import { idealChip, convert, combine, designWeights } from '../../zaan/model/chargeSar.js';

/** Largest offset the redundancy of a design repairs [V]. */
export function absorbedOffset(d) {
  const n = d.decisions;
  const last = d.cNode[n - 1];
  let v = Infinity;
  for (let i = 0; i < n - 1; i++) {
    const dc = last - d.cNode[i];
    if (dc > 1e-21) v = Math.min(v, ((d.tol[i] + 0.5) * d.qLsb) / dc);
  }
  return v;
}

/** Error over a ramp after removing the mean shift: [code, worst error in that bin], plus shift and worst. */
function rampError(d, P, vos) {
  const chip = idealChip(d, P);
  const dw = designWeights(d);
  const e = [];
  for (let x = 16; x < d.codes - 16; x += 0.5) e.push(combine(convert(chip, d, x - d.codes / 2, { vos }), dw, d.codes, 6) + 0.5 - x);
  const shift = e.reduce((a, v) => a + v, 0) / e.length;
  const pts = [];
  let worst = 0;
  for (let k = 0; k < e.length; k += 8) {
    let m = 0;
    for (let j = k; j < Math.min(e.length, k + 8); j++) if (Math.abs(e[j] - shift) > Math.abs(m)) m = e[j] - shift;
    pts.push([16 + k / 2, m]);
    worst = Math.max(worst, Math.abs(m));
  }
  return { pts, shift, worst };
}

export const page = {
  id: 'offset',
  title: 'Comparator offset',
  side() {
    return '';
  },
  main(store) {
    return `<section class="card wide"><header><h3>Try an offset</h3><span class="ctl"><label class="mini-l">comparator offset <input type="range" id="osV" min="0" max="30" step="0.1" value="${store.ui.osV ?? 1}"/> <output id="osVO"></output></label>
        <label class="mini-l">untrimmed offset, 1σ [mV] <input type="number" id="osRaw" min="1" max="30" step="0.5" value="${store.ui.osRaw || 8}" style="width:4.5em"/></label></span></header><div id="osRo"></div></section>
      <div class="grid2"><section class="card"><header><h3>The offset seen at each decision</h3></header><div class="cbody" id="osCurve"></div><p class="cap" id="osCurve-cap"></p></section>
      <section class="card"><header><h3>Error of each decision against what can be repaired</h3></header><div class="cbody" id="osTol"></div><p class="cap" id="osTol-cap"></p></section></div>
      <section class="card wide"><header><h3>What is left in the result, over the whole input range (shift removed)</h3></header><div class="cbody" id="osErr"></div><p class="cap" id="osErr-cap"></p></section>
      <section class="card wide"><header><h3>Feasibility: which offset calibration does this converter need?</h3></header><div class="cbody" id="osFeas"></div><p class="cap" id="osFeas-cap"></p></section>
      ${explain('Why the offset can still be handled', [
        'The comparator offset is a fixed voltage. The signal is a charge on a node that grows with every CDAC capacitor, so the same offset is worth more LSB at every decision. It rises quickly while the big capacitors join and hardly at the end.',
        'The last decisions therefore see almost the same offset. They agree with each other, and what they agree on is simply a shift of the whole result. A shift is harmless: it is a constant, and the IQ demodulator removes constants anyway.',
        'Measured against that shift, only the first decisions are wrong, because they saw a smaller offset. That is an early error like any other, and the redundancy of the first steps is large. As long as the error stays inside the tolerance, the later steps repair it and nothing is left but the shift.',
      ])}`;
  },
  mount(store) {
    const upd = () => page.update(store, store.ctx);
    document.getElementById('osV').oninput = (e) => {
      store.ui.osV = Number(e.target.value);
      upd();
    };
    document.getElementById('osRaw').onchange = (e) => {
      store.ui.osRaw = Math.min(30, Math.max(1, Number(e.target.value) || 8));
      upd();
    };
  },
  update(store, ctx) {
    const { P, d, dBin } = ctx;
    const vos = (store.ui.osV ?? 1) * 1e-3;
    const raw = (store.ui.osRaw || 8) * 1e-3;
    document.getElementById('osVO').textContent = eng(vos, 'V');
    const n = d.decisions;
    const last = d.cNode[n - 1];
    const perV = last / d.qLsb; // shift in LSB per volt
    const offs = d.cNode.map((c) => (vos * c) / d.qLsb);
    const errs = d.cNode.map((c) => (vos * (last - c)) / d.qLsb);
    const vmax = absorbedOffset(d);
    const a = rampError(d, P, vos);
    const b = rampError(dBin, P, vos);
    fill('osRo', readouts([
      ['Shift of the result', `${num(vos * perV, 1)} LSB`, `${num(perV * 1e-3, 2)} LSB per mV; ${num(((vos * perV) / d.codes) * 100, 1)} % of the range`],
      ['First decision is off by', `${num(errs[0], 2)} LSB`, `tolerance there: ${num(d.tol[0], 1)} LSB`, errs[0] > d.tol[0] + 0.5 ? 'bad' : 'ok'],
      ['Present weights: error left', `${num(a.worst, 2)} LSB`, 'worst, shift removed', a.worst > 0.75 ? 'bad' : 'ok'],
      ['Binary weights: error left', `${num(b.worst, 2)} LSB`, 'worst, shift removed', b.worst > 0.75 ? 'bad' : 'ok'],
      ['Redundancy repairs up to', eng(vmax, 'V'), 'offset, with the present weights'],
    ]));
    const idx = (arr) => arr.map((v, i) => [i + 1, v]);
    fill('osCurve', plot({ height: 260, x: { min: 1, max: n, label: 'decision' }, y: { min: 0, max: Math.max(1, offs[n - 1] * 1.15), label: 'offset [LSB]' },
      series: [{ points: idx(offs), color: COL.an, width: 2.4, label: 'offset at this decision' }], hlines: [{ y: offs[n - 1], color: COL.ok || COL.cal, dash: '6 3', label: 'the shift' }] }, widthOf('osCurve')),
      `Q os,i = V os · C node,i. The node grows from ${eng(d.cNode[0], 'F')} to ${eng(last, 'F')}, most of it in the first steps. From decision ${1 + errs.findIndex((e) => e < 0.25)} on, the decisions are within ¼ LSB of the final value: they agree.`);
    const ymax = Math.max(2, errs[0] * 1.3, 3);
    fill('osTol', plot({ height: 260, x: { min: 1, max: n, label: 'decision' }, y: { min: 0, max: ymax, label: 'LSB' },
      series: [{ points: idx(errs), color: COL.ref, width: 2.4, label: 'error against the shift' }, { points: idx(d.tol.slice(0, n).map((t, i) => (i === n - 1 ? 0 : Math.min(ymax, t + 0.5)))), color: COL.cal, width: 2, step: true, label: 'repairable (tolerance + ½), clipped' }, { points: idx(dBin.tol.slice(0, n).map(() => 0.5)), color: COL.muted, width: 1.2, dash: '4 3', label: 'binary: ½' }] }, widthOf('osTol')),
      `Error = V os · (C node,last − C node,i) / Q LSB. It is largest at the first decision, which is also where the tolerance is largest (${num(d.tol[0], 0)} LSB). Binary can repair only ½ LSB anywhere.`);
    const em = Math.max(1, a.worst, b.worst) * 1.15;
    fill('osErr', plot({ height: 250, x: { min: 0, max: d.codes, label: 'input [code]' }, y: { min: -em, max: em, label: 'error [LSB]' },
      series: [{ points: b.pts, color: COL.ref, width: 1.4, label: 'binary weights' }, { points: a.pts, color: COL.an, width: 1.8, label: 'present weights' }], bands: [{ y0: -0.5, y1: 0.5, color: 'color-mix(in srgb, var(--cal) 14%, transparent)' }] }, widthOf('osErr')),
      `Ramp with ideal capacitors and ${eng(vos, 'V')} offset; the mean shift (${num(a.shift, 1)} LSB) is taken out. Binary shows spikes of up to ${num(b.worst, 1)} LSB where the big steps change, at mid-scale and at the quarter points. With the present weights ${a.worst < 0.75 ? 'nothing but the quantisation is left' : `errors of ${num(a.worst, 1)} LSB remain: this offset is more than the redundancy repairs`}.`);
    // feasibility
    const raw3 = 3 * raw;
    const rangeLoss = (v) => ((v * perV) / d.codes) * 100;
    const target = Math.min(vmax / 2, (0.01 * d.codes) / perV); // half the repairable offset, and at most 1 % of the range
    const bitsTrim = Math.ceil(Math.log2((2 * raw3) / target));
    const tDec = (k) => ((1 / P.fs) * 0.78) / k;
    const row = (x, y, z) => `<tr><td>${x}</td><td>${y}</td><td>${z}</td></tr>`;
    fill('osFeas', `<div class="tablewrap"><table class="tbl"><thead><tr><th>Question</th><th>Numbers for this design</th><th>Conclusion</th></tr></thead><tbody>
      ${row('Can it run without any offset calibration?', `untrimmed 3σ = ${eng(raw3, 'V')}: shift ${num(raw3 * perV, 0)} LSB (${num(rangeLoss(raw3), 0)} % of the range); first decision off by ${num((raw3 * (last - d.cNode[0])) / d.qLsb, 0)} LSB against a tolerance of ${num(d.tol[0], 0)}`, raw3 > vmax || rangeLoss(raw3) > 3 ? '<b>No.</b> The offset must be trimmed, but only coarsely.' : 'Yes, the redundancy covers it.')}
      ${row('How well must it be trimmed?', `redundancy repairs up to ${eng(vmax, 'V')}; 1 % of the range is ${eng((0.01 * d.codes) / perV, 'V')}`, `to about ±${eng(target, 'V')}. Binary (Malki 2014) needs about 0.15 mV.`)}
      ${row('Chen 2018: background loop, one extra comparison per sample, charge pump on an auxiliary input pair', `time per comparison ${eng(tDec(n), 's')} without, ${eng(tDec(n + 1), 's')} with the extra one; Chen has 2.4 ns`, 'Works and tracks drift, but it costs one more comparison in a period that is already tight, and the auxiliary pair adds comparator noise.')}
      ${row('Alternative: trim once at start-up with a small DAC at the comparator (as Malki 2014: 5-bit capacitor bank)', `range ±${eng(raw3, 'V')}, step ${eng(target, 'V')}: ${bitsTrim} bits`, 'Enough for linearity. No extra comparison. Drift of a few mV afterwards is repaired by the redundancy.')}
      ${row('Digital only: subtract the shift after the converter', `shift ${num(perV * 1e-3, 1)} LSB per mV, a constant`, 'Removes the shift (the IQ demodulator does this anyway), but cannot give back the lost range or repair a first decision beyond its tolerance. Useful on top of a coarse trim, not instead of it.')}
    </tbody></table></div>`,
      `Study with the present weights; the untrimmed offset of ${eng(raw, 'V')} (1σ) is an assumption for a small dynamic comparator in 180 nm and is yours to replace. Time per comparison takes 78 % of the period for the comparisons (assumption, read off Chen Fig. 4). Not covered: offset that depends on the input common mode during the conversion (Chen, p. 3058, calls it negligible), and offset drift between measuring the weights and using them, which only moves the shift.`);
  },
};
