// Weight optimizer: search radix, first step and the steps below one unit, and
// score every candidate on the same checks as the design itself: coverage,
// tolerance against mismatch and offset, and the charge noise budget.

import { buildSteps } from '../zaan/model/steps.js';
import { designCdac } from '../zaan/model/cdac.js';
import { chargeBudget, toleranceNeeds } from './budget.js';

export const GOALS = {
  enob: 'highest ENOB',
  decisions: 'fewest decisions',
  area: 'smallest CDAC',
};

/** Evaluate one candidate. residualLsb: calibration residual carried over from the simulated chip. */
export function evaluate(P, cells, steps, { sigmaU, arrayGain, residualLsb }) {
  const d = designCdac(P, cells, steps);
  const minW = Math.min(...d.weights);
  const need = toleranceNeeds(P, d, sigmaU);
  const margin = Math.min(...need.filter((r) => !r.last).map((r) => r.have + 0.5 - r.need));
  const b = chargeBudget(P, d, { arrayGain, residualQ: residualLsb * d.qLsb });
  return {
    weights: d.weights, decisions: d.decisions, units: d.units, cdac: d.cdac, cover: d.cover.ok, resolves: minW <= 1 + 1e-9,
    margin, tolOk: margin >= -1e-9, enob: b.enob, enobOk: b.enob >= P.enobAim,
  };
}

/** All candidates over the search grid. halvingOn as in the current design. */
export function search(P, cells, opts) {
  const out = [];
  for (let r = 160; r <= 200; r += 2) {
    for (let top = 16; top <= 48; top++) {
      for (let h = 0; h <= 4; h++) {
        const radix = r / 100;
        const steps = buildSteps({ topUnits: top, radix, halvings: h, halvingOn: P.halvingOn === 'charge halving' });
        const e = evaluate(P, cells, steps, opts);
        if (!e.cover || !e.resolves) continue;
        out.push({ radix, topUnits: top, halvings: h, ...e });
      }
    }
  }
  return out;
}

/** Best candidate for a goal; tolerance must pass, and for the size goals the ENOB too. */
export function best(cands, goal, aim) {
  const ok = cands.filter((c) => c.tolOk && (goal === 'enob' || c.enob >= aim));
  const key = {
    enob: (a, b) => b.enob - a.enob || a.units - b.units,
    decisions: (a, b) => a.decisions - b.decisions || a.units - b.units || b.enob - a.enob,
    area: (a, b) => a.units - b.units || a.decisions - b.decisions || b.enob - a.enob,
  }[goal];
  const seen = new Set();
  return ok.sort(key).filter((c) => {
    const k = c.weights.join(',');
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
