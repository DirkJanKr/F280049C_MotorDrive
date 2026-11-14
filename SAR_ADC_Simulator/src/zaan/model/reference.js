// Reference charge: charge sharing draws it once per conversion (precharge);
// charge redistribution draws signal-dependent charge at every bit.

import { createAdc } from '../../model/adc.js';
import { convert as convertRedistribution } from '../../model/sar.js';
import { createRng } from '../../model/rng.js';

/**
 * Units of the CDAC that are charged from V REF: every whole-unit or small capacitor, plus the one
 * source unit of the charge halving chain. The halving capacitors start empty and take their charge
 * from that source unit, not from V REF.
 */
export function prechargedUnits(steps) {
  const caps = steps.filter((s) => s.kind === 'cap' || s.kind === 'small').reduce((a, s) => a + s.units, 0);
  return caps + (steps.some((s) => s.kind === 'half') ? 1 : 0);
}

/**
 * Charge the reference delivers per conversion: Q REF = V REF C, with C the capacitance charged from V REF
 * (Chen 2018, eq. 2, p. 3056: Q REF = C DAC V REF; Rabuske 2017, eq. 3.14, p. 39: energy C V PC² per conversion,
 * which is this charge times V PC). The factor 2 of Q+ − Q− belongs to the node bookkeeping, not to the source.
 * Used by the Power page, the Reference page and the old Zaan reference chapter.
 */
export function referenceCharge(P, d) {
  return P.vref * (prechargedUnits(d.steps) * P.cu);
}

/** Precharge charge per conversion and the average reference current. */
export function prechargeCharge(P, d) {
  const q = referenceCharge(P, d);
  return { q, current: q * P.fs };
}

/**
 * Reference charge per bit cycle for a few conversions, charge redistribution
 * (conventional differential CDAC with the same total capacitance) against charge sharing.
 */
export function referenceWaveforms(P, d, conversions = 6, seed = 4) {
  const bits = P.bits;
  const unitCap = d.cdac / 2 ** bits;
  const adc = createAdc({ scheme: 'conventional-diff', bits, unitCap, vref: P.vref, vcm: P.vref / 2, vinCM: P.vref / 2 });
  const rng = createRng(seed);
  const red = [];
  const share = [];
  const pre = prechargeCharge(P, d).q;
  const slots = bits + 1;
  for (let k = 0; k < conversions; k++) {
    const vin = (rng.uniform() * 2 - 1) * 0.9 * P.vref;
    const r = convertRedistribution(adc, vin, { record: true, rng });
    const per = r.snapshots.filter((s) => s.phase === 'preset' || s.phase === 'compare').map((s) => s.transition.sourceCharge.VREF);
    for (let i = 0; i < slots; i++) {
      red.push(per[i] ?? 0);
      share.push(i === 0 ? pre : 0);
    }
  }
  return { red, share, slots };
}

/** Ping-pong doubles the CDAC; a reservoir adds C_RSV instead (break-even when C_RSV equals one CDAC). */
export function referenceArea(d) {
  return { pingPong: 2 * d.cdac, single: d.cdac };
}
