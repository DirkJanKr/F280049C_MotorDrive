/**
 * SAR control logic + conversion engine.
 *
 * Combines the physical CDAC (cdac.js), the switching plan of the selected
 * scheme and the comparator into a complete conversion:
 *
 *   1. Sample : top plates forced (switch closed), bottom plates per scheme.
 *               Q_X = sum Ci (Vtop - Vb_i) + Cp Vtop  (+ kT/C noise charge)
 *   2. Hold   : top-plate switch opens -> Q_X is frozen from here on.
 *   3. Preset : optional initial DAC switching (conventional: MSB -> VREF).
 *   4. For k = 0..N-1: compare, store bit, apply the scheme's switching.
 *
 * Top-plate voltages are always obtained from charge conservation
 * Vx = (Q_X + sum Ci Vb_i)/(Ct + Cp); an incremental sum keeps the cost O(1)
 * per switch so the same engine drives single conversions, ramps and FFTs.
 * With `record: true` every intermediate state is captured as a snapshot
 * with full charge bookkeeping (used by the UI and by the validation tests).
 */
import { BOLTZMANN } from './adc.js';
import { TERMINAL_NAMES, forcedTopCharge, plateCharges, predictedTopStep, accumulateSourceCharge } from './cdac.js';
import { createRng } from './rng.js';
import { terminalId } from './cdac.js';

const VREF = 2;
const VCM = 4;

function nodeVoltage(node, vTop, src) {
  return node.top ? vTop[node.a] : src[node.t];
}

