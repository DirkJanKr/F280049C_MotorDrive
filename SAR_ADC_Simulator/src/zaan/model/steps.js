// CDAC step weights. Upper steps are capacitors of whole units, shrinking by the
// radix (2.00 = binary). Below one unit, steps are made by charge halving (Malki):
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
 * Tolerance of each decision, in LSB: t_i = (sum of later step weights) + 1 - w_i.
 * The final decision (no step after it) has tolerance 0.
 */
export function tolerances(weights) {
  const t = [];
  for (let i = 0; i < weights.length; i++) {
    let later = 0;
    for (let j = i + 1; j < weights.length; j++) later += weights[j];
    t.push(later + 1 - weights[i]);
  }
  t.push(0);
  return t;
}

/** The steps must be able to move the level over half the codes: sum w >= 2^(N-1) - 1. */
export function coverage(weights, bits) {
  const sum = weights.reduce((a, w) => a + w, 0);
  const need = 2 ** (bits - 1) - 1;
  return { sum, need, ok: sum >= need };
}
