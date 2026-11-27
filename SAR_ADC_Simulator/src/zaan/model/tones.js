// Beamformer memory-cell tones (Zaan MATLAB step 2b, extended with charge injection).
//
// Every channel j writes sample t into cell c j(t) = (t - d j) mod M and the 16 cells read together are summed.
// A cell adds two errors that both repeat every M samples:
//   gain    its capacitance differs: g = 1 + (e P + e N) / 2, e ~ N(0, sigma cap), sigma cap = A C / sqrt(C M in fF)
//           -> tones at f sig +- k fs / M, proportional to the signal
//   offset  its switch leaves extra charge o ~ N(0, sigma q) (injection mismatch, per cell)
//           -> fixed tones at k fs / M, independent of the signal
// Theory (D):  gain tones   / signal = sigma cap^2 / (2 N) * (M - 1) / M
//              offset tones / signal = N sigma q^2 (M - 1) / M / (A sig^2 / 2),  A sig = level Q FS / 2

import { createRng } from '../../model/rng.js';

export function toneTheory({ N, M, cm, aMem, cellQ, level, qFs }) {
  const sigCap = aMem / Math.sqrt(cm * 1e15);
  const gain = ((sigCap ** 2) / (2 * N)) * ((M - 1) / M);
  const aSig = (level * qFs) / 2;
  const offset = cellQ > 0 ? (N * cellQ ** 2 * ((M - 1) / M)) / (aSig ** 2 / 2) : 0;
  return { gain, offset, sigCap };
}

/** Power of bin b of a real record (one-sided, the Nyquist bin counted half). */
function binPower(x, b) {
  const n = x.length;
  let re = 0, im = 0;
  const w = (2 * Math.PI * b) / n;
  for (let t = 0; t < n; t++) { re += x[t] * Math.cos(w * t); im -= x[t] * Math.sin(w * t); }
  return (re * re + im * im) * (b === n / 2 ? 0.5 : 1);
}

/**
 * Simulate chips; returns the tones of the first chip (frequency, dBc, kind) and the mean totals.
 * opts: N, M, fs, pitch [m], steer [rad], cm [F], aMem (fraction sqrt(fF)), cellQ [C rms], level (of full scale),
 *       qFs [C], band [lo, hi] Hz, chips, seed, L (record = M L samples).
 */
export function simulateTones(o) {
  const { N, M, fs, cm, aMem, cellQ, level, qFs, band = [7e6, 13e6], chips = 20, seed = 2, L = 128 } = o;
  const n = M * L;
  let ks = Math.round(((o.f0 || 10e6) / fs) * n);
  if (ks % 2 === 0) ks += 1;
  if (ks % L === 0) ks += 2;
  const c = o.c || 1540;
  const del = Array.from({ length: N }, (_, j) => Math.round((j * o.pitch * Math.sin(o.steer || 0) * fs) / c));
  const sigCap = aMem / Math.sqrt(cm * 1e15);
  const amp = (level * qFs) / 2 / N;
  const fold = (b) => { const m = ((b % n) + n) % n; return m > n / 2 ? n - m : m; };
  const gainBins = new Map(), offBins = new Map();
  for (let k = 1; k < M; k++) { gainBins.set(fold(ks + k * L), k); gainBins.set(fold(ks - k * L), -k); }
  for (let k = 1; k <= M / 2; k++) offBins.set(fold(k * L), k);
  const inBand = (b) => { const f = (b / n) * fs; return f >= band[0] && f <= band[1]; };
  const rng = createRng(seed);
  const x = new Float64Array(n);
  const tot = { gain: 0, offset: 0, gainIn: 0, offsetIn: 0, largest: 0 };
  let first = null;
  for (let chip = 0; chip < chips; chip++) {
    const g = [], q = [];
    for (let j = 0; j < N; j++) {
      g.push(Array.from({ length: M }, () => 1 + (sigCap * (rng.gaussian() + rng.gaussian())) / 2));
      q.push(Array.from({ length: M }, () => cellQ * rng.gaussian()));
    }
    for (let t = 0; t < n; t++) {
      const s = amp * Math.sin((2 * Math.PI * ks * t) / n);
      let v = 0;
      for (let j = 0; j < N; j++) { const cc = (((t - del[j]) % M) + M) % M; v += g[j][cc] * s + q[j][cc]; }
      x[t] = v;
    }
    const ps = binPower(x, ks);
    const tones = [];
    let ga = 0, of = 0, gi = 0, oi = 0, lg = 0;
    for (const [b] of gainBins) { const p = binPower(x, b) / ps; ga += p; if (inBand(b)) gi += p; lg = Math.max(lg, p); tones.push({ f: (b / n) * fs, p, kind: 'gain' }); }
    for (const [b] of offBins) { const p = binPower(x, b) / ps; of += p; if (inBand(b)) oi += p; lg = Math.max(lg, p); tones.push({ f: (b / n) * fs, p, kind: 'offset' }); }
    tot.gain += ga / chips; tot.offset += of / chips; tot.gainIn += gi / chips; tot.offsetIn += oi / chips; tot.largest = Math.max(tot.largest, lg);
    if (!first) first = { tones, fSig: (ks / n) * fs };
  }
  return { ...tot, first, theory: toneTheory({ N, M, cm, aMem, cellQ, level, qFs }) };
}

export const dbc = (p) => (p > 0 ? 10 * Math.log10(p) : -Infinity);
