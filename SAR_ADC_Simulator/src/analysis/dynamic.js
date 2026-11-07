/**
 * Dynamic performance from a coherently sampled sine wave (rectangular
 * window, odd number of cycles J in M points, so every sample hits a
 * distinct phase). Metrics follow IEEE Std 1241 definitions:
 *   SNR  = Ps / (P_total - P_dc - Ps - P_harm)
 *   SNDR = Ps / (P_total - P_dc - Ps)
 *   THD  = P_harm / Ps   (harmonics 2..7, aliased)
 *   SFDR = Ps / max spur
 *   ENOB = (SNDR - 1.76 dB) / 6.02 dB
 */
import { convertCode } from '../model/sar.js';
import { createRng } from '../model/rng.js';
import { fft } from './fft.js';

function chooseCycles(points, ratio) {
  let J = Math.max(1, Math.round(points * ratio));
  if (J % 2 === 0) J += 1;
  return Math.min(J, points / 2 - 1);
}

function alias(bin, points) {
  let b = bin % points;
  if (b > points / 2) b = points - b;
  return b;
}

export function dynamicPerformance(adc, { points = 4096, amplitudeDbfs = -0.5, finRatio = 0.0977, seed = 23, harmonics = 7 } = {}) {
  const { range, timing, noise } = adc;
  const N = adc.config.bits;
  const J = chooseCycles(points, finRatio);
  const fs = timing.fs;
  const fin = (J * fs) / points;
  const amp = (range.fullScale / 2) * 10 ** (amplitudeDbfs / 20);
  const mid = 0.5 * (range.low + range.high);
  const rng = createRng(seed);
  const codes = new Float64Array(points);
  for (let n = 0; n < points; n++) {
    const dt = noise.jitterRms > 0 ? noise.jitterRms * rng.gaussian() : 0;
    const x = mid + amp * Math.sin(2 * Math.PI * fin * (n / fs + dt));
    codes[n] = convertCode(adc, x, rng);
  }
  let mean = 0;
  for (let n = 0; n < points; n++) mean += codes[n];
  mean /= points;
  const re = Float64Array.from(codes, (c) => c - mean);
  const im = new Float64Array(points);
  fft(re, im);
  const half = points / 2;
  const power = new Float64Array(half + 1);
  for (let k = 0; k <= half; k++) {
    const mag2 = (re[k] * re[k] + im[k] * im[k]) / (points * points);
    power[k] = k === 0 || k === half ? mag2 : 2 * mag2; // single-sided, mean-square per bin
  }
  const pfs = (2 ** (N - 1)) ** 2 / 2; // power of a full-scale sine in codes^2
  const ps = power[J];
  const harmBins = [];
  let pharm = 0;
  for (let h = 2; h <= harmonics; h++) {
    const b = alias(h * J, points);
    if (b === 0 || b === J || harmBins.includes(b)) continue;
    harmBins.push(b);
    pharm += power[b];
  }
  let ptotal = 0;
  let maxSpur = 0;
  let maxSpurBin = 1;
  for (let k = 1; k <= half; k++) {
    ptotal += power[k];
    if (k !== J && power[k] > maxSpur) {
      maxSpur = power[k];
      maxSpurBin = k;
    }
  }
  const pnoise = Math.max(ptotal - ps - pharm, 1e-300);
  const db = (r) => 10 * Math.log10(r);
  const snr = db(ps / pnoise);
  const sndr = db(ps / (pnoise + pharm));
  const spectrumDbfs = Float64Array.from(power, (p) => db(Math.max(p, 1e-30) / pfs));
  return {
    points,
    cycles: J,
    fin,
    fs,
    amplitude: amp,
    amplitudeDbfs,
    snr,
    sndr,
    thd: pharm > 0 ? db(pharm / ps) : -Infinity,
    sfdr: db(ps / Math.max(maxSpur, 1e-300)),
    sfdrBin: maxSpurBin,
    enob: (sndr - 1.76) / 6.02,
    signalDbfs: db(ps / pfs),
    harmonicBins: harmBins,
    spectrumDbfs,
    codes,
  };
}
