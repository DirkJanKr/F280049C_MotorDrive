// One spec sheet per block, built from the registry and the budget.
// Each row: name, value (SI), unit, budget line it comes from, and whether it is an estimate.

import { si } from './params.js';
import { lsbVolts } from './noiseBudget.js';

export const BOLTZMANN = 1.381e-23; // J/K

function row(name, value, unit, kind, line) {
  // kind: 'target' (your value), 'share' (budget share, an estimate), 'calc' (calculated), 'unknown'
  return { name, value, unit, line, estimate: kind === 'share' || kind === 'unknown', kind };
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
      row('Resolution', si(reg, 'bits'), 'bit', 'target', 'target'),
      row('Raw decisions', n, '', 'target', 'target'),
      row('Mismatch after calibration (σ)', L.mismatch, 'V rms', 'share', 'CDAC mismatch'),
      row('Same, in LSB', L.mismatch / lsb, 'LSB rms', 'calc', 'CDAC mismatch'),
      row('Sum Cdac / Cs needed', ratio, '', 'calc', 'full scale and V REF'),
    ],
    Reference: [
      row('V REF', si(reg, 'vref'), 'V', 'target', 'target'),
      row('Reference charge error (σ)', L.refCharge, 'V rms', 'share', 'Reference charge error'),
      row('Same, in LSB', L.refCharge / lsb, 'LSB rms', 'calc', 'Reference charge error'),
    ],
    Comparator: [
      row('Noise at ADC input (σ)', L.compNoise, 'V rms', 'share', 'Comparator noise'),
      row('Noise at comparator node, scaled by 1 / (1 + ratio)', L.compNoise * att, 'V rms', 'calc', 'Comparator noise'),
      row('Offset after calibration (σ)', L.compOffset, 'V rms', 'share', 'Comparator offset after calibration'),
      row('Average decide and settle time', timing.tDec, 's', 'calc', 'Timing'),
    ],
    'Sampling switch': [
      row('kT/C noise (σ)', L.ktc, 'V rms', 'share', 'kT/C sampling noise'),
      row('Sampling capacitance per side, minimum', capForKtc(L.ktc, T), 'F', 'calc', 'kT/C sampling noise'),
      row('Jitter noise (σ)', L.jitter, 'V rms', 'share', 'Clock jitter'),
      row('Clock jitter at fin = centre frequency', jitterForNoise(L.jitter, f0, vSig), 's rms', 'calc', 'Clock jitter'),
      row('Clock jitter at fin = upper band edge', jitterForNoise(L.jitter, fEdge, vSig), 's rms', 'calc', 'Clock jitter'),
      row('Sampling time Ts', si(reg, 'tSample'), 's', 'unknown', 'Timing'),
    ],
    'SAR logic': [
      row('Logic delay per decision', si(reg, 'tLogic'), 's', 'unknown', 'Timing'),
      row('Logic delay, total', n * si(reg, 'tLogic'), 's', 'calc', 'Timing'),
    ],
  };
}
