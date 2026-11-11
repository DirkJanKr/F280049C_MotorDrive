// Zaan workbench: values, weight designer and the design computation.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createValues } from '../src/workbench/values.js';
import { design } from '../src/workbench/design.js';
import { stepsFromList } from '../src/workbench/weights.js';

const ui = { weightMode: 'generator', customWeights: '' };

test('values start from the beamformer: nothing from the front end', () => {
  const ids = createValues().map((v) => v.id);
  for (const id of ['sMax', 'lnaNoise', 'afeGain', 'depth', 'focalDepths', 'feType']) assert.ok(!ids.includes(id), id);
});

test('default design: 22 cells, 12 decisions, CDAC 2.56 pF, 12.5 ns step from two clocks', () => {
  const c = design(createValues(), ui);
  assert.equal(c.need.m, 22);
  assert.equal(c.d.decisions, 12);
  assert.ok(Math.abs(c.d.cdac - 2.555e-12) < 1e-18);
  assert.ok(c.halfSteps.some((h) => h) && c.halfSteps.some((h) => !h));
});

test('charge halving against small capacitors: same weights, different capacitors', () => {
  const v = createValues();
  const a = design(v, ui);
  v.find((x) => x.id === 'halvingOn').value = 'small capacitors';
  const b = design(v, ui);
  assert.deepEqual(a.d.weights, b.d.weights);
  assert.ok(Math.abs(a.smallest - 35e-15) < 1e-21, 'halving keeps 35 fF');
  assert.ok(b.smallest < 5e-15, 'small capacitors go below the PDK minimum');
  assert.equal(a.d.units, 73);
  assert.ok(b.d.units < a.d.units);
});

test('typed weights: valid binary list, and a clear error for an impossible halving step', () => {
  assert.equal(stepsFromList('256,128,64,32,16,8,4,2,1', 8, 'charge halving').error, null);
  assert.match(stepsFromList('256,136,72,3', 8, 'charge halving').error, /does not fit/);
  assert.equal(stepsFromList('256,136,72,3', 8, 'small capacitors').error, null);
});

test('typed weights drive the design', () => {
  const c = design(createValues(), { weightMode: 'custom', customWeights: '256, 128, 64, 32, 16, 8, 4, 2, 1' });
  assert.equal(c.d.decisions, 10);
  assert.deepEqual(c.d.tol.slice(0, -1).every((t) => t === 0), true, 'binary has no tolerance');
});

test('charge budget: ideal 10-bit quantisation alone gives ENOB 10.0, and the lines add in power', async () => {
  const { chargeBudget, allowedCharge, enobFromCharge } = await import('../src/workbench/budget.js');
  const c = design(createValues(), ui);
  const q = c.d.qLsb / Math.sqrt(12);
  assert.ok(Math.abs(enobFromCharge(c.d, q).enob - 10) < 0.01);
  assert.ok(Math.abs(allowedCharge(c.d, 9.5) / c.d.qLsb - 0.4082) < 1e-3, 'σ allowed = 2^0.5 / √12 LSB');
  const b = chargeBudget(c.P, c.d, { residualQ: 0 });
  const rss = Math.sqrt(b.lines.reduce((a, l) => a + l.sigma ** 2, 0));
  assert.ok(Math.abs(rss - b.total) < 1e-24);
  assert.ok(Math.abs(b.lines.reduce((a, l) => a + l.share, 0) - b.used) < 1e-9);
});

test('beamformer gain: switching it off makes the cell kT/C charge √N larger', async () => {
  const { chargeBudget } = await import('../src/workbench/budget.js');
  const c = design(createValues(), ui);
  const on = chargeBudget(c.P, c.d, { arrayGain: true }).lines.find((l) => l.id === 'samp').sigma;
  const off = chargeBudget(c.P, c.d, { arrayGain: false }).lines.find((l) => l.id === 'samp').sigma;
  assert.ok(Math.abs(off / on - 4) < 1e-9);
});

