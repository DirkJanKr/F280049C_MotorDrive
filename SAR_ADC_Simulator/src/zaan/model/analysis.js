// Shared analysis pipeline (addendum 8.3): works on output codes from the model,
// from Spectre transient data or from lab captures alike.

import { fft } from '../../analysis/fft.js';

export function gcd(a, b) {
  while (b) [a, b] = [b, a % b];
  return a;
}

/** Coherent sampling: fin = (J / M) fs with J and M sharing no factor. */
export function isCoherent(J, M) {
  return Number.isInteger(J) && J > 0 && J < M / 2 && gcd(J, M) === 1;
}

/** Odd cycle count near ratio x M, so it is coprime with a power-of-two record. */
export function coherentCycles(M, ratio) {
  let J = Math.max(1, Math.round(M * ratio));
  if (J % 2 === 0) J += 1;
  while (!isCoherent(J, M) && J > 1) J -= 2;
  return J;
}

/** FFT metrics of a coherent sine record of codes. Rectangular window. */
export function sineMetrics(codes, J, bits, harmonics = 7) {
  const M = codes.length;
  let mean = 0;
  for (const c of codes) mean += c;
  mean /= M;
  const re = Float64Array.from(codes, (c) => c - mean);
  const im = new Float64Array(M);
  fft(re, im);
  const half = M / 2;
  const p = new Float64Array(half + 1);
  for (let k = 0; k <= half; k++) p[k] = ((k === 0 || k === half ? 1 : 2) * (re[k] ** 2 + im[k] ** 2)) / (M * M);
  const pfs = (2 ** (bits - 1)) ** 2 / 2;
  const ps = p[J];
  let ph = 0;
  const hb = [];
  for (let h = 2; h <= harmonics; h++) {
    let b = (h * J) % M;
    if (b > half) b = M - b;
    if (b && b !== J && !hb.includes(b)) {
      hb.push(b);
      ph += p[b];
    }
  }
  let pt = 0;
  let spur = 0;
  for (let k = 1; k <= half; k++) {
    pt += p[k];
    if (k !== J) spur = Math.max(spur, p[k]);
  }
  const pn = Math.max(pt - ps - ph, 1e-300);
  const db = (r) => 10 * Math.log10(r);
  const sndr = db(ps / (pn + ph));
  return {
    sndr, snr: db(ps / pn), sfdr: db(ps / Math.max(spur, 1e-300)), enob: (sndr - 1.76) / 6.02,
    spectrum: Float64Array.from(p, (x) => db(Math.max(x, 1e-30) / pfs)), harmonicBins: hb, coherent: isCoherent(J, M),
  };
}

/** Histogram DNL/INL from a uniform ramp with s samples per code spanning the full range (endpoint fit). */
export function rampLinearity(codesOut, codes) {
  const h = new Float64Array(codes);
  for (const c of codesOut) h[c]++;
  const T = new Float64Array(codes);
  let cum = 0;
  for (let k = 1; k < codes; k++) {
    cum += h[k - 1];
    T[k] = cum;
  }
  const lsb = (T[codes - 1] - T[1]) / (codes - 2);
  const dnl = new Float64Array(codes);
  const inl = new Float64Array(codes);
  let peakDnl = 0;
  let peakInl = 0;
  let missing = 0;
  for (let k = 1; k < codes; k++) {
    inl[k] = (T[k] - T[1]) / lsb - (k - 1);
    peakInl = Math.max(peakInl, Math.abs(inl[k]));
    if (k < codes - 1) {
      dnl[k] = (T[k + 1] - T[k]) / lsb - 1;
      peakDnl = Math.max(peakDnl, Math.abs(dnl[k]));
      if (h[k] === 0) missing++;
    }
  }
  return { dnl, inl, peakDnl, peakInl, missing };
}
