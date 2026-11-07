// Non-ideal effects against closed-form predictions.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createAdc } from '../src/model/adc.js';
import { convert } from '../src/model/sar.js';
import { staticLinearity } from '../src/analysis/static.js';
import { dynamicPerformance } from '../src/analysis/dynamic.js';
import { createRng } from '../src/model/rng.js';

const fF = 1e-15;

test('reference error is a pure gain error: code = floor(Vin / (Vref (1+e)) * 2^N)', () => {
  const e = 0.03;
  const adc = createAdc({ bits: 8, nonIdeal: { referenceError: { enabled: true, relative: e } } });
  for (let j = 0; j < 400; j++) {
    const x = (j + 0.5) / 400;
    const expected = Math.min(255, Math.floor((x / (1 + e)) * 256));
    // skip inputs within 1e-9 of a transition
    const frac = ((x / (1 + e)) * 256) % 1;
    if (frac < 1e-6 || frac > 1 - 1e-6) continue;
    assert.equal(convert(adc, x).code, expected);
  }
});

test('comparator offset (SE conventional) shifts all thresholds by -Vos (Ct+Cp)/Ct', () => {
  const vos = 3e-3;
  const cp = 40 * fF;
  const adc = createAdc({
    bits: 8,
    unitCap: fF,
    nonIdeal: { comparatorOffset: { enabled: true, offset: vos }, topParasitic: { enabled: true, cap: cp } },
  });
  const ct = 256 * fF;
  const shift = -vos * (ct + cp) / ct;
  const lsb = adc.range.lsb;
  for (let c = 1; c < 256; c++) {
    const t = c * lsb + shift;
    assert.equal(convert(adc, t + 1e-7).code, c, `above T${c}`);
    assert.equal(convert(adc, t - 1e-7).code, c - 1, `below T${c}`);
  }
});

test('monotonic top-plate parasitic produces gain error Ct/(Ct+Cp) of the DAC', () => {
  // Vx+ - Vx- = Vd - V_DAC * Ct/(Ct+Cp): equivalent to quantizing Vd*(Ct+Cp)/Ct ideally.
  const bits = 8;
  const cp = 64 * fF;
  const ct = 2 ** (bits - 1) * fF;
  const adc = createAdc({ scheme: 'monotonic', bits, unitCap: fF, nonIdeal: { topParasitic: { enabled: true, cap: cp } } });
  const ideal = createAdc({ scheme: 'monotonic', bits, unitCap: fF });
  const g = (ct + cp) / ct;
  for (let j = 0; j < 500; j++) {
    const vd = -0.7 + (1.4 * (j + 0.5)) / 500;
    assert.equal(convert(adc, vd).code, convert(ideal, vd * g).code);
  }
  const s = staticLinearity(adc, { samplesPerCode: 16 });
  // transitions compressed by 1/g -> measured LSB is lsb/g
  assert.ok(Math.abs(s.gainErrorPct - (1 / g - 1) * 100) < 0.2, `gain ${s.gainErrorPct}`);
});

test('single MSB capacitor error: DNL at mid-scale matches hand calculation', () => {
  // 4-bit SE, MSB = 8.5 Cu (+6.25 %). Ct = 16.5 Cu.
  // T_k = Vref*W(k)/Ct. Endpoint LSB = (T15 - T1)/14 = (15.5 - 1)/(14*16.5)
  // code 7 width = (8.5 - 7)/16.5 -> DNL7 = 1.5*14/14.5 - 1 = +0.44828
  // code 8 width = (9.5 - 8.5)/16.5 -> DNL8 = 14/14.5 - 1 = -0.03448
  const adc = createAdc({ bits: 4, unitCap: fF, capErrorOverride: [[0.0625, 0, 0, 0, 0]] });
  const s = staticLinearity(adc, { samplesPerCode: 4096 });
  assert.ok(Math.abs(s.dnl[7] - (1.5 * 14) / 14.5 + 1) < 2e-3, `DNL7 ${s.dnl[7]}`);
  assert.ok(Math.abs(s.dnl[8] - (14 / 14.5 - 1)) < 2e-3, `DNL8 ${s.dnl[8]}`);
  // INL at code 8: (T8 - T1)/LSBavg - 7 = (7.5/16.5)/(14.5/(14*16.5)) - 7 = 7.5*14/14.5 - 7
  assert.ok(Math.abs(s.inl[8] - ((7.5 * 14) / 14.5 - 7)) < 2e-3, `INL8 ${s.inl[8]}`);
});

