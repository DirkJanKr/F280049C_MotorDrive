// Timing budget of one conversion: what the period is spent on, and what is left for the
// comparator and the logic. No comparator or logic delay is assumed anywhere in this file.
//
// Sources (S):
//   Chen 2018, p. 3053: 30 MS/s; the conversion starts "after a short-time interval reserved for
//     the passive charge redistribution"; no duration given. Fig. 9(c), p. 3057: 10 bit cycles,
//     one calibration cycle, summing-node reset (CPRST) during the calibration cycle.
//     p. 3056: two CDAC arrays (ping-pong), T_int = 25 ns = 3/4 of the period, so precharging
//     takes no time from the conversion.
//   Guo 2024, p. 2607 and 2610, Fig. 4(b) and 9(b): 25 ns period, 11 comparisons, ONE CDAC.
//     The CDAC is reset (phi_RST) at the end of a conversion and takes its charge from the
//     reservoir (phi_REF) during the MSB comparison, which needs no DAC. The reservoir itself is
//     recharged for T_CHG = 12.5 ns while the conversion runs.
//
// Settling of step j (D, from the circuit of Rabuske 2017, Fig. 3.7): capacitor C_j is connected
// across the two nodes through two switches, so its branch holds r_j = 2 R_j in series with C_j.
// The earlier capacitors stay connected, each behind its own two switches. The memory cells are
// one capacitor C_0 = C_TH / 2 directly on the nodes (their read switches are ignored). With v_0
// the differential node voltage and v_i the voltage on capacitor i:
//
//   C_0 dv_0/dt = sum over i of (v_i - v_0) / r_i          C_i dv_i/dt = -(v_i - v_0) / r_i
//
// For step 1 this is one time constant, tau_1 = 2 R_on C_1 C_0 / (C_1 + C_0). For a later, small
// step the node first moves with the short time constant of its own branch, too far by about
// C_d / C_0, and then comes back with the time constant of the LARGEST earlier capacitor.
// ngspice shows the same (spice/settling.mjs).
//
// Distance to the final value e(t) [LSB of the new node capacitance]; r = residue before the step.
// Decisions that redundancy can repair need |e| <= tol of the next decision; binary needs 0.5 LSB.
// Worst cases taken: r = w_j - tol and r = w_j + tol (final residue at the edge of the tolerance).
// Every earlier step is taken as settled when the next one starts (optimistic).
// All times are proportional to R_on, so the network is solved once for 1 ohm.
//
// Switch sizing (mode): 'same' = every capacitor has the same switch R_on; 'unit' = every unit
// capacitor has its own switch pair, so R_j = R_on C_u / C_j and all branches have equal r C.

import { tolerances } from './steps.js';

/** Measured prior art in 180 nm: the period divided by the number of comparison cycles (upper bound per cycle). */
export const PRIOR = {
  chen: { name: 'Chen 2018', period: 1 / 30e6, cycles: 11, source: 'p. 3053, Fig. 9(c) p. 3057: 10 bit cycles and 1 calibration cycle in 33.3 ns' },
  guo: { name: 'Guo 2024', period: 25e-9, cycles: 11, source: 'p. 2607, Fig. 4(b): 11 comparisons in 25 ns' },
};
export const cycleOf = (p) => p.period / p.cycles;

/**
 * Marginal: the comparator plus logic must be faster than Guo's cycle, but by no more than Guo's
 * cycle is shorter than Chen's (25 %, both measured in 180 nm). The threshold is my choice (A).
 */
export const MARGINAL = 1 - cycleOf(PRIOR.guo) / cycleOf(PRIOR.chen);

/** The capacitors of the steps as they are in the circuit: C_j and the differential capacitance before the step. */
export function stepCaps(d, extraHalf = false) {
  const list = d.weights.map((w, j) => ({ w, c: d.cAdd[j] / 2, cd: d.cNode[j] / 2 }));
  if (extraHalf) {
    const last = list[list.length - 1];
    list.push({ w: last.w / 2, c: last.c, cd: last.cd + last.c });
  }
  return list;
}

