// Coupling of the tunable values: every value in values.js is changed by a sensible amount,
// design() is run again, and the outputs that must follow are checked.
// Links that are broken and cannot be fixed in values.js, design.js or designSide.js are marked todo.
// The audit that goes with this test is docs/audit/coupling-audit.md.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createValues } from '../src/workbench/values.js';
import { design } from '../src/workbench/design.js';
import { cellsNeeded } from '../src/zaan/model/beamformer.js';
import { outputs, timingMain, powerOf } from './coupling-outputs.mjs';

const ui = { weightMode: 'generator', customWeights: '' };
const BASE = JSON.parse(readFileSync(new URL('./fixtures/coupling-baseline.json', import.meta.url), 'utf8'));

/** Values with some of them changed: { id: value in the unit of values.js }. */
function valuesWith(changes = {}) {
  const v = createValues();
  for (const [id, x] of Object.entries(changes)) {
    const q = v.find((y) => y.id === id);
    assert.ok(q, `no value ${id}`);
    q.value = x;
  }
  return v;
}
const run = (changes) => design(valuesWith(changes), ui);
const line = (ctx, id) => ctx.budget.lines.find((l) => l.id === id);
const close = (a, b, rel = 1e-9) => Math.abs(a - b) <= rel * Math.max(Math.abs(a), Math.abs(b), 1e-300);
const differs = (a, b) => !close(a, b, 1e-12);

/** A sensible change of one value: one tenth up (or down at the top of the range), a set value for an empty one, the other option of a choice. */
function nudge(v) {
  if (v.kind === 'choice') return v.options.find((o) => o !== v.value);
  if (v.value === null) return (v.min + v.max) / 2;
  const s = v.step * Math.max(1, Math.round((v.value * 0.1) / v.step));
  return v.value + s <= v.max ? v.value + s : v.value - s;
}

// Values that change nothing in the context because only one page reads them; checked by grep in the audit.
const PAGE_ONLY = {
  iqTaps: 'IQ page', iqDecim: 'IQ page and System page', iqCut: 'IQ page', iqTest: 'IQ page', chips: 'Monte Carlo page',
};

test('snapshot: with untouched values the key outputs are the ones taken before the audit edits', () => {
  const now = outputs(run());
  for (const [k, v] of Object.entries(BASE)) assert.ok(close(now[k], v, 1e-12), `${k}: ${now[k]} against ${v}`);
});

test('every value changes something in the context, or is read by one named page', () => {
  const base = run();
  const b = outputs(base);
  for (const v of createValues()) {
    const ctx = run({ [v.id]: nudge(v) });
    const o = outputs(ctx);
    const moved = Object.keys(b).filter((k) => differs(o[k], b[k]));
    const checks = JSON.stringify(ctx.checks) !== JSON.stringify(base.checks);
    if (PAGE_ONLY[v.id]) continue;
    assert.ok(moved.length > 0 || checks, `${v.id} changes nothing in the context`);
  }
});

test('every value reaches the model parameters P', () => {
  const P = run().P;
  const alias = { cm: 'cmIn', alpha: 'alphaIn', rxFocus: 'focus', swSize: 'swMode', pairSigma: 'aC' };
  for (const v of createValues()) assert.ok((alias[v.id] || v.id) in P, `${v.id} is not in P`);
});

test('C M follows into Q FS, Q LSB, C DAC, C u, the kT/C of the cells and the area', () => {
  const a = run();
  const b = run({ cm: 224 });
  assert.ok(close(b.d.qFs, 2 * a.d.qFs));
  assert.ok(close(b.d.qLsb, 2 * a.d.qLsb));
  assert.ok(close(b.P.cdacBalance, 2 * a.P.cdacBalance));
  assert.ok(close(b.P.cu, 2 * a.P.cu));
  assert.ok(close(line(b, 'samp').sigma, Math.SQRT2 * line(a, 'samp').sigma));
  assert.ok(b.areaTotal > a.areaTotal);
});

test('channels N follow into Q FS, Q LSB, C DAC, C u, the kT/C of the cells and the area', () => {
  const a = run();
  const b = run({ channels: 32 });
  assert.ok(close(b.d.qFs, 2 * a.d.qFs));
  assert.ok(close(b.d.qLsb, 2 * a.d.qLsb));
  assert.ok(close(b.P.cdacBalance, 2 * a.P.cdacBalance));
  assert.ok(close(b.P.cu, 2 * a.P.cu));
  assert.ok(close(line(b, 'samp').sigma, Math.SQRT2 * line(a, 'samp').sigma));
  assert.ok(b.areaTotal > a.areaTotal);
  assert.ok(b.tauMax > a.tauMax, 'a wider tile has a longer delay');
});