test('mismatch draw follows Pelgrom scaling sigma/sqrt(units)', () => {
  const sigma = 0.01;
  const samples = [];
  for (let seed = 1; seed <= 2000; seed++) {
    const adc = createAdc({ bits: 10, nonIdeal: { mismatch: { enabled: true, sigmaUnit: sigma, seed } } });
    samples.push([adc.arrays[0].errors[0], adc.arrays[0].errors[9]]);
  }
  const std = (v) => Math.sqrt(v.reduce((s, x) => s + x * x, 0) / v.length);
  const sMsb = std(samples.map((s) => s[0]));
  const sLsb = std(samples.map((s) => s[1]));
  assert.ok(Math.abs(sMsb / (sigma / Math.sqrt(512)) - 1) < 0.08, `MSB ${sMsb}`);
  assert.ok(Math.abs(sLsb / sigma - 1) < 0.08, `LSB ${sLsb}`);
});

test('kT/C noise: rms of the held top-plate voltage equals sqrt(kT/C)', () => {
  const adc = createAdc({ bits: 8, unitCap: 0.1e-15, nonIdeal: { samplingNoise: { enabled: true, kTC: true, temperature: 300, extraRms: 0 } } });
  const rng = createRng(9);
  let s2 = 0;
  const n = 4000;
  for (let i = 0; i < n; i++) s2 += convert(adc, 0.5, { rng }).kTCvoltage[0] ** 2;
  const expected = Math.sqrt((1.380649e-23 * 300) / adc.arrays[0].nodeCap);
  assert.ok(Math.abs(Math.sqrt(s2 / n) / expected - 1) < 0.05);
});

test('input-referred noise sets SNR = 20 log10(A_rms / sigma)', () => {
  // 12-bit, sigma = 2 mV >> LSB/sqrt(12) so the noise dominates quantization.
  const sigma = 2e-3;
  const adc = createAdc({ bits: 12, nonIdeal: { samplingNoise: { enabled: true, kTC: false, extraRms: sigma } } });
  const d = dynamicPerformance(adc, { points: 8192, amplitudeDbfs: -1 });
  const arms = d.amplitude / Math.SQRT2;
  const q = adc.range.lsb / Math.sqrt(12);
  const expected = 20 * Math.log10(arms / Math.sqrt(sigma ** 2 + q ** 2));
  assert.ok(Math.abs(d.snr - expected) < 0.5, `SNR ${d.snr} vs ${expected}`);
});

test('aperture jitter: SNR ~ -20 log10(2 pi fin sigma_t)', () => {
  const tj = 20e-12;
  const adc = createAdc({ bits: 14, timing: { tSample: 10e-9, tBit: 1e-9 }, nonIdeal: { jitter: { enabled: true, rms: tj } } });
  const d = dynamicPerformance(adc, { points: 8192, amplitudeDbfs: 0, finRatio: 0.45 });
  const sJ = -20 * Math.log10(2 * Math.PI * d.fin * tj);
  const sQ = 6.02 * 14 + 1.76;
  const expected = -10 * Math.log10(10 ** (-sJ / 10) + 10 ** (-sQ / 10));
  assert.ok(Math.abs(d.snr - expected) < 0.7, `SNR ${d.snr} vs ${expected}`);
});

test('VCM-based: a VCM error does not change differential decisions (it is a pure common-mode shift)', () => {
  const a = createAdc({ scheme: 'vcm', bits: 8, vcm: 0.5 });
  const b = createAdc({ scheme: 'vcm', bits: 8, vcm: 0.53 });
  for (let j = 0; j < 300; j++) {
    const vd = -0.99 + (1.98 * (j + 0.5)) / 300;
    assert.equal(convert(a, vd).code, convert(b, vd).code);
  }
});
