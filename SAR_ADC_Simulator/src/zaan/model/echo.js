// Full receive chain for one image line: point reflectors -> 16 channels -> delay-and-sum
// with quantised delays -> charge-sharing ADC -> combiner -> digital IQ demodulator -> envelope.
// Assumptions: transmit focused on the line (arrival R / c), signals as seen after the front end
// (attenuation compensated upstream), per-channel clipping at the full scale (bone).

import { receiveDelays, quantise } from './beamformer.js';
import { convert, combine } from './chargeSar.js';
import { samplingNoise } from './noise.js';

/** Gaussian pulse with -6 dB fractional bandwidth fbw around f0. */
function pulse(t, f0, fbw) {
  const sf = (fbw * f0) / 2.3548;
  const st = 1 / (2 * Math.PI * sf);
  return Math.exp(-(t * t) / (2 * st * st)) * Math.cos(2 * Math.PI * f0 * t);
}

/** Windowed-sinc low-pass FIR, cutoff fc (Hz) at rate fs. */
function lowpass(fc, fs, taps = 41) {
  const h = [];
  const m = (taps - 1) / 2;
  let sum = 0;
  for (let i = 0; i < taps; i++) {
    const k = i - m;
    const sinc = k === 0 ? (2 * fc) / fs : Math.sin((2 * Math.PI * fc * k) / fs) / (Math.PI * k);
    const w = 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (taps - 1));
    h.push(sinc * w);
    sum += sinc * w;
  }
  return h.map((x) => x / sum);
}

export function echoLine(P, d, chip, cal, { reflectors, bone, level = -6, rng, fracBits = 0, maxDepth = 0.035 }) {
  const N = P.channels;
  const { xs, tau } = receiveDelays({ N, pitch: P.pitch, theta: P.steer, F: P.focus, c: P.c });
  const tq = quantise(tau, P.delayStep);
  const fs = P.fs;
  const nS = Math.ceil(((2 * maxDepth) / P.c) * fs);
  const amp = (P.fullScale / 2) * 10 ** (level / 20);
  const targets = reflectors.filter((r) => !bone || r.z < bone.z).concat(bone ? [{ z: bone.z, a: bone.a }] : []);
  const pos = targets.map((r) => ({ x: r.z * Math.sin(P.steer), z: r.z * Math.cos(P.steer), R: r.z, a: r.a }));
  const sum = new Float64Array(nS);
  const ch0 = new Float64Array(nS);
  const clip = P.fullScale / 2;
  for (let n = 0; n < N; n++) {
    for (let k = 0; k < nS; k++) {
      const t = k / fs - tq[n];
      let s = 0;
      for (const r of pos) {
        const arrive = (r.R + Math.hypot(xs[n] - r.x, r.z)) / P.c;
        s += amp * r.a * pulse(t - arrive, P.f0, P.fbw);
      }
      s = Math.max(-clip, Math.min(clip, s));
      sum[k] += s / N;
      if (n === 0) ch0[k] = s;
    }
  }
  const sig = samplingNoise(P, d);
  const codes = new Float64Array(nS);
  for (let k = 0; k < nS; k++) {
    const v = sum[k] + sig * rng.gaussian();
    const dec = convert(chip, d, (v / P.fullScale) * d.codes, { vos: P.vosCal, noise: P.compNoise, rng });
    codes[k] = combine(dec, cal, d.codes, fracBits) - d.codes / 2 + 0.5;
  }
  // IQ demodulation: mix with f0, low-pass to half the bandwidth (plus margin), decimate by 2.
  const h = lowpass(Math.min(0.45 * fs, P.f0 * P.fbw * 0.6), fs);
  const I = new Float64Array(nS);
  const Q = new Float64Array(nS);
  for (let k = 0; k < nS; k++) {
    const ph = (2 * Math.PI * P.f0 * k) / fs;
    I[k] = codes[k] * Math.cos(ph);
    Q[k] = -codes[k] * Math.sin(ph);
  }
  const env = [];
  const depth = [];
  const m = (h.length - 1) / 2;
  for (let k = 0; k < nS; k += 2) {
    let i = 0;
    let q = 0;
    for (let j = 0; j < h.length; j++) {
      const idx = k + j - m;
      if (idx >= 0 && idx < nS) {
        i += h[j] * I[idx];
        q += h[j] * Q[idx];
      }
    }
    env.push(2 * Math.hypot(i, q));
    depth.push(((k / fs) * P.c) / 2);
  }
  const peak = Math.max(...env, 1e-12);
  return {
    t: Array.from({ length: nS }, (_, k) => k / fs), analog: sum, ch0, codes, depth,
    envDb: env.map((e) => 20 * Math.log10(Math.max(e / peak, 1e-6))), tau, tq, targets,
  };
}
