// Parameter registry for the Zaan converter.
// Every parameter: value in the shown unit, factor `si` to SI, SI unit,
// status code, source, date (ISO, empty when not given) and an optional note.
// Defaults are Dirk-Jan's own values. No paper values are defaults.

export const STATUS = {
  S: 'From a paper, page checked',
  'S*': 'From a paper, page not checked',
  U: "Mine or my team's",
  D: 'Derived (derivation shown)',
  A: 'Assumption',
  '?': 'Unknown',
};

function p(id, group, label, value, unit, si, siUnit, status, source, date, note = '') {
  return { id, group, label, value, unit, si, siUnit, status, source, date, note };
}

export const GROUPS = {
  system: 'System and converter targets',
  array: 'Transducer tile',
  device: 'Capacitor devices and CDAC',
  chain: 'Signal chain of 13 Oct (noise over 6 MHz)',
  assumed: 'Working assumptions and unknowns',
};

export const DEFAULT_PARAMS = [
  p('f0', 'system', 'Centre frequency', 10, 'MHz', 1e6, 'Hz', 'U', 'Yannick', '', 'range 8 to 10 MHz'),
  p('fbw', 'system', 'Fractional bandwidth', 60, '%', 0.01, '1', 'U', 'Yannick', ''),
  p('fs', 'system', 'Sample rate', 40, 'MS/s', 1e6, 'S/s', 'U', 'working figure', ''),
  p('bits', 'system', 'Resolution', 10, 'bit', 1, 'bit', 'U', '23 Oct', '2026-10-23'),
  p('enobAim', 'system', 'ENOB aim', 9.5, 'bit', 1, 'bit', 'U', '23 Oct', '2026-10-23'),
  p('rawDecisions', 'system', 'Raw decisions', 12, '', 1, '1', 'U', '5 Nov', '2026-11-05'),
  p('fullScale', 'system', 'Full scale (differential, peak to peak)', 1, 'V', 1, 'V', 'U', 'Yannick', '', 'conservative, not fixed'),
  p('vref', 'system', 'V REF', 200, 'mV', 1e-3, 'V', 'U', '5 Nov review', '2026-11-05', 'take a value for now'),
  p('channels', 'system', 'Channels per converter', 16, '', 1, '1', 'U', 'not given', ''),
  p('memCaps', 'system', 'Memory capacitors per channel', 22, '', 1, '1', 'U', 'not given', ''),
  p('delayStep', 'system', 'Analog delay step', 12.5, 'ns', 1e-9, 's', 'U', '28 Oct, 5 Nov review', '2026-11-05', 'baseline; compare 25 ns and 1 to 2 finer steps'),
  p('steer', 'system', 'Receive steering (plus/minus)', 15, 'deg', Math.PI / 180, 'rad', 'U', 'own MATLAB simulations', ''),
  p('depth', 'system', 'Working depth', 20, 'mm', 1e-3, 'm', 'U', 'clinical team', ''),
  p('depthKey', 'system', 'Most important depth', 15, 'mm', 1e-3, 'm', 'U', 'clinical team', ''),
  p('frameRate', 'system', 'Frame rate (minimum)', 30, 'fps', 1, '1/s', 'U', 'not given', ''),
  p('c', 'system', 'Speed of sound', 1540, 'm/s', 1, 'm/s', 'A', 'soft tissue assumption', ''),
  p('imageDR', 'system', 'Image dynamic range', 60, 'dB', 1, 'dB', 'U', 'MIT figure', '', 'initial reference only, not a specification'),

  p('elements', 'array', 'Elements per tile', 16, '', 1, '1', 'U', 'system description', '', '1 x 16 line'),
  p('pitch', 'array', 'Element pitch', 200, 'um', 1e-6, 'm', 'U', 'system description', ''),
  p('kerf', 'array', 'Kerf', 20, 'um', 1e-6, 'm', 'U', 'system description', ''),
  p('elementLength', 'array', 'Element length', 5, 'mm', 1e-3, 'm', 'U', 'system description', ''),
  p('chipWidth', 'array', 'Chip width', 3.2, 'mm', 1e-3, 'm', 'U', 'system description', ''),
  p('chipLength', 'array', 'Chip length', 5, 'mm', 1e-3, 'm', 'U', 'system description', ''),
  p('tiles', 'array', 'Tiles in a row', 16, '', 1, '1', 'U', 'system description', '', '256 channels, fired one after another'),

  p('capDensity', 'device', 'Capacitor density', 2, 'fF/um2', 1e-3, 'F/m2', 'U', 'not given', '', 'use in all calculations'),
  p('mimSide', 'device', 'Minimum MIM side', 4, 'um', 1e-6, 'm', 'S*', 'PDK', '', 'square device, 4 um x 4 um'),
  p('mimMin', 'device', 'Minimum MIM capacitance', 35, 'fF', 1e-15, 'F', 'S*', 'PDK', ''),
  p('mimMatch', 'device', 'MIM matching coefficient', 0.0499, 'um', 1e-6, 'm', 'S*', 'PDK', '', 'pair sigma(dC/C) = coefficient / sqrt(W L)'),
  p('radix', 'device', 'CDAC radix, upper steps', 1.9, '', 1, '1', 'U', '29 Oct, 3 Nov', '2026-11-03', 'sub-radix-2; charge-halving LSBs (Malki); radix may differ per step'),
  p('dnlLimit', 'device', 'Mismatch criterion: 3 sigma DNL below', 0.5, 'LSB', 1, 'LSB', 'U', 'not given', ''),

  p('pmutNoise', 'chain', 'PMUT noise at the PMUT', 1.017, 'uV rms', 1e-6, 'V', 'U', '13 Oct chain', '2026-10-13'),
  p('lnaNoise', 'chain', 'LNA noise, input referred', 1.537, 'uV rms', 1e-6, 'V', 'U', '13 Oct chain', '2026-10-13'),
  p('sMax', 'chain', 'Smax at the PMUT', 25, 'mV rms', 1e-3, 'V', 'U', '13 Oct chain', '2026-10-13'),
  p('sMin', 'chain', 'Smin at the PMUT', 1.41, 'mV rms', 1e-3, 'V', 'U', '13 Oct chain', '2026-10-13'),
  p('afeGain', 'chain', 'AFE gain', 30, 'dB', 1, 'dB', 'U', '13 Oct chain', '2026-10-13'),
  p('idr', 'chain', 'Instantaneous dynamic range', 24, 'dB', 1, 'dB', 'U', '13 Oct chain', '2026-10-13'),
  p('tgcStep', 'chain', 'TGC step', 2.5, 'dB', 1, 'dB', 'U', '13 Oct chain', '2026-10-13', 'TGC is Zehou\'s block; numbers only'),
  p('idrTotal', 'chain', 'IDR plus TGC, total', 26.5, 'dB', 1, 'dB', 'U', '13 Oct chain', '2026-10-13'),
  p('pmutNoiseAfe', 'chain', 'PMUT noise after AFE', 32.2, 'uV rms', 1e-6, 'V', 'U', '13 Oct chain', '2026-10-13'),
  p('lnaNoiseAfe', 'chain', 'LNA noise after AFE', 58.3, 'uV rms', 1e-6, 'V', 'U', '13 Oct chain', '2026-10-13'),
  p('sMaxAfe', 'chain', 'Smax after AFE', 790, 'mV rms', 1e-3, 'V', 'U', '13 Oct chain', '2026-10-13'),
  p('sMinAfe', 'chain', 'Smin after AFE', 44.6, 'mV rms', 1e-3, 'V', 'U', '13 Oct chain', '2026-10-13'),
  p('noiseAfterBf', 'chain', 'Noise after beamformer', 14.6, 'uV rms', 1e-6, 'V', 'U', '13 Oct chain', '2026-10-13', 'one fourth of the AFE output noise'),
  p('adcQuantNoise', 'chain', 'ADC quantisation noise', 280, 'uV rms', 1e-6, 'V', 'U', '13 Oct chain', '2026-10-13', 'chain was built on ENOB 9; see conflict 1'),

  p('temperature', 'assumed', 'Temperature for kT/C', 300, 'K', 1, 'K', 'A', 'my assumption', '', 'a wrist chip may run near 310 K'),
  p('cmExample', 'assumed', 'Memory capacitor, example value', 35, 'fF', 1e-15, 'F', 'A', 'set equal to minimum MIM', '', 'only for flags F5 and F6 until phase 2'),
  p('tSample', 'assumed', 'Sampling time Ts', 5, 'ns', 1e-9, 's', '?', 'unknown', '', 'placeholder so the timing budget can be drawn'),
  p('tLogic', 'assumed', 'SAR logic delay per decision', 0, 'ns', 1e-9, 's', '?', 'unknown', '', 'left at 0 until known; the budget is optimistic'),
];

export const OPEN_ITEMS = [
  'Capacitor device for CDAC and memory capacitors (MIM, MOM, MOS, finger)',
  'Front end output type (voltage or current)',
  'Instantaneous dynamic range at the wrist',
  'The 4 focal depths (proposal 10, 15, 20, 30 mm)',
  'Reference generation (external pin or on-chip buffer)',
  'Power share',
  'Mechanism for a 12.5 ns delay step without extra memory capacitors (Hopf paper to study)',
  'LUT per bit or per code',
  'How far the IQ demodulator goes',
];

/** Fresh, editable copy of the registry. */
export function createRegistry() {
  return DEFAULT_PARAMS.map((x) => ({ ...x }));
}

export function findParam(reg, id) {
  const x = reg.find((q) => q.id === id);
  if (!x) throw new Error(`Unknown parameter ${id}`);
  return x;
}

/** Value of a parameter in SI units. */
export function si(reg, id) {
  const x = findParam(reg, id);
  return x.value * x.si;
}
