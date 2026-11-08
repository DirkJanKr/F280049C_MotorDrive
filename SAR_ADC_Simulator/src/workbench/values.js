// Every input value of the Zaan workbench, with status, source and date.
// Status codes (Knowledge Base): S paper page checked, S* paper page not checked,
// U own or team, D derived, A assumption, ? unknown.
// A "?" value has value null and is never filled with a guess.

export const STATUS = {
  S: 'From a paper, page checked',
  'S*': 'From a paper, page not checked',
  U: 'Own or team value',
  D: 'Derived; formula in the inspector',
  A: 'Assumption',
  '?': 'Unknown: fill it in',
};

export const BLOCKS = {
  system: 'System',
  chain: 'Signal chain (13 Oct)',
  frontend: 'Front end and test input',
  beamformer: 'Beamformer',
  cdac: 'CDAC',
  reference: 'Reference',
  sampling: 'Sampling switch',
  comparator: 'Comparator',
  logic: 'SAR logic and clocks',
  power: 'Power',
  sim: 'Simulation settings',
};

/** num(id, block, label, value, unit, si, siUnit, status, source, date, note) */
function num(id, block, label, value, unit, si, siUnit, status, source, date = '', note = '') {
  return { id, kind: 'num', block, label, value, unit, si, siUnit, status, source, date, note };
}
function choice(id, block, label, value, options, status, source, date = '', note = '') {
  return { id, kind: 'choice', block, label, value, options, status, source, date, note };
}
function text(id, block, label, value, status, source, date = '', note = '') {
  return { id, kind: 'text', block, label, value, status, source, date, note };
}

