// Parameter block of the Zaan workbench, from the beamformer onward.
// Every value carries a status:
//   S  from a paper or the PDK, with the page or the expression in `source`
//   D  derived from other values; the derivation is in src/zaan/model/cdac.js and on the Charge balance page
//   A  assumption or placeholder
//   U  my own decision
// No value is decided unless it is marked U. A value that is not known is null and shown
// as an empty field; it is never filled with a guess. The status can be changed on the Values page.

export const GROUPS = {
  system: 'Converter',
  beamformer: 'Beamformer',
  balance: 'Charge balance (Chen 2018 eq. 3)',
  cdac: 'CDAC and weights',
  comparator: 'Comparator',
  timing: 'Timing (illustrative)',
  iq: 'IQ demodulator (illustrative)',
  sim: 'Simulation',
};

export const STATUS = {
  S: 'from a paper or the PDK',
  D: 'derived',
  A: 'assumption or placeholder',
  U: 'my decision',
};

function num(id, group, label, value, unit, si, siUnit, range, status, source = '', note = '') {
  const [min, max, step] = range;
  return { id, kind: 'num', group, label, value, unit, si, siUnit, min, max, step, status, source, note };
}
function choice(id, group, label, value, options, status, source = '', note = '') {
  return { id, kind: 'choice', group, label, value, options, status, source, note };
}

