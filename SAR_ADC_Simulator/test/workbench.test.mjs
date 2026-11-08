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
