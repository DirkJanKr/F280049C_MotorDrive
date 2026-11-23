// The weight builder must give the same lists as Zaan_MATLAB step 7b (build_weights.m), 23 Nov.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildWeights, fixedErrors } from '../src/zaan/model/weightBuilder.js';

// alpha = 1, C_M = 280 fF, N = 16, 10 bit, V_FS = 1 V, C_u = 35 fF, A_C = 0.0499
const K = { cTh: 16 * 280e-15, qLsb: (16 * 280e-15 * 1) / 1024, cu: 35e-15, lsbPerUnit: 8, sigmaU: 0.0499 / Math.sqrt(35), half: 512 };
const vos = 0.15e-3;

test('builder: same lists as MATLAB 7b', () => {
  assert.deepEqual(buildWeights({ nTau: 4.6, vos }, K), [176, 168, 72, 40, 32, 16, 8, 4, 2, 1, 1]);
  assert.deepEqual(buildWeights({ nTau: 3.0, vos }, K), [144, 136, 112, 56, 32, 16, 8, 8, 4, 2, 1, 1]);
  assert.deepEqual(buildWeights({ nTau: 3.7, vos, gMargin: 0.02, dMargin: 0.2 }, K), [200, 160, 80, 40, 16, 16, 8, 4, 2, 1, 1]);
  assert.deepEqual(buildWeights({ nTau: 2.8, vos, gMargin: 0.02, dMargin: 0.2 }, K), [176, 168, 56, 56, 32, 16, 8, 8, 4, 2, 1, 1]);
  assert.equal(buildWeights({ nTau: 2.4, vos, gMargin: 0.02, dMargin: 0.2 }, K), null);
});

test('fixed errors: decision 6 of the old w_design as in MATLAB 7a', () => {
  const e = fixedErrors([184, 160, 72, 48, 24, 16, 8, 4, 2, 1, 1], Math.exp(-4.6), vos, K);
  assert.ok(Math.abs(e.t[5] - 1) < 1e-9);
  assert.ok(Math.abs(e.mis[5] - 0.37) < 0.01);
  assert.ok(Math.abs(e.setl[5] - 0.24) < 0.01);
  assert.ok(Math.abs(e.t[0] - 153) < 1e-9);
});
