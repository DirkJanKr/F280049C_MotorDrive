// What is left after calibration, split into its parts by simulation (no comparator noise,
// offset after trimming included), averaged in power over a few chips:
//   sar    the levels the SAR can make are spaced by its smallest step and are not exactly
//          uniform; with perfect weights and no rounding this is the error left
//   round  rounding the combined value to the output bits, on top of that
//   lut    the weights in the LUT are not exact (calibration method), on top of that
// All in input LSB rms. A constant offset is DC and not part of any of them.

import { drawChip, convert, combine } from '../zaan/model/chargeSar.js';
import { leastSquaresWeights } from '../zaan/model/calibrate.js';
import { sineMetrics, coherentCycles } from '../zaan/model/analysis.js';
import { createRng } from '../model/rng.js';

const M = 2048;

/** Error rms in LSB of a sine at -0.5 dBFS, from its SNDR. */
function errLsb(sndr, codes) {
  const aRms = ((codes / 2) * 10 ** (-0.5 / 20)) / Math.SQRT2;
  return aRms / 10 ** (sndr / 20);
}

function ramp(chip, d, P, s, opt) {
  const xs = [];
  for (let j = 0; j < d.codes * s; j++) xs.push((j + 0.5) / s);
  return { xs, dec: xs.map((x) => convert(chip, d, x - d.codes / 2, opt)) };
}

/** On-chip LMS with comparator noise; random known inputs. */
function lms(chip, d, P, rng, muExp, n = 4000) {
  const mu = 2 ** -muExp;
  let c = d.codes / 2 - 0.5;
  const w = [...d.weights, 0.5];
  for (let k = 0; k < n; k++) {
    const x = (rng.uniform() - 0.5) * d.codes * 0.98;
    const dec = convert(chip, d, x, { vos: P.vosCal, noise: P.compNoise, rng });
    let y = c;
    for (let i = 0; i < dec.length; i++) y += (dec[i] ? 1 : -1) * w[i];
    const e = x + d.codes / 2 - 0.5 - y;
    c += mu * e;
    for (let i = 0; i < dec.length; i++) w[i] += mu * e * (dec[i] ? 1 : -1);
  }
  return { c, w };
}

export function methodOf(P) {
  const m = String(P.calMethod || '');
  return m.startsWith('on-chip least') ? 'ls' : m.startsWith('on-chip LMS') ? 'lms' : 'ideal';
}

/** The LUT weights of one chip for the chosen method. */
export function lutWeights(chip, d, P, rng, method, muExp = 7) {
  if (method === 'ls') {
    const r = ramp(chip, d, P, 2, { vos: P.vosCal, noise: P.compNoise, rng });
    return leastSquaresWeights(r.dec, r.xs);
  }
  if (method === 'lms') return lms(chip, d, P, rng, muExp);
  const r = ramp(chip, d, P, 16, { vos: P.vosCal });
  return leastSquaresWeights(r.dec, r.xs);
}

/**
 * Residual parts for chips seed, seed+1, ... for the output bits in `outs` (default: P.outBits).
 * Returns the parts for P.outBits at the top level and per output bits in byBits.
 */
export function residualParts(d, P, { chips = 4, seed = 1, muExp = 7, outs = null } = {}) {
  const method = methodOf(P);
  const list = outs || [P.outBits];
  const J = coherentCycles(M, 0.1);
  const A = (d.codes / 2) * 10 ** (-0.5 / 20);
  const acc = list.map(() => ({ sar: 0, round: 0, lut: 0, enob: [] }));
  for (let k = 0; k < chips; k++) {
    const rng = createRng(seed + 101 * (k + 1));
    const chip = drawChip(d, P, rng);
    const ideal = lutWeights(chip, d, P, rng, 'ideal');
    const used = method === 'ideal' ? ideal : lutWeights(chip, d, P, rng, method, muExp);
    const dec = [];
    for (let i = 0; i < M; i++) dec.push(convert(chip, d, A * Math.sin((2 * Math.PI * J * i) / M), { vos: P.vosCal }));
    const m = (cw, f) => sineMetrics(dec.map((q) => combine(q, cw, d.codes, f)), J, P.bits);
    const eRaw = errLsb(m(ideal, 8).sndr, d.codes);
    list.forEach((ob, j) => {
      const fb = Math.max(0, Math.round(ob - P.bits));
      const eRound = errLsb(m(ideal, fb).sndr, d.codes);
      const mu = method === 'ideal' ? null : m(used, fb);
      const eLut = mu ? errLsb(mu.sndr, d.codes) : eRound;
      acc[j].sar += eRaw ** 2;
      acc[j].round += Math.max(eRound ** 2 - eRaw ** 2, 0);
      acc[j].lut += Math.max(eLut ** 2 - eRound ** 2, 0);
      acc[j].enob.push(mu ? mu.enob : m(ideal, fb).enob);
    });
  }
  const byBits = {};
  list.forEach((ob, j) => {
    byBits[ob] = { sar: Math.sqrt(acc[j].sar / chips), round: Math.sqrt(acc[j].round / chips), lut: Math.sqrt(acc[j].lut / chips), enob: acc[j].enob };
  });
  const top = byBits[list[0]];
  return { ...top, byBits, method, fb: Math.max(0, Math.round(list[0] - P.bits)) };
}

/** Estimates without simulation, for sweeps: levels spaced by the smallest step, rounding to the output LSB. */
export function residualEstimate(d, P, lutLsb = 0) {
  const wMin = Math.min(...d.weights);
  const lsbOut = 2 ** -Math.max(0, Math.round(P.outBits - P.bits));
  return { sar: wMin / Math.sqrt(12), round: lsbOut / Math.sqrt(12), lut: lutLsb };
}
