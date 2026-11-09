// Noise budget in the charge domain, as is usual for a charge-sharing SAR ADC.
// Every noise source is referred to the differential charge on the summing node
// at the start of the conversion, where the input is Q in = N · CM · V in.
// One LSB of input is Q LSB = 2 · VREF · Cu / (LSB per unit). Lines add in power.

import { K_B } from '../zaan/model/noise.js';

export const Q_E = 1.602176634e-19;

/** Charge noise a full-scale sine allows for a given ENOB: σQ = Q sig,rms / 10^((6.02 ENOB + 1.76) / 20). */
export function allowedCharge(d, enob) {
  const qSigRms = d.qFs / 2 / Math.SQRT2;
  return qSigRms / 10 ** ((6.02 * enob + 1.76) / 20);
}

/** ENOB from a total charge noise, for a full-scale sine. */
export function enobFromCharge(d, sigmaQ) {
  const qSigRms = d.qFs / 2 / Math.SQRT2;
  const sndr = 20 * Math.log10(qSigRms / sigmaQ);
  return { sndr, enob: (sndr - 1.76) / 6.02 };
}

/** Comparator noise referred to charge at decision i: σQ = C node,i · vn. */
export function comparatorCharge(P, d, i) {
  return d.cNode[i] * P.compNoise;
}

/**
 * Offset at decision i as charge, in LSB. Only the difference from the last decision
 * uses up tolerance; the common part shifts every code the same way.
 */
export function offsetLsb(d, vos, i) {
  const last = d.cNode[d.decisions - 1];
  return { total: (vos * d.cNode[i]) / d.qLsb, differential: (vos * (last - d.cNode[i])) / d.qLsb };
}

/**
 * CDAC precharge noise as differential node charge. Each step is one floating capacitor C between
 * node + and node −; when its precharge switches open it keeps a plate charge error with variance kT C.
 * That error enters node + and node − with opposite sign, so the differential charge sees 2× it:
 * variance 4 kT C. A halving step also opens the switch between the two halves (series C u / 2): 4 kT C u / 2.
 */
export function prechargeCharge(P, d) {
  const kT = K_B * P.temperature;
  const halves = d.steps.filter((s) => s.kind === 'half').length;
  return Math.sqrt(4 * kT * d.cdac + halves * 4 * kT * (P.cu / 2));
}

/** The noise lines in charge. residualQ: simulated mismatch, offset and rounding residual (C rms). */
export function chargeLines(P, d, { arrayGain = true, residualQ = 0 } = {}) {
  const kT = K_B * P.temperature;
  const N = P.channels;
  const cellOne = Math.sqrt(2 * kT * d.cm);
  const fJ = P.f0 * (1 + P.fbw / 2);
  const vrms = P.fullScale / 2 / Math.SQRT2;
  return [
    { id: 'q', label: 'Quantisation, output bits', sigma: d.qLsb / Math.sqrt(12), knob: 'bits', perChannel: false },
    { id: 'cal', label: 'Mismatch, offset and rounding after calibration', sigma: residualQ, knob: 'cu', perChannel: false, simulated: true },
    { id: 'comp', label: 'Comparator noise at the last decision', sigma: comparatorCharge(P, d, d.decisions - 1), knob: 'compNoise', perChannel: false },
    { id: 'samp', label: 'kT/C of the memory cells', sigma: arrayGain ? Math.sqrt(N) * cellOne : N * cellOne, knob: 'temperature', perChannel: true },
    { id: 'pre', label: 'CDAC precharge kT/C', sigma: prechargeCharge(P, d), knob: 'vref', perChannel: false },
    { id: 'jit', label: 'Sampling clock jitter', sigma: N * d.cm * 2 * Math.PI * fJ * P.jitter * vrms, knob: 'jitter', perChannel: false },
  ];
}

/** Share of the allowed noise power that each line gets when nothing else is set: the rest split evenly. */
export function defaultAllocation(lines, allowed) {
  const q = lines.find((l) => l.id === 'q');
  const rest = Math.max(0, 1 - (q.sigma / allowed) ** 2);
  const others = lines.filter((l) => l.id !== 'q');
  const out = { q: (q.sigma / allowed) ** 2 * 100 };
  for (const l of others) out[l.id] = (rest / others.length) * 100;
  return out;
}

/** Full budget: lines with shares, totals, the ENOB and the verdict. */
export function chargeBudget(P, d, opts = {}) {
  const lines = chargeLines(P, d, opts);
  const allowed = allowedCharge(d, P.enobAim);
  const alloc = { ...defaultAllocation(lines, allowed), ...(opts.allocation || {}) };
  const total = Math.sqrt(lines.reduce((a, l) => a + l.sigma ** 2, 0));
  for (const l of lines) {
    l.lsb = l.sigma / d.qLsb;
    l.share = (l.sigma / allowed) ** 2 * 100;
    l.alloc = alloc[l.id];
    l.ok = l.share <= l.alloc + 1e-9;
    const others = total ** 2 - l.sigma ** 2;
    l.enobWithout = enobFromCharge(d, Math.sqrt(Math.max(others, 1e-60))).enob;
    l.maxAlone = allowed ** 2 > others ? Math.sqrt(allowed ** 2 - others) : 0;
  }
  const e = enobFromCharge(d, total);
  return {
    lines, allowed, total, sndr: e.sndr, enob: e.enob, ok: total <= allowed, used: (total / allowed) ** 2 * 100,
    arrayGainDb: 10 * Math.log10(P.channels), arrayGain: opts.arrayGain !== false,
  };
}

/**
 * What each decision needs from its tolerance, in LSB:
 * mismatch: 3σ of the tolerance itself, from the step and all later steps;
 * offset: the part of the comparator offset that differs from the last decision;
 * noise: 3σ of the comparator noise referred to charge at that decision (shown, but not in
 * the check: noise that is not repaired appears as output noise and is in the noise budget).
 * Check: mismatch + offset ≤ tolerance + 0.5 LSB, so an unrepaired error stays below half a code.
 */
export function toleranceNeeds(P, d, sigmaU) {
  const n = d.decisions;
  const sw = d.steps.map((st, i) => (st.kind === 'cap' || st.kind === 'small' ? (d.weights[i] * sigmaU) / Math.sqrt(st.units) : (d.weights[i] * sigmaU) / Math.SQRT2));
  const rows = [];
  for (let i = 0; i < n; i++) {
    let v = 0;
    for (let j = i; j < sw.length; j++) v += sw[j] ** 2;
    const mismatch = 3 * Math.sqrt(v);
    const off = offsetLsb(d, P.vosCal, i).differential;
    const offRaw = offsetLsb(d, P.vos, i).differential;
    const noise = (3 * comparatorCharge(P, d, i)) / d.qLsb;
    const need = mismatch + Math.abs(off);
    rows.push({ i, have: d.tol[i], mismatch, offset: Math.abs(off), offsetRaw: Math.abs(offRaw), noise, need, last: i === n - 1, ok: i === n - 1 || need <= d.tol[i] + 0.5 + 1e-9 });
  }
  return rows;
}
