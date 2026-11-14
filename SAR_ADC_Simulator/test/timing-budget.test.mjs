// Timing budget: settling of the charge-sharing steps and the time left per decision.

import test from 'node:test';
import assert from 'node:assert/strict';
import { createValues } from '../src/workbench/values.js';
import { design } from '../src/workbench/design.js';
import { stepCaps, stepSettling, timingCase, timingCases, PRIOR, cycleOf } from '../src/zaan/model/timingBudget.js';
import { ngspiceVersion, runTransient } from '../spice/ngspice.mjs';
import { settlingRun } from '../spice/settling.mjs';

const c = design(createValues(), {});
const close = (a, b, rel = 1e-9) => assert.ok(Math.abs(a - b) <= rel * Math.abs(b), `${a} against ${b}`);

test('time constant of a step is 2 R on times the series of C j and the node capacitance', () => {
  const caps = stepCaps(c.d);
  const s = stepSettling(caps, 500)[0];
  // default array: first step 32 units of 35 fF = 1.12 pF, C d = 16 x 112 fF / 2 = 896 fF
  close(s.c, 1.12e-12, 1e-6);
  close(s.cd, 0.896e-12, 1e-6);
  close(s.tau, (2 * 500 * 1.12e-12 * 0.896e-12) / (1.12e-12 + 0.896e-12));
  // tau scales with the switch resistance
  close(stepSettling(caps, 1000)[0].tau, 2 * s.tau);
});

test('step 1 is a single time constant: the network gives tau ln(A / tolerance)', () => {
  const st = stepSettling(stepCaps(c.d), 500)[0];
  // hand value: w = 256, next tolerance 33, worst residue 256 + 33: A = 256 + 289 x 1.25 = 617.25
  close(st.tRed, st.tau * Math.log(617.25 / 33), 0.02);
  close(st.tBin, st.tau * Math.log((256 + 256.5 * 1.25) / 0.5), 0.02);
});

test('redundancy needs less settling time than half an LSB, on every step', () => {
  for (const s of stepSettling(stepCaps(c.d), 500)) assert.ok(s.tRed <= s.tBin + 1e-18);
});

test('with equal switches a small step settles with the slow time constant of the large capacitors', () => {
  const caps = stepCaps(c.d);
  const same = stepSettling(caps, 500, 'same');
  const unit = stepSettling(caps, 500, 'unit');
  // step 6 (16 LSB): its own branch is fast, the network is several times slower
  assert.ok(same[5].tBin > 3 * same[5].tau * Math.log(same[5].w / 0.5));
  // one switch pair per unit capacitor: large capacitors get small switches' resistance in parallel, so it settles faster
  assert.ok(unit[5].tBin < same[5].tBin / 3);
  // settling time is proportional to the switch resistance
  close(stepSettling(caps, 1000, 'same')[5].tRed, 2 * same[5].tRed);
});

test('with ideal switches the whole period is left: 25 ns over the comparison cycles', () => {
  const k = timingCase(c.d, c.P, { ron: 0, scheme: 'pingpong', extraHalf: false, offsetCmp: false });
  assert.equal(k.decisions, c.d.decisions);
  close(k.perCycle, 25e-9 / c.d.decisions);
  const k2 = timingCase(c.d, c.P, { ron: 0, scheme: 'reservoir', extraHalf: true, offsetCmp: true });
  assert.equal(k2.cycles, c.d.decisions + 2);
  close(k2.perCycle, 25e-9 / (c.d.decisions + 2));
});

test('the intervals and the time left add up to the period, for every case', () => {
  const all = timingCases(c.d, c.P, 500);
  assert.equal(all.length, 8);
  for (const k of all) {
    close(k.fixed + k.perCycle * k.cycles, k.period);
    for (const p of k.parts) assert.ok(p.status && p.source, `${p.id} has a status and a source`);
  }
  // the reservoir case has the CDAC reset inside the period, ping-pong has not
  assert.ok(all.find((k) => k.scheme === 'reservoir').parts.some((p) => p.id === 'rst'));
  assert.ok(!all.find((k) => k.scheme === 'pingpong').parts.some((p) => p.id === 'rst'));
});

test('prior art: Chen at most 3.03 ns and Guo at most 2.27 ns per comparison cycle', () => {
  close(cycleOf(PRIOR.chen), 33.333e-9 / 11, 1e-4);
  close(cycleOf(PRIOR.guo), 25e-9 / 11);
});

test('verdict follows the time left against the cycle Guo measured', () => {
  const k = timingCase(c.d, c.P, { ron: 0, scheme: 'pingpong', extraHalf: false, offsetCmp: false });
  assert.equal(k.verdict, k.perCycle >= 25e-9 / 11 ? 'fits' : k.perCycle >= (25e-9 / 11) * 0.75 ? 'marginal' : 'not shown');
  assert.equal(timingCase(c.d, c.P, { ron: 5000, scheme: 'reservoir', extraHalf: true, offsetCmp: true }).verdict, 'not shown');
});

test('ngspice: the settling of every step matches the RC network of the model', { skip: !ngspiceVersion() && 'ngspice not installed' }, () => {
  // unit switches at 8 kOhm: with smaller values the 10 ps edge of the ideal switch is no longer short against the settling
  for (const [mode, ron] of [['same', 500], ['unit', 8000]]) {
    for (const s of settlingRun(c.d, c.P, ron, runTransient, mode)) assert.ok(Math.abs(s.tSpice / s.tModel - 1) < 0.05, `${mode} step ${s.j + 1}: ngspice ${s.tSpice}, model ${s.tModel}`);
  }
});

test('the settling data shown on the Timing page records ngspice and the sweep', async () => {
  const { readFileSync } = await import('node:fs');
  const data = JSON.parse(readFileSync(new URL('../src/workbench/data/spice-settling.json', import.meta.url)));
  assert.ok(data.ngspice);
  assert.equal(data.runs.length, 5);
  for (const run of data.runs) assert.ok(run.steps.every((s) => Math.abs(s.tSpice / s.tModel - 1) < 0.05));
});
