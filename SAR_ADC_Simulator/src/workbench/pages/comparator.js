// Comparator page: the specification the system gives the comparator (Zaan MATLAB steps 3, 7a, 7f, 7h, 8),
// with fields for the Cadence results and a check for each. Nothing here is a comparator model:
// the numbers follow from the charge model, the weights and the noise budget.

import { card, fill, explain, readouts, eng, num, esc } from '../kit.js';
import { enobFromCharge } from '../budget.js';
import { K_B } from '../../zaan/model/noise.js';
import { mainCase } from './timing.js';

/** Largest offset left after calibration that every decision still absorbs (MATLAB step 7f): need incl. mismatch, settling and margin. */
export function offsetLimit(ctx) {
  const { d } = ctx;
  const last = d.cNode[d.decisions - 1];
  let v = Infinity;
  for (const r of ctx.tolNeed) {
    if (r.last || !(r.have > 0)) continue;
    const dc = last - d.cNode[r.i];
    if (dc > 1e-21) v = Math.min(v, ((r.have - r.mismatch - r.settling - r.margin) * d.qLsb) / dc);
  }
  return Math.max(0, v);
}

/** ENOB of the whole budget when the comparator noise is v [V rms] instead of the value set. */
export function enobAtNoise(ctx, v) {
  const { d, budget: b } = ctx;
  const comp = b.lines.find((l) => l.id === 'comp');
  const cEnd = d.cNode[d.decisions - 1];
  const rest = b.total ** 2 - comp.sigma ** 2;
  return enobFromCharge(d, Math.sqrt(Math.max(rest + (v * cEnd) ** 2, 1e-60))).enob;
}

// Energy estimate of a dynamic comparator for a noise target (two theses, eq. 3.5 of the StrongArm one, after Razavi):
// sigma^2 = 4 kT gamma / ((gm/ID) C PQ V th), so C PQ = 4 kT gamma / (sigma^2 (gm/ID) V th); E about 2 C PQ V DD^2.
const GAMMA = 1; // A
const VTH = 0.5; // V, A (generic 180 nm)
export function energyFor(P, v) {
  const c = (4 * K_B * P.temperature * GAMMA) / (v ** 2 * P.gmId * VTH);
  return { c, e: 2 * c * P.vdd ** 2 };
}

