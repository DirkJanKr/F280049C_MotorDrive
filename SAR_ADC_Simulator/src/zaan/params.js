// Project values for the Zaan converter, from the architecture review (Nov 2026).
// Each entry: value in the shown unit, factor `si` to SI, SI unit, slider range,
// a note, and `estimate: true` when the value is not decided yet.

function p(id, group, label, value, unit, si, siUnit, range, note = '', estimate = false) {
  const [min, max, step] = range;
  return { id, group, label, value, unit, si, siUnit, min, max, step, note, estimate };
}

export const GROUPS = {
  specs: 'Converter targets',
  beam: 'Tile and beamforming',
  cdac: 'CDAC and reference',
  comparator: 'Comparator and timing',
  noise: 'Noise sources',
  sim: 'Simulation settings',
};

export const DEFAULT_PARAMS = [
  p('fs', 'specs', 'Sample rate', 40, 'MS/s', 1e6, 'S/s', [10, 80, 1]),
  p('bits', 'specs', 'Resolution', 10, 'bit', 1, 'bit', [8, 12, 1]),
  p('fullScale', 'specs', 'Full scale, differential peak to peak', 1, 'V', 1, 'V', [0.4, 2, 0.05], 'conservative, not fixed'),
  p('enobAim', 'specs', 'ENOB aim', 9.5, 'bit', 1, 'bit', [8, 11, 0.1]),
  p('f0', 'specs', 'Echo centre frequency', 10, 'MHz', 1e6, 'Hz', [5, 15, 0.5], 'band about 7 to 13 MHz'),
  p('fbw', 'specs', 'Fractional bandwidth', 60, '%', 0.01, '1', [20, 100, 5]),

  p('channels', 'beam', 'Channels per converter', 16, '', 1, '1', [4, 32, 1], 'one tile'),
  p('pitch', 'beam', 'Element pitch', 200, 'µm', 1e-6, 'm', [100, 400, 10]),
  p('steer', 'beam', 'Receive steering, plus or minus', 15, '°', Math.PI / 180, 'rad', [0, 30, 0.5], 'approved by Yahua'),
  p('focus', 'beam', 'Receive focus depth', 15, 'mm', 1e-3, 'm', [5, 40, 0.5], 'one fixed focus per acquisition'),
  p('delayStep', 'beam', 'Delay step', 12.5, 'ns', 1e-9, 's', [3.125, 25, 3.125], 'chosen in the review; falling-edge writes'),
  p('c', 'beam', 'Speed of sound', 1540, 'm/s', 1, 'm/s', [1450, 1600, 5], 'soft tissue', true),

  p('vref', 'cdac', 'V REF', 200, 'mV', 1e-3, 'V', [50, 500, 5], 'working figure; how to choose it is open', true),
  p('cu', 'cdac', 'Unit capacitor Cu', 35, 'fF', 1e-15, 'F', [35, 500, 1], 'mim5_2 minimum is 35 fF'),
  p('aC', 'cdac', 'Matching, one capacitor', 4.99, '%·√fF', 1, '%√fF', [1, 10, 0.01], 'mim5_2 PDK: pair slope 0.0499 µm'),
  p('lsbPerUnit', 'cdac', 'LSB per unit capacitor', 8, 'LSB', 1, 'LSB', [2, 16, 1], 'smaller steps by charge halving (Malki)'),
  p('topUnits', 'cdac', 'First step', 32, 'units', 1, '1', [16, 48, 1]),
  p('radix', 'cdac', 'Radix of the upper steps', 1.9, '', 1, '1', [1.6, 2, 0.01], '2.00 is plain binary'),
  p('halvings', 'cdac', 'Charge-halving steps', 3, '', 1, '1', [0, 4, 1]),
  p('outBits', 'cdac', 'Combiner output resolution', 10, 'bit', 1, 'bit', [10, 14, 1], 'the review sends 10 bits to the IQ demodulator'),
  p('routing', 'cdac', 'Area factor for routing and switches', 1.5, '×', 1, '1', [1, 3, 0.1], '', true),
  p('density', 'cdac', 'Capacitor density', 2, 'fF/µm²', 1e-3, 'F/m2', [1, 5, 0.1]),

  p('vos', 'comparator', 'Comparator offset (before calibration)', 1, 'mV', 1e-3, 'V', [0, 10, 0.1], 'example value; spread comes from the comparator block', true),
  p('vosCal', 'comparator', 'Offset left after calibration', 0.1, 'mV', 1e-3, 'V', [0, 2, 0.01], '', true),
  p('compNoise', 'comparator', 'Comparator noise at its input', 0.05, 'mV rms', 1e-3, 'V', [0, 0.5, 0.005], 'one LSB at the last decision is only about 0.25 mV', true),
  p('ibias', 'comparator', 'Comparator bias current', 50, 'µA', 1e-6, 'A', [5, 500, 5], '', true),
  p('gmId', 'comparator', 'gm / ID', 15, '1/V', 1, '1/V', [5, 25, 0.5], 'moderate inversion', true),
  p('cload', 'comparator', 'Comparator load capacitance', 30, 'fF', 1e-15, 'F', [5, 200, 1], '', true),
  p('vfinal', 'comparator', 'Comparator output swing for a valid decision', 0.9, 'V', 1, 'V', [0.3, 1.8, 0.05], '', true),
  p('tSample', 'comparator', 'Sampling (read and share) time', 5, 'ns', 1e-9, 's', [0.5, 15, 0.1], 'not known yet', true),
  p('tauDac', 'comparator', 'DAC settling time constant', 0.1, 'ns', 1e-9, 's', [0.01, 1, 0.01], '', true),
  p('tLogic', 'comparator', 'Logic delay per decision', 0.2, 'ns', 1e-9, 's', [0, 1, 0.01], '', true),

  p('temperature', 'noise', 'Temperature', 300, 'K', 1, 'K', [250, 360, 1], '', true),
  p('jitter', 'noise', 'Sampling clock jitter', 1, 'ps rms', 1e-12, 's', [0, 20, 0.1], '', true),

  p('chips', 'sim', 'Monte Carlo chips', 100, '', 1, '1', [10, 400, 10]),
  p('seed', 'sim', 'Random seed', 1, '', 1, '1', [1, 999, 1]),
];

export const OPEN_ITEMS = [
  'Capacitor device: MIM now; MOS is a question to the team',
  'How to choose V REF (200 mV is a working figure)',
  'Charge balance with redundancy: total CDAC or half-range charge',
  'Reference: ping-pong (two CDACs) or reservoir with servo (Guo 2024)',
  'Test signal entry point, pad count, capture interface',
  'LUT per bit or per code; required weight accuracy',
  'Sample rate 40 MS/s is exactly 4 × 10 MHz',
];

export function createRegistry() {
  return DEFAULT_PARAMS.map((x) => ({ ...x }));
}

export function findParam(reg, id) {
  const x = reg.find((q) => q.id === id);
  if (!x) throw new Error(`Unknown parameter ${id}`);
  return x;
}

/** Value in SI units. */
export function si(reg, id) {
  const x = findParam(reg, id);
  return x.value * x.si;
}

/** All values in SI units as a plain object, for the model functions. */
export function siAll(reg) {
  return Object.fromEntries(reg.map((x) => [x.id, x.value * x.si]));
}
