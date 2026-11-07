// One spec sheet per block, built from the registry and the budget.
// Each row: name, value (SI), unit, status, budget line it comes from.

import { si } from './params.js';
import { lsbVolts } from './noiseBudget.js';

export const BOLTZMANN = 1.381e-23; // J/K

function row(name, value, unit, status, line) {
  return { name, value, unit, status, line };
}

/** Comparator node attenuation at the end of conversion, flag F5: Cs / (Cs + sum Cdac) = 1 / (1 + ratio). */
export function dacToSampleRatio(reg) {
  return si(reg, 'fullScale') / 2 / si(reg, 'vref');
}

/** Differential kT/C: two sampling nodes, each kT/C, so sigma^2 = 2 k T / C and C = 2 k T / sigma^2 (per side). */
export function capForKtc(sigma, temperature) {
  return (2 * BOLTZMANN * temperature) / (sigma * sigma);
}

/** Jitter: sigma v = V signal rms x 2 pi fin sigma t, so sigma t = sigma v / (2 pi fin V signal rms). */
export function jitterForNoise(sigmaV, fin, vSig) {
  return sigmaV / (2 * Math.PI * fin * vSig);
}

export function buildSpecSheets({ reg, alloc, vSig, timing }) {
  const L = alloc.lines;
  const lsb = lsbVolts(si(reg, 'fullScale'), si(reg, 'bits'));
  const ratio = dacToSampleRatio(reg);
  const att = 1 / (1 + ratio);
  const T = si(reg, 'temperature');
  const f0 = si(reg, 'f0');
  const fEdge = f0 * (1 + si(reg, 'fbw') / 2);
  const n = si(reg, 'rawDecisions');
  return {
    CDAC: [
      row('Resolution', si(reg, 'bits'), 'bit', 'U', 'target'),
      row('Raw decisions', n, '', 'U', 'target'),
      row('Mismatch after calibration, sigma', L.mismatch, 'V rms', 'A', 'CDAC mismatch'),
      row('Same, in LSB', L.mismatch / lsb, 'LSB rms', 'D', 'CDAC mismatch'),
      row('Sum Cdac / Cs needed (flag F5)', ratio, '', 'D', 'full scale and V REF'),
    ],
    Reference: [
      row('V REF', si(reg, 'vref'), 'V', 'U', 'target'),
      row('Reference charge error, sigma', L.refCharge, 'V rms', 'A', 'Reference charge error'),
      row('Same, in LSB', L.refCharge / lsb, 'LSB rms', 'D', 'Reference charge error'),
    ],
    Comparator: [
      row('Noise at ADC input, sigma', L.compNoise, 'V rms', 'A', 'Comparator noise'),
      row('Noise at comparator node (x 1/(1+ratio), F5)', L.compNoise * att, 'V rms', 'D', 'Comparator noise'),
      row('Offset after calibration, sigma', L.compOffset, 'V rms', 'A', 'Comparator offset after calibration'),
      row('Average decide and settle time', timing.tDec, 's', 'D', 'Timing'),
    ],
    'Sampling switch': [
      row('kT/C noise, sigma', L.ktc, 'V rms', 'A', 'kT/C sampling noise'),
      row('Sampling capacitance per side, minimum', capForKtc(L.ktc, T), 'F', 'D', 'kT/C sampling noise'),
      row('Jitter noise, sigma', L.jitter, 'V rms', 'A', 'Clock jitter'),
      row('Clock jitter at fin = centre frequency', jitterForNoise(L.jitter, f0, vSig), 's rms', 'D', 'Clock jitter'),
      row('Clock jitter at fin = upper band edge', jitterForNoise(L.jitter, fEdge, vSig), 's rms', 'D', 'Clock jitter'),
      row('Sampling time Ts', si(reg, 'tSample'), 's', '?', 'Timing'),
    ],
    'SAR logic': [
      row('Logic delay per decision', si(reg, 'tLogic'), 's', '?', 'Timing'),
      row('Logic delay, total', n * si(reg, 'tLogic'), 's', 'D', 'Timing'),
    ],
  };
}
