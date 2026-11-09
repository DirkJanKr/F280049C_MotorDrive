// Everything the pages show, computed once from the current values.
// The physics comes from src/zaan/model; nothing is re-implemented here.

import { designCdac, binaryMatchingCu } from '../zaan/model/cdac.js';
import { receiveDelays, cellsNeeded, worstPhaseError, quantise } from '../zaan/model/beamformer.js';
import { quantNoise } from '../zaan/model/noise.js';
import { chargeBudget, toleranceNeeds } from './budget.js';
import { runChecks } from './checks.js';
import { comparatorTau, conversionTimes, settlingTimes } from '../zaan/model/timing.js';
import { drawChip, convert, combine, designWeights } from '../zaan/model/chargeSar.js';
import { rampLinearity } from '../zaan/model/analysis.js';
import { testChip } from '../zaan/model/testbench.js';
import { buildSteps } from '../zaan/model/steps.js';
import { createRng } from '../model/rng.js';
import { stepsFor } from './weights.js';

export const CHIP = { w: 3.2e-3, h: 5e-3 };

export function siOf(values, id) {
  const x = values.find((q) => q.id === id);
  if (!x) return null;
  if (x.kind === 'choice') return x.value;
  return x.value === null || x.value === '' || !Number.isFinite(Number(x.value)) ? null : Number(x.value) * x.si;
}

export function modelParams(values) {
  const g = (id) => siOf(values, id);
  const pair = g('pairSigma');
  return {
    fs: g('fs'), f0: g('f0'), fbw: g('fbw'), fullScale: g('fullScale'), bits: g('bits'), outBits: g('bits'), enobAim: g('enobAim'), rawDecisions: g('rawDecisions'),
    channels: g('channels'), pitch: g('pitch'), steer: g('steer'), focus: g('rxFocus') ?? Infinity, delayStep: g('delayStep'), c: g('c'), memCells: g('memCells'),
    vref: g('vref'), cu: g('cu'), density: g('density'), aC: ((pair / Math.SQRT2) * Math.sqrt(35)) * 100, routing: g('routing'),
    radix: g('radix'), topUnits: g('topUnits'), lsbPerUnit: g('lsbPerUnit'), halvings: g('halvings'), halvingOn: g('halvingOn'),
    vos: g('vos'), vosCal: g('vosCal'), compNoise: g('compNoise'), ibias: g('ibias'), gmId: g('gmId'), cload: g('cload'), vfinal: g('vfinal'),
    iqTaps: g('iqTaps'), iqDecim: g('iqDecim'), iqCut: g('iqCut'), iqTest: g('iqTest'), tSample: g('tSample'), tauDac: g('tauDac'), tLogic: g('tLogic'), temperature: g('temperature'), jitter: g('jitter'), chips: g('chips'), seed: g('seed'),
  };
}

const RES_CHIPS = 4;

/** DNL and INL from a ramp of 16 samples per code without comparator noise (offset included). */
function linearity(chip, d, P, cal) {
  const dec = [];
  for (let j = 0; j < d.codes * 16; j++) dec.push(convert(chip, d, (j + 0.5) / 16 - d.codes / 2, { vos: P.vosCal }));
  return { raw: rampLinearity(dec.map((x) => combine(x, designWeights(d), d.codes)), d.codes), cal: rampLinearity(dec.map((x) => combine(x, cal, d.codes)), d.codes) };
}

const cache = new Map();
function memo(key, fn) {
  if (cache.has(key)) return cache.get(key);
  const v = fn();
  if (cache.size > 40) cache.clear();
  cache.set(key, v);
  return v;
}

