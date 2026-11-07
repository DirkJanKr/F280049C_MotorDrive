/**
 * Static linearity by the linear-ramp histogram method (IEEE Std 1241).
 *
 * A ramp with M samples per LSB is applied (extending past both ends of the
 * range); code transition levels are recovered from the cumulative histogram:
 *     T_k = x_start + dx * sum_{j<k} h_j
 * DNL and INL use the endpoint definition (line through T_1 and T_{2^N-1}).
 * Resolution of the estimate is 1/M LSB.
 */
import { convertCode } from '../model/sar.js';
import { createRng } from '../model/rng.js';

export function defaultSamplesPerCode(bits) {
  return Math.max(4, Math.min(64, Math.floor(2 ** 20 / 2 ** bits)));
}

export function staticLinearity(adc, { samplesPerCode, seed = 11 } = {}) {
  const { range } = adc;
  const codes = range.codes;
  const M = samplesPerCode ?? defaultSamplesPerCode(adc.config.bits);
  const marginCodes = Math.max(2, Math.ceil((0.02 * range.fullScale) / range.lsb));
  const dx = range.lsb / M;
  const xEdge = range.low - marginCodes * range.lsb;
  const total = (codes + 2 * marginCodes) * M;
  const hist = new Float64Array(codes);
  const rng = createRng(seed);
  for (let j = 0; j < total; j++) {
    const x = xEdge + (j + 0.5) * dx;
    hist[convertCode(adc, x, rng)]++;
  }
  // transition levels T[k], k = 1..codes-1 (T[0] unused)
  const T = new Float64Array(codes);
  let cum = 0;
  for (let k = 1; k < codes; k++) {
    cum += hist[k - 1];
    T[k] = xEdge + cum * dx;
  }
  const lsbAvg = (T[codes - 1] - T[1]) / (codes - 2);
  const dnl = new Float64Array(codes); // defined for k = 1..codes-2
  const inl = new Float64Array(codes); // defined for k = 1..codes-1
  let maxDnl = 0;
  let minDnl = 0;
  let maxInl = 0;
  let minInl = 0;
  let missing = 0;
  for (let k = 1; k < codes; k++) {
    inl[k] = (T[k] - T[1]) / lsbAvg - (k - 1);
    maxInl = Math.max(maxInl, inl[k]);
    minInl = Math.min(minInl, inl[k]);
    if (k < codes - 1) {
      dnl[k] = (T[k + 1] - T[k]) / lsbAvg - 1;
      maxDnl = Math.max(maxDnl, dnl[k]);
      minDnl = Math.min(minDnl, dnl[k]);
      if (hist[k] === 0) missing++;
    }
  }
  return {
    samplesPerCode: M,
    conversions: total,
    hist,
    transitions: T,
    dnl,
    inl,
    maxDnl,
    minDnl,
    maxInl,
    minInl,
    peakDnl: Math.max(maxDnl, -minDnl),
    peakInl: Math.max(maxInl, -minInl),
    missingCodes: missing,
    offsetErrorLsb: (T[1] - (range.low + range.lsb)) / range.lsb,
    gainErrorPct: (lsbAvg / range.lsb - 1) * 100,
    resolutionLsb: 1 / M,
  };
}
