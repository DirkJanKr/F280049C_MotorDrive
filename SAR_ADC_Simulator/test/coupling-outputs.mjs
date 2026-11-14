// The top-level outputs of design() that the coupling test watches.
// Used by test/coupling.test.mjs and to write the baseline snapshot.

import { timingCase } from '../src/zaan/model/timingBudget.js';

/** The case the summary bar shows (the same as mainCase in pages/timing.js), for a given switch resistance. */
export function timingMain(ctx, ron = ctx.P.ron || 0) {
  return timingCase(ctx.d, ctx.P, { ron, scheme: 'pingpong', extraHalf: false, offsetCmp: false, mode: ctx.P.swMode });
}

/** The power estimate of pages/power.js, written out again because the page computes it inside update(). */
export function powerOf(ctx, vdd = 1.8) {
  const { P, d } = ctx;
  const chen = { p: 1.58e-3, fs: 30e6, cycles: 11, vdd: 1.8, qref: 1.5e-12 * 0.16 };
  const scale = (P.fs / chen.fs) * ((d.decisions + 1) / chen.cycles) * (vdd / chen.vdd) ** 2;
  const pLogic = chen.p * scale;
  const pRef = vdd * d.cdacEff * P.vref * P.fs;
  const pRefChen = chen.vdd * chen.qref * chen.fs;
  return pLogic + pRef - pRefChen * scale;
}

/** A flat list of named numbers taken from the context. */
export function outputs(ctx) {
  const { P, d, budget } = ctx;
  const out = {
    'P.vref': P.vref,
    'P.cu': P.cu,
    'P.aC': P.aC,
    'P.cdacBalance': P.cdacBalance,
    'd.cdac': d.cdac,
    'd.cdacEff': d.cdacEff,
    'd.cm': d.cm,
    'd.qLsb': d.qLsb,
    'd.qFs': d.qFs,
    'd.cNode first': d.cNode[0],
    'd.cNode last': d.cNode[d.cNode.length - 1],
    'd.decisions': d.decisions,
    'd.units': d.units,
    'd.alpha': d.alpha,
    'budget.enob': budget.enob,
    'budget.total': budget.total,
    'budget.allowed': budget.allowed,
    areaTotal: ctx.areaTotal,
    'need.m': ctx.need.m,
    tauMax: ctx.tauMax,
    tw: ctx.tw,
    phaseErr: ctx.phaseErr,
    sigmaU: ctx.sigmaU,
    binCu: ctx.binCu,
    smallest: ctx.smallest,
    tauC: ctx.tauC,
    'timing.median': ctx.timing.median,
    'tolNeed first mismatch': ctx.tolNeed[0].mismatch,
    'tolNeed first offset': ctx.tolNeed[0].offset,
    'tolNeed first offsetRaw': ctx.tolNeed[0].offsetRaw,
    'tolNeed first noise': ctx.tolNeed[0].noise,
    'delays last': ctx.delays.tau[ctx.delays.tau.length - 1],
    'sim.sCal': ctx.sim.sCal.enob ?? ctx.sim.sCal,
    'timing budget perCycle': timingMain(ctx).perCycle,
    'timing budget perCycle at 500 ohm': timingMain(ctx, 500).perCycle,
    'timing budget read at 500 ohm': timingMain(ctx, 500).parts[0].t,
    power: powerOf(ctx),
  };
  for (const l of budget.lines) out[`budget line ${l.id}`] = l.sigma;
  for (const l of budget.lines) out[`budget line ${l.id} lsb`] = l.lsb;
  return out;
}
