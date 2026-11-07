/**
 * Physical capacitive-DAC model (charge domain).
 *
 * One "array" is a set of capacitors whose top plates share a single node X
 * (the comparator input) and whose bottom plates are each driven by an ideal
 * voltage source selected by a switch (a "terminal"). A parasitic capacitor
 * Cp connects X to ground, and an optional bottom-plate parasitic (alpha*Ci)
 * connects every bottom plate to ground.
 *
 * Everything here follows from one law: while the top-plate switch is open,
 * node X is floating and its total charge is conserved:
 *
 *     Q_X = sum_i Ci (Vx - Vb_i) + Cp (Vx - 0)          (constant)
 *
 * so  Vx = (Q_X + sum_i Ci Vb_i) / (sum_i Ci + Cp).
 *
 * This module knows nothing about SAR algorithms or comparators.
 */

/** Numeric terminal ids (bottom-plate / top-plate connection targets). */
export const TERMINAL = Object.freeze({ VINP: 0, VINN: 1, VREF: 2, GND: 3, VCM: 4 });
export const TERMINAL_NAMES = Object.freeze(['VINP', 'VINN', 'VREF', 'GND', 'VCM']);

export function terminalId(name) {
  const id = TERMINAL[name];
  if (id === undefined) throw new Error(`Unknown terminal "${name}"`);
  return id;
}

/**
 * Build a capacitor array.
 * @param {object} spec
 * @param {string} spec.name          'P' or 'N'
 * @param {number[]} spec.weights     binary weights in unit capacitors, MSB first
 * @param {number} [spec.dummyUnits]  size of the termination (dummy) capacitor in units, 0 = none
 * @param {number} spec.unitCap       unit capacitance [F]
 * @param {number[]} [spec.relErrors] relative error of each capacitor (incl. dummy), (C-Cnom)/Cnom
 * @param {number} [spec.topParasitic]        top-plate parasitic to ground [F]
 * @param {number} [spec.bottomParasiticRatio] bottom-plate parasitic as fraction of Ci
 */
export function buildCapacitorArray(spec) {
  const {
    name,
    weights,
    dummyUnits = 0,
    unitCap,
    relErrors = null,
    topParasitic = 0,
    bottomParasiticRatio = 0,
    inputTerminal = 'VINP',
    rails = [],
  } = spec;
  if (!(unitCap > 0)) throw new Error('Unit capacitance must be > 0');
  if (topParasitic < 0) throw new Error('Top-plate parasitic must be >= 0');
  const units = dummyUnits > 0 ? [...weights, dummyUnits] : [...weights];
  const n = units.length;
  const nominal = new Float64Array(n);
  const actual = new Float64Array(n);
  const errors = new Float64Array(n);
  const labels = [];
  const isDummy = [];
  for (let i = 0; i < n; i++) {
    const dummy = i >= weights.length;
    const e = relErrors ? relErrors[i] ?? 0 : 0;
    nominal[i] = units[i] * unitCap;
    actual[i] = nominal[i] * (1 + e);
    errors[i] = e;
    if (!(actual[i] > 0)) throw new Error(`Capacitor ${i} of array ${name} is non-positive`);
    labels.push(dummy ? 'Cd' : `C${weights.length - 1 - i}`);
    isDummy.push(dummy);
  }
  let totalCap = 0;
  let nominalTotal = 0;
  for (let i = 0; i < n; i++) {
    totalCap += actual[i];
    nominalTotal += nominal[i];
  }
  return Object.freeze({
    name,
    n,
    units,
    nominal,
    actual,
    errors,
    labels,
    isDummy,
    unitCap,
    totalCap,
    nominalTotal,
    topParasitic,
    nodeCap: totalCap + topParasitic,
    bottomParasiticRatio,
    inputTerminal,
    rails,
  });
}

/** Charge on node X when the top plate is forced to vTop (switch closed). */
export function forcedTopCharge(arr, vTop, vBottom) {
  let q = arr.topParasitic * vTop;
  for (let i = 0; i < arr.n; i++) q += arr.actual[i] * (vTop - vBottom[i]);
  return q;
}

/** sum_i Ci * Vb_i */
export function weightedBottomSum(arr, vBottom) {
  let s = 0;
  for (let i = 0; i < arr.n; i++) s += arr.actual[i] * vBottom[i];
  return s;
}

/** Top-plate voltage of a floating node holding charge qTop (charge conservation). */
export function floatingTopVoltage(arr, qTop, vBottom) {
  return (qTop + weightedBottomSum(arr, vBottom)) / arr.nodeCap;
}

/**
 * Charge bookkeeping for a given node state.
 * top[i]    : charge on the top plate of Ci        = Ci (Vx - Vb_i)
 * bottom[i] : charge supplied through the bottom-plate switch = Ci (Vb_i - Vx) + alpha Ci Vb_i
 * parasitic : charge on the top-plate parasitic    = Cp Vx
 * totalTop  : total charge on node X               = sum top + parasitic
 */
export function plateCharges(arr, vTop, vBottom) {
  const top = new Float64Array(arr.n);
  const bottom = new Float64Array(arr.n);
  let totalTop = 0;
  for (let i = 0; i < arr.n; i++) {
    const c = arr.actual[i];
    top[i] = c * (vTop - vBottom[i]);
    bottom[i] = -top[i] + arr.bottomParasiticRatio * c * vBottom[i];
    totalTop += top[i];
  }
  const parasitic = arr.topParasitic * vTop;
  totalTop += parasitic;
  return { top, bottom, parasitic, totalTop };
}

/** Hand formula for the top-plate step caused by bottom-plate switching: dVx = sum Ci dVb_i / (Ct + Cp). */
export function predictedTopStep(arr, vBottomBefore, vBottomAfter) {
  let s = 0;
  for (let i = 0; i < arr.n; i++) s += arr.actual[i] * (vBottomAfter[i] - vBottomBefore[i]);
  return s / arr.nodeCap;
}

/**
 * Charge delivered by each source during a transition of a floating array.
 * The charge change of every bottom plate is supplied by the source it is
 * connected to *after* the transition.
 * @param {Float64Array} out accumulator indexed by terminal id (length 5)
 */
export function accumulateSourceCharge(arr, vxBefore, vbBefore, vxAfter, vbAfter, termsAfter, out) {
  const alpha = arr.bottomParasiticRatio;
  for (let i = 0; i < arr.n; i++) {
    const c = arr.actual[i];
    const qb0 = c * (vbBefore[i] - vxBefore) + alpha * c * vbBefore[i];
    const qb1 = c * (vbAfter[i] - vxAfter) + alpha * c * vbAfter[i];
    out[termsAfter[i]] += qb1 - qb0;
  }
  return out;
}