test('tolerance check: binary weights fail at decision 1, the default redundant weights pass', () => {
  const bin = design(createValues(), { weightMode: 'custom', customWeights: '256, 128, 64, 32, 16, 8, 4, 2, 1' });
  assert.equal(bin.tolNeed[0].ok, false);
  assert.equal(bin.checks.find((k) => k.id === 'tol').state, 'bad');
  const def = design(createValues(), ui);
  assert.equal(def.checks.find((k) => k.id === 'tol').state, 'ok');
  assert.ok(def.checks.every((k) => typeof k.why === 'string' && k.why.length > 10));
});

test('needs-driven optimizer: every step is covered, range reached, no more units than the radix design', async () => {
  const { optimise } = await import('../src/workbench/optimizer.js');
  const c = design(createValues(), ui);
  for (const o of [{ smallest: 1 }, { smallest: 0.5 }, { smallest: 1, noise: true }]) {
    const r = optimise(c.P, c.P.memCells, { sigmaU: c.sigmaU, arrayGain: true, ...o });
    assert.ok(r.steps, 'builds');
    assert.ok(r.need.every((x) => x.ok), 'every decision covered');
    assert.ok(r.d.cover.ok, 'reaches both ends');
    assert.ok(Math.min(...r.d.weights) <= o.smallest + 1e-12);
    assert.ok(r.d.units <= c.d.units + 1, 'no larger than the default');
  }
});

test('noise formulas: precharge is 4kT per farad of CDAC plus the halving switches; cell kT/C is 2kT CM per channel', async () => {
  const { chargeLines } = await import('../src/workbench/budget.js');
  const c = design(createValues(), ui);
  const kT = 1.381e-23 * c.P.temperature;
  const lines = chargeLines(c.P, c.d, { arrayGain: true });
  const pre = lines.find((l) => l.id === 'pre').sigma;
  const halves = c.d.steps.filter((x) => x.kind === 'half').length;
  assert.ok(Math.abs(pre ** 2 - (4 * kT * c.d.cdac + halves * 2 * kT * c.P.cu)) / pre ** 2 < 1e-9);
  const samp = lines.find((l) => l.id === 'samp').sigma;
  assert.ok(Math.abs(samp ** 2 - c.P.channels * 2 * kT * c.d.cm) / samp ** 2 < 1e-9);
});

test('IQ demodulator: SNR gain after the low-pass matches 1 / (2 Σh²) for white noise', async () => {
  const { runIq } = await import('../src/workbench/iq.js');
  const r = runIq({ fs: 40e6, f0: 10e6, ftest: 11.2731e6, K: 63, fc: 3e6, D: 4, codes: 1024, noiseLsb: 3, ampDbfs: -1 });
  const gain = r.stages[2].snr - r.stages[0].snr;
  assert.ok(Math.abs(gain - r.gainTheory) < 0.6, `${gain} vs ${r.gainTheory}`);
  assert.ok(Math.abs(r.stages[3].snr - r.stages[2].snr) < 0.5, 'decimation keeps the SNR');
});

test('every formula renders for the default design, with no NaN', async () => {
  const { FORMULAS, formulaHtml } = await import('../src/workbench/formulas.js');
  const c = design(createValues(), ui);
  for (const id of Object.keys(FORMULAS)) {
    if (id === 'b-quant') continue; // only shown when the residual lines are joined
    const h = formulaHtml(id, c);
    assert.ok(h, id);
    assert.ok(!/NaN|undefined/.test(h), id);
  }
  for (const l of c.budget.lines) assert.ok(formulaHtml({ sar: 'b-sar', round: 'b-round', lut: 'b-lut', comp: 'b-comp', tint: 'b-tint', samp: 'b-samp', pre: 'b-pre', jit: 'b-jit' }[l.id], c), l.id);
});

