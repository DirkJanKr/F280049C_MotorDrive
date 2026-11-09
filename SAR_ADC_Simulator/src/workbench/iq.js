// Digital IQ demodulator after the ADC, as hardware would do it:
//   1 ADC output x[n] (real, fs)
//   2 mixing with an NCO: I[n] = x[n] cos(2π f0 n / fs), Q[n] = −x[n] sin(2π f0 n / fs)
//   3 FIR low-pass on I and Q (K taps, windowed sinc, DC gain 1)
//   4 decimation by D: keep every D-th output (fs / D)
// The SNR is measured on a test tone at each stage. Noise of the converter comes from
// the budget (everything except quantisation, which is made by rounding to the output bits).

import { fft } from '../analysis/fft.js';
import { createRng } from '../model/rng.js';

/** Low-pass FIR: windowed sinc (Blackman), cutoff fc, normalised to DC gain 1. */
export function lowpass(K, fc, fs) {
  const h = [];
  const m = (K - 1) / 2;
  for (let i = 0; i < K; i++) {
    const t = i - m;
    const x = (2 * fc) / fs;
    const sinc = t === 0 ? x : Math.sin(Math.PI * x * t) / (Math.PI * t);
    const w = K === 1 ? 1 : 0.42 - 0.5 * Math.cos((2 * Math.PI * i) / (K - 1)) + 0.08 * Math.cos((4 * Math.PI * i) / (K - 1));
    h.push(sinc * w);
  }
  const s = h.reduce((a, v) => a + v, 0);
  return h.map((v) => v / s);
}

/** Magnitude response in dB at frequencies f (Hz). */
export function response(h, fs, f) {
  return f.map((fr) => {
    let re = 0;
    let im = 0;
    for (let i = 0; i < h.length; i++) {
      re += h[i] * Math.cos((2 * Math.PI * fr * i) / fs);
      im -= h[i] * Math.sin((2 * Math.PI * fr * i) / fs);
    }
    return 10 * Math.log10(Math.max(re * re + im * im, 1e-16));
  });
}

function bh(n, N) {
  const a = (2 * Math.PI * n) / (N - 1);
  return 0.35875 - 0.48829 * Math.cos(a) + 0.14128 * Math.cos(2 * a) - 0.01168 * Math.cos(3 * a);
}

/**
 * Windowed spectrum of a (complex) record. Returns power per bin normalised so that a
 * component's power is the sum over its bins, and the frequency of each bin (two-sided, centred).
 */
function spectrum(re0, im0, fs) {
  let N = 1;
  while (N * 2 <= re0.length) N *= 2;
  const re = new Float64Array(N);
  const im = new Float64Array(N);
  let w2 = 0;
  for (let n = 0; n < N; n++) {
    const w = bh(n, N);
    re[n] = re0[n] * w;
    im[n] = (im0 ? im0[n] : 0) * w;
    w2 += w * w;
  }
  fft(re, im);
  const p = new Float64Array(N);
  const f = new Float64Array(N);
  for (let k = 0; k < N; k++) {
    const kk = (k + N / 2) % N; // centre: bin 0 of the output is −fs/2
    p[k] = (re[kk] ** 2 + im[kk] ** 2) / (N * w2);
    f[k] = ((k - N / 2) * fs) / N;
  }
  return { p, f, N, fs };
}

/** Power in the signal lobes (±4 bins around each frequency) against the noise outside all signal and excluded lobes. */
function snrOf(sp, sigF, exF = []) {
  const bin = (x) => Math.round((x / sp.fs) * sp.N + sp.N / 2);
  const lobe = (c) => [c - 4, c + 4];
  const sig = sigF.map((x) => lobe(bin(x)));
  const ex = sig.concat(exF.map((x) => lobe(bin(x))));
  let ps = 0;
  let pn = 0;
  let nb = 0;
  for (let k = 0; k < sp.N; k++) {
    if (sig.some(([a, b]) => k >= a && k <= b)) ps += sp.p[k];
    else if (!ex.some(([a, b]) => k >= a && k <= b)) {
      pn += sp.p[k];
      nb++;
    }
  }
  pn *= sp.N / Math.max(1, nb);
  return { ps, pn, snr: 10 * Math.log10(ps / pn) };
}

/** Run the chain. o: { fs, f0, ftest, K, fc, D, codes, noiseLsb, ampDbfs }. */
export function runIq(o) {
  const nOut = 1024;
  const N = nOut * o.D + o.K;
  const rng = createRng(11);
  const A = (o.codes / 2) * 10 ** (o.ampDbfs / 20);
  const x = new Float64Array(N);
  for (let n = 0; n < N; n++) {
    const v = A * Math.sin((2 * Math.PI * o.ftest * n) / o.fs) + o.noiseLsb * rng.gaussian();
    x[n] = Math.max(-o.codes / 2, Math.min(o.codes / 2 - 1, Math.round(v - 0.5) + 0.5));
  }
  const I = new Float64Array(N);
  const Q = new Float64Array(N);
  for (let n = 0; n < N; n++) {
    const ph = (2 * Math.PI * o.f0 * n) / o.fs;
    I[n] = x[n] * Math.cos(ph);
    Q[n] = -x[n] * Math.sin(ph);
  }
  const h = lowpass(o.K, o.fc, o.fs);
  const Ny = N - o.K;
  const yI = new Float64Array(Ny);
  const yQ = new Float64Array(Ny);
  for (let n = 0; n < Ny; n++) {
    let a = 0;
    let b = 0;
    for (let i = 0; i < o.K; i++) {
      a += h[i] * I[n + o.K - 1 - i];
      b += h[i] * Q[n + o.K - 1 - i];
    }
    yI[n] = a;
    yQ[n] = b;
  }
  const dI = new Float64Array(nOut);
  const dQ = new Float64Array(nOut);
  for (let n = 0; n < nOut; n++) {
    dI[n] = yI[n * o.D];
    dQ[n] = yQ[n * o.D];
  }
  const fb = o.ftest - o.f0;
  const img = -(o.ftest + o.f0);
  const wrap = (f, fs) => ((((f + fs / 2) % fs) + fs) % fs) - fs / 2;
  const s1 = spectrum(x.slice(o.K), null, o.fs);
  const s2 = spectrum(I.slice(o.K), Q.slice(o.K), o.fs);
  const s3 = spectrum(yI, yQ, o.fs);
  const s4 = spectrum(dI, dQ, o.fs / o.D);
  const h2 = h.reduce((a, v) => a + v * v, 0);
  return {
    h, A,
    stages: [
      { id: 'adc', sp: s1, snr: snrOf(s1, [o.ftest, -o.ftest], [0]).snr, ref: (o.codes / 2) ** 2 / 2 },
      { id: 'mix', sp: s2, snr: snrOf(s2, [fb], [wrap(img, o.fs), 0]).snr, ref: (o.codes / 2) ** 2 / 4, image: wrap(img, o.fs) },
      { id: 'lpf', sp: s3, snr: snrOf(s3, [fb], [0]).snr, ref: (o.codes / 2) ** 2 / 4 },
      { id: 'dec', sp: s4, snr: snrOf(s4, [wrap(fb, o.fs / o.D)], [0]).snr, ref: (o.codes / 2) ** 2 / 4 },
    ],
    gainTheory: 10 * Math.log10(1 / (2 * h2)),
    gainIdeal: 10 * Math.log10(o.fs / 2 / (2 * o.fc)),
    noiseBw: o.fs * h2,
  };
}
