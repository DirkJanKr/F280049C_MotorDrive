// Charge-sharing SAR conversion, from charge conservation.
// Node: differential charge Q on capacitance Cn (starts as the 16 shared memory cells).
// Each step connects a precharged capacitor pair: Q -> Q - s q_i, Cn -> Cn + c_i.
// The comparator sees V = Q / Cn plus offset and noise; the decision does not depend on Cn,
// but offset and noise referred to charge grow with Cn (review slide 11).

import { sigmaOf } from './cdac.js';

/** Step charges and added node capacitance of a perfect chip. */
export function idealChip(d) {
  return { q: d.weights.map((w) => w * d.qLsb), cAdd: d.cAdd.slice(), cNode0: d.cNode[0] };
}

/** One fabricated chip: every unit capacitor drawn with the PDK mismatch. */
export function drawChip(d, P, rng) {
  const s1 = sigmaOf(P, P.cu);
  const q = [];
  const cAdd = [];
  let a0 = 0;
  let qa = 0;
  for (const st of d.steps) {
    if (st.kind === 'cap' || st.kind === 'small') {
      const c = st.units * P.cu * (1 + (s1 / Math.sqrt(st.units)) * rng.gaussian());
      q.push(2 * P.vref * c);
      cAdd.push(2 * c);
    } else {
      if (a0 === 0) {
        a0 = P.cu * (1 + s1 * rng.gaussian());
        qa = 2 * P.vref * a0;
      }
      if (st.kind === 'half') {
        const b = P.cu * (1 + s1 * rng.gaussian());
        const qb = (qa * b) / (a0 + b);
        qa -= qb;
        q.push(qb);
        cAdd.push(2 * b);
      } else {
        q.push(qa);
        cAdd.push(2 * a0);
      }
    }
  }
  return { q, cAdd, cNode0: d.cNode[0], wTrue: q.map((x) => x / d.qLsb) };
}

/**
 * Convert one input. x is the input in LSB relative to mid-scale (x = Vin / FS x 2^N).
 * Returns the raw decisions (0/1); with trace, also the node state before every decision.
 */
export function convert(chip, d, x, { vos = 0, noise = 0, rng = null, trace = false } = {}) {
  let Q = x * d.qLsb;
  let cn = chip.cNode0;
  const n = d.decisions;
  const dec = new Uint8Array(n);
  const steps = trace ? [] : null;
  for (let i = 0; i < n; i++) {
    const v = Q / cn;
    const vn = noise > 0 && rng ? noise * rng.gaussian() : 0;
    const bit = v + vos + vn > 0 ? 1 : 0;
    dec[i] = bit;
    if (trace) steps.push({ i, Q, cn, v, offsetLsb: (cn * vos) / d.qLsb, bit });
    if (i < n - 1) {
      Q -= (bit ? 1 : -1) * chip.q[i];
      cn += chip.cAdd[i];
    }
  }
  if (trace) steps.push({ i: n, Q, cn, v: Q / cn, final: true });
  return trace ? { dec, steps } : dec;
}

/** Design (or calibrated) weights in the form used by the combiner: offset c and one weight per decision. */
export function designWeights(d) {
  return { c: d.codes / 2 - 0.5, w: [...d.weights, 0.5] };
}

/**
 * Combiner: code = round(c + sum s_i w_i), s_i = +1 or -1, clamped to the code range.
 * fracBits > 0 keeps that many bits below the LSB (a wider combiner output).
 */
export function combine(dec, cw, codes, fracBits = 0) {
  let y = cw.c;
  for (let i = 0; i < dec.length; i++) y += (dec[i] ? 1 : -1) * cw.w[i];
  const k = 2 ** fracBits;
  return Math.min(codes - 1, Math.max(0, Math.round(y * k) / k));
}