test('Item 1, charge balance (Chen eq. 3, Rabuske alpha): algebra, Chen numbers, and the defaults', async () => {
  const { chargeBalance } = await import('../src/zaan/model/cdac.js');
  // Chen 2018: N = 9, V in,max = 0.8 V, C M = 133 fF, C DAC about 1.5 pF -> alpha 0.399, V REF about 160 mV
  const alphaChen = (9 * 133e-15) / (2 * 1.5e-12);
  const chen = chargeBalance({ channels: 9, fullScale: 0.8, bits: 10, cm: 133e-15, alpha: alphaChen, lsbPerUnit: 8 });
  assert.ok(Math.abs(alphaChen - 0.399) < 1e-3);
  assert.ok(Math.abs(chen.vref - 0.1596) < 1e-4, 'V REF 159.6 mV, paper: approximately 160 mV');
  assert.ok(Math.abs(chen.cdac - 1.5e-12) < 1e-18);
  assert.ok(Math.abs(9 * 0.8 * 133e-15 - 4 * chen.vref * chen.cdac) < 1e-24, 'eq. 3 holds');
  // defaults: C M 112 fF and alpha 0.40 give the earlier working figures
  const c = design(createValues(), ui);
  assert.ok(Math.abs(c.P.vref - 0.2) < 1e-12);
  assert.ok(Math.abs(c.P.cu - 35e-15) < 1e-21);
  assert.ok(Math.abs(c.d.cm - 112e-15) < 1e-21, 'the model returns the C M that was put in');
  assert.ok(Math.abs(c.d.qLsb - 1.75e-15) < 1e-21);
  assert.ok(Math.abs(c.d.qFs - 16 * 112e-15 * 1) < 1e-21, 'Q FS = N C M V in,max, as Q+ - Q-');
});

test('Item 1: eq. 3 in the charge model. A binary array spans 2^B - 2 LSB; redundant weights span 2 sum(w)', () => {
  const c = design(createValues(), ui);
  const { P, d, dBin } = c;
  assert.equal(dBin.units, 67, 'binary array: 67 physical units, as in Chen 2018');
  assert.ok(Math.abs(4 * P.vref * dBin.cdacEff - d.qFs * (1024 - 2) / 1024) < 1e-21);
  assert.ok(Math.abs(4 * P.vref * d.cdacEff - d.qFs * (2 * d.sumW) / 1024) < 1e-21, '4 V REF C DAC = Q FS x 2 sum(w) / 2^B');
  assert.ok(Math.abs(d.alpha - (2 * P.vref / P.fullScale) * (1024 / (2 * d.sumW))) < 1e-12);
  // Rabuske eq. 5 for one LSB and eq. 7: the node grows by 2 C DAC, so phi_MSB = V os / (alpha V LSB)
  const lsbV = P.fullScale / 1024;
  const phiModel = (P.vosCal * (dBin.cNode[dBin.decisions - 1] - dBin.cNode[0])) / dBin.qLsb;
  assert.ok(Math.abs(phiModel - P.vosCal / (P.alphaIn * lsbV)) / phiModel < 0.06, 'within the 3 empty halving capacitors');
});

test('audit fixes: tolerance and last-decision weight follow the last step; overrange is reported', async () => {
  const { tolerances, coverage } = await import('../src/zaan/model/steps.js');
  const { designWeights } = await import('../src/zaan/model/chargeSar.js');
  assert.deepEqual(tolerances([2, 1, 0.5, 0.5]), [0.5, 0.5, 0.5, 0, 0]);
  assert.deepEqual(tolerances([2, 1, 1]), [1, 1, 0, 0]);
  assert.equal(designWeights({ codes: 1024, weights: [2, 1, 0.5, 0.5] }).w[4], 0.25);
  const cov = coverage([256, 136, 72, 40, 24, 16, 8, 4, 2, 1, 1], 10);
  assert.ok(cov.ok && Math.abs(cov.overrange - (561 / 512 - 1)) < 1e-12);
});

test('every value has a status S, D, A or U', () => {
  for (const v of createValues()) assert.ok(['S', 'D', 'A', 'U'].includes(v.status), v.id);
});

test('residual split: more combiner output bits remove most of the rounding line; an exact LUT has no weight error', () => {
  const v = createValues();
  const a = design(v, ui);
  assert.ok(a.res.lut < 1e-6);
  v.find((x) => x.id === 'outBits').value = 12;
  const b = design(v, ui);
  assert.ok(b.res.round < a.res.round / 2);
  assert.ok(b.budget.enob > a.budget.enob + 0.2);
});