const row = (cells) => `<tr>${cells.map((x) => `<td>${x}</td>`).join('')}</tr>`;
const tbl = (head, rows) => `<div class="tablewrap"><table class="tbl"><thead><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
const state = (ok, unset) => (unset ? '<span class="dim">not measured yet</span>' : ok ? '<b class="ok">meets</b>' : '<b class="bad">does not meet</b>');

export const page = {
  id: 'comparator',
  title: 'Comparator',
  main() {
    return `<div id="cpRo"></div>
      ${card('cpSpec', 'Specification from the system, and the Cadence results', '', 'wide')}
      ${card('cpNoise', 'Comparator noise against ENOB and energy', '', 'wide')}
      ${explain('How to read this page', [
        'The comparator only has to decide the sign of a small charge. How small, how noisy, how offset and how fast it may be all follow from the rest of the converter. This page collects those limits in one place, from the same model every other page uses.',
        '<b>Smallest input</b>: one LSB of charge spread over the node. The node grows with every connected step, so the last decision sees the smallest voltage (Charge balance page). <b>Noise</b>: only the noise at the last decisions reaches the output; earlier noisy decisions are repaired by redundancy (MATLAB step 7h). <b>Offset</b>: only the part that changes during the conversion uses tolerance (step 7f). <b>Kickback</b>: charge pushed back onto the node is a fixed error of that decision; it must fit inside the decision margin.',
        'Enter the Cadence results in the side panel under Comparator. A field that is empty stays "not measured yet"; it is never filled with a guess.',
        'The energy column uses σ² = 4 kT γ / ((gm/ID) C PQ V th) for the input pair (γ = 1 and V th = 0.5 V are assumptions, generic 180 nm), E ≈ 2 C PQ V DD² per comparison. It shows the trend only: halving the noise costs four times the capacitance and energy.',
      ])}`;
  },
  update(store, ctx) {
    const { P, d, budget: b } = ctx;
    const cFirst = d.cNode[0];
    const cEnd = d.cNode[d.decisions - 1];
    const vLsbEnd = d.qLsb / cEnd;
    const vLsbFirst = d.qLsb / cFirst;
    const comp = b.lines.find((l) => l.id === 'comp');
    const vAllowed = comp.maxAlone / cEnd;
    const vosMax = offsetLimit(ctx);
    const kickMax = (P.decMargin || 0) * d.qLsb;
    const k = mainCase(ctx);
    const per = k.perCycle;
    const compTime = P.tComp != null ? P.tComp + (P.tLogic || 0) : null;
    fill('cpRo', readouts([
      ['Smallest input, last decision', eng(vLsbEnd, 'V'), `1 LSB = ${num(d.qLsb * 1e15, 3)} fC on ${eng(cEnd, 'F')}; first decision ${eng(vLsbFirst, 'V')}`],
      ['Noise allowed', vAllowed > 0 ? eng(vAllowed, 'V') + ' rms' : 'aim out of reach', vAllowed > 0 ? `for ENOB ${num(P.enobAim, 1)} with every other line as it is; set: ${eng(P.compNoise, 'V')}` : `ceiling ${num(enobAtNoise(ctx, 0), 2)} bit without comparator noise, below the aim ${num(P.enobAim, 1)}; the table below shows the trade`, vAllowed > 0 ? '' : 'warn'],
      ['Offset after calibration, at most', eng(vosMax, 'V'), `every decision with tolerance still absorbs it (MATLAB 7f); set: ${eng(P.vosCal, 'V')}`, P.vosCal <= vosMax ? '' : 'bad'],
      ['Time per decision for comparator and logic', eng(per, 's'), `${k.cycles} cycles in one period, Timing page`],
    ]));
    const rows = [
      row(['Input noise', vAllowed > 0 ? eng(vAllowed, 'V') + ' rms at most (ENOB aim)' : `the aim of ${num(P.enobAim, 1)} bit is out of reach even without comparator noise (ceiling ${num(enobAtNoise(ctx, 0), 2)} bit); choose from the table below`, P.compNoise != null ? eng(P.compNoise, 'V') + ' rms (value set)' : '', state(P.compNoise <= vAllowed, P.compNoise == null), 'steps 7h, 8; Noise budget']),
      row(['Delay at 1 LSB input, plus logic', `${eng(per, 's')} per decision`, compTime != null ? `${eng(P.tComp, 's')} + ${eng(P.tLogic || 0, 's')} logic` : '', state(compTime != null && compTime <= per, compTime == null), 'Timing page']),
      row(['Regeneration time constant τ reg', 'sets how fast small inputs resolve', P.tauReg != null ? eng(P.tauReg, 's') : '', P.tauReg != null ? `${eng(P.tauReg * Math.log(vLsbEnd / Math.max(P.compNoise / 10, 1e-9)), 's')} extra for a hard decision (input σ / 10)` : '<span class="dim">not measured yet</span>', 'delay against ln(input)']),
      row(['Offset left after calibration', `${eng(vosMax, 'V')} at most`, eng(P.vosCal, 'V'), state(P.vosCal <= vosMax, false), 'step 7f; Offset page']),
      row(['Offset calibration range', `≥ 3σ of the raw offset = ${eng(3 * P.vos, 'V')}`, P.calRange != null ? eng(P.calRange, 'V') : '', state(P.calRange != null && P.calRange >= 3 * P.vos, P.calRange == null), 'Chen 2018 background loop (decided 23 Nov)']),
      row(['Kickback charge onto a node', `${num(kickMax * 1e15, 3)} fC at most (decision margin ${num(P.decMargin || 0, 2)} LSB)`, P.kick != null ? `${num(P.kick * 1e15, 3)} fC` : '', state(P.kick != null && P.kick <= kickMax, P.kick == null), 'step 7b margin']),
      row(['Input common mode', 'set by the memory cells and the summing node', P.vinCm != null ? eng(P.vinCm, 'V') : '', P.vinCm != null ? 'check the comparator works there' : '<span class="dim">not known yet</span>', 'step 7g (V CM is A)']),
    ];
    fill('cpSpec', tbl(['', 'What the system needs', 'Cadence result', 'Check', 'From'], rows), `Smallest input ${eng(vLsbEnd, 'V')}: Q LSB / C node at the last decision. Kickback limit: the decision margin of the weight design times Q LSB. Fill in the results under Comparator in the side panel.`);
    const vs = [0, 25e-6, 45e-6, 70e-6, 100e-6, 150e-6, 200e-6];
    const nRows = vs.map((v) => {
      const en = enobAtNoise(ctx, v);
      const E = v > 0 ? energyFor(P, v) : null;
      const pw = E ? E.e * (d.decisions + 1) * P.fs : null;
      return row([v ? `${num(v * 1e6, 0)} µV` : '0 (ceiling)', `${num(en, 2)} bit`, E ? `${num(E.c * 1e15, 0)} fF` : '', E ? `${num(E.e * 1e12, 2)} pJ` : '', pw ? eng(pw, 'W') : '']);
    });
    fill('cpNoise', tbl(['Comparator noise', 'ENOB of the budget', 'C PQ for that noise', 'Energy per comparison', `Power, ${d.decisions + 1} comparisons at ${eng(P.fs, 'Hz')}`], nRows), `ENOB: the noise budget with only the comparator line changed. The ceiling (0 µV) is set by quantisation, rounding and the other lines. Energy and power use gm/ID = ${num(P.gmId, 1)} 1/V (side panel), γ = 1, V th = 0.5 V (A); ${d.decisions + 1} comparisons include Chen's extra offset comparison.`);
  },
};
