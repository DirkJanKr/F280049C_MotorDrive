// CDAC steps from the weight designer: generated from a radix, or typed as a list.
// Steps below one unit capacitor are made by charge halving (Malki/Chen) or by
// physically smaller capacitors, so the two can be compared.

import { buildSteps } from '../zaan/model/steps.js';

export const PRESETS = {
  'radix 1.9, halving (29 Oct example)': { mode: 'generator', radix: 1.9, topUnits: 32, halvings: 3, halvingOn: 'charge halving' },
  'radix 1.9, small capacitors': { mode: 'generator', radix: 1.9, topUnits: 32, halvings: 3, halvingOn: 'small capacitors' },
  'binary, halving (review slide 16)': { mode: 'generator', radix: 2, topUnits: 32, halvings: 3, halvingOn: 'charge halving' },
  'radix 1.8, halving': { mode: 'generator', radix: 1.8, topUnits: 32, halvings: 3, halvingOn: 'charge halving' },
};

/** Parse "256, 136, 72 ..." (LSB) into steps. Returns { steps, error }. */
export function stepsFromList(text, lsbPerUnit, halvingOn) {
  const w = String(text || '')
    .split(/[\s,;]+/)
    .filter(Boolean)
    .map(Number);
  if (!w.length || w.some((x) => !(x > 0))) return { steps: null, error: 'Type positive weights in LSB, separated by commas.' };
  const steps = [];
  let k = 0;
  for (let i = 0; i < w.length; i++) {
    const units = w[i] / lsbPerUnit;
    if (units >= 1) {
      steps.push({ units, kind: Number.isInteger(units) ? 'cap' : 'small' });
      continue;
    }
    if (halvingOn !== 'charge halving') {
      steps.push({ units, kind: 'small' });
      continue;
    }
    const expect = 0.5 ** (k + 1);
    if (Math.abs(units - expect) < 1e-9) {
      steps.push({ units, kind: 'half' });
      k++;
    } else if (k > 0 && i === w.length - 1 && Math.abs(units - 0.5 ** k) < 1e-9) {
      steps.push({ units, kind: 'rest' });
    } else {
      return { steps: null, error: `With charge halving, steps below one unit must be ½, ¼, ⅛ … of a unit in order (here ${lsbPerUnit / 2}, ${lsbPerUnit / 4} … LSB), with one repeat of the last at the end. ${w[i]} LSB does not fit.` };
    }
  }
  return { steps, error: null };
}

export function stepsFor(P, ui) {
  if (ui.weightMode === 'custom') return stepsFromList(ui.customWeights, P.lsbPerUnit, P.halvingOn);
  return { steps: buildSteps({ topUnits: P.topUnits, radix: P.radix, halvings: P.halvings, halvingOn: P.halvingOn === 'charge halving' }), error: null };
}
