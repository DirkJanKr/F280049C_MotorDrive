// Tolerance logic: fixed errors use the tolerance, settling may use what they leave, and the
// sum of the steps needs spare reach at the ends of the range.

import test from 'node:test';
import assert from 'node:assert/strict';
import { createValues } from '../src/workbench/values.js';
import { design } from '../src/workbench/design.js';
import { stepCaps, stepSettling, timingCase } from '../src/zaan/model/timingBudget.js';

const CAND = { weightMode: 'custom', customWeights: '216, 128, 72, 40, 24, 16, 8, 4, 2, 1, 0.5, 0.5' };
const def = design(createValues(), { weightMode: 'custom', customWeights: '200, 160, 80, 40, 16, 16, 8, 4, 2, 1, 1' });
const cand = design(createValues(), CAND);

test('each decision reports what the fixed errors leave for settling: tolerance − mismatch − offset − margin (MATLAB 7a)', () => {
  for (const r of [...def.tolNeed, ...cand.tolNeed]) {
    assert.ok(Math.abs(r.allow - Math.max(0, r.have - r.mismatch - r.offset - r.margin)) < 1e-12);
  }
});

test('overrange: the default list has spare reach, the candidate with a sum of 512 does not', () => {
  const ok = def.checks.find((k) => k.id === 'over');
  const short = cand.checks.find((k) => k.id === 'over');
  assert.equal(ok.state, 'ok');
  assert.equal(short.state, 'warn');
  // needed spare = shift of the whole result by the calibrated offset + 3 sigma of the sum of the step errors
  const need = cand.overNeed;
  const shift = (cand.P.vosCal * cand.d.cNode[cand.d.decisions - 1]) / cand.d.qLsb;
  assert.ok(Math.abs(need - (shift + cand.tolNeed[0].mismatch + cand.P.gainMargin * 512)) < 1e-9);
  assert.ok(Math.abs(cand.overSpare - 0.5) < 1e-9);
});

test('settling to a smaller allowed error takes longer; without one the old rule (tolerance) holds', () => {
  const caps = stepCaps(def.d);
  const old = stepSettling(caps, 500, 'same');
  const tight = stepSettling(caps, 500, 'same', caps.map(() => 0.2).concat([0.2]));
  assert.ok(tight[5].tRed > old[5].tRed);
  const same = stepSettling(caps, 500, 'same', undefined);
  assert.equal(same[0].tRed, old[0].tRed);
  const a = timingCase(def.d, def.P, { ron: 500, scheme: 'pingpong', extraHalf: false, offsetCmp: false, mode: 'same' });
  const b = timingCase(def.d, def.P, { ron: 500, scheme: 'pingpong', extraHalf: false, offsetCmp: false, mode: 'same', allow: def.tolNeed.map((r) => r.allow) });
  assert.notEqual(a.perCycle, b.perCycle);
});
