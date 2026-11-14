// Numbers fixed after the theory and coupling audits (docs/audit/theory-audit.md, coupling-audit.md).
// Each test states the correct value; docs/audit/fixes-applied.md lists the numbers before and after.

import test from 'node:test';
import assert from 'node:assert/strict';
import { createValues } from '../src/workbench/values.js';
import { design } from '../src/workbench/design.js';
import { referenceCharge, prechargeCharge } from '../src/zaan/model/reference.js';
import { timingCase } from '../src/zaan/model/timingBudget.js';
import { powerEstimate } from '../src/workbench/pages/power.js';
import { beamSteps } from '../src/workbench/pages/beamformer.js';
import { offsetValues } from '../src/workbench/pages/offset.js';

const ui = { weightMode: 'generator', customWeights: '' };
function run(changes = {}) {
  const v = createValues();
  for (const [id, x] of Object.entries(changes)) {
    const q = v.find((y) => y.id === id);
    assert.ok(q, `no value ${id}`);
    q.value = x;
  }
  return design(v, ui);
}
const close = (a, b, rel = 1e-9) => Math.abs(a - b) <= rel * Math.max(Math.abs(a), Math.abs(b), 1e-300);
const line = (ctx, id) => ctx.budget.lines.find((l) => l.id === id);

test('A1: read-slot gain sigma is sigma(C M) / sqrt(2 N), 0.0834 % and 0.302 LSB at full scale', () => {
  const c = run({ slotCal: 'not calibrated' });
  const sigmaCm = c.P.aC / 100 / Math.sqrt(c.d.cm * 1e15);
  const sigmaG = sigmaCm / Math.sqrt(2 * c.P.channels);
  assert.ok(Math.abs(sigmaG * 100 - 0.0834) < 0.0001, `sigma G ${sigmaG * 100} %`);
  assert.ok(close(line(c, 'slot').sigma, (sigmaG * c.d.qFs) / 2 / Math.SQRT2));
  assert.ok(Math.abs(line(c, 'slot').lsb - 0.302) < 0.001, `${line(c, 'slot').lsb} LSB`);
  assert.equal(line(run(), 'slot').sigma, 0, 'calibrated: zero');
});

test('A2: reference charge is V REF times the precharged capacitance: 70 units = 0.490 pC; binary 64 units', () => {
  const c = run();
  // 69 whole units plus the one halving source unit; the halving capacitors start empty
  assert.ok(close(referenceCharge(c.P, c.d), 70 * 35e-15 * 0.2, 1e-12), `${referenceCharge(c.P, c.d)}`);
  assert.ok(close(referenceCharge(c.P, c.dBin), 64 * 35e-15 * 0.2, 1e-12), `${referenceCharge(c.P, c.dBin)}`);
  assert.ok(close(prechargeCharge(c.P, c.d).q, referenceCharge(c.P, c.d)), 'the old Zaan chapter uses the same charge');
  assert.ok(close(prechargeCharge(c.P, c.d).current, referenceCharge(c.P, c.d) * c.P.fs));
  assert.ok(close(powerEstimate(c.P, c.d).qref, referenceCharge(c.P, c.d)), 'the Power page uses the same charge');
  // small capacitors instead of halving: every capacitor is precharged
  const s = run({ halvingOn: 'small capacitors' });
  assert.ok(close(referenceCharge(s.P, s.d), 70 * 35e-15 * 0.2, 1e-12));
});

test('C1: C par lowers the effective alpha, C TH / (2 C DAC + C par); d.alpha keeps its meaning', () => {
  const a = run();
  const b = run({ cpar: 1000 });
  assert.equal(a.d.alphaEff, a.d.alpha, 'equal without C par');
  assert.equal(b.d.alpha, a.d.alpha, 'd.alpha is without C par');
  assert.ok(close(b.d.alphaEff, 1.792e-12 / (2 * 2.45e-12 + 1e-12)), `${b.d.alphaEff}`);
  // the attenuation at the last decision of the model is alpha eff / (1 + alpha eff) for the charge-carrying capacitance
  assert.ok(close(b.d.cTh / (b.d.cTh + 1e-12 + 2 * b.d.cdacEff), b.d.alphaEff / (1 + b.d.alphaEff)));
});

test('C3: matching follows the density; defaults unchanged', () => {
  const a = run();
  assert.ok(close(a.P.aC, (1.193 / Math.SQRT2) * Math.sqrt(35), 1e-15), 'default A C as before');
  const b = run({ density: 4 });
  assert.ok(close(b.sigmaU, Math.SQRT2 * a.sigmaU), 'twice the density: half the area, sqrt 2 more mismatch');
});

test('T int share of the period moves the T int jitter line', () => {
  const a = run();
  assert.equal(a.P.tIntShare, 0.75);
  assert.ok(close(line(run({ tIntShare: 0.5 }), 'tint').sigma, 1.5 * line(a, 'tint').sigma));
});

test('supply voltage moves the power estimate; 1.8 V gives the old number', () => {
  const a = run();
  assert.equal(a.P.vdd, 1.8);
  const b = run({ vdd: 1.2 });
  assert.ok(powerEstimate(b.P, b.d).total < powerEstimate(a.P, a.d).total);
});

test('PDK minimum capacitor moves the smallest-capacitor check', () => {
  assert.equal(run().P.cuMin, 35e-15);
  assert.equal(run().checks.find((k) => k.id === 'small').state, 'ok');
  assert.equal(run({ cuMin: 40 }).checks.find((k) => k.id === 'small').state, 'warn');
});

test('chip width and height set the chip area', () => {
  const a = run();
  assert.ok(close(a.chipArea, 3.2e-3 * 5e-3));
  assert.ok(close(run({ chipW: 6.4 }).chipArea, 2 * a.chipArea));
});

test('reservoir to CDAC ratio moves the largest reservoir switch resistance', () => {
  const a = run();
  const b = run({ rsvRatio: 3 });
  const r = (c) => timingCase(c.d, c.P, { ron: 500, scheme: 'reservoir', extraHalf: false, offsetCmp: false, mode: 'same' }).rRsvMax;
  // series C RSV C DAC / (C RSV + C DAC): 1/2 C DAC at ratio 1, 3/4 C DAC at ratio 3
  assert.ok(close(r(b), (r(a) * 2) / 3));
});

test('beam pattern compares the set delay step with one write slot', () => {
  const a = run();
  const same = (x, y) => x.length === y.length && x.every((v, i) => close(v, y[i]));
  assert.ok(same(beamSteps(a).map((s) => s.step), [12.5e-9, 25e-9]));
  assert.ok(same(beamSteps(run({ delayStep: 6.25, fs: 20 })).map((s) => s.step), [6.25e-9, 50e-9]));
});

test('offset page starts from the offset values of the design', () => {
  const a = run();
  assert.ok(close(offsetValues(a.P, {}).vos, 1e-3));
  assert.ok(close(offsetValues(a.P, {}).vosCal, 0.15e-3));
  const b = run({ vos: 2.5, vosCal: 0.3 });
  assert.ok(close(offsetValues(b.P, {}).vos, 2.5e-3));
  assert.ok(close(offsetValues(b.P, {}).vosCal, 0.3e-3));
  // a value tried on the page holds until the design value changes
  assert.ok(close(offsetValues(b.P, { osV: 4, osVBase: b.P.vos }).vos, 4e-3));
  assert.ok(close(offsetValues(b.P, { osV: 4, osVBase: 1e-3 }).vos, 2.5e-3));
});