export function convert(adc, input, opts = {}) {
  const rng = opts.rng || createRng(1);
  const record = !!opts.record;
  const trackEnergy = opts.trackEnergy ?? record;
  const { arrays, plan, comparator, config, noise, scheme } = adc;
  const N = config.bits;
  const A = arrays.length;
  const { tSample, tBit } = config.timing;

  // ---- 1. sampling --------------------------------------------------------
  const extraNoise = noise.extraRms > 0 ? noise.extraRms * rng.gaussian() : 0;
  const sampledInput = input + extraNoise;
  const src = adc.sourceVoltages(sampledInput);
  const terms = plan.samplingBottoms.map((b) => Int8Array.from(b));
  const vb = terms.map((t) => Float64Array.from(t, (id) => src[id]));
  const vTopForced = plan.samplingTop.map((t) => src[t]);
  const qForced = arrays.map((arr, a) => forcedTopCharge(arr, vTopForced[a], vb[a]));
  const q = Float64Array.from(qForced);
  const kTCcharge = new Float64Array(A);
  if (noise.kTC) {
    for (let a = 0; a < A; a++) {
      kTCcharge[a] = Math.sqrt(BOLTZMANN * noise.temperature * arrays[a].nodeCap) * rng.gaussian();
      q[a] += kTCcharge[a];
    }
  }
  const scv = new Float64Array(A);
  for (let a = 0; a < A; a++) {
    let s = 0;
    for (let i = 0; i < arrays[a].n; i++) s += arrays[a].actual[i] * vb[a][i];
    scv[a] = s;
  }
  const vTop = new Float64Array(A);
  const updateTop = () => {
    for (let a = 0; a < A; a++) vTop[a] = (q[a] + scv[a]) / arrays[a].nodeCap;
  };

  // ---- bookkeeping ----------------------------------------------------------
  const sourceChargeTotal = new Float64Array(5);
  let energyRef = 0;
  let energyVcm = 0;
  const snapshots = record ? [] : null;
  let pending = { changes: [], sourceCharge: new Float64Array(5), deltaVtop: [], predictedDeltaVtop: [], energyRef: 0, energyVcm: 0 };

  function applyChanges(list) {
    const before = trackEnergy ? { vx: Float64Array.from(vTop), vb: vb.map((v) => Float64Array.from(v)) } : null;
    const applied = [];
    for (const { a, i, t } of list) {
      const from = terms[a][i];
      if (from === t) continue;
      const c = arrays[a].actual[i];
      scv[a] += c * (src[t] - src[from]);
      terms[a][i] = t;
      vb[a][i] = src[t];
      applied.push({ array: a, cap: i, from: TERMINAL_NAMES[from], to: TERMINAL_NAMES[t] });
    }
    updateTop();
    const sc = new Float64Array(5);
    if (trackEnergy) {
      for (let a = 0; a < A; a++) accumulateSourceCharge(arrays[a], before.vx[a], before.vb[a], vTop[a], vb[a], terms[a], sc);
      const eRef = src[VREF] * sc[VREF];
      const eVcm = src[VCM] * sc[VCM];
      energyRef += eRef;
      energyVcm += eVcm;
      for (let s = 0; s < 5; s++) sourceChargeTotal[s] += sc[s];
      if (record) {
        pending.changes.push(...applied);
        for (let s = 0; s < 5; s++) pending.sourceCharge[s] += sc[s];
        pending.energyRef += eRef;
        pending.energyVcm += eVcm;
        pending.deltaVtop = arrays.map((_, a) => vTop[a] - (pending.vxStart?.[a] ?? before.vx[a]));
        pending.predictedDeltaVtop = arrays.map((arr, a) => predictedTopStep(arr, pending.vbStart?.[a] ?? before.vb[a], vb[a]));
        if (!pending.vxStart) {
          pending.vxStart = before.vx;
          pending.vbStart = before.vb;
        }
      }
    }
    return applied;
  }

  function takeSnapshot(phase, extra) {
    const forced = phase === 'sample';
    const arraysState = arrays.map((arr, a) => {
      const vx = forced ? vTopForced[a] : vTop[a];
      const vbs = Float64Array.from(vb[a]);
      const ch = plateCharges(arr, vx, vbs);
      const qNode = forced ? qForced[a] : q[a];
      return {
        name: arr.name,
        terminals: Array.from(terms[a], (t) => TERMINAL_NAMES[t]),
        vBottom: vbs,
        vTop: vx,
        topForced: forced,
        topForcedTo: forced ? TERMINAL_NAMES[plan.samplingTop[a]] : null,
        qNode,
        charges: ch,
        conservationResidual: ch.totalTop - qNode,
      };
    });
    const snap = {
      index: snapshots.length,
      phase,
      arrays: arraysState,
      changes: pending.changes,
      transition: {
        sourceCharge: Object.fromEntries(TERMINAL_NAMES.map((n, s) => [n, pending.sourceCharge[s]])),
        energyRef: pending.energyRef,
        energyVcm: pending.energyVcm,
        deltaVtop: pending.deltaVtop.length ? pending.deltaVtop : arrays.map(() => 0),
        predictedDeltaVtop: pending.predictedDeltaVtop.length ? pending.predictedDeltaVtop : arrays.map(() => 0),
      },
      energyRefCum: energyRef,
      energyVcmCum: energyVcm,
      ...extra,
    };
    snap.dacLevel = phase === 'sample' ? NaN : balanceInput(adc, terms);
    snapshots.push(snap);
    pending = { changes: [], sourceCharge: new Float64Array(5), deltaVtop: [], predictedDeltaVtop: [], energyRef: 0, energyVcm: 0 };
    return snap;
  }

  if (record) {
    takeSnapshot('sample', {
      title: 'Sampling (track)',
      detail: `Top plate${A > 1 ? 's' : ''} forced to ${plan.samplingTop.map((t) => TERMINAL_NAMES[t]).join(' / ')}; bottom plates per ${scheme.samplingStyle} sampling. Input tracked.`,
      tStart: 0,
      tEnd: tSample,
      decisions: [],
      comparator: null,
      bitIndex: null,
    });
  }

  // ---- 2. hold -------------------------------------------------------------
  updateTop();
  if (record) {
    pending.deltaVtop = arrays.map((_, a) => vTop[a] - vTopForced[a]);
    pending.predictedDeltaVtop = arrays.map((arr, a) => kTCcharge[a] / arr.nodeCap);
    takeSnapshot('hold', {
      title: 'Hold (top-plate switch opens)',
      detail: noise.kTC
        ? 'Node charge Q_X frozen. kT/C noise charge is captured at this instant.'
        : 'Node charge Q_X frozen; it is conserved for the rest of the conversion.',
      tStart: tSample,
      tEnd: tSample,
      decisions: [],
      comparator: null,
      bitIndex: null,
    });
  }

  // ---- 3. preset ------------------------------------------------------------
  const presetApplied = applyChanges(plan.preset);
  if (record && presetApplied.length) {
    takeSnapshot('preset', {
      title: 'DAC preset',
      detail: 'Bottom plates leave the input and take the initial trial configuration.',
      tStart: tSample,
      tEnd: tSample,
      decisions: [],
      comparator: null,
      bitIndex: null,
    });
  }

  // ---- 4. successive approximation -----------------------------------------
  const decisions = new Array(N);
  for (let k = 0; k < N; k++) {
    const vp = nodeVoltage(plan.plus, vTop, src);
    const vm = nodeVoltage(plan.minus, vTop, src);
    const cmp = comparator.decide(vp, vm, rng);
    decisions[k] = cmp.decision;
    if (record) {
      takeSnapshot('compare', {
        title: `Bit cycle ${k + 1}/${N}: decide b${N - 1 - k}`,
        detail: scheme.narrate(k, cmp.decision, N),
        tStart: tSample + k * tBit,
        tEnd: tSample + (k + 1) * tBit,
        tCompare: tSample + (k + 0.8) * tBit,
        decisions: decisions.slice(0, k + 1),
        comparator: cmp,
        bitIndex: N - 1 - k,
      });
    }
    const list = plan.after ? plan.after[k][cmp.decision] : compileLive(adc, k, cmp.decision, decisions.slice(0, k + 1));
    applyChanges(list);
  }

  let code = 0;
  for (let k = 0; k < N; k++) code = code * 2 + decisions[k];

  if (record) {
    takeSnapshot('done', {
      title: 'Conversion complete',
      detail: `Output code ${code}. Remaining top-plate voltage is the residue of the conversion.`,
      tStart: tSample + N * tBit,
      tEnd: tSample + (N + 0.6) * tBit,
      decisions: decisions.slice(),
      comparator: null,
      bitIndex: null,
      code,
    });
  }

  return {
    input,
    sampledInput,
    code,
    decisions,
    idealCode: adc.idealCode(input),
    reconstructed: adc.reconstruct(code),
    energyRef,
    energyVcm,
    sourceCharge: Object.fromEntries(TERMINAL_NAMES.map((n, s) => [n, sourceChargeTotal[s]])),
    kTCvoltage: Array.from(kTCcharge, (qn, a) => qn / arrays[a].nodeCap),
    sources: Object.fromEntries(TERMINAL_NAMES.map((n, s) => [n, src[s]])),
    snapshots,
  };
}

