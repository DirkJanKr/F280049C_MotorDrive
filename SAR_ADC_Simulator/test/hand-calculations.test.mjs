// Hand-calculated reference examples. Every expected number below is derived
// on paper from Q = C*V and charge conservation, not from the simulator.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createAdc } from '../src/model/adc.js';
import { convert } from '../src/model/sar.js';

const fF = 1e-15;
const close = (a, b, tol = 1e-12, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} expected ${b}, got ${a}`);

test('4-bit conventional SE, Vin = 0.6 V, Vref = 1 V, Vcm = 0.5 V, Cu = 1 fF', () => {
  // Ct = 16 fF. Sampling: Q_X = 16 fF * (0.5 - 0.6) = -1.6 fC.
  // Trial 1000: Vx = (-1.6 fC + 8 fF*1 V)/16 fF = 0.4    < 0.5 -> b3 = 1
  // Trial 1100: Vx = (-1.6 + 12)/16             = 0.65   > 0.5 -> b2 = 0
  // Trial 1010: Vx = (-1.6 + 10)/16             = 0.525  > 0.5 -> b1 = 0
  // Trial 1001: Vx = (-1.6 + 9)/16              = 0.4625 < 0.5 -> b0 = 1   => code 1001b = 9
  const adc = createAdc({ scheme: 'conventional', bits: 4, unitCap: 1 * fF, vref: 1, vcm: 0.5 });
  const r = convert(adc, 0.6, { record: true });
  assert.equal(r.code, 9);
  assert.deepEqual(r.decisions, [1, 0, 0, 1]);
  const cmp = r.snapshots.filter((s) => s.phase === 'compare');
  const expectedVx = [0.4, 0.65, 0.525, 0.4625];
  const expectedDac = [0.5, 0.75, 0.625, 0.5625];
  cmp.forEach((s, k) => {
    close(s.arrays[0].vTop, expectedVx[k], 1e-12, `Vx at cycle ${k}`);
    close(s.dacLevel, expectedDac[k], 1e-12, `DAC level at cycle ${k}`);
  });
  close(r.snapshots[0].arrays[0].qNode, -1.6 * fF, 1e-27, 'sampled charge');
  // charge on C3 (8 fF) at the first trial: 8 fF * (0.4 - 1.0) = -4.8 fC
  close(cmp[0].arrays[0].charges.top[0], -4.8 * fF, 1e-27, 'Q on C3');
});

test('top-plate parasitic attenuates conventional steps but leaves the decisions unchanged', () => {
  // Cp = 16 fF on a 16 fF array: every step is halved, Vx - Vcm = (Vdac - Vin) * 16/32.
  const base = { scheme: 'conventional', bits: 4, unitCap: fF, vref: 1, vcm: 0.5 };
  const adc = createAdc({ ...base, nonIdeal: { topParasitic: { enabled: true, cap: 16 * fF } } });
  const r = convert(adc, 0.6, { record: true });
  assert.equal(r.code, 9);
  const vx = r.snapshots.filter((s) => s.phase === 'compare').map((s) => s.arrays[0].vTop);
  [0.45, 0.575, 0.5125, 0.48125].forEach((v, k) => close(vx[k], v, 1e-12, `cycle ${k}`));
});

test('monotonic 4-bit: hand calculation of the first two cycles', () => {
  // N=4: per side caps 4,2,1 + dummy 1 -> Ct = 8 Cu. Vref = 1, Vin,cm = 0.5, Vd = +0.3
  // Vx+ = 0.65, Vx- = 0.35 after sampling -> b3 = 1 (Vd > 0)
  // P-side C2 (4 Cu) VREF->GND: Vx+ = 0.65 - 4/8 = 0.15 -> b2 = 0 (0.15 < 0.35)
  // N-side C1 (2 Cu) VREF->GND: Vx- = 0.35 - 2/8 = 0.10 -> b1 = 1
  // P-side C0 (1 Cu) VREF->GND: Vx+ = 0.15 - 1/8 = 0.025 -> b0 = 0
  // code 1010b = 10; ideal floor((0.3 + 1)/0.125) = 10.
  const adc = createAdc({ scheme: 'monotonic', bits: 4, unitCap: fF, vref: 1, vinCM: 0.5 });
  const r = convert(adc, 0.3, { record: true });
  const cmp = r.snapshots.filter((s) => s.phase === 'compare');
  const vp = [0.65, 0.15, 0.15, 0.025];
  const vn = [0.35, 0.35, 0.1, 0.1];
  cmp.forEach((s, k) => {
    close(s.arrays[0].vTop, vp[k], 1e-12, `Vx+ cycle ${k}`);
    close(s.arrays[1].vTop, vn[k], 1e-12, `Vx- cycle ${k}`);
  });
  assert.deepEqual(r.decisions, [1, 0, 1, 0]);
  assert.equal(r.code, 10);
});

test('VCM-based 4-bit: differential steps of Vref*Ck/Ct with constant common mode', () => {
  // Per side caps 4,2,1 + dummy, Ct = 8 Cu, bottoms at VCM = 0.5. Vd = -0.42
  // Vx+ = 0.29, Vx- = 0.71 -> b3 = 0: P C2 -> VREF (+0.25), N C2 -> GND (-0.25)
  //   Vx+ = 0.54, Vx- = 0.46 -> b2 = 1: P C1 -> GND (-0.125), N C1 -> VREF (+0.125)
  //   Vx+ = 0.415, Vx- = 0.585 -> b1 = 0: P C0 -> VREF (+0.0625), N C0 -> GND
  //   Vx+ = 0.4775, Vx- = 0.5225 -> b0 = 0   => code 0100b = 4; ideal floor((-0.42+1)/0.125) = 4
  const adc = createAdc({ scheme: 'vcm', bits: 4, unitCap: fF, vref: 1, vcm: 0.5, vinCM: 0.5 });
  const r = convert(adc, -0.42, { record: true });
  const cmp = r.snapshots.filter((s) => s.phase === 'compare');
  [0.29, 0.54, 0.415, 0.4775].forEach((v, k) => close(cmp[k].arrays[0].vTop, v, 1e-12, `Vx+ ${k}`));
  [0.71, 0.46, 0.585, 0.5225].forEach((v, k) => close(cmp[k].arrays[1].vTop, v, 1e-12, `Vx- ${k}`));
  cmp.forEach((s) => close((s.arrays[0].vTop + s.arrays[1].vTop) / 2, 0.5, 1e-12, 'CM'));
  assert.equal(r.code, 4);
});

test('charge and energy drawn from VREF in the first conventional step = C_MSB * Vref/2', () => {
  // SE, 4 bit, Cu = 1 fF, Vref = 1: preset MSB (8 fF) to VREF from Vin.
  // dVx = 8/16*(1 - Vin) + 8/16*(0 - Vin) ... charge drawn from VREF:
  // dQ = C3*[(Vref - Vx') - (Vin - Vx)], Vx = Vcm, Vx' = Vcm - Vin + Vref/2  => dQ = C3 * Vref/2 = 4 fC
  const adc = createAdc({ scheme: 'conventional', bits: 4, unitCap: fF, vref: 1, vcm: 0.5 });
  const r = convert(adc, 0.37, { record: true });
  const preset = r.snapshots.find((s) => s.phase === 'preset');
  close(preset.transition.sourceCharge.VREF, 4 * fF, 1e-27, 'charge from VREF');
  close(preset.transition.energyRef, 4 * fF, 1e-27, 'energy from VREF');
});
