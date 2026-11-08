// Chapter 8: one image line through the whole chain.

import { knob, uiKnob, knobGroup } from '../knobs.js';
import { context } from '../ctx.js';
import { plot, figure, C } from '../charts.js';
import { num } from '../fmt.js';
import { readouts, fillReadouts, insight } from '../callouts.js';
import { echoLine } from '../../model/echo.js';
import { drawChip } from '../../model/chargeSar.js';
import { testChip } from '../../model/testbench.js';
import { createRng } from '../../../model/rng.js';

export const chapter = {
  id: 'chain', n: 8, short: 'Full chain', title: 'What does one image line look like?',
  lede: 'Point reflectors in tissue, a bone below them. Sixteen channels, delay-and-sum in charge, the charge-sharing ADC of this chip, the calibrated combiner and the IQ demodulator.',
  view(state) {
    return {
      knobs:
        knobGroup('Scene', [
          uiKnob(state, 'z1', { label: 'Tendon 1 depth', min: 3, max: 34, step: 0.5, unit: 'mm' }),
          uiKnob(state, 'z2', { label: 'Tendon 2 depth', min: 3, max: 34, step: 0.5, unit: 'mm' }),
          uiKnob(state, 'z3', { label: 'Muscle boundary depth', min: 3, max: 34, step: 0.5, unit: 'mm' }),
          uiKnob(state, 'weak', { label: 'Muscle echo, relative', min: -40, max: 0, step: 1, unit: 'dB' }),
          uiKnob(state, 'bone', { label: 'Bone depth', min: 10, max: 35, step: 0.5, unit: 'mm', note: '35 mm = no bone in view' }),
          uiKnob(state, 'level', { label: 'Strongest tissue echo', min: -40, max: 0, step: 1, unit: 'dBFS' }),
        ].join('')) + knobGroup('Beam', ['steer', 'focus', 'delayStep'].map((id) => knob(state, id)).join('')) + knobGroup('Converter', knob(state, 'outBits') + knob(state, 'seed')),
      main: `${readouts('ch-ro')}
        ${figure('ch-rf', 'Before and after the beamformer')}
        ${figure('ch-code', 'ADC output codes')}
        ${figure('ch-env', 'Envelope of the image line after IQ demodulation')}
        <div id="ch-ins"></div>`,
    };
  },
  update(state) {
    const { P, d } = context(state);
    const u = state.ui;
    const rng = createRng(P.seed);
    const chip = drawChip(d, P, rng);
    const cal = testChip(chip, d, P, rng, { samplesPerCode: 2 }).cal;
    const reflectors = [{ z: u.z1 * 1e-3, a: 1 }, { z: u.z2 * 1e-3, a: 0.7 }, { z: u.z3 * 1e-3, a: 10 ** (u.weak / 20) }];
    const bone = u.bone < 35 ? { z: u.bone * 1e-3, a: 8 } : null;
    const r = echoLine(P, d, chip, cal, { reflectors, bone, level: u.level, rng, fracBits: Math.max(0, P.outBits - P.bits) });
    const us = (k) => r.t[k] * 1e6;
    const pick = (arr, scale = 1) => Array.from(arr, (y, k) => [us(k), y * scale]);
    document.getElementById('ch-rf').innerHTML = plot({
      height: 230, x: { min: 0, max: r.t[r.t.length - 1] * 1e6, label: 'time [µs]' }, y: { min: -P.fullScale / 2, max: P.fullScale / 2, label: 'V' },
      series: [{ points: pick(r.ch0), color: C.muted, width: 0.8, label: 'element 1' }, { points: pick(r.analog), color: C.a, width: 1.1, label: 'delayed sum of 16' }],
      legend: true,
    });
    document.getElementById('ch-code').innerHTML = plot({
      height: 200, x: { min: 0, max: r.t[r.t.length - 1] * 1e6, label: 'time [µs]' }, y: { min: -d.codes / 2, max: d.codes / 2, label: 'code − mid' },
      series: [{ points: pick(r.codes), color: C.c, width: 1 }],
    });
    const zmax = r.depth[r.depth.length - 1] * 1e3;
    document.getElementById('ch-env').innerHTML = plot({
      height: 260, x: { min: 0, max: zmax, label: 'depth [mm]' }, y: { min: -70, max: 3, label: 'dB' },
      series: [{ points: r.envDb.map((y, i) => [r.depth[i] * 1e3, y]), color: C.a, width: 1.8 }],
      vlines: r.targets.map((tg) => ({ x: tg.z * 1e3, color: bone && tg.z === bone.z ? C.bad : C.b, label: bone && tg.z === bone.z ? 'bone' : '' })),
    });
    document.getElementById('ch-env-cap').textContent = 'Dashed lines: true reflector depths. Signals as seen after the front end: attenuation with depth is assumed compensated before the ADC; the bone clips the channels.';
    const floor = [...r.envDb].sort((a, b) => a - b)[Math.floor(r.envDb.length * 0.2)];
    fillReadouts(document.getElementById('ch-ro'), [
      ['Noise floor of the line', `${num(floor, 0)} dB`, 'below the brightest echo'],
      ['Muscle echo', `${num(u.weak, 0)} dB`, 'relative to tendon 1'],
      ['Samples per line', `${r.codes.length}`, `${num(P.fs / 1e6, 0)} MS/s, ${num(zmax, 0)} mm`],
      ['Combiner output', `${P.outBits} bit`, 'into the IQ demodulator'],
    ]);
    document.getElementById('ch-ins').innerHTML = insight('Read the line like an image column', 'Each peak is a reflector; its width is set by the pulse bandwidth. Raise the delay step to 25 ns or steer further and watch the peaks; lower the strongest echo and watch weak echoes sink into the ADC noise.');
  },
};
