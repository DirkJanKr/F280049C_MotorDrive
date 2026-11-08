// Charge-sharing CDAC sizing from the charge balance (review slide 15):
//   N x Vin,max x CM = 4 x VREF x C
// One unit step delivers the differential charge q_unit = 2 x VREF x Cu (assumption,
// consistent with slides 11, 15 and 36); one LSB is q_unit / (LSB per unit).

import { buildSteps, areaUnits, tolerances, coverage } from './steps.js';

export function designCdac(P, cells = 22, givenSteps = null) {
  const steps = givenSteps || buildSteps(P);
  const weights = steps.map((s) => s.units * P.lsbPerUnit);
  const codes = 2 ** P.bits;
  const units = areaUnits(steps, P.halvings);
  const cdac = units * P.cu;
  const qUnit = 2 * P.vref * P.cu;
  const qLsb = qUnit / P.lsbPerUnit;
  const qFs = codes * qLsb;
  // Half-range charge balance: input charge over the full scale equals 1024 LSB of step charge.
  const cm = qFs / (P.channels * P.fullScale);
  // As on slide 25/26: charge balance with the total CDAC (redundancy and halving caps included).
  const cmSlide = (4 * P.vref * cdac) / (P.channels * P.fullScale);
  // Node capacitance before each decision: memory cells, then 2 x C of every shared step.
  const cAdd = steps.map((s) => 2 * (s.kind === 'cap' || s.kind === 'small' ? s.units : 1) * P.cu);
  const cNode = [P.channels * cm];
  for (const c of cAdd) cNode.push(cNode[cNode.length - 1] + c);
  const memCaps = cells * P.channels * 2;
  const plates = (cdac + memCaps * cm) / P.density;
  return {
    steps, weights, decisions: steps.length + 1, codes, units, cdac, qUnit, qLsb, qFs, cm, cmSlide, cAdd, cNode,
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
