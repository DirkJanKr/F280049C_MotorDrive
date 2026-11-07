// Ideal SAR behaviour: with every non-ideality off, all schemes must be an
// exact uniform quantizer, conserve charge and match published energy figures.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createAdc } from '../src/model/adc.js';
import { convert } from '../src/model/sar.js';
import { SCHEME_LIST } from '../src/model/switching/index.js';
import { averageSwitchingEnergy } from '../src/analysis/energy.js';
import { staticLinearity } from '../src/analysis/static.js';
import { dynamicPerformance } from '../src/analysis/dynamic.js';

for (const scheme of SCHEME_LIST) {
  test(`${scheme.id}: ideal transfer equals floor quantizer for every code (4..12 bit)`, () => {
    for (const bits of [4, 7, 10, 12]) {
      const adc = createAdc({ scheme: scheme.id, bits, unitCap: 2e-15 });
      const { lsb, low, codes } = adc.range;
      for (let c = 0; c < codes; c++) {
        for (const frac of [0.02, 0.5, 0.98]) {
          const x = low + (c + frac) * lsb;
          assert.equal(convert(adc, x).code, c, `${bits} bit, code ${c}, frac ${frac}`);
        }
      }
    }
  });

  test(`${scheme.id}: charge on every floating top plate is conserved (with mismatch and parasitics)`, () => {
    const adc = createAdc({
      scheme: scheme.id,
      bits: 10,
      nonIdeal: {
        mismatch: { enabled: true, sigmaUnit: 0.02, seed: 3 },
        topParasitic: { enabled: true, cap: 0.7e-12 },
        bottomParasitic: { enabled: true, ratio: 0.1 },
        referenceError: { enabled: true, relative: 0.01 },
      },
    });
    const r = convert(adc, adc.range.low + 0.37 * adc.range.fullScale, { record: true });
    const floating = r.snapshots.filter((s) => s.phase !== 'sample');
    const q0 = floating[0].arrays.map((a) => a.qNode);
    for (const s of floating) {
      s.arrays.forEach((a, i) => {
        assert.ok(Math.abs(a.charges.totalTop - q0[i]) <= 1e-12 * Math.abs(adc.arrays[i].nodeCap), 'charge conserved');
      });
      // solver step equals hand formula dVx = sum Ci dVb / (Ct + Cp)
      s.transition.deltaVtop.forEach((dv, i) => assert.ok(Math.abs(dv - s.transition.predictedDeltaVtop[i]) < 1e-12));
    }
  });

  test(`${scheme.id}: recorded and fast conversions give identical codes with noise`, () => {
    const cfg = {
      scheme: scheme.id,
      bits: 9,
      nonIdeal: {
        comparatorNoise: { enabled: true, rms: 2e-3 },
        samplingNoise: { enabled: true, kTC: true, temperature: 300, extraRms: 1e-3 },
      },
    };
    const adc = createAdc(cfg);
    const xs = Array.from({ length: 50 }, (_, i) => adc.range.low + ((i + 0.3) / 50) * adc.range.fullScale);
    for (const x of xs) {
      const seed = Math.round(x * 1e6) & 0xffff;
      const a = convert(adc, x, { rng: (createRngLocal(seed)) });
      const b = convert(adc, x, { rng: (createRngLocal(seed)), record: true });
      assert.equal(a.code, b.code);
    }
  });
}

import { createRng as createRngLocal } from '../src/model/rng.js';

test('average switching energy matches published values (10 bit, units of Cu*Vref^2)', () => {
  // Conventional: Ginsburg & Chandrakasan / Liu et al. 2010 -> 1363.3
  // Monotonic:   Liu et al., JSSC 2010                    -> 255.5
  // VCM-based:   Zhu et al., JSSC 2010                     -> 170.2
  const expected = { 'conventional-diff': 1363.33, monotonic: 255.5, vcm: 170.17 };
  for (const [scheme, e] of Object.entries(expected)) {
    const adc = createAdc({ scheme, bits: 10, unitCap: 1e-15, vref: 1 });
    const r = averageSwitchingEnergy(adc);
    assert.ok(Math.abs(r.avgRefNormalized - e) < 0.01, `${scheme}: ${r.avgRefNormalized}`);
  }
});

test('conventional differential energy follows sum_i 2^(N+1-2i)(2^i - 1) for N = 4..12', () => {
  for (let N = 4; N <= 12; N++) {
    let formula = 0;
    for (let i = 1; i <= N; i++) formula += 2 ** (N + 1 - 2 * i) * (2 ** i - 1);
    const adc = createAdc({ scheme: 'conventional-diff', bits: N, unitCap: 1e-15, vref: 1 });
    const r = averageSwitchingEnergy(adc);
    assert.ok(Math.abs(r.avgRefNormalized - formula) < 1e-6 * formula, `N=${N}: ${r.avgRefNormalized} vs ${formula}`);
  }
});

test('ideal static linearity: DNL = INL = 0, no missing codes, no offset/gain error', () => {
  for (const scheme of ['conventional', 'monotonic', 'vcm', 'conventional-diff']) {
    const adc = createAdc({ scheme, bits: 8 });
    const s = staticLinearity(adc, { samplesPerCode: 16 });
    assert.ok(s.peakDnl < 1e-9, `${scheme} DNL ${s.peakDnl}`);
    assert.ok(s.peakInl < 1e-9, `${scheme} INL ${s.peakInl}`);
    assert.equal(s.missingCodes, 0);
    assert.ok(Math.abs(s.offsetErrorLsb) < 1e-9 && Math.abs(s.gainErrorPct) < 1e-9);
  }
});

test('ideal dynamic performance: SNDR ~ 6.02 N + 1.76 dB', () => {
  for (const bits of [6, 8, 10, 12]) {
    const adc = createAdc({ scheme: 'conventional', bits });
    const d = dynamicPerformance(adc, { points: 8192, amplitudeDbfs: -0.05 });
    const theory = 6.02 * bits + 1.76;
    assert.ok(Math.abs(d.sndr - theory) < 0.6, `${bits} bit SNDR ${d.sndr} vs ${theory}`);
    assert.ok(Math.abs(d.enob - bits) < 0.1, `ENOB ${d.enob}`);
  }
});

import { convertCode } from '../src/model/sar.js';
test('fast path convertCode matches convert bit-exactly for all schemes with every non-ideality on', () => {
  for (const scheme of SCHEME_LIST) {
    const adc = createAdc({
      scheme: scheme.id,
      bits: 11,
      nonIdeal: {
        mismatch: { enabled: true, sigmaUnit: 0.01, seed: 4 },
        topParasitic: { enabled: true, cap: 0.3e-12 },
        comparatorOffset: { enabled: true, offset: 1e-3, cmCoefficient: 0.01 },
        comparatorNoise: { enabled: true, rms: 0.5e-3 },
        referenceError: { enabled: true, relative: 0.004 },
        samplingNoise: { enabled: true, kTC: true, temperature: 350, extraRms: 0.2e-3 },
      },
    });
    const r1 = createRngLocal(77);
    const r2 = createRngLocal(77);
    for (let j = 0; j < 2000; j++) {
      const x = adc.range.low + ((j + 0.5) / 2000) * adc.range.fullScale;
      assert.equal(convertCode(adc, x, r1), convert(adc, x, { rng: r2 }).code, `${scheme.id} j=${j}`);
    }
  }
});