function compileLive(adc, k, d, history) {
  return adc.scheme
    .afterDecision(k, d, adc.config.bits, history)
    .map((c) => ({ a: c.array, i: c.cap, t: terminalId(c.to) }));
}

/**
 * Input value (V or differential V) at which an *ideal* comparator would be
 * balanced for the given bottom-plate configuration — the DAC level that the
 * held input is being compared against. Includes all CDAC non-idealities
 * (mismatch, parasitics, reference error) but no comparator offset/noise and
 * no sampling noise. Computed exactly: the comparator input is affine in the
 * input, so two evaluations determine the root.
 */
export function balanceInput(adc, terms) {
  const { arrays, plan } = adc;
  const f = (x) => {
    const src = adc.sourceVoltages(x);
    const vTop = arrays.map((arr, a) => {
      const vbS = Array.from(plan.samplingBottoms[a], (t) => src[t]);
      const qn = forcedTopCharge(arr, src[plan.samplingTop[a]], vbS);
      let s = 0;
      for (let i = 0; i < arr.n; i++) s += arr.actual[i] * src[terms[a][i]];
      return (qn + s) / arr.nodeCap;
    });
    return nodeVoltage(plan.plus, vTop, src) - nodeVoltage(plan.minus, vTop, src);
  };
  const x0 = adc.range.low;
  const x1 = adc.range.high;
  const f0 = f(x0);
  const f1 = f(x1);
  if (f1 === f0) return NaN;
  return x0 - (f0 * (x1 - x0)) / (f1 - f0);
}

/**
 * Allocation-free conversion returning only the output code. Uses the same
 * charge equations, switching plan and random-number order as `convert`, so
 * both give identical codes for identical RNG state (verified in tests).
 * Used for ramps (INL/DNL) and FFT runs with up to ~10^6 conversions.
 */
const scratchCache = new WeakMap();

export function convertCode(adc, input, rng) {
  let s = scratchCache.get(adc);
  if (!s) {
    s = {
      src: new Float64Array(5),
      terms: adc.arrays.map((arr) => new Int8Array(arr.n)),
      scv: new Float64Array(adc.arrays.length),
      vTop: new Float64Array(adc.arrays.length),
      kTCscale: adc.arrays.map((arr) => Math.sqrt(BOLTZMANN * adc.noise.temperature * arr.nodeCap)),
    };
    scratchCache.set(adc, s);
  }
  const { arrays, plan, comparator, noise, config } = adc;
  const A = arrays.length;
  const N = config.bits;
  const { src, terms, scv, vTop } = s;
  const x = noise.extraRms > 0 ? input + noise.extraRms * rng.gaussian() : input;
  adc.sourceVoltages(x, src);
  for (let a = 0; a < A; a++) {
    const arr = arrays[a];
    const t = terms[a];
    t.set(plan.samplingBottoms[a]);
    let sum = 0;
    for (let i = 0; i < arr.n; i++) sum += arr.actual[i] * src[t[i]];
    scv[a] = sum;
    // Q = Vtop,f * (Ct + Cp) - sum Ci Vb_i  (forced charge) -> Vx = Vtop,f + q_noise / (Ct + Cp)
  }
  const qf = s.qf || (s.qf = new Float64Array(A));
  for (let a = 0; a < A; a++) {
    qf[a] = src[plan.samplingTop[a]] * arrays[a].nodeCap - scv[a];
    if (noise.kTC) qf[a] += s.kTCscale[a] * rng.gaussian();
  }
  const apply = (list) => {
    for (let j = 0; j < list.length; j++) {
      const c = list[j];
      const from = terms[c.a][c.i];
      if (from === c.t) continue;
      scv[c.a] += arrays[c.a].actual[c.i] * (src[c.t] - src[from]);
      terms[c.a][c.i] = c.t;
    }
  };
  apply(plan.preset);
  const plus = plan.plus;
  const minus = plan.minus;
  const history = plan.after ? null : [];
  let code = 0;
  for (let k = 0; k < N; k++) {
    for (let a = 0; a < A; a++) vTop[a] = (qf[a] + scv[a]) / arrays[a].nodeCap;
    const vp = plus.top ? vTop[plus.a] : src[plus.t];
    const vm = minus.top ? vTop[minus.a] : src[minus.t];
    const d = comparator.decideBit(vp, vm, rng);
    code = code * 2 + d;
    if (history) {
      history.push(d);
      apply(compileLive(adc, k, d, history));
    } else {
      apply(plan.after[k][d]);
    }
  }
  return code;
}
