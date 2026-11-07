import { binaryWeights, change } from './common.js';

/**
 * Monotonic (set-and-down) switching, after C.-C. Liu et al., JSSC 2010.
 * Top-plate sampling, differential.
 *
 * Per side: N-1 binary capacitors + 1 unit dummy, Ct = 2^(N-1) Cu.
 *   Sample : top plates -> Vin+/Vin-, all bottom plates -> VREF.
 *   Hold   : top plates open; MSB decided directly (Vx+ vs Vx-) with no switching.
 *   After decision k (k < N-1): the largest remaining capacitor on the side
 *   whose top plate is higher is switched VREF -> GND (one switch per cycle).
 *
 * The comparator input common mode falls monotonically by up to ~Vref/2
 * during conversion, and top-plate parasitics cause a gain error because the
 * sampled signal is not attenuated by Ct/(Ct+Cp) while the DAC steps are.
 */
export const monotonic = Object.freeze({
  id: 'monotonic',
  name: 'Monotonic (set-and-down)',
  shortName: 'Monotonic',
  family: 'monotonic',
  differential: true,
  minBits: 2,
  samplingStyle: 'top-plate',
  description:
    'Top-plate sampling; MSB resolved without switching; afterwards one capacitor per cycle switches VREF→GND on the higher side. N−1 caps + dummy per side, Ct = 2^(N−1)·Cu.',
  arrays(N) {
    return [
      { name: 'P', weights: binaryWeights(N - 1), dummyUnits: 1, inputTerminal: 'VINP', rails: ['VREF', 'GND'] },
      { name: 'N', weights: binaryWeights(N - 1), dummyUnits: 1, inputTerminal: 'VINN', rails: ['VREF', 'GND'] },
    ];
  },
  sampling(N) {
    return { top: ['VINP', 'VINN'], bottoms: [Array(N).fill('VREF'), Array(N).fill('VREF')] };
  },
  preset() {
    return [];
  },
  afterDecision(k, d, N) {
    if (k >= N - 1) return [];
    return [change(d === 1 ? 0 : 1, k, 'GND')];
  },
  comparator: { plus: { type: 'top', array: 0 }, minus: { type: 'top', array: 1 } },
  comparatorCmReference(config) {
    return config.vinCM;
  },
  narrate(k, d, N) {
    const b = N - 1 - k;
    if (k >= N - 1) return `b${b} = ${d}: conversion complete (no switching)`;
    return `b${b} = ${d}: ${d === 1 ? 'P' : 'N'}-side C${N - 2 - k} VREF → GND`;
  },
});
