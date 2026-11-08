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

test('optimizer: the best candidate passes the tolerance and beats or equals the default ENOB', async () => {
  const { search, best } = await import('../src/workbench/optimizer.js');
  const c = design(createValues(), ui);
  const all = search(c.P, c.P.memCells, { sigmaU: c.sigmaU, arrayGain: true, residualLsb: 0 });
  const top = best(all, 'enob', c.P.enobAim)[0];
  assert.ok(top.tolOk && top.cover);
  const cur = all.find((x) => x.radix === 1.9 && x.topUnits === 32 && x.halvings === 3);
  assert.ok(top.enob >= cur.enob - 1e-12);
});
