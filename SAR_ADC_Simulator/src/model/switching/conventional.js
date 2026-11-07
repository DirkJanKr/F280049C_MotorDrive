import { binaryWeights, change } from './common.js';

/**
 * Conventional "try-and-reset" charge-redistribution switching
 * (McCreary & Gray style), bottom-plate sampling.
 *
 * Single-ended: N binary capacitors + 1 unit dummy, Ct = 2^N Cu.
 *   Sample : top plate -> VCM, bottom plates -> Vin.
 *   Hold   : top plate opens (Q_X frozen).
 *   Trial k: capacitor k -> VREF; Vx = Vcm + (V_DAC - Vin) Ct/(Ct+Cp).
 *   Decide : Vx < Vcm  -> bit = 1 (keep VREF), otherwise reset to GND.
 *
 * Differential: identical P array; the N array is the complement (VREF <-> GND)
 * and samples Vin-. Input range +-Vref (differential).
 */
export function createConventionalScheme({ differential }) {
  const hi = (a) => (a === 0 ? 'VREF' : 'GND');
  const lo = (a) => (a === 0 ? 'GND' : 'VREF');
  const nArr = differential ? 2 : 1;
  return Object.freeze({
    id: differential ? 'conventional-diff' : 'conventional',
    name: differential ? 'Conventional (differential)' : 'Conventional (single-ended)',
    shortName: differential ? 'Conv. diff' : 'Conv. SE',
    family: 'conventional',
    differential,
    minBits: 2,
    samplingStyle: 'bottom-plate',
    description: differential
      ? 'Try-and-reset binary search on complementary P/N arrays (bottom-plate sampling, top plates reset to VCM). N binary caps + dummy per side, Ct = 2^N·Cu.'
      : 'Try-and-reset binary search (bottom-plate sampling, top plate reset to VCM, comparator referenced to VCM). N binary caps + dummy, Ct = 2^N·Cu.',
    arrays(N) {
      const defs = [
        { name: 'P', weights: binaryWeights(N), dummyUnits: 1, inputTerminal: 'VINP', rails: ['VINP', 'VREF', 'GND'] },
      ];
      if (differential) {
        defs.push({ name: 'N', weights: binaryWeights(N), dummyUnits: 1, inputTerminal: 'VINN', rails: ['VINN', 'VREF', 'GND'] });
      }
      return defs;
    },
    sampling(N) {
      const top = [];
      const bottoms = [];
      for (let a = 0; a < nArr; a++) {
        top.push('VCM');
        bottoms.push(Array(N + 1).fill(a === 0 ? 'VINP' : 'VINN'));
      }
      return { top, bottoms };
    },
    preset(N) {
      const out = [];
      for (let a = 0; a < nArr; a++) {
        for (let i = 0; i <= N; i++) out.push(change(a, i, i === 0 ? hi(a) : lo(a)));
      }
      return out;
    },
    afterDecision(k, d, N) {
      const out = [];
      // No switching after the final decision: the code is complete and the
      // LSB trial capacitor can stay where it is (it is reset at the next sample).
      if (k + 1 >= N) return out;
      for (let a = 0; a < nArr; a++) {
        if (d === 0) out.push(change(a, k, lo(a)));
        out.push(change(a, k + 1, hi(a)));
      }
      return out;
    },
    comparator: differential
      ? { plus: { type: 'top', array: 1 }, minus: { type: 'top', array: 0 } }
      : { plus: { type: 'terminal', terminal: 'VCM' }, minus: { type: 'top', array: 0 } },
    comparatorCmReference(config) {
      return config.vcm;
    },
    narrate(k, d, N) {
      const b = N - 1 - k;
      if (k + 1 >= N) return `b${b} = ${d}: conversion complete (no further switching)`;
      const keep = d === 1 ? `keep C${b} at VREF` : `reset C${b} to GND`;
      return `b${b} = ${d}: ${keep}; trial C${b - 1} → VREF${differential ? ' (N side complementary)' : ''}`;
    },
  });
}

export const conventionalSE = createConventionalScheme({ differential: false });
export const conventionalDiff = createConventionalScheme({ differential: true });
