// Weight optimizer driven by the redundancy each step needs.
// The weights are built from the smallest step upward. For every new step the
// largest whole number of unit capacitors is taken whose tolerance still covers
// what that decision needs:
//   t i = (sum of the steps below) + w last − w i
//   need i = k σ · sqrt(σ w,i² + sum below σ w,j²)            DAC mismatch
//          + |v os| · (C node,last − C node,i) / Q LSB          offset after calibration
//          (+ k σ · C node,i · v n / Q LSB                     comparator noise, if chosen)
//          + margin
//   check: need i ≤ t i + ½ LSB
// The largest step that passes gives the fewest decisions for these errors: more
// redundancy than needed only costs decisions and capacitance. Building stops as soon
// as the steps reach both ends of the range; the range left over is then spread as
// extra margin over all steps, so no step is left with just enough.

import { designCdac } from '../zaan/model/cdac.js';
import { chargeBudget, toleranceNeeds } from './budget.js';
import { residualEstimate } from './residual.js';

/** σ of a step weight in LSB: w σu / √units for whole capacitors, about w σu / √2 for a halving step. */
function sigmaW(w, units, kind, sigmaU) {
  return kind === 'cap' ? (w * sigmaU) / Math.sqrt(units) : (w * sigmaU) / Math.SQRT2;
}

/** Steps below one unit: charge halving down to the chosen smallest step, plus the charge left as one more step. */
function bottomSteps(P, smallest) {
  const h = Math.max(0, Math.round(Math.log2(P.lsbPerUnit / smallest)));
  const out = [];
  for (let k = 1; k <= h; k++) out.push({ units: 0.5 ** k, kind: 'half' });
  if (h > 0) out.push({ units: 0.5 ** h, kind: 'rest' });
  return out;
}

/**
 * Build weights from the needs. opts: sigmaU, k (σ multiple), margin [LSB], noise (bool),
 * smallest [LSB], cNodeLast (estimate for the noise term). Returns steps (largest first) and a log per step.
 */
export function buildFromNeeds(P, cells, opts) {
  const { sigmaU, k = 3, margin = 0, noise = false, smallest = 1 } = opts;
  const lsbU = P.lsbPerUnit;
  const cover = 2 ** (P.bits - 1) - smallest;
  const cm = (2 ** P.bits * (2 * P.vref * P.cu) / lsbU) / (P.channels * P.fullScale);
  const qLsb = (2 * P.vref * P.cu) / lsbU;
  const below = bottomSteps(P, smallest).reverse(); // smallest first
  let sum = below.reduce((a, s) => a + s.units * lsbU, 0);
  let var2 = below.reduce((a, s) => a + sigmaW(s.units * lsbU, s.units, s.kind, sigmaU) ** 2, 0);
  let capBelow = below.reduce((a, s) => a + 2 * (s.kind === 'half' || s.kind === 'rest' ? 1 : s.units) * P.cu, 0);
  const caps = [];
  const log = [];
  for (let guard = 0; guard < 40 && sum < cover; guard++) {
    let best = 0;
    let bestNeed = null;
    for (let u = 1; u <= 4096; u++) {
      const w = u * lsbU;
      const sw = sigmaW(w, u, 'cap', sigmaU);
      const mis = k * Math.sqrt(sw ** 2 + var2);
      const off = (Math.abs(P.vosCal) * (capBelow + 2 * u * P.cu)) / qLsb;
      const cNode = opts.cNodeLast ? opts.cNodeLast - capBelow - 2 * u * P.cu : P.channels * cm;
      const nz = noise ? (k * Math.max(cNode, P.channels * cm) * P.compNoise) / qLsb : 0;
      const need = mis + off + nz + margin;
      const tol = sum + smallest - w;
      if (need > tol + 0.5) break;
      best = u;
      bestNeed = { need, tol, mis, off, nz };
    }
    if (best === 0) return { steps: null, log, error: 'Even a single unit capacitor needs more tolerance than the steps below give. Lower the margin or the offset, or use a smaller smallest step.' };
    // the top step is not trimmed: what the list reaches beyond the range is overrange (Item 4)
    caps.push(best);
    log.push({ units: best, weight: best * lsbU, ...bestNeed });
    sum += best * lsbU;
    var2 += sigmaW(best * lsbU, best, 'cap', sigmaU) ** 2;
    capBelow += 2 * best * P.cu;
  }
  const steps = caps.reverse().map((u) => ({ units: u, kind: 'cap' })).concat(bottomSteps(P, smallest));
  return { steps, log: log.reverse(), error: null };
}

/** Build once, then spread the range left over as extra margin on every step, keeping the number of steps. */
function buildSpread(P, cells, opts) {
  const base = buildFromNeeds(P, cells, opts);
  if (!base.steps) return { ...base, extra: 0 };
  const n = base.steps.length;
  let lo = 0;
  let hi = 20;
  let best = base;
  for (let it = 0; it < 30; it++) {
    const mid = (lo + hi) / 2;
    const r = buildFromNeeds(P, cells, { ...opts, margin: (opts.margin || 0) + mid });
    if (r.steps && r.steps.length === n) {
      lo = mid;
      best = r;
    } else hi = mid;
  }
  return { ...best, extra: lo };
}

/** Run the builder (twice when noise is included, to estimate the final node) and score the result. */
export function optimise(P, cells, opts) {
  let r = buildSpread(P, cells, opts);
  if (opts.noise && r.steps) {
    const d0 = designCdac(P, cells, r.steps);
    r = buildSpread(P, cells, { ...opts, cNodeLast: d0.cNode[d0.decisions - 1] });
  }
  if (!r.steps) return r;
  const d = designCdac(P, cells, r.steps);
  const need = toleranceNeeds(P, d, opts.sigmaU);
  const b = chargeBudget(P, d, { arrayGain: opts.arrayGain, res: residualEstimate(d, P, opts.lutLsb || 0) });
  return { ...r, d, need, enob: b.enob, budget: b };
}
