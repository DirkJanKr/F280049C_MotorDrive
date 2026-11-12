// CDAC step weights. Upper steps are capacitors of whole units, shrinking by the
// radix (2.00 = binary). Below one unit, steps are made by charge halving (multi-step LSB precharge, Craninckx 2007; Rabuske 2017 Fig. 3.10; used by Malki 2014 and Chen 2018):
// one unit capacitor shares its charge with an empty unit capacitor, again and again.

/**
 * Steps as [{units, kind}] with kind 'cap' (whole capacitor), 'half' (halving), 'rest'
 * (charge left on the halving capacitor) or 'small' (a physical capacitor smaller than one unit,
 * used when charge halving is off).
 */
export function buildSteps({ topUnits, radix, halvings, halvingOn = true }) {
  const caps = [Math.round(topUnits)];
  let u = caps[0];
  while (u > 1) {
    let next = Math.round(u / radix);
    if (next >= u) next = u - 1;
    if (next < 1) break;
    caps.push(next);
    u = next;
  }
  const steps = caps.map((units) => ({ units, kind: 'cap' }));
  for (let k = 1; k <= halvings; k++) steps.push({ units: 0.5 ** k, kind: halvingOn ? 'half' : 'small' });
  // With redundancy the charge left on the halving capacitor is used as one more step.
  if (radix < 2 && halvings > 0) steps.push({ units: 0.5 ** halvings, kind: halvingOn ? 'rest' : 'small' });
  return steps;
}

/** Physical unit capacitors: the whole-unit steps plus the halving chain (one source cap + one per halving). */
export function areaUnits(steps, halvings) {
  const caps = steps.filter((s) => s.kind === 'cap' || s.kind === 'small').reduce((a, s) => a + s.units, 0);
  const halves = steps.filter((s) => s.kind === 'half').length;
  return caps + (halves > 0 ? halves + 1 : 0);
}

/**
 * Tolerance of each decision, in LSB: t_i = (sum of later step weights) + w_last - w_i.
 * After the last step the residue must lie within +-w_last for the final decision to place it
 * within half of that; so the later steps can still bring back an error of t_i (standard result
 * for redundant search, for example Chang 2013, where w_last = 1 LSB). The final decision has tolerance 0.
 */
export function tolerances(weights) {
  const last = weights[weights.length - 1] ?? 1;
  const t = [];
  for (let i = 0; i < weights.length; i++) {
    let later = 0;
    for (let j = i + 1; j < weights.length; j++) later += weights[j];
    t.push(later + last - weights[i]);
  }
  t.push(0);
  return t;
}

/**
 * Range the steps reach from mid-scale: sum w + w_last (in LSB, each side). The input full
 * scale needs 2^(B-1). Anything above that is overrange, which redundancy brings by itself.
 */
export function coverage(weights, bits) {
  const sum = weights.reduce((a, w) => a + w, 0);
  const last = weights[weights.length - 1] ?? 1;
  const need = 2 ** (bits - 1) - last;
  return { sum, need, ok: sum >= need - 1e-9, reach: sum + last, overrange: (sum + last) / 2 ** (bits - 1) - 1 };
}