test('alpha sets V REF = alpha V in,max / 2 and C DAC = N C M / (2 alpha), and moves comparator noise and offset in LSB', () => {
  const a = run();
  const b = run({ alpha: 0.8 });
  assert.ok(close(b.P.vref, (0.8 * 1) / 2));
  assert.ok(close(b.P.cdacBalance, (16 * 112e-15) / (2 * 0.8)));
  assert.ok(close(b.d.qLsb, a.d.qLsb), 'Q LSB does not depend on alpha');
  assert.ok(line(b, 'comp').lsb < line(a, 'comp').lsb, 'a smaller CDAC is a smaller node');
  assert.ok(b.tolNeed[0].offset < a.tolNeed[0].offset);
});

test('the full scale moves V REF and Q LSB', () => {
  const a = run();
  const b = run({ fullScale: 2 });
  assert.ok(close(b.P.vref, 2 * a.P.vref));
  assert.ok(close(b.d.qLsb, 2 * a.d.qLsb));
  assert.ok(close(b.P.cu, a.P.cu), 'C u = n u N C M / (2^B alpha) does not depend on the full scale');
});

test('bits move Q LSB, C u and the binary reference array', () => {
  const a = run();
  const b = run({ bits: 11 });
  assert.ok(close(b.d.qLsb, a.d.qLsb / 2));
  assert.ok(close(b.P.cu, a.P.cu / 2));
  assert.ok(b.dBin.units > a.dBin.units);
  assert.ok(close(b.d.qFs, a.d.qFs), 'Q FS does not depend on the bits');
});

test('the sample rate moves the period, the timing budget, the cells needed, the T int jitter and the power', () => {
  const a = run();
  const b = run({ fs: 20 });
  assert.ok(close(b.tw, 2 * a.tw));
  assert.ok(timingMain(b).perCycle > timingMain(a).perCycle);
  assert.ok(timingMain(b, 500).perCycle > timingMain(a, 500).perCycle);
  assert.ok(b.need.m < a.need.m);
  assert.ok(close(line(b, 'tint').sigma, line(a, 'tint').sigma / 2), 'T int is a fixed share of the period');
  assert.ok(close(line(b, 'jit').sigma, line(a, 'jit').sigma), 'sampling jitter depends on the signal, not on fs');
  assert.ok(powerOf(b) < powerOf(a));
  assert.ok(b.timing.late <= a.timing.late);
});

test('pair mismatch moves every matching result', () => {
  const a = run({ slotCal: 'not calibrated' });
  const b = run({ slotCal: 'not calibrated', pairSigma: 2.386 });
  assert.ok(close(b.P.aC, 2 * a.P.aC));
  assert.ok(close(b.sigmaU, 2 * a.sigmaU));
  assert.ok(close(b.binCu, 4 * a.binCu));
  assert.ok(close(b.tolNeed[0].mismatch, 2 * a.tolNeed[0].mismatch));
  assert.ok(close(line(b, 'slot').sigma, 2 * line(a, 'slot').sigma));
  assert.notEqual(b.sim.sCal.enob, a.sim.sCal.enob);
});

test('C par moves the node capacitance and the comparator noise in LSB', () => {
  const a = run();
  const b = run({ cpar: 1000 });
  assert.ok(close(b.d.cNode[0], a.d.cNode[0] + 1e-12));
  assert.ok(close(b.d.cNode[b.d.decisions - 1], a.d.cNode[a.d.decisions - 1] + 1e-12));
  assert.ok(line(b, 'comp').lsb > line(a, 'comp').lsb);
  assert.ok(close(b.tolNeed[0].offset, a.tolNeed[0].offset), 'the common part of the node cancels in the offset difference');
  assert.ok(timingMain(b, 500).parts[0].t > 0, 'the read now takes time');
});

test('the simulated chip follows C par and the output bits even after another design was computed', async () => {
  // a second copy of design.js has its own cache, so it computes from nothing
  const fresh = (await import('../src/workbench/design.js?fresh')).design;
  run();
  for (const ch of [{ cpar: 2000 }, { outBits: 12 }]) {
    const warm = run(ch);
    const cold = fresh(valuesWith(ch), ui);
    assert.equal(warm.sim.sCal.enob, cold.sim.sCal.enob, JSON.stringify(ch));
    assert.equal(warm.timing.median, cold.timing.median, JSON.stringify(ch));
    assert.equal(warm.budget.enob, cold.budget.enob, JSON.stringify(ch));
  }
});