export const SEED = [
  num('fs', 'system', 'Sample rate', 40, 'MS/s', 1e6, 'S/s', [10, 80, 1], 'A', 'working figure'),
  num('f0', 'system', 'Echo centre frequency', 10, 'MHz', 1e6, 'Hz', [5, 15, 0.5], 'A', 'Yannick'),
  num('fbw', 'system', 'Fractional bandwidth', 60, '%', 0.01, '1', [20, 100, 5], 'A', 'Yannick'),
  num('bits', 'system', 'Resolution B (2^B codes over the full scale)', 10, 'bit', 1, 'bit', [8, 12, 1], 'A', '5 Nov'),
  num('outBits', 'system', 'Combiner output bits', 10, 'bit', 1, 'bit', [10, 14, 1], 'A', 'review: 10 bits to the IQ demodulator'),
  num('rawDecisions', 'system', 'Raw decisions planned', 12, '', 1, '1', [8, 16, 1], 'U', 'M = 11 or 12 steps; steps or decisions is still to confirm'),
  num('enobAim', 'system', 'ENOB aim', 9.5, 'bit', 1, 'bit', [8, 11, 0.1], 'A', '23 Oct'),
  num('temperature', 'system', 'Temperature', 300, 'K', 1, 'K', [250, 360, 1], 'A', 'assumed'),

  num('channels', 'beamformer', 'Channels N', 16, '', 1, '1', [4, 32, 1], 'U', 'one tile; Chen 2018 has 9'),
  num('pitch', 'beamformer', 'Element pitch', 200, 'µm', 1e-6, 'm', [100, 400, 10], 'A', 'tile design'),
  num('steer', 'beamformer', 'Steering angle', 15, '°', Math.PI / 180, 'rad', [-30, 30, 0.5], 'A', 'my MATLAB, 26 Oct', '±15° is the design range'),
  num('memCells', 'beamformer', 'Memory cells per channel', 22, '', 1, '1', [8, 48, 1], 'U', 'Chen 2018 has 8 (p. 3053)'),
  num('delayStep', 'beamformer', 'Delay step', 12.5, 'ns', 1e-9, 's', [3.125, 25, 3.125], 'U', 'my decision, 11 Nov: the inverted clock and its rising edge', 'the spec of 10 Nov says 25 ns'),
  num('c', 'beamformer', 'Speed of sound', 1540, 'm/s', 1, 'm/s', [1450, 1600, 5], 'A', 'soft tissue'),
  num('rxFocus', 'beamformer', 'Receive focus (empty = plane wave)', null, 'mm', 1e-3, 'm', [5, 40, 0.5], 'A', 'not decided'),

  // Charge balance inputs. V_REF, C_DAC, Q_LSB and C_u follow from these (D).
  num('fullScale', 'balance', 'V in,max: peak-to-peak differential swing per channel', 1, 'V', 1, 'V', [0.4, 2, 0.05], 'A', 'working figure; Chen 2018 has 800 mV (p. 3056)'),
  num('cm', 'balance', 'Memory capacitor C M', 112, 'fF', 1e-15, 'F', [20, 400, 1], 'A', 'placeholder: gives C u = 35 fF at alpha 0.40; Chen 2018 has 133 fF (p. 3055)'),
  num('cpar', 'balance', 'Parasitic capacitance on the summing node', 0, 'fF', 1e-15, 'F', [0, 3000, 10], 'A', 'unknown until extracted: switches and routing of all memory cells. Dilutes the signal like a lower alpha (Rabuske 2017, eq. 4.13)'),
  num('alpha', 'balance', 'alpha = C TH / (2 C DAC)', 0.4, '', 1, '1', [0.1, 4, 0.01], 'A', 'placeholder: gives V REF = 200 mV; Chen 2018 has 0.40 (p. 3056); Rabuske 2016 simulates 0.5 to 3'),

  num('pairSigma', 'cdac', 'Pair mismatch σ(ΔC/C) at 35 fF', 1.193, '%', 0.01, '1', [0.1, 5, 0.001], 'S', 'PDK mim5_2: 0.0499 µm / √(W L), W L = 35 fF / 2 fF/µm²'),
  num('density', 'cdac', 'Capacitor density', 2, 'fF/µm²', 1e-3, 'F/m²', [0.5, 10, 0.1], 'S', 'PDK mim5_2'),
  num('routing', 'cdac', 'Area factor for routing and switches', 1.5, '×', 1, '1', [1, 3, 0.1], 'A', 'review slide 26'),
  num('lsbPerUnit', 'cdac', 'LSB per unit capacitor n u', 8, 'LSB', 1, 'LSB', [1, 32, 1], 'A', '29 Oct example array; Chen 2018 has 8 (3 LSBs by redistribution, p. 3056)'),
  num('topUnits', 'cdac', 'First step', 32, 'units', 1, '1', [8, 64, 1], 'A', '29 Oct example array'),
  num('radix', 'cdac', 'Radix of the upper steps', 1.9, '', 1, '1', [1.5, 2, 0.01], 'A', 'sub-radix-2 is decided (U); the value is not'),
  num('halvings', 'cdac', 'Steps below one unit', 3, '', 1, '1', [0, 5, 1], 'A', '29 Oct example array; Chen 2018 has 3 (p. 3056)'),
  choice('slotCal', 'cdac', 'Gain of each read slot', 'calibrated', ['calibrated', 'not calibrated'], 'A', 'assumption: one digital gain per read slot. Not decided', 'each read slot uses another set of memory cells (Rabuske 2017, eq. 4.42)'),
  choice('calMethod', 'cdac', 'Weights in the LUT from', 'measured externally (ideal)', ['measured externally (ideal)', 'on-chip least squares, ramp', 'on-chip LMS'], 'A', 'not decided'),
  choice('halvingOn', 'cdac', 'Steps below one unit made by', 'charge halving', ['charge halving', 'small capacitors'], 'A', 'Multi-step LSB precharge: Craninckx 2007, in Rabuske 2017 p. 41; Chen 2018 p. 3056, after Malki 2014'),

  num('vos', 'comparator', 'Offset before calibration (example)', 1, 'mV', 1e-3, 'V', [0, 10, 0.1], 'A', 'example'),
  num('vosCal', 'comparator', 'Offset left after calibration', 0.15, 'mV', 1e-3, 'V', [0, 2, 0.01], 'S', 'Malki 2014, p. 1174: calibrated to within 0.15 mV', 'Chen 2018 (p. 3058) calibrates in the background but gives no value'),
  num('compNoise', 'comparator', 'Comparator input noise', 0.05, 'mV rms', 1e-3, 'V', [0, 0.5, 0.005], 'A', 'estimate; Chen 2018 gives no value; Malki 2014 (p. 1181, 40 nm) simulates 0.11 mV for the low-noise comparator'),

  num('tSample', 'timing', 'Sampling (read and share) time', 5, 'ns', 1e-9, 's', [0.5, 15, 0.1], 'A', 'illustrative'),
  num('tauDac', 'timing', 'DAC settling time constant', 0.1, 'ns', 1e-9, 's', [0.01, 1, 0.01], 'A', 'illustrative'),
  num('ibias', 'timing', 'Comparator bias current', 50, 'µA', 1e-6, 'A', [5, 500, 5], 'A', 'illustrative'),
  num('gmId', 'timing', 'Comparator gm / ID', 15, '1/V', 1, '1/V', [5, 25, 0.5], 'A', 'illustrative'),
  num('cload', 'timing', 'Comparator load capacitance', 30, 'fF', 1e-15, 'F', [5, 200, 1], 'A', 'illustrative'),
  num('vfinal', 'timing', 'Comparator swing for a valid output', 0.9, 'V', 1, 'V', [0.3, 1.8, 0.05], 'A', 'illustrative'),
  num('tLogic', 'timing', 'Logic delay per decision', 0.2, 'ns', 1e-9, 's', [0, 1, 0.01], 'A', 'illustrative'),
  num('jitter', 'timing', 'Sampling clock jitter', 1, 'ps rms', 1e-12, 's', [0, 20, 0.1], 'A', 'illustrative'),

  num('iqTaps', 'iq', 'Low-pass filter taps', 63, '', 1, '1', [7, 127, 2], 'A', 'illustrative'),
  num('iqDecim', 'iq', 'Decimation factor', 4, '', 1, '1', [1, 8, 1], 'A', 'illustrative'),
  num('iqCut', 'iq', 'Low-pass cutoff (empty = half the echo band)', null, 'MHz', 1e6, 'Hz', [0.5, 10, 0.1], 'A', 'not decided'),
  num('iqTest', 'iq', 'Test tone (empty = inside the band)', null, 'MHz', 1e6, 'Hz', [1, 19, 0.01], 'A', 'not decided'),

  num('chips', 'sim', 'Monte Carlo chips', 100, '', 1, '1', [10, 400, 10], 'A', 'simulation setting'),
  num('seed', 'sim', 'Random seed', 1, '', 1, '1', [1, 999, 1], 'A', 'simulation setting'),
];

export function createValues() {
  return SEED.map((v) => ({ ...v }));
}
