// Testbenches on one chip: a sine for SNDR, a ramp for DNL and calibration.
// Every random number comes from the seeded generator passed in.

import { convert, combine, designWeights } from './chargeSar.js';
import { leastSquaresWeights } from './calibrate.js';
import { sineMetrics, rampLinearity, coherentCycles } from './analysis.js';

export const SINE_POINTS = 2048;

/** Ramp: s samples per code over the full range, input in codes and in LSB from mid-scale. */
function rampInputs(codes, s) {
  const xs = [];
  for (let j = 0; j < codes * s; j++) xs.push((j + 0.5) / s);
  return xs;
}

/** Run sine and ramp on one chip, before and after calibration. */
export function testChip(chip, d, P, rng, { samplesPerCode = 4, amplitudeDbfs = -0.5 } = {}) {
  const opt = { vos: P.vosCal, noise: P.compNoise, rng };
  const codes = d.codes;
  // ramp: raw decisions with known input -> calibration and DNL
  const xr = rampInputs(codes, samplesPerCode);
  const decR = xr.map((x) => convert(chip, d, x - codes / 2, opt));
  const cal = leastSquaresWeights(decR, xr);
  const des = designWeights(d);
  const linRaw = rampLinearity(decR.map((q) => combine(q, des, codes)), codes);
  const linCal = rampLinearity(decR.map((q) => combine(q, cal, codes)), codes);
  // sine: SNDR
  const M = SINE_POINTS;
  const J = coherentCycles(M, 0.1);
  const amp = (codes / 2) * 10 ** (amplitudeDbfs / 20);
  const decS = [];
  for (let k = 0; k < M; k++) decS.push(convert(chip, d, amp * Math.sin((2 * Math.PI * J * k) / M), opt));
  const fb = Math.max(0, Math.round(P.outBits - P.bits));
  const sRaw = sineMetrics(decS.map((q) => combine(q, des, codes, fb)), J, P.bits);
  const sCal = sineMetrics(decS.map((q) => combine(q, cal, codes, fb)), J, P.bits);
  return { linRaw, linCal, sRaw, sCal, cal, J, decS, amp };
}