const factor = (s, cu, mode) => (mode === 'unit' ? cu / s.c : 1);

/**
 * Distance to the final value after step j closes, for 1 ohm switches. Returns { t, e } with e in LSB.
 * Charge unit: 1 LSB = 1, so a step of w LSB is a capacitor holding w and a residue r is r on the nodes.
 */
export function deviation(caps, j, r, mode = 'same') {
  const cu = Math.min(...caps.map((s) => s.c));
  const C = [caps[0].cd, ...caps.slice(0, j + 1).map((s) => s.c)];
  const R = [0, ...caps.slice(0, j + 1).map((s) => 2 * factor(s, cu, mode))];
  const cd = caps[j].cd;
  const sign = r >= 0 ? -1 : 1;
  const v = C.map(() => r / cd);
  v[j + 1] = (sign * caps[j].w) / caps[j].c;
  const vEnd = (r + sign * caps[j].w) / (cd + caps[j].c);
  const taus = R.slice(1).map((ri, i) => ri * C[i + 1]);
  const dt = 0.04 * Math.min(...R.slice(1).map((ri, i) => (ri * C[i + 1] * C[0]) / (C[i + 1] + C[0])));
  const n = Math.min(60000, Math.ceil((16 * Math.max(...taus)) / dt));
  const f = (x) => {
    const d = x.map(() => 0);
    for (let i = 1; i < x.length; i++) {
      const cur = (x[i] - x[0]) / R[i];
      d[0] += cur / C[0];
      d[i] = -cur / C[i];
    }
    return d;
  };
  const add = (x, d, h) => x.map((xi, i) => xi + h * d[i]);
  const t = [0];
  const e = [(v[0] - vEnd) * (cd + caps[j].c)];
  let x = v;
  for (let k = 1; k <= n; k++) {
    const k1 = f(x);
    const k2 = f(add(x, k1, dt / 2));
    const k3 = f(add(x, k2, dt / 2));
    const k4 = f(add(x, k3, dt));
    x = x.map((xi, i) => xi + (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
    t.push(k * dt);
    e.push((x[0] - vEnd) * (cd + caps[j].c));
  }
  return { t, e };
}

/** Last moment at which |e| is still above the level. */
export function settledAfter({ t, e }, level) {
  for (let k = e.length - 1; k >= 0; k--) if (Math.abs(e[k]) > level) return t[Math.min(k + 1, t.length - 1)];
  return 0;
}

const memo = new Map();

/** Settling of every step per ohm of switch resistance: { tau (own branch with the node), kRed, kBin } in s per ohm. */
export function settlingPerOhm(caps, mode = 'same') {
  const key = JSON.stringify([caps, mode]);
  if (memo.has(key)) return memo.get(key);
  const tol = tolerances(caps.map((s) => s.w));
  const cu = Math.min(...caps.map((s) => s.c));
  const out = caps.map((s, j) => {
    const tolNext = Math.max(0.5, tol[j + 1] ?? 0.5);
    const worst = (tolAt) => Math.max(...[s.w - tolAt, s.w + tolAt].map((r) => settledAfter(deviation(caps, j, r, mode), tolAt)));
    return { ...s, tolNext, tau: (2 * factor(s, cu, mode) * s.c * s.cd) / (s.c + s.cd), kRed: worst(tolNext), kBin: worst(0.5) };
  });
  if (memo.size > 12) memo.clear();
  memo.set(key, out);
  return out;
}

/** Settling of every step for a switch resistance ron [ohm]. */
export function stepSettling(caps, ron, mode = 'same') {
  return settlingPerOhm(caps, mode).map((s) => ({ ...s, tau: s.tau * ron, tRed: s.kRed * ron, tBin: s.kBin * ron }));
}

/**
 * One case. d: CDAC design, P: model parameters (fs, bits, channels, cpar, vref, vosCal).
 * o: { ron, scheme: 'pingpong' | 'reservoir', extraHalf, offsetCmp, mode }.
 * Returns the intervals [{ id, label, t, status, source }], the time left and the verdict.
 */
export function timingCase(d, P, o) {
  const period = 1 / P.fs;
  const caps = stepCaps(d, o.extraHalf);
  const settle = stepSettling(caps, o.ron, o.mode);
  const decisions = caps.length + 1;
  const cycles = decisions + (o.offsetCmp ? 1 : 0);
  const lastCap = caps[caps.length - 1];
  const cdEnd = lastCap.cd + lastCap.c;
  const vRes = (lastCap.w * d.qLsb) / (2 * cdEnd); // largest node voltage left after the last step [V]
  const parts = [];
  // read: the node parasitic is charged through N cell switches in parallel
  const tauRead = (o.ron * (P.cpar || 0)) / P.channels;
  const tol0 = Math.max(0.5, tolerances(caps.map((s) => s.w))[0]);
  parts.push({ id: 'read', label: 'Read: cells onto the node', t: tauRead * Math.log(2 ** P.bits / tol0), status: 'D', source: 'tau = R on C par / N; zero while the node parasitic is not set. Chen p. 3053 reserves an interval without giving its length' });
  parts.push({ id: 'settle', label: `DAC settling, ${caps.length} steps`, t: settle.reduce((a, s) => a + s.tRed, 0), status: 'D', source: 'RC network of the connected capacitors, each settled to the tolerance of the next decision; circuit of Rabuske 2017, Fig. 3.7' });
  if (o.offsetCmp) {
    const n = P.vosCal > 0 ? Math.max(0, Math.log(vRes / P.vosCal)) : 0;
    parts.push({ id: 'short', label: 'Short the nodes for the offset comparison', t: n * o.ron * cdEnd, status: 'D', source: 'Chen p. 3058 and Fig. 9(c): nodes shorted, one more comparison. tau = R on C d; down to the offset left after calibration' });
  }
  if (o.scheme === 'reservoir') {
    const cu = Math.min(...caps.map((s) => s.c));
    const rc = Math.max(...caps.map((s) => factor(s, cu, o.mode) * s.c));
    const n = Math.max(0, Math.log((vRes / P.vref) * 2 ** P.bits));
    parts.push({ id: 'rst', label: 'CDAC reset before the reservoir share', t: n * o.ron * rc, status: 'D', source: 'Guo p. 2607, Fig. 9(b): phi RST inside the period. tau = R on C j; until the charge left changes the reference by less than 0.5 LSB at full scale' });
  }
  const fixed = parts.reduce((a, p) => a + p.t, 0);
  const left = period - fixed;
  const perCycle = left / cycles;
  const guo = cycleOf(PRIOR.guo);
  const verdict = perCycle >= guo ? 'fits' : perCycle >= guo * (1 - MARGINAL) ? 'marginal' : 'not shown';
  // reservoir share (phi REF) must end inside the first cycle: C_RSV = C_DAC in series (Guo p. 2610), to 0.5 LSB of full scale
  const cdac = caps.reduce((a, s) => a + s.c, 0);
  const rRsvMax = o.scheme === 'reservoir' ? perCycle / (Math.log(2 ** (P.bits + 1)) * (cdac / 2)) : null;
  return { ...o, period, decisions, cycles, parts, fixed, left, perCycle, verdict, shorter: 1 - perCycle / guo, settle, rRsvMax, tInt: o.scheme === 'pingpong' ? period : 12.5e-9 };
}

/** The eight cases: two reference schemes, with and without one more half step, with and without the offset comparison. */
export function timingCases(d, P, ron, mode = 'same') {
  const out = [];
  for (const scheme of ['pingpong', 'reservoir']) for (const extraHalf of [false, true]) for (const offsetCmp of [false, true]) out.push(timingCase(d, P, { ron, scheme, extraHalf, offsetCmp, mode }));
  return out;
}
