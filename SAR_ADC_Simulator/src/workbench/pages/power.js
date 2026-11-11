// Power estimate by scaling Chen 2018.
// S, Chen 2018 p. 3059: the beamforming ADC with the delay programming logic takes 1.58 mW
// (36 % of the 4.3 mW subarray) at 30 MS/s, 1.8 V, 0.18 um, N = 9, 10 decisions + 1 calibration comparison.
// S, p. 3056: "the high-speed SAR logic readily dominates the power consumption of the ADC".
// A: so the whole 1.58 mW is treated as switching power, P = k * cycles * f_s * V_DD^2.
// D: the reference charge is added separately, P_ref = V_DD * Q_REF * f_s, Q_REF = C_DAC * V_REF.

import { fill, readouts, explain, eng, num } from '../kit.js';

const CHEN = { p: 1.58e-3, fs: 30e6, cycles: 11, vdd: 1.8, n: 9, qref: 1.5e-12 * 0.16 };

export const page = {
  id: 'power',
  title: 'Power',
  side() {
    return '';
  },
  main() {
    return `<div id="pwRo"></div>
      <section class="card wide"><header><h3>From Chen 2018 to this design</h3><label class="cap">supply V DD [V] <input type="number" id="pwVdd" min="1" max="5" step="0.1" style="width:5em"/></label></header><div class="cbody" id="pwTab"></div><p class="cap" id="pwTab-cap"></p></section>
      ${explain('How far this estimate can be trusted', [
        'It is a scaling of one measured number, not a design. Chen gives 1.58 mW for the ADC together with the delay programming logic; the split between comparator, SAR logic and delay logic is only in his Fig. 14 and is not used here. Treating all of it as switching power makes the estimate scale with the sample rate, the number of comparator cycles and the square of the supply.',
        'What it leaves out: a different comparator (lower noise costs power, roughly four times the power for half the noise), the larger CDAC switches, the delay logic for 16 channels where Chen has 9, and everything outside the ADC (amplifiers, data link). Use it as an order of magnitude until there is a schematic.',
      ])}`;
  },
  update(store, ctx) {
    const { P, d, budget } = ctx;
    const vdd = store.ui.pwVdd || 1.8;
    const cycles = d.decisions + 1;
    const fFs = P.fs / CHEN.fs;
    const fCy = cycles / CHEN.cycles;
    const fV = (vdd / CHEN.vdd) ** 2;
    const pLogic = CHEN.p * fFs * fCy * fV;
    const qref = d.cdacEff * P.vref;
    const pRef = vdd * qref * P.fs;
    const pRefChen = CHEN.vdd * CHEN.qref * CHEN.fs;
    const total = pLogic + pRef - pRefChen * fFs * fCy * fV;
    const fom = total / (2 ** budget.enob * P.fs);
    fill('pwRo', readouts([
      ['ADC power, estimate', eng(total, 'W'), 'D from Chen 2018 with assumptions; see the table'],
      ['Per channel', eng(total / P.channels, 'W'), `${P.channels} channels share one ADC; Chen: ${eng(CHEN.p / CHEN.n, 'W')}`],
      ['Energy per conversion', eng(total / P.fs, 'J'), 'P / f s'],
      ['Walden figure of merit', eng(fom, 'J'), `P / (2^ENOB · f s), ENOB ${num(budget.enob, 2)} from the budget`],
    ]));
    const row = (a, b, c, s) => `<tr><td>${a}</td><td class="num">${b}</td><td class="num">${c}</td><td>${s}</td></tr>`;
    fill('pwTab', `<div class="tablewrap"><table class="tbl"><thead><tr><th>Step</th><th>Chen 2018</th><th>This design</th><th>Status</th></tr></thead><tbody>
      ${row('ADC with delay programming logic', eng(CHEN.p, 'W'), '', 'S, p. 3059')}
      ${row('Sample rate f s', eng(CHEN.fs, 'Hz'), `${eng(P.fs, 'Hz')} (× ${num(fFs, 2)})`, 'S, p. 3053; mine')}
      ${row('Comparator cycles per sample', '10 + 1', `${d.decisions} + 1 (× ${num(fCy, 2)})`, 'S, p. 3057; D from the weights')}
      ${row('Supply V DD', '1.8 V', `${num(vdd, 1)} V (× ${num(fV, 2)})`, 'S, p. 3059; A, not decided')}
      ${row('Switching power, P Chen · f s · cycles · V DD²', '', eng(pLogic, 'W'), 'D, assumes all of it is switching power')}
      ${row('Reference charge per conversion Q REF = C DAC · V REF', eng(CHEN.qref, 'C'), eng(qref, 'C'), 'D')}
      ${row('Reference power V DD · Q REF · f s', eng(pRefChen, 'W'), eng(pRef, 'W'), 'D')}
      ${row('Total: switching power with Chen\'s reference part replaced by mine', '', `<b>${eng(total, 'W')}</b>`, 'D')}
    </tbody></table></div>`,
      'Process: both 0.18 µm, so no scaling for the technology. The reference power assumes the precharge current is drawn from V DD for the whole charge, which is the gated current source of Chen Fig. 7.');
    const el = document.getElementById('pwVdd');
    el.value = vdd;
    el.onchange = () => {
      store.ui.pwVdd = Math.min(5, Math.max(1, +el.value || 1.8));
      page.update(store, ctx);
    };
  },
};