export const SEED = [
  num('fs', 'system', 'Sample rate fs', 40, 'MS/s', 1e6, 'S/s', 'U', 'working figure'),
  num('f0', 'system', 'Centre frequency f0', 10, 'MHz', 1e6, 'Hz', 'U', 'Yannick', '', 'echo band about 7 to 13 MHz'),
  num('fbw', 'system', 'Fractional bandwidth', 60, '%', 0.01, '1', 'U', 'Yannick'),
  num('fullScale', 'system', 'Full scale, differential peak to peak', 1, 'V', 1, 'V', 'U', 'Yannick', '', 'conservative, not fixed'),
  num('bits', 'system', 'Output bits', 10, 'bit', 1, 'bit', 'U', '5 Nov', '2026-11-05'),
  num('rawDecisions', 'system', 'Raw decisions', 12, '', 1, '1', 'U', '5 Nov', '2026-11-05'),
  num('enobAim', 'system', 'ENOB aim', 9.5, 'bit', 1, 'bit', 'U', '23 Oct', '2026-10-23'),
  num('depth', 'system', 'Working depth', 20, 'mm', 1e-3, 'm', 'U', 'clinical team'),
  num('depthKey', 'system', 'Most important depth', 15, 'mm', 1e-3, 'm', 'U', 'clinical team'),
  text('focalDepths', 'system', 'Transmit focal depths', '10, 15, 20, 30 mm', '?', 'proposal only'),
  num('c', 'system', 'Speed of sound', 1540, 'm/s', 1, 'm/s', 'A', 'soft tissue assumption'),
  num('temperature', 'system', 'Temperature for kT/C', 300, 'K', 1, 'K', 'A', 'existing estimate'),

  num('pmutNoise', 'chain', 'PMUT noise at the PMUT', 1.017, 'µV rms', 1e-6, 'V', 'U', '13 Oct chain, built on ENOB 9', '2026-10-13'),
  num('lnaNoise', 'chain', 'LNA noise, input referred', 1.537, 'µV rms', 1e-6, 'V', 'U', '13 Oct chain, built on ENOB 9', '2026-10-13'),
  num('sMax', 'chain', 'Smax at the PMUT', 25, 'mV rms', 1e-3, 'V', 'U', '13 Oct chain, built on ENOB 9', '2026-10-13'),
  num('sMin', 'chain', 'Smin at the PMUT', 1.41, 'mV rms', 1e-3, 'V', 'U', '13 Oct chain, built on ENOB 9', '2026-10-13'),
  num('afeGain', 'chain', 'AFE gain', 30, 'dB', 1, 'dB', 'U', '13 Oct chain, built on ENOB 9', '2026-10-13'),
  num('idr', 'chain', 'Instantaneous dynamic range', 24, 'dB', 1, 'dB', 'U', '13 Oct chain, built on ENOB 9', '2026-10-13'),
  num('tgcStep', 'chain', 'TGC step', 2.5, 'dB', 1, 'dB', 'U', '13 Oct chain (TGC is Zehou\'s block)', '2026-10-13'),
  num('sMaxAfe', 'chain', 'Smax after AFE', 790, 'mV rms', 1e-3, 'V', 'U', '13 Oct chain, built on ENOB 9', '2026-10-13'),
  num('sMinAfe', 'chain', 'Smin after AFE', 44.6, 'mV rms', 1e-3, 'V', 'U', '13 Oct chain, built on ENOB 9', '2026-10-13'),
  num('pmutNoiseAfe', 'chain', 'PMUT noise after AFE', 32.2, 'µV rms', 1e-6, 'V', 'U', '13 Oct chain, built on ENOB 9', '2026-10-13'),
  num('lnaNoiseAfe', 'chain', 'LNA noise after AFE', 58.3, 'µV rms', 1e-6, 'V', 'U', '13 Oct chain, built on ENOB 9', '2026-10-13'),
  num('noiseAfterBf', 'chain', 'Noise after beamformer', 14.6, 'µV rms', 1e-6, 'V', 'U', '13 Oct chain, built on ENOB 9', '2026-10-13'),

  choice('feType', 'frontend', 'Front-end output type', null, ['voltage', 'current'], '?', 'open'),
  num('rDrive', 'frontend', 'LNA output (drive) resistance', null, 'kΩ', 1e3, 'Ω', '?', 'from Zehou\'s LNA design'),
  choice('testEntry', 'frontend', 'Test input entry point', 'at the beamformer', ['at the beamformer'], 'U', 'review slide 32 (proposal)', '2026-11-06', 'exact entry point still open'),

  num('channels', 'beamformer', 'Channels per converter', 16, '', 1, '1', 'U', 'one tile'),
  num('pitch', 'beamformer', 'Element pitch', 200, 'µm', 1e-6, 'm', 'U', 'tile design'),
  num('steer', 'beamformer', 'Receive steering, plus or minus', 15, '°', Math.PI / 180, 'rad', 'U', 'my MATLAB', '2026-10-26'),
  num('memCells', 'beamformer', 'Memory cells per channel', 22, '', 1, '1', 'U', 'review slide 7'),
  num('delayStep', 'beamformer', 'Delay step', 12.5, 'ns', 1e-9, 's', 'U', 'CLK and CLK 180°', '2026-11-08'),
  num('rxFocus', 'beamformer', 'Receive focus for the beam graphs', null, 'mm', 1e-3, 'm', '?', 'one of the focal depths (open)', '', 'empty: plane-wave steering is used'),
  num('leakage', 'beamformer', 'Memory cell leakage current', null, 'fA', 1e-15, 'A', '?', 'PDK switch data'),

  num('cu', 'cdac', 'Unit capacitor Cu', 35, 'fF', 1e-15, 'F', 'U', 'PDK minimum MIM'),
  num('density', 'cdac', 'MIM density', 2, 'fF/µm²', 1e-3, 'F/m²', 'U', 'PDK'),
  num('pairSigma', 'cdac', 'Pair mismatch σ(ΔC/C) at 35 fF', 1.25, '%', 0.01, '1', 'U', 'PDK'),
  choice('device', 'cdac', 'Capacitor device', 'MIM', ['MIM', 'MOS'], 'A', 'working assumption; MOS also acceptable per 5 Nov review', '2026-11-05'),
  num('radix', 'cdac', 'Radix of the upper steps', 1.9, '', 1, '1', 'U', 'Chang 2013'),
  num('topUnits', 'cdac', 'First step', 32, 'units', 1, '1', 'U', '29 Oct example array', '2026-10-29'),
  num('lsbPerUnit', 'cdac', 'LSB per unit capacitor', 8, 'LSB', 1, 'LSB', 'U', '29 Oct example array', '2026-10-29'),
  num('halvings', 'cdac', 'Charge-halving steps (Malki/Chen)', 3, '', 1, '1', 'U', '29 Oct example array', '2026-10-29'),
  text('stepModel', 'cdac', 'Unit step model', 'one unit step delivers 2 × VREF × Cu of differential charge and adds 2 × Cu to the node', 'A', 'my assumption'),
  num('routing', 'cdac', 'Area factor for routing and switches', 1.5, '×', 1, '1', 'A', 'review slide 26, assumed'),

  num('vref', 'reference', 'VREF', 200, 'mV', 1e-3, 'V', 'A', 'review said take a value', '2026-11-05'),
  choice('refVariant', 'reference', 'Reference variant', null, ['ping-pong CDAC', 'reservoir C RSV with servo (Guo 2024)', 'external pin (DFT)'], '?', 'open'),
  num('cRsv', 'reference', 'Reservoir capacitance C RSV', null, 'pF', 1e-12, 'F', '?', 'Guo 2024, not sized'),
  num('refNoise', 'reference', 'Reference noise, relative', null, 'ppm rms', 1e-6, '1', '?', 'reference design'),

  num('tSample', 'sampling', 'Sampling (read and share) time Ts', 5, 'ns', 1e-9, 's', 'A', 'existing estimate'),
  num('rOn', 'sampling', 'Switch on-resistance at mid-supply', null, 'Ω', 1, 'Ω', '?', 'PDK switch data'),
  num('qInj', 'sampling', 'Switch channel charge (injection)', null, 'fC', 1e-15, 'C', '?', 'PDK switch data'),
  num('vdd', 'sampling', 'Supply voltage', null, 'V', 1, 'V', '?', 'PDK / system'),

  num('compNoise', 'comparator', 'Comparator input noise', 0.05, 'mV rms', 1e-3, 'V', 'A', 'existing estimate'),
  num('ibias', 'comparator', 'Comparator bias current', 50, 'µA', 1e-6, 'A', 'A', 'existing estimate'),
  num('gmId', 'comparator', 'gm / ID', 15, '1/V', 1, '1/V', 'A', 'existing estimate'),
  num('cload', 'comparator', 'Comparator load capacitance', 30, 'fF', 1e-15, 'F', 'A', 'existing estimate'),
  num('vfinal', 'comparator', 'Output swing for a valid decision', 0.9, 'V', 1, 'V', 'A', 'existing estimate'),
  num('vos', 'comparator', 'Comparator offset, example', 1, 'mV', 1e-3, 'V', 'A', 'existing estimate (example value)'),
  num('vosCal', 'comparator', 'Offset left after calibration', 0.1, 'mV', 1e-3, 'V', 'A', 'existing estimate'),
  num('vosSigma', 'comparator', 'Offset spread σ before calibration', null, 'mV', 1e-3, 'V', '?', 'comparator block, 16 Nov'),

  num('tauDac', 'logic', 'DAC settling time constant', 0.1, 'ns', 1e-9, 's', 'A', 'existing estimate'),
  num('tLogic', 'logic', 'Logic delay per decision', 0.2, 'ns', 1e-9, 's', 'A', 'existing estimate'),
  num('jitter', 'logic', 'Sampling clock jitter', 1, 'ps rms', 1e-12, 's', 'A', 'existing estimate'),
  choice('lutType', 'logic', 'LUT per bit or per code', null, ['per bit', 'per code'], '?', 'open; review slide 24 draws per bit'),
  choice('iqExtent', 'logic', 'How far the IQ demodulator goes', null, ['mix only', 'mix and low-pass', 'mix, low-pass and decimate'], '?', 'open'),

  num('pBeam', 'power', 'Beamformer power', null, 'µW', 1e-6, 'W', '?', 'not designed yet'),
  num('pComp', 'power', 'Comparator power', null, 'µW', 1e-6, 'W', '?', 'needs supply voltage'),
  num('pLogic', 'power', 'SAR logic and combiner power', null, 'µW', 1e-6, 'W', '?', 'not designed yet'),
  num('pIq', 'power', 'IQ demodulator power', null, 'µW', 1e-6, 'W', '?', 'not designed yet'),

  num('chips', 'sim', 'Monte Carlo chips', 100, '', 1, '1', 'U', 'workbench setting'),
  num('seed', 'sim', 'Random seed', 1, '', 1, '1', 'U', 'workbench setting'),
];

