import test from 'node:test';
import assert from 'node:assert/strict';
import { simulateTones, dbc } from '../src/zaan/model/tones.js';

const base = { N: 16, M: 22, fs: 40e6, f0: 7.3e6, pitch: 200e-6, steer: (15 * Math.PI) / 180, cm: 280e-15, level: 0.95, qFs: 4480e-15, chips: 30, seed: 3 };

test('gain tones: the simulation follows sigma cap^2 / (2N) (M-1)/M within 1 dB (MATLAB step 2b: -65.6 dBc at 280 fF MIM)', () => {
  const r = simulateTones({ ...base, aMem: 0.0499, cellQ: 0 });
  assert.ok(Math.abs(dbc(r.gain) - dbc(r.theory.gain)) < 1, `${dbc(r.gain)} vs ${dbc(r.theory.gain)}`);
  assert.ok(Math.abs(dbc(r.theory.gain) + 65.8) < 0.3);
  assert.ok(r.offset < 1e-12);
});

test('offset tones from charge injection follow N sigma q^2 (M-1)/M / (A^2/2) within 1 dB and grow as the signal gets smaller', () => {
  const r = simulateTones({ ...base, aMem: 1e-9, cellQ: 0.16e-15 });
  assert.ok(Math.abs(dbc(r.offset) - dbc(r.theory.offset)) < 1, `${dbc(r.offset)} vs ${dbc(r.theory.offset)}`);
  const weak = simulateTones({ ...base, aMem: 1e-9, cellQ: 0.16e-15, level: 0.0095 });
  assert.ok(Math.abs(dbc(weak.offset) - dbc(r.offset) - 40) < 0.5, 'a 40 dB weaker echo sees 40 dB more offset tones');
  assert.ok(Math.abs(dbc(weak.gain) - dbc(r.gain)) < 0.5, 'gain tones stay the same relative to the echo');
});

test('in-band part is a fraction of the total', () => {
  const r = simulateTones({ ...base, aMem: 0.0499, cellQ: 0.16e-15 });
  assert.ok(r.gainIn < r.gain && r.offsetIn < r.offset && r.gainIn > 0);
});
