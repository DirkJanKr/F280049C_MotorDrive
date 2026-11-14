// Charge-sharing CDAC sizing from the charge balance of Chen 2018, eq. 3, p. 3056:
//
//   N * V_in,max * C_M = 4 * V_REF * C_DAC
//
//   N         number of channels summed                                   [1]
//   V_in,max  maximum peak-to-peak differential swing per channel         [V]
//   C_M       one memory capacitor                                        [F]
//   V_REF     voltage the CDAC is precharged to                           [V]
//   C_DAC     CDAC capacitance that carries reference charge              [F]
//   The factor 4: a capacitor C precharged single-ended to V_REF and connected
//   between the two summing nodes changes Q+ - Q- by 2 C V_REF, with either sign,
//   so the peak-to-peak range of the whole CDAC is 4 V_REF C_DAC.
//
// Rabuske and Fernandes 2017, eq. 4.58, p. 89:
//
//   alpha = C_TH / (2 * C_DAC),  C_TH = N * C_M
//
// Combined (D, binary CDAC):
//   alpha = 2 * V_REF / V_in,max        V_REF = alpha * V_in,max / 2
//   C_DAC = N * C_M / (2 * alpha)
//   Q_FS  = N * C_M * V_in,max          Q_LSB = Q_FS / 2^B
//
// Charge convention in this code: Q = Q+ - Q-, the difference of the charges on the
// two summing nodes, each on its own capacitance N * C_M. Rabuske 2017, eq. 4.21 and its text
// (p. 72 to 73) uses the differential-mode charge (C_TH / 2) * V, which is half of this; voltages are the same.
//
// The unit capacitor follows from the LSB (D): one unit delivers 2 V_REF C_u = n_u Q_LSB,
// so C_u = n_u * Q_LSB / (2 * V_REF) = n_u * N * C_M / (2^B * alpha), n_u = LSB per unit.

import { buildSteps, areaUnits, tolerances, coverage } from './steps.js';

/** Chen eq. 3 with Rabuske's alpha: from C_M and alpha to V_REF, C_DAC, Q_FS, Q_LSB and C_u. */
export function chargeBalance({ channels, fullScale, bits, cm, alpha, lsbPerUnit }) {
  const vref = (alpha * fullScale) / 2;
  const cdac = (channels * cm) / (2 * alpha);
  const qFs = channels * cm * fullScale;
  const qLsb = qFs / 2 ** bits;
  const cu = (lsbPerUnit * qLsb) / (2 * vref);
  return { vref, cdac, qFs, qLsb, cu };
}

/**
 * The CDAC for a list of steps. P.vref and P.cu are the physical values (from chargeBalance).
 * One input LSB is Q_LSB = N C_M V_in,max / 2^B = 2 V_REF C_u / n_u. Weights are in input LSB
 * and every step is added or subtracted, so a step of weight w changes the code by 2 w.
 */
export function designCdac(P, cells = 22, givenSteps = null) {
  const steps = givenSteps || buildSteps(P);
  const stepW = steps.map((s) => s.units * P.lsbPerUnit);
  const codes = 2 ** P.bits;
  const units = areaUnits(steps, P.halvings);
  const cdac = units * P.cu;
  const qUnit = 2 * P.vref * P.cu;
  const qStep = qUnit / P.lsbPerUnit;
  const sumW = stepW.reduce((a, w) => a + w, 0);
  const cm = (codes * qStep) / (P.channels * P.fullScale);
  const qLsb = qStep;
  const weights = stepW;
  const qFs = codes * qLsb;
  // capacitance that carries reference charge: the halving capacitors start empty and are not counted
  const cdacEff = (sumW / P.lsbPerUnit) * P.cu;
  const cmSlide = (4 * P.vref * cdac) / (P.channels * P.fullScale);
  // Node capacitance before each decision: memory cells, then 2 x C of every shared step.
  const cAdd = steps.map((s) => 2 * (s.kind === 'cap' || s.kind === 'small' ? s.units : 1) * P.cu);
  // Rabuske 2017, eq. 4.21: the node starts as the sampling capacitance C_TH = N C_M; a parasitic on the node adds to it (eq. 4.13)
  const cTh = P.channels * cm;
  const cNode = [cTh + (P.cpar || 0)];
  for (const c of cAdd) cNode.push(cNode[cNode.length - 1] + c);
  const memCaps = cells * P.channels * 2;
  const plates = (cdac + memCaps * cm) / P.density;
  return {
    steps, weights, stepW, sumW, decisions: steps.length + 1, codes, units, cdac, cdacEff, qUnit, qStep, qLsb, qFs, cm, cmSlide, cAdd, cNode, cTh,
    alpha: (P.channels * cm) / (2 * cdacEff), alphaPhysical: (P.channels * cm) / (2 * cdac),
    // alpha with the node parasitic: the node at the end is C TH + C par + 2 C DAC = C TH (1 + 1 / alphaEff),
    // Rabuske 2017, eq. 4.21 and 4.58 with C par added to the sampling capacitance in the denominator only (eq. 4.13)
    alphaEff: cTh / (2 * cdacEff + (P.cpar || 0)),
    tol: tolerances(weights), cover: coverage(weights, P.bits), memCaps, plateArea: plates, area: plates * P.routing,
  };
}

/** Binary steps for B bits with n_u LSB per unit: 2^(B-2)/n_u units down to 1, then halvings down to 1 LSB. */
export function binarySteps(bits, lsbPerUnit) {
  return buildSteps({ topUnits: 2 ** (bits - 2) / lsbPerUnit, radix: 2, halvings: Math.round(Math.log2(lsbPerUnit)), halvingOn: true });
}

/**
 * Unit capacitor that binary matching needs for 3 sigma DNL < 0.5 LSB at mid-code (hand estimate).
 * At the mid-scale transition every step changes sign, so the code step is off by
 * 2 (dw_1 - sum of dw_rest): sigma = 2 * n_u * sigma_u * sqrt(units of the first step + units of the rest)
 * = 2 * n_u * sigma_u * sqrt(2 * topUnits) LSB. Checked against 4000 simulated chips (1.14 against 1.13 LSB).
 */
export function binaryMatchingCu(P) {
  const sigmaU = 0.5 / (3 * 2 * P.lsbPerUnit * Math.sqrt(2 * P.topUnits));
  const cuF = (P.aC / 100 / sigmaU) ** 2 * 1e-15;
  return { sigmaU, cu: cuF };
}

/** Single-capacitor mismatch sigma for a capacitor of C farad: A_C / sqrt(C / 1 fF). */
export function sigmaOf(P, c) {
  return P.aC / 100 / Math.sqrt(c / 1e-15);
}