test('delay step, pitch, steering angle and speed of sound move the delays and the cells needed', () => {
  const a = run();
  assert.ok(run({ pitch: 300 }).need.m > a.need.m);
  assert.ok(run({ steer: 25 }).need.m > a.need.m);
  assert.ok(run({ c: 1450 }).tauMax > a.tauMax);
  const s = run({ delayStep: 25 });
  assert.ok(close(s.phaseErr, 2 * a.phaseErr));
  assert.notDeepEqual(s.qd, a.qd);
  // the cells follow the step only through rounding: check the rule itself
  assert.equal(cellsNeeded(a.tauMax, 25e-9, a.tw).m, s.need.m);
});

test('f0 moves the phase error, the wavelength and the band-edge jitter', () => {
  const a = run();
  const b = run({ f0: 5 });
  assert.ok(close(b.phaseErr, a.phaseErr / 2));
  assert.ok(close(b.lambda, 2 * a.lambda));
  assert.ok(line(b, 'jit').sigma < line(a, 'jit').sigma);
});

test('comparator noise and offset values move the budget and the offset results', () => {
  const a = run();
  assert.ok(close(line(run({ compNoise: 0.1 }), 'comp').sigma, 2 * line(a, 'comp').sigma));
  assert.ok(close(run({ compNoise: 0.1 }).tolNeed[0].noise, 2 * a.tolNeed[0].noise));
  assert.ok(close(run({ vosCal: 0.3 }).tolNeed[0].offset, 2 * a.tolNeed[0].offset));
  assert.ok(close(run({ vos: 2 }).tolNeed[0].offsetRaw, 2 * a.tolNeed[0].offsetRaw));
});

test('temperature moves the kT/C lines as the square root of T', () => {
  const a = run();
  const b = run({ temperature: 1200 });
  assert.ok(close(line(b, 'samp').sigma, 2 * line(a, 'samp').sigma));
  assert.ok(close(line(b, 'pre').sigma, 2 * line(a, 'pre').sigma));
});

test('memory cells, density and routing move the area', () => {
  const a = run();
  assert.ok(run({ memCells: 44 }).areaTotal > a.areaTotal);
  assert.ok(close(run({ density: 4 }).areaTotal, a.areaTotal / 2));
  assert.ok(close(run({ routing: 3 }).areaTotal, 2 * a.areaTotal));
});

test('switch resistance and switch sizing move the timing budget', () => {
  const a = run();
  assert.ok(timingMain(run({ ron: 1000 })).perCycle < timingMain(a).perCycle);
  const u = run({ swSize: 'one pair per unit capacitor' });
  assert.notEqual(timingMain(u, 500).perCycle, timingMain(a, 500).perCycle);
});

test('raw decisions planned move the decisions check', () => {
  assert.equal(run().checks.find((c) => c.id === 'dec').state, 'ok');
  assert.equal(run({ rawDecisions: 13 }).checks.find((c) => c.id === 'dec').state, 'warn');
});

// Broken links: they hold only after a change outside values.js, design.js and designSide.js.

test('broken: C par lowers the effective alpha (Rabuske 2017, eq. 4.13)', { todo: 'd.alpha in src/zaan/model/cdac.js leaves C par out' }, () => {
  assert.ok(run({ cpar: 1000 }).d.alpha < run().d.alpha);
});

test('broken: a receive focus moves the cells needed', { todo: 'design.js takes tauMax from the plane wave only; changing it would change a formula' }, () => {
  assert.ok(run({ steer: 0, rxFocus: 5 }).need.m > run({ steer: 0 }).need.m);
});

test('broken: capacitor density moves the matching (pair figure is given for 2 fF/µm²)', { todo: 'pairSigma is fixed at 35 fF and 2 fF/µm²; aC should follow from the PDK slope and the density' }, () => {
  assert.notEqual(run({ density: 4 }).sigmaU, run().sigmaU);
});

test('missing: the T int share of the period is a value', { todo: '0.75 is hard coded in budget.js, formulas.js, pages/reference.js and pages/chen.js' }, () => {
  assert.ok('tIntShare' in run().P);
});

test('missing: the supply voltage is a value', { todo: 'pages/power.js reads store.ui.pwVdd with 1.8 V as fallback' }, () => {
  assert.ok('vdd' in run().P);
});

test('missing: the PDK minimum capacitor is a value', { todo: '35e-15 is hard coded in checks.js, pages/balance.js, pages/sar.js and pages/optimizer.js' }, () => {
  assert.ok('cuMin' in run().P);
});

test('missing: the reservoir to CDAC ratio is a value', { todo: 'C RSV = C DAC is hard coded in src/zaan/model/timingBudget.js' }, () => {
  assert.ok('rsvRatio' in run().P);
});
