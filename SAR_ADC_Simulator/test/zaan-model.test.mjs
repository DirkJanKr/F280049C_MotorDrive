// Zaan charge-sharing model, checked against the architecture review and ideal behaviour.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRegistry, siAll } from '../src/zaan/params.js';
import { designCdac, binaryMatchingCu } from '../src/zaan/model/cdac.js';
import { buildSteps, tolerances } from '../src/zaan/model/steps.js';
import { idealChip, drawChip, convert, combine, designWeights } from '../src/zaan/model/chargeSar.js';
import { leastSquaresWeights } from '../src/zaan/model/calibrate.js';
import { sineMetrics, rampLinearity, isCoherent, coherentCycles } from '../src/zaan/model/analysis.js';
import { receiveDelays, cellsNeeded, worstPhaseError } from '../src/zaan/model/beamformer.js';
import { samplingNoise } from '../src/zaan/model/noise.js';
import { createRng } from '../src/model/rng.js';

const P = siAll(createRegistry());
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: expected ${b}, got ${a}`);

test('slide 24 example array: 256, 136, 72 ... LSB, 12 decisions, 73 units, CDAC 2.56 pF', () => {
  const d = designCdac(P);
  assert.deepEqual(d.weights, [256, 136, 72, 40, 24, 16, 8, 4, 2, 1, 1]);
  assert.equal(d.decisions, 12);
  assert.equal(d.units, 73);
  near(d.cdac * 1e12, 2.555, 1e-9, 'CDAC pF');
  near(d.cmSlide * 1e15, 127.75, 0.01, 'CM with total CDAC (slide 25: 128 fF)');
});

test('slide 16 binary array: 67 units, unit about 1.46 pF', () => {
  const b = designCdac({ ...P, radix: 2 });
  assert.equal(b.units, 67);
  assert.equal(b.decisions, 10);
  // at the mid-scale transition every step flips, so the step error is 2 (dw1 - sum dw_rest): 4 x the earlier 364 fF
  near(binaryMatchingCu(P).cu * 1e15, 1456, 24, 'binary unit fF');
});

test('slide 22 tolerance example: 9, 5, 3, 2, 1, 1 gives 4, 3, 2, 1, 1, 0, 0', () => {
  assert.deepEqual(tolerances([9, 5, 3, 2, 1, 1]), [4, 3, 2, 1, 1, 0, 0]);
  assert.deepEqual(tolerances([8, 4, 2, 1]), [0, 0, 0, 0, 0]);
});

test('radix generator reproduces 32, 17, 9, 5, 3, 2, 1 units for radix 1.9', () => {
  const s = buildSteps({ topUnits: 32, radix: 1.9, halvings: 3 }).filter((x) => x.kind === 'cap').map((x) => x.units);
  assert.deepEqual(s, [32, 17, 9, 5, 3, 2, 1]);
});

test('slide 7: 504 ns longest delay, 22 cells; slide 8: 45 and 22.5 degrees', () => {
  const r = receiveDelays({ N: 16, pitch: 200e-6, theta: (15 * Math.PI) / 180, F: Infinity, c: 1540 });
  const tmax = Math.max(...r.tau);
  near(tmax * 1e9, 504.2, 0.1, 'delay ns');
  assert.equal(cellsNeeded(tmax, 25e-9, 25e-9).m, 22);
  assert.equal(cellsNeeded(tmax, 12.5e-9, 25e-9).m, 22);
  near(worstPhaseError(10e6, 25e-9), 45, 1e-9, '25 ns');
  near(worstPhaseError(10e6, 12.5e-9), 22.5, 1e-9, '12.5 ns');
});

test('slide 11: offset is 1.0 LSB per mV at the first decision', () => {
  const d = designCdac(P);
  near((d.cNode[0] * 1e-3) / d.qLsb, 1.024, 1e-9, 'LSB per mV');
});

test('slide 25: kT/C of 16 cells of 128 fF is 64 uV rms', () => {
  near(samplingNoise(P, { cm: 128e-15 }) * 1e6, 63.6, 0.2, 'uV');
});

test('charge is conserved after every step: final Q = input charge - sum of shared step charges', () => {
  const d = designCdac(P);
  const chip = drawChip(d, P, createRng(5));
  for (const x of [-400.3, -12.7, 0.2, 333.3]) {
    const r = convert(chip, d, x, { trace: true });
    let q = x * d.qLsb;
    for (let i = 0; i < d.decisions; i++) {
      assert.ok(Math.abs(r.steps[i].Q - q) <= 1e-12 * Math.abs(d.qFs), `step ${i}`);
      assert.ok(Math.abs(r.steps[i].v * r.steps[i].cn - r.steps[i].Q) <= 1e-12 * Math.abs(d.qFs));
      if (i < d.decisions - 1) q -= (r.dec[i] ? 1 : -1) * chip.q[i];
    }
  }
});

test('binary and redundant weights with zero mismatch reconstruct the input exactly', () => {
  for (const radix of [2, 1.9, 1.75]) {
    const d = designCdac({ ...P, radix });
    const chip = idealChip(d);
    const cw = designWeights(d);
    for (let j = 0; j < 20000; j++) {
      const xc = ((j + 0.37) / 20000) * d.codes;
      assert.equal(combine(convert(chip, d, xc - d.codes / 2), cw, d.codes), Math.floor(xc), `radix ${radix}`);
    }
  }
});

test('ideal 10-bit binary with a full-scale sine: SQNR 61.96 dB, ENOB 10.0', () => {
  const d = designCdac({ ...P, radix: 2 });
  const chip = idealChip(d);
  const M = 8192;
  const J = coherentCycles(M, 0.1);
  assert.ok(isCoherent(J, M));
  const amp = 512 * 0.9999;
  const codes = Array.from({ length: M }, (_, k) => combine(convert(chip, d, amp * Math.sin((2 * Math.PI * J * k) / M)), designWeights(d), 1024));
  const m = sineMetrics(codes, J, 10);
  near(m.sndr, 61.96, 0.3, 'SQNR');
  near(m.enob, 10.0, 0.05, 'ENOB');
});

test('ideal ramp gives zero histogram DNL and INL', () => {
  const d = designCdac(P);
  const chip = idealChip(d);
  const out = [];
  for (let j = 0; j < 1024 * 8; j++) out.push(combine(convert(chip, d, (j + 0.5) / 8 - 512), designWeights(d), 1024));
  const l = rampLinearity(out, 1024);
  assert.equal(l.peakDnl, 0);
  assert.equal(l.peakInl, 0);
  assert.equal(l.missing, 0);
});

test('least-squares calibration recovers the true step weights of a mismatched chip', () => {
  const d = designCdac(P);
  const chip = drawChip(d, P, createRng(2));
  const xs = [];
  for (let j = 0; j < 1024 * 8; j++) xs.push((j + 0.5) / 8);
  const cal = leastSquaresWeights(xs.map((x) => convert(chip, d, x - 512)), xs);
  for (let i = 0; i < 6; i++) near(cal.w[i], chip.wTrue[i], 0.05, `weight ${i}`);
});

test('coherence check rejects a record with a common factor', () => {
  assert.ok(!isCoherent(64, 2048));
  assert.ok(isCoherent(205, 2048));
});
