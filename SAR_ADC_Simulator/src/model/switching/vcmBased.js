import { binaryWeights, change } from './common.js';

/**
 * VCM-based (tri-level) switching, after Y. Zhu et al., JSSC 2010
 * (equivalent in charge behaviour to merged-capacitor switching).
 * Top-plate sampling, differential.
 *
 * Per side: N-1 binary capacitors + 1 unit dummy, Ct = 2^(N-1) Cu.
 *   Sample : top plates -> Vin+/Vin-, all bottom plates -> VCM (ideally Vref/2).
 *   Hold   : MSB decided without switching.
 *   After decision k < N-1: capacitor k on BOTH sides leaves VCM in opposite
 *     directions (d=1: P->GND, N->VREF; d=0: P->VREF, N->GND).
 *     Differential step = Vref*Ck/Ct, independent of VCM; the comparator
 *     common mode stays (ideally) constant.
 */
export const vcmBased = Object.freeze({
  id: 'vcm',
  name: 'VCM-based (tri-level)',
  shortName: 'VCM-based',
  family: 'vcm',
  differential: true,
  minBits: 2,
  samplingStyle: 'top-plate',
  description:
    'Top-plate sampling with bottom plates parked at VCM; each cycle moves one cap per side VCM→GND / VCM→VREF in opposite directions. N−1 caps + dummy per side, Ct = 2^(N−1)·Cu.',
  arrays(N) {
    return [
      { name: 'P', weights: binaryWeights(N - 1), dummyUnits: 1, inputTerminal: 'VINP', rails: ['VCM', 'VREF', 'GND'] },
      { name: 'N', weights: binaryWeights(N - 1), dummyUnits: 1, inputTerminal: 'VINN', rails: ['VCM', 'VREF', 'GND'] },
    ];
  },
  sampling(N) {
    return { top: ['VINP', 'VINN'], bottoms: [Array(N).fill('VCM'), Array(N).fill('VCM')] };
  },
  preset() {
    return [];
  },
  afterDecision(k, d, N) {
    if (k >= N - 1) return [];
    return d === 1 ? [change(0, k, 'GND'), change(1, k, 'VREF')] : [change(0, k, 'VREF'), change(1, k, 'GND')];
  },
  comparator: { plus: { type: 'top', array: 0 }, minus: { type: 'top', array: 1 } },
  comparatorCmReference(config) {
    return config.vinCM;
  },
  narrate(k, d, N) {
    const b = N - 1 - k;
    if (k >= N - 1) return `b${b} = ${d}: conversion complete (no switching)`;
    const c = `C${N - 2 - k}`;
    return d === 1 ? `b${b} = 1: P ${c} VCM→GND, N ${c} VCM→VREF` : `b${b} = 0: P ${c} VCM→VREF, N ${c} VCM→GND`;
  },
});
