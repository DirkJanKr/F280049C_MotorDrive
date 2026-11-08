// Integrated workbench: values carry status and source; unknowns stay unknown;
// derived values follow the model and the review numbers.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createValues, STATUS, OPEN_DECISIONS } from '../src/workbench/values.js';
import { derive } from '../src/workbench/derive.js';

test('every value has a status code and a source; "?" values carry no number', () => {
  for (const v of createValues()) {
    assert.ok(v.status in STATUS, v.id);
    assert.ok(typeof v.source === 'string' && v.source.length > 0, v.id);
    if (v.status === '?' && v.kind === 'num') assert.equal(v.value, null, `${v.id} must not be guessed`);
  }
});

test('open decisions point at existing values', () => {
  const ids = new Set(createValues().map((v) => v.id));
  for (const o of OPEN_DECISIONS) assert.ok(ids.has(o.value), o.value);
});

test('derived values: 22 cells, 12 decisions, CDAC 2.56 pF, 12.5 ns step from two clocks', () => {
  const ctx = derive(createValues());
  assert.equal(ctx.D.cellsNeeded.value, 22);
  assert.equal(ctx.D.decisions.value, 12);
  assert.ok(Math.abs(ctx.D.cdac.value - 2.555e-12) < 1e-18);
  assert.ok(ctx.halfSteps.some((h) => h) && ctx.halfSteps.some((h) => !h), 'both CLK and CLK 180° are used');
  for (let n = 0; n < ctx.qd.length; n++) assert.ok(Math.abs(ctx.qd[n] / 12.5e-9 - Math.round(ctx.qd[n] / 12.5e-9)) < 1e-9);
});

test('conflicts include fs = 4 f0, the charge balance and the grating lobe', () => {
  const ids = derive(createValues()).conflicts.map((c) => c.id);
  for (const id of ['fs4f0', 'cmBalance', 'offsetSlides', 'smaxFs', 'grating']) assert.ok(ids.includes(id), id);
});

test('changing Cu changes the derived CDAC and memory cell', () => {
  const v = createValues();
  const a = derive(v);
  v.find((x) => x.id === 'cu').value = 50;
  const b = derive(v);
  assert.ok(b.D.cdac.value > a.D.cdac.value && b.D.cm.value > a.D.cm.value);
});