/** Steps of the design, or the generated default when the typed list is invalid. */
export function design(values, ui) {
  const P = modelParams(values);
  const s = stepsFor(P, ui);
  const steps = s.steps || buildSteps({ topUnits: P.topUnits, radix: P.radix, halvings: P.halvings, halvingOn: true });
  const tw = 1 / P.fs;
  const plane = receiveDelays({ N: P.channels, pitch: P.pitch, theta: Math.abs(P.steer), F: Infinity, c: P.c });
  const tauMax = Math.max(...plane.tau);
  const need = cellsNeeded(tauMax, P.delayStep, tw);
  const d = designCdac(P, P.memCells, steps);
  const delays = receiveDelays({ N: P.channels, pitch: P.pitch, theta: P.steer, F: P.focus, c: P.c });
  const qd = quantise(delays.tau, P.delayStep);
  const halfSteps = qd.map((x) => Math.round(x / (tw / 2)) % 2);
  // one simulated chip: calibration and the error left after it
  const key = JSON.stringify([d.weights, steps.map((x) => x.kind), P.cu, P.aC, P.seed, P.vosCal, P.vref, P.bits, P.fullScale, P.compNoise]);
  const vrms = P.fullScale / 2 / Math.SQRT2;
  const q = quantNoise(P);
  // rms error of a sine at -0.5 dBFS from its SNDR, in volts at the input
  const errV = (sndr) => (vrms * 10 ** (-0.5 / 20)) / 10 ** (sndr / 20);
  const sim = memo(key, () => {
    const rng = createRng(P.seed);
    const chip = drawChip(d, P, rng);
    const r = testChip(chip, d, P, rng, { samplesPerCode: 2 });
    const r0 = testChip(chip, d, { ...P, compNoise: 0 }, createRng(P.seed + 9), { samplesPerCode: 2 });
    // static linearity of this chip: dense ramp, no comparator noise, so the histogram itself does not scatter
    const lin = linearity(chip, d, P, r.cal);
    // calibration residual averaged over several chips, so one lucky or unlucky chip does not set the budget
    const res = [];
    for (let k = 0; k < RES_CHIPS; k++) {
      const rk = createRng(P.seed + 101 + k);
      const ck = k === 0 ? chip : drawChip(d, P, rk);
      const tk = k === 0 ? r0 : testChip(ck, d, { ...P, compNoise: 0 }, rk, { samplesPerCode: 1 });
      res.push({ enob: tk.sCal.enob, v2: Math.max(errV(tk.sCal.sndr) ** 2 - q ** 2, 0) });
    }
    const compSimV = Math.sqrt(Math.max(errV(r.sCal.sndr) ** 2 - errV(r0.sCal.sndr) ** 2, 0));
    return { chip, cal: r.cal, sRaw: r.sRaw, sCal: r.sCal, linRaw: lin.raw, linCal: lin.cal, sCal0: r0.sCal, res, compSimV };
  });
  const residualV = Math.sqrt(sim.res.reduce((a, x) => a + x.v2, 0) / sim.res.length);
  const budget = chargeBudget(P, d, { arrayGain: ui.arrayGain !== false, residualQ: residualV * d.cNode[0], allocation: ui.alloc || {} });
  const enob = { enob: budget.enob, sndr: budget.sndr };
  const sigmaU = P.aC / 100 / Math.sqrt(P.cu / 1e-15);
  const tolNeed = toleranceNeeds(P, d, sigmaU);
  const timing = memo(key + JSON.stringify([P.tSample, P.tauDac, P.tLogic, P.ibias, P.gmId, P.cload, P.vfinal, P.fs]), () => {
    const rng = createRng(P.seed + 1);
    const traces = [];
    for (let k = 0; k < 300; k++) {
      const x = (d.codes / 2) * 0.95 * Math.sin((2 * Math.PI * 37 * k) / 300) + (rng.uniform() - 0.5);
      const r = convert(sim.chip, d, x, { vos: P.vosCal, trace: true });
      traces.push(r.steps.slice(0, d.decisions).map((st) => st.v + P.vosCal));
    }
    return conversionTimes(P, d, traces);
  });
  const memArea = (d.memCaps * d.cm * P.routing) / P.density;
  const cdacArea = (d.cdac * P.routing) / P.density;
  const smallest = Math.min(...steps.map((st) => (st.kind === 'cap' || st.kind === 'small' ? st.units * P.cu : P.cu)));
  const ctx = {
    P, steps, stepsError: s.error, d, tw, tauMax, need, delays, qd, halfSteps, sim, budget, enob, timing, vrms, tolNeed,
    tauC: comparatorTau(P), settle: settlingTimes(d, P.tauDac), phaseErr: worstPhaseError(P.f0, P.delayStep),
    memArea, cdacArea, areaTotal: memArea + cdacArea, smallest, binCu: binaryMatchingCu(P).cu,
    sigmaU, lambda: P.c / P.f0, ui,
  };
  ctx.checks = runChecks(ctx);
  return ctx;
}
