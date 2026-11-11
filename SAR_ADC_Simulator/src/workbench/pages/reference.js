// Item 3: the charge reference of Chen 2018 (Fig. 7, p. 3055 to 3056) with its calibration.
//   Q_REF = I_P * T_int (eq. 1), target Q_REF = C_DAC * V_REF (eq. 2)
// Calibration (during transmit): after each precharge the comparator compares V_DAC with V_REF and
// the charge pump moves the gate of M_P by one packet on C_MOS. Receive: pump off, I_P held on C_MOS.
// Values not in the paper are placeholders (A); they are listed on the page.

import { fill, widthOf, plot, readouts, explain, eng, num, COL } from '../kit.js';
import { createRng } from '../../model/rng.js';

const A = { pump: 100e-9, cmos: 4e-12, pulse: 2e-9, gm: 50e-6, cycles: 4000, droopDb: 0.3, rx: 100e-6 };

export const page = {
  id: 'reference',
  title: 'Reference',
  side() {
    return '';
  },
  main() {
    return `<div id="rfRo"></div>
      <div class="grid2"><section class="card"><header><h3>Calibration: V DAC converges on V REF</h3></header><div class="cbody" id="rfCal"></div><p class="cap" id="rfCal-cap"></p></section>
      <section class="card"><header><h3>Receive: held current, droop, and the two CDACs</h3></header><div class="cbody" id="rfRx"></div><p class="cap" id="rfRx-cap"></p></section></div>
      <section class="card wide"><header><h3>Values used here</h3></header><div class="cbody" id="rfVal"></div></section>
      ${explain('How the reference works', [
        'The CDAC is not charged from a voltage source but by a current I P that flows for a fixed time T int. The charge is I P · T int. To make that equal to C DAC · V REF on every chip, I P is trimmed while the chip transmits and nothing is being converted.',
        'After each trial precharge a comparator checks whether V DAC ended above or below V REF, and a charge pump moves the gate voltage of the current source by one small packet. After enough cycles V DAC stays within one packet of V REF. During receive the pump is off and the gate voltage is held on a capacitor; it leaks a little, which is a slow gain drift.',
        'Both CDACs use the same current source and the same T int, so they receive the same charge even if their capacitances differ. Noise: the pump noise is frozen on the gate capacitor; what is left is jitter on T int, which changes the charge of the whole CDAC in proportion.',
      ])}`;
  },
  update(store, ctx) {
    const { P, d } = ctx;
    const tint = 0.75 / P.fs;
    const cdac = d.cdacEff;
    const ipTarget = (cdac * P.vref) / tint;
    const dI = A.gm * ((A.pump * A.pulse) / A.cmos);
    const lsbCal = (dI * tint) / cdac;
    const rng = createRng(P.seed + 31);
    let ip = ipTarget * (0.7 + 0.6 * rng.uniform());
    const pts = [];
    let settled = null;
    for (let k = 0; k < A.cycles; k++) {
      const v = (ip * tint) / cdac;
      if (k % 10 === 0) pts.push([k, v * 1e3]);
      if (settled === null && Math.abs(v - P.vref) <= lsbCal) settled = k;
      ip += v < P.vref ? dI : -dI;
    }
    const jit = (P.jitter / tint) * 2 ** (P.bits - 1) / Math.SQRT2;
    fill('rfRo', readouts([
      ['Q REF', eng(cdac * P.vref, 'C'), 'C DAC · V REF (eq. 2)'],
      ['I P needed', eng(ipTarget, 'A'), `Q REF / T int, T int = ${eng(tint, 's')}`],
      ['One calibration step', eng(lsbCal, 'V'), `${num((lsbCal / P.vref) * 100, 3)} % of V REF`],
      ['Cycles to settle', settled === null ? 'not settled' : `${settled}`, settled === null ? '' : `${eng(settled / P.fs, 's')} of transmit time`, settled === null ? 'bad' : 'ok'],
      ['T int jitter', `${num(jit, 3)} LSB rms`, `${eng(P.jitter, 's')} rms, full-scale sine`, jit > 0.2 ? 'bad' : 'ok'],
      ['Jitter for 0.29 LSB', eng((0.2887 * Math.SQRT2 * tint) / 2 ** (P.bits - 1), 's'), 'as much as the quantisation noise'],
    ]));
    fill('rfCal', plot({ height: 260, x: { min: 0, max: A.cycles, label: 'calibration cycle' }, y: { min: P.vref * 600, max: P.vref * 1400, label: 'V DAC after precharge [mV]' }, series: [{ points: pts, color: COL.an, width: 2 }], hlines: [{ y: P.vref * 1e3, color: COL.ref, dash: '6 3' }, { y: (P.vref + lsbCal) * 1e3, color: COL.muted }, { y: (P.vref - lsbCal) * 1e3, color: COL.muted }] }, widthOf('rfCal')),
      `Random start within ±30 %. Each cycle moves I P by ${eng(dI, 'A')}: pump current × pulse time / C MOS × gm. Dashed: V REF = ${eng(P.vref, 'V')}; grey: ±1 calibration step.`);
    const k = 10 ** (-A.droopDb / 20);
    const rx = Array.from({ length: 101 }, (_, i) => [i, 100 * k ** (i / 100)]);
    fill('rfRx', plot({ height: 260, x: { min: 0, max: 100, label: 'time in the receive phase [µs]' }, y: { min: 95, max: 100.5, label: 'charge per precharge [% of Q REF]' }, series: [{ points: rx, color: COL.an, width: 2.2, label: 'CDAC A and CDAC B (the same)' }], legend: true }, widthOf('rfRx')),
      `Worst case from the paper: ${A.droopDb} dB over ${eng(A.rx, 's')} (p. 3056), ${num((1 - k) * 100, 1)} % less charge at the end. That is a gain error of up to ${num((1 - k) * 2 ** (P.bits - 1), 0)} LSB at full scale, the same for every sample at that depth, so it acts like a slow gain change. A and B alternate every period and get the same charge, because they share the current source and T int.`);
    const row = (a, b, s, n) => `<tr><td><span class="stat st-${s}">${s}</span></td><td>${a}</td><td class="num">${b}</td><td class="dim">${n}</td></tr>`;
    fill('rfVal', `<div class="tablewrap"><table class="tbl"><thead><tr><th>Status</th><th>Value</th><th></th><th>Where from</th></tr></thead><tbody>
      ${row('Pump current', eng(A.pump, 'A'), 'S', 'Chen 2018, Fig. 7(a)')}${row('C MOS', eng(A.cmos, 'F'), 'S', 'p. 3056: about 4 pF')}
      ${row('Leakage drift', `${A.droopDb} dB in ${eng(A.rx, 's')}`, 'S', 'p. 3056, worst case')}${row('T int', eng(tint, 's'), 'D', '3/4 of the clock period, as in Chen')}
      ${row('C DAC that is precharged', eng(cdac, 'F'), 'D', 'the charge-carrying part of the present weights')}
      ${row('Pump pulse width', eng(A.pulse, 's'), 'A', 'placeholder')}${row('gm of M P', eng(A.gm, 'S'), 'A', 'placeholder')}${row('Calibration cycles', `${A.cycles}`, 'A', 'placeholder')}
      ${row('Clock jitter', eng(P.jitter, 's'), 'A', 'the sampling jitter value of the workbench')}
    </tbody></table></div>`);
  },
};
