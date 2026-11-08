// Project specifications for the Zaan converter.
// Each entry: value in the shown unit, factor `si` to SI units, SI unit, a note,
// and `estimate: true` for values that are not decided yet.

function p(id, group, label, value, unit, si, siUnit, note = '', estimate = false) {
  return { id, group, label, value, unit, si, siUnit, note, estimate };
}

export const GROUPS = {
  system: 'Converter and imaging targets',
  array: 'Transducer tile',
  device: 'Capacitors and CDAC',
  chain: 'Signal chain (13 Oct, noise over 6 MHz)',
  assumed: 'Not decided yet',
};

export const DEFAULT_PARAMS = [
  p('f0', 'system', 'Centre frequency', 10, 'MHz', 1000000, 'Hz', 'range 8 to 10 MHz'),
  p('fbw', 'system', 'Fractional bandwidth', 60, '%', 0.01, '1', ''),
  p('fs', 'system', 'Sample rate', 40, 'MS/s', 1000000, 'S/s', ''),
  p('bits', 'system', 'Resolution', 10, 'bit', 1, 'bit', ''),
  p('enobAim', 'system', 'ENOB aim', 9.5, 'bit', 1, 'bit', ''),
  p('rawDecisions', 'system', 'Raw decisions', 12, '', 1, '1', ''),
  p('fullScale', 'system', 'Full scale (differential, peak to peak)', 1, 'V', 1, 'V', 'conservative, not fixed'),
  p('vref', 'system', 'V REF', 200, 'mV', 0.001, 'V', 'take a value for now'),
  p('channels', 'system', 'Channels per converter', 16, '', 1, '1', ''),
  p('memCaps', 'system', 'Memory capacitors per channel', 22, '', 1, '1', ''),
  p('delayStep', 'system', 'Analog delay step', 12.5, 'ns', 1e-9, 's', 'baseline; compare 25 ns and 1 to 2 finer steps'),
  p('steer', 'system', 'Receive steering (plus/minus)', 15, 'deg', Math.PI / 180, 'rad', ''),
  p('depth', 'system', 'Working depth', 20, 'mm', 0.001, 'm', ''),
  p('depthKey', 'system', 'Most important depth', 15, 'mm', 0.001, 'm', ''),
  p('frameRate', 'system', 'Frame rate (minimum)', 30, 'fps', 1, '1/s', ''),
  p('c', 'system', 'Speed of sound', 1540, 'm/s', 1, 'm/s', 'soft tissue value', true),
  p('imageDR', 'system', 'Image dynamic range', 60, 'dB', 1, 'dB', 'initial reference only, not a specification'),
  p('elements', 'array', 'Elements per tile', 16, '', 1, '1', '1 x 16 line'),
  p('pitch', 'array', 'Element pitch', 200, 'um', 0.000001, 'm', ''),
  p('kerf', 'array', 'Kerf', 20, 'um', 0.000001, 'm', ''),
  p('elementLength', 'array', 'Element length', 5, 'mm', 0.001, 'm', ''),
  p('chipWidth', 'array', 'Chip width', 3.2, 'mm', 0.001, 'm', ''),
  p('chipLength', 'array', 'Chip length', 5, 'mm', 0.001, 'm', ''),
  p('tiles', 'array', 'Tiles in a row', 16, '', 1, '1', '256 channels, fired one after another'),
  p('capDensity', 'device', 'Capacitor density', 2, 'fF/µm²', 0.001, 'F/m2', 'use in all calculations'),
  p('mimSide', 'device', 'Minimum MIM side', 4, 'um', 0.000001, 'm', 'square device, 4 µm × 4 µm; from the PDK; page not checked yet'),
  p('mimMin', 'device', 'Minimum MIM capacitance', 35, 'fF', 1e-15, 'F', 'from the PDK; page not checked yet'),
  p('mimMatch', 'device', 'MIM matching coefficient', 0.0499, 'um', 0.000001, 'm', 'pair σ(ΔC/C) = coefficient / √(W·L); from the PDK; page not checked yet'),
  p('radix', 'device', 'CDAC radix, upper steps', 1.9, '', 1, '1', 'sub-radix-2; charge-halving LSBs (Malki); radix may differ per step'),
  p('dnlLimit', 'device', 'Mismatch criterion: 3σ DNL below', 0.5, 'LSB', 1, 'LSB', ''),
  p('pmutNoise', 'chain', 'PMUT noise at the PMUT', 1.017, 'µV rms', 0.000001, 'V', ''),
  p('lnaNoise', 'chain', 'LNA noise, input referred', 1.537, 'µV rms', 0.000001, 'V', ''),
  p('sMax', 'chain', 'Smax at the PMUT', 25, 'mV rms', 0.001, 'V', ''),
  p('sMin', 'chain', 'Smin at the PMUT', 1.41, 'mV rms', 0.001, 'V', ''),
  p('afeGain', 'chain', 'AFE gain', 30, 'dB', 1, 'dB', ''),
  p('idr', 'chain', 'Instantaneous dynamic range', 24, 'dB', 1, 'dB', ''),
  p('tgcStep', 'chain', 'TGC step', 2.5, 'dB', 1, 'dB', 'TGC is Zehou\'s block; numbers only'),
  p('idrTotal', 'chain', 'IDR plus TGC, total', 26.5, 'dB', 1, 'dB', ''),
  p('pmutNoiseAfe', 'chain', 'PMUT noise after AFE', 32.2, 'µV rms', 0.000001, 'V', ''),
  p('lnaNoiseAfe', 'chain', 'LNA noise after AFE', 58.3, 'µV rms', 0.000001, 'V', ''),
  p('sMaxAfe', 'chain', 'Smax after AFE', 790, 'mV rms', 0.001, 'V', ''),
  p('sMinAfe', 'chain', 'Smin after AFE', 44.6, 'mV rms', 0.001, 'V', ''),
  p('noiseAfterBf', 'chain', 'Noise after beamformer', 14.6, 'µV rms', 0.000001, 'V', 'one fourth of the AFE output noise'),
  p('adcQuantNoise', 'chain', 'ADC quantisation noise', 280, 'µV rms', 0.000001, 'V', 'chain was built on ENOB 9; see conflict 1'),
  p('temperature', 'assumed', 'Temperature for kT/C', 300, 'K', 1, 'K', 'a wrist chip may run near 310 K', true),
  p('cmExample', 'assumed', 'Memory capacitor, example value', 35, 'fF', 1e-15, 'F', 'example used in the decisions page until the CDAC block exists', true),
  p('tSample', 'assumed', 'Sampling time Ts', 5, 'ns', 1e-9, 's', 'not known yet; drag it in the budget to see the effect', true),
  p('tLogic', 'assumed', 'SAR logic delay per decision', 0, 'ns', 1e-9, 's', 'left at 0 until known; the budget is optimistic', true),
];

export const OPEN_ITEMS = [
  'Capacitor device for CDAC and memory capacitors (MIM, MOM, MOS, finger)',
  'Front end output type (voltage or current)',
  'Instantaneous dynamic range at the wrist',
  'The 4 focal depths (proposal 10, 15, 20, 30 mm)',
  'Reference generation (external pin or on-chip buffer)',
  'Power share',
  'How to get a 12.5 ns delay step without extra memory capacitors',
  'LUT per bit or per code',
  'How far the IQ demodulator goes',
];

/** Fresh, editable copy of the specifications. */
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