/** Open decisions from my notes (besides every "?" value, which is listed automatically). */
export const OPEN_DECISIONS = [
  { title: 'Front-end output type: voltage or current', value: 'feType', el: 'lna' },
  { title: 'Reference variant: ping-pong, reservoir with servo, or external pin', value: 'refVariant', el: 'ref' },
  { title: 'Capacitor device: MIM (working assumption) or MOS', value: 'device', el: 'cdacP' },
  { title: 'Focal depths: 10, 15, 20, 30 mm is a proposal', value: 'focalDepths', el: 'bf' },
  { title: 'Instantaneous dynamic range at the wrist', value: 'idr', el: 'lna' },
  { title: 'Power share per block', value: 'pBeam', el: 'sys' },
  { title: 'LUT per bit or per code', value: 'lutType', el: 'lut' },
  { title: 'How far the IQ demodulator goes', value: 'iqExtent', el: 'iq' },
  { title: 'Test signal entry point, pad count, capture interface', value: 'testEntry', el: 'test' },
];

/** Contradictions found in the notes and the model. Each is computed live in derive.js. */
export const CONFLICT_IDS = ['fs4f0', 'cmBalance', 'offsetSlides', 'smaxFs', 'grating', 'matching'];

export function createValues() {
  return SEED.map((v) => ({ ...v }));
}

export function today() {
  return new Date().toISOString().slice(0, 10);
}
