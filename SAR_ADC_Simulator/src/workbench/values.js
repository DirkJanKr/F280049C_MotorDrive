// Values of the Zaan workbench, from the beamformer onward. Every value can be
// changed on the page where it matters. A value that is not known yet is null
// and shown as an empty field; it is never filled with a guess.

export const GROUPS = {
  system: 'Converter',
  beamformer: 'Beamformer',
  cdac: 'CDAC and reference',
  comparator: 'Comparator',
  timing: 'Timing (illustrative)',
  sim: 'Simulation',
};

function num(id, group, label, value, unit, si, siUnit, range, source = '', note = '') {
  const [min, max, step] = range;
  return { id, kind: 'num', group, label, value, unit, si, siUnit, min, max, step, source, note };
}
function choice(id, group, label, value, options, source = '', note = '') {
  return { id, kind: 'choice', group, label, value, options, source, note };
}

export const SEED = [
  num('fs', 'system', 'Sample rate', 40, 'MS/s', 1e6, 'S/s', [10, 80, 1], 'working figure'),
  num('f0', 'system', 'Echo centre frequency', 10, 'MHz', 1e6, 'Hz', [5, 15, 0.5], 'Yannick'),
  num('fbw', 'system', 'Fractional bandwidth', 60, '%', 0.01, '1', [20, 100, 5], 'Yannick'),
  num('fullScale', 'system', 'Full scale, differential peak to peak', 1, 'V', 1, 'V', [0.4, 2, 0.05], 'Yannick, conservative'),
  num('bits', 'system', 'Output bits', 10, 'bit', 1, 'bit', [8, 12, 1], '5 Nov'),
  num('rawDecisions', 'system', 'Raw decisions planned', 12, '', 1, '1', [8, 16, 1], '5 Nov'),
  num('enobAim', 'system', 'ENOB aim', 9.5, 'bit', 1, 'bit', [8, 11, 0.1], '23 Oct'),
  num('temperature', 'system', 'Temperature', 300, 'K', 1, 'K', [250, 360, 1], 'assumed'),

  num('channels', 'beamformer', 'Channels', 16, '', 1, '1', [4, 32, 1], 'one tile'),
  num('pitch', 'beamformer', 'Element pitch', 200, 'µm', 1e-6, 'm', [100, 400, 10], 'tile design'),
  num('steer', 'beamformer', 'Steering angle', 15, '°', Math.PI / 180, 'rad', [-30, 30, 0.5], 'my MATLAB, 26 Oct', '±15° is the design range'),
  num('memCells', 'beamformer', 'Memory cells per channel', 22, '', 1, '1', [8, 48, 1], 'review slide 7'),
  num('delayStep', 'beamformer', 'Delay step', 12.5, 'ns', 1e-9, 's', [3.125, 25, 3.125], 'CLK and CLK 180°, 8 Nov'),
  num('c', 'beamformer', 'Speed of sound', 1540, 'm/s', 1, 'm/s', [1450, 1600, 5], 'soft tissue'),
  num('rxFocus', 'beamformer', 'Receive focus (empty = plane wave)', null, 'mm', 1e-3, 'm', [5, 40, 0.5], 'not decided'),

  num('cu', 'cdac', 'Unit capacitor Cu', 35, 'fF', 1e-15, 'F', [10, 500, 1], 'PDK minimum MIM'),
  num('pairSigma', 'cdac', 'Pair mismatch σ(ΔC/C) at 35 fF', 1.25, '%', 0.01, '1', [0.1, 5, 0.01], 'PDK'),
  num('density', 'cdac', 'Capacitor density', 2, 'fF/µm²', 1e-3, 'F/m²', [0.5, 10, 0.1], 'PDK'),
  num('routing', 'cdac', 'Area factor for routing and switches', 1.5, '×', 1, '1', [1, 3, 0.1], 'assumed, review slide 26'),
  num('vref', 'cdac', 'VREF', 200, 'mV', 1e-3, 'V', [50, 500, 5], 'review: take a value'),
  num('lsbPerUnit', 'cdac', 'LSB per unit capacitor', 8, 'LSB', 1, 'LSB', [1, 32, 1], '29 Oct example array'),
  num('topUnits', 'cdac', 'First step', 32, 'units', 1, '1', [8, 64, 1], '29 Oct example array'),
  num('radix', 'cdac', 'Radix of the upper steps', 1.9, '', 1, '1', [1.5, 2, 0.01], 'Chang 2013'),
  num('halvings', 'cdac', 'Steps below one unit', 3, '', 1, '1', [0, 5, 1], '29 Oct example array'),
  choice('halvingOn', 'cdac', 'Steps below one unit made by', 'charge halving', ['charge halving', 'small capacitors'], 'Malki 2014 / Chen 2018'),

  num('vos', 'comparator', 'Offset before calibration (example)', 1, 'mV', 1e-3, 'V', [0, 10, 0.1], 'example'),
  num('vosCal', 'comparator', 'Offset left after calibration', 0.1, 'mV', 1e-3, 'V', [0, 2, 0.01], 'estimate'),
  num('compNoise', 'comparator', 'Comparator input noise', 0.05, 'mV rms', 1e-3, 'V', [0, 0.5, 0.005], 'estimate'),

  num('tSample', 'timing', 'Sampling (read and share) time', 5, 'ns', 1e-9, 's', [0.5, 15, 0.1], 'illustrative'),
  num('tauDac', 'timing', 'DAC settling time constant', 0.1, 'ns', 1e-9, 's', [0.01, 1, 0.01], 'illustrative'),
  num('ibias', 'timing', 'Comparator bias current', 50, 'µA', 1e-6, 'A', [5, 500, 5], 'illustrative'),
  num('gmId', 'timing', 'Comparator gm / ID', 15, '1/V', 1, '1/V', [5, 25, 0.5], 'illustrative'),
  num('cload', 'timing', 'Comparator load capacitance', 30, 'fF', 1e-15, 'F', [5, 200, 1], 'illustrative'),
  num('vfinal', 'timing', 'Comparator swing for a valid output', 0.9, 'V', 1, 'V', [0.3, 1.8, 0.05], 'illustrative'),
  num('tLogic', 'timing', 'Logic delay per decision', 0.2, 'ns', 1e-9, 's', [0, 1, 0.01], 'illustrative'),
  num('jitter', 'timing', 'Sampling clock jitter', 1, 'ps rms', 1e-12, 's', [0, 20, 0.1], 'illustrative'),

  num('chips', 'sim', 'Monte Carlo chips', 100, '', 1, '1', [10, 400, 10], ''),
  num('seed', 'sim', 'Random seed', 1, '', 1, '1', [1, 999, 1], ''),
];

export function createValues() {
  return SEED.map((v) => ({ ...v }));
}
