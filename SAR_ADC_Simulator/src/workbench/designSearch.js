// Design search: for every unit capacitor Cu and smallest step, build the weights
// from what each step needs, simulate a few chips, and score every combiner output
// width. Each point gives CM, area, decisions, ENOB from the charge budget, the
// tolerance check and the conversion time (with the illustrative timing values).

import { designCdac } from '../zaan/model/cdac.js';
import { drawChip, convert } from '../zaan/model/chargeSar.js';
import { conversionTimes } from '../zaan/model/timing.js';
import { createRng } from '../model/rng.js';
import { optimise } from './optimizer.js';
import { chargeBudget } from './budget.js';
import { residualParts } from './residual.js';

export const CU_GRID = [10, 15, 20, 25, 30, 35, 40, 45, 50, 60, 70, 85, 100, 120, 150];
export const SMALLEST = [1, 0.5];
// The digital side takes 10 bits, so the search does not offer more (decision of 11 Nov).
export const OUT_BITS = [10];

function timeOf(d, P, seed) {
  const rng = createRng(seed + 3);
  const chip = drawChip(d, P, rng);
  const traces = [];
  for (let k = 0; k < 150; k++) {
    const x = (d.codes / 2) * 0.95 * Math.sin((2 * Math.PI * 37 * k) / 150) + (rng.uniform() - 0.5);
    const r = convert(chip, d, x, { vos: P.vosCal, trace: true });
    traces.push(r.steps.slice(0, d.decisions).map((st) => st.v + P.vosCal));
  }
  return conversionTimes(P, d, traces);
}

/** One grid point: Cu (fF) and smallest step. Returns one row per output width. */
export function evaluatePoint(P0, cuF, smallest, { arrayGain = true, chips = 2, k = 3, margin = 0, noise = false } = {}) {
  const P = { ...P0, cu: cuF * 1e-15 };
  const sigmaU = P.aC / 100 / Math.sqrt(cuF);
  const r = optimise(P, P.memCells, { sigmaU, k, margin, noise, smallest, arrayGain });
  if (!r.steps) return OUT_BITS.map((ob) => ({ cu: cuF, smallest, outBits: ob, ok: false, error: r.error }));
  const d = designCdac(P, P.memCells, r.steps);
  const res = residualParts(d, P, { chips, seed: P.seed, outs: OUT_BITS });
  const t = timeOf(d, P, P.seed);
  const tolOk = r.need.every((x) => x.ok);
  return OUT_BITS.map((ob) => {
    const b = chargeBudget({ ...P, outBits: ob }, d, { arrayGain, res: res.byBits[ob] });
    const timeOk = t.median <= 1 / P.fs;
    return {
      cu: cuF, smallest, outBits: ob, weights: d.weights, stepW: d.stepW, decisions: d.decisions, units: d.units, cdac: d.cdac, cm: d.cm, area: ((d.memCaps * d.cm + d.cdac) * P.routing) / P.density,
      enob: b.enob, tolOk, tConv: t.median, late: t.late, timeOk, pdk: cuF >= 35, ok: tolOk && b.enob >= P.enobAim,
    };
  });
}

/** Run the whole grid, one point per tick so the page stays responsive. */
export function runSearch(P, opts, onProgress, onDone) {
  const points = [];
  for (const s of SMALLEST) for (const cu of CU_GRID) points.push([cu, s]);
  const rows = [];
  let i = 0;
  let stopped = false;
  const tick = () => {
    if (stopped) return;
    if (i >= points.length) {
      onDone(rows);
      return;
    }
    rows.push(...evaluatePoint(P, points[i][0], points[i][1], opts));
    i++;
    onProgress(i, points.length, rows);
    setTimeout(tick, 0);
  };
  setTimeout(tick, 0);
  return () => (stopped = true);
}

/** Best design per smallest step and output width: the smallest CM that passes (and fits in time if asked). */
export function bestOf(rows, { needTime = false, pdkOnly = true } = {}) {
  const out = [];
  for (const s of SMALLEST) {
    for (const ob of OUT_BITS) {
      const c = rows.filter((r) => r.smallest === s && r.outBits === ob && r.ok && (!needTime || r.timeOk) && (!pdkOnly || r.pdk)).sort((a, b) => a.cm - b.cm);
      out.push({ smallest: s, outBits: ob, best: c[0] || null });
    }
  }
  return out;
}
