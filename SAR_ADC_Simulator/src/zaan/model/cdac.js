// Charge-sharing CDAC sizing from the charge balance (review slide 15).
// One unit step delivers the differential charge q unit = 2 VREF Cu (assumption,
// consistent with slides 11, 15 and 36); one step LSB is q unit / (LSB per unit).

import { buildSteps, areaUnits, tolerances, coverage } from './steps.js';

/**
 * Charge balance, P.balance:
 *  'range' (default): the input full scale equals 2^N step LSB: N CM V FS = 2^N Q step
 *  'total': the input full scale equals the total step charge, both directions: N CM V FS = 2 Σw Q step
 *  'slide': as on the review slides, with the total CDAC capacitance: N CM V FS = 4 VREF C DAC
 * One input LSB is Q LSB = N CM V FS / 2^N; weights are expressed in input LSB.
 */
export function balanceOf(P) {
  const b = String(P.balance || 'range');
  return b.startsWith('total') ? 'total' : b.startsWith('slide') ? 'slide' : 'range';
}

export function designCdac(P, cells = 22, givenSteps = null) {
  const steps = givenSteps || buildSteps(P);
  const stepW = steps.map((s) => s.units * P.lsbPerUnit);
  const codes = 2 ** P.bits;
  const units = areaUnits(steps, P.halvings);
  const cdac = units * P.cu;
  const qUnit = 2 * P.vref * P.cu;
  const qStep = qUnit / P.lsbPerUnit;
  const sumW = stepW.reduce((a, w) => a + w, 0);
  const mode = balanceOf(P);
  const cm = mode === 'total' ? (2 * sumW * qStep) / (P.channels * P.fullScale) : mode === 'slide' ? (4 * P.vref * cdac) / (P.channels * P.fullScale) : (codes * qStep) / (P.channels * P.fullScale);
  const qLsb = (P.channels * cm * P.fullScale) / codes;
  const weights = stepW.map((w) => (w * qStep) / qLsb);
  const qFs = codes * qLsb;
  const cmRange = (codes * qStep) / (P.channels * P.fullScale);
  const cmSlide = (4 * P.vref * cdac) / (P.channels * P.fullScale);
  const cmTotal = (2 * sumW * qStep) / (P.channels * P.fullScale);
  // Node capacitance before each decision: memory cells, then 2 x C of every shared step.
  const cAdd = steps.map((s) => 2 * (s.kind === 'cap' || s.kind === 'small' ? s.units : 1) * P.cu);
  const cNode = [P.channels * cm];
  for (const c of cAdd) cNode.push(cNode[cNode.length - 1] + c);
  const memCaps = cells * P.channels * 2;
  const plates = (cdac + memCaps * cm) / P.density;
  return {
    steps, weights, stepW, decisions: steps.length + 1, codes, units, cdac, qUnit, qStep, qLsb, qFs, cm, cmRange, cmSlide, cmTotal, balance: mode, cAdd, cNode,
    tol: tolerances(weights), cover: coverage(weights, P.bits), memCaps, plateArea: plates, area: plates * P.routing,
  };
}

/** Unit capacitor that binary matching needs for 3 sigma DNL < 0.5 LSB at mid-code (slide 16, hand estimate). */
export function binaryMatchingCu(P) {
  // Mid-code: the first step (topUnits) against the rest (about the same) -> sigma = sigma_u x sqrt(2 x topUnits) units.
  const sigmaU = 0.5 / (3 * P.lsbPerUnit * Math.sqrt(2 * P.topUnits));
  const cuF = (P.aC / 100 / sigmaU) ** 2 * 1e-15;
  return { sigmaU, cu: cuF };
}

/** Single-capacitor mismatch sigma for a capacitor of C farad: A_C / sqrt(C / 1 fF). */
export function sigmaOf(P, c) {
  return P.aC / 100 / Math.sqrt(c / 1e-15);
}
