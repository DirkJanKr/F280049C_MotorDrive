// Every formula the workbench uses, where it comes from, and a numeric check against the model.
// Goal: each line ends up with a literature source. Lines marked "own derivation" are the ones
// that still need one.

import { NAME } from '../names.js';
import { referenceCharge } from '../../zaan/model/reference.js';
import { fill, eng, num } from '../kit.js';
import { idealChip, convert } from '../../zaan/model/chargeSar.js';

const tag = (k) => ({ lit: '<b style="color:var(--an)">literature</b>', from: '<b style="color:var(--cal)">derived from literature</b>', own: '<b style="color:var(--bad)">own derivation</b>' }[k]);
const ok = (a, b, tol = 0.02) => (Math.abs(a / b - 1) < tol ? `<span style="color:var(--an)">✓ agrees</span>` : `<span style="color:var(--bad)">differs</span>`);

export const page = {
  id: 'sources',
  title: 'Formulas and sources',
  main() {
    return `<section class="card wide"><header><h3>Every formula, its source, and a check against the model</h3></header><div class="cbody" id="srcTab"></div><p class="cap" id="srcTab-cap"></p></section>
      <section class="card wide"><header><h3>Symbols: this workbench and Rabuske</h3></header><div class="cbody" id="srcSym"></div></section>`;
  },
  update(store, ctx) {
    const { P, d, dBin } = ctx;
    const N = P.channels;
    const cTh = d.cTh;
    const c0 = P.cu / P.lsbPerUnit; // capacitor worth one LSB
    const lsbV = P.fullScale / 2 ** P.bits;
    const aBin = dBin.alpha;
    // check 1: eq. 4.21 against the node model, at the third decision of one input
    const tr = convert(idealChip(d), d, 137.3, { trace: true });
    const st = tr.steps[2];
    let num421 = (cTh / 2) * (137.3 * lsbV);
    let den421 = (cTh + (d.cNode[0] - cTh)) / 2;
    for (let j = 0; j < 2; j++) {
      const cj = d.cAdd[j] / 2;
      const charge = (d.weights[j] * d.qLsb) / (2 * P.vref); // capacitance at V PC that carries this step's charge
      num421 -= (tr.dec[j] ? 1 : -1) * charge * P.vref;
      den421 += cj;
    }
    const v421 = num421 / den421;
    const rows = [
      ['Voltage at the comparator in cycle i', 'V<sub>PN</sub>[i] = (C<sub>TH</sub>/2 · V<sub>in</sub> − Σ ±C<sub>j</sub> · V<sub>PC</sub>) / (C<sub>TH</sub>/2 + Σ C<sub>j</sub>)', 'Rabuske 2017, eq. 4.21, p. 73', 'lit', `eq.: ${eng(v421, 'V')}; model: ${eng(st.v, 'V')} ${ok(v421, st.v)}`],
      ['Input range (charge balance)', 'V<sub>IR</sub> = 2<sup>B+1</sup> · C<sub>0</sub> · V<sub>PC</sub> / C<sub>TH</sub>', 'Rabuske 2017, eq. 4.24, p. 74. Chen 2018, eq. 3, p. 3056 is the same with C<sub>DAC</sub> ≈ 2<sup>B−1</sup> C<sub>0</sub>', 'lit', `eq.: ${eng((2 ** (P.bits + 1) * c0 * P.vref) / cTh, 'V')}; set: ${eng(P.fullScale, 'V')} ${ok((2 ** (P.bits + 1) * c0 * P.vref) / cTh, P.fullScale)}`],
      ['Capacitance ratio', 'α = C<sub>TH</sub> / (2 · C<sub>DAC</sub>)', 'Rabuske 2017, eq. 4.58, p. 89', 'lit', `${NAME.alphaBin}: ${num(aBin, 3)}; ${NAME.alphaW}: ${num(d.alpha, 3)}; ${NAME.alphaEff}: ${num(d.alphaEff, 3)}; ${NAME.alphaIn}: ${num(P.alphaIn, 3)}`],
      ['Voltage left at the last decision', 'α / (1 + α)', 'follows from eq. 4.21 with all capacitors connected', 'from', `${num((aBin / (1 + aBin)) * 100, 0)} % with the ${NAME.alphaBin}; one LSB = ${eng(d.qLsb / d.cNode[d.decisions - 1], 'V')} on the ${NAME.cnodeW}`],
      ['Offset factor in cycle i', 'η<sub>i</sub> = 1 + (2<sup>B</sup> C<sub>0</sub> / C<sub>TH</sub>)(1 − 2<sup>−i</sup>)', 'Rabuske 2017, eq. 4.52, p. 88', 'lit', `equals C<sub>node,i</sub> / C<sub>TH</sub> for an ideal binary array: last cycle 1 + 1/α = ${num(1 + 1 / aBin, 2)}. The ${NAME.cnodeBin} gives ${num(dBin.cNode[dBin.decisions - 1] / dBin.cNode[0], 2)}, larger because each halving step adds a whole unit capacitor`],
      ['Shift of the transfer curve by the offset', '(1 + 1/α) · V<sub>OS</sub>', 'Rabuske 2017, eq. 4.63, p. 91', 'lit', `${num((1 + 1 / aBin) / (lsbV * 1e3), 2)} LSB per mV with the ${NAME.alphaBin}; model with the ${NAME.cnodeBin}: ${num(dBin.cNode[dBin.decisions - 1] / dBin.qLsb / 1e3, 2)}`],
      ['Worst DNL and INL from offset, binary search', '|δ<sub>max</sub>| = |V<sub>OS</sub>| / (α · V<sub>LSB</sub>)', 'Rabuske 2017, eq. 4.59 and 4.67, p. 89 and 91', 'lit', `${num(1e-3 / (aBin * lsbV), 2)} LSB per mV; see the Comparator offset page for the simulated value`],
      ['No missing codes, binary search', '|V<sub>OS</sub>| &lt; α · V<sub>LSB</sub>', 'Rabuske 2017, eq. 4.60, p. 89', 'lit', `${eng(aBin * lsbV, 'V')}`],
      ['Gain error from sampling capacitance against DAC', 'ΔG = −ΔC / (C<sub>TH</sub> + ΔC)', 'Rabuske 2017, eq. 4.42, p. 81', 'lit', 'used for the read-slot gain variation below'],
      ['Read-slot gain variation', 'σ<sub>G</sub> = σ(C<sub>M</sub>) / √(2N)', 'eq. 4.38 with independent cells on the two sides: N new memory cells per side in every read slot, and only their common part changes the gain; the difference between the sides is second order (eq. 4.30, 4.33)', 'from', `${num((P.aC / Math.sqrt(d.cm * 1e15) / Math.sqrt(2 * N)), 3)} % rms; at full scale ${num(((P.aC / 100 / Math.sqrt(d.cm * 1e15) / Math.sqrt(2 * N)) * 2 ** P.bits) / (2 * Math.SQRT2), 2)} LSB rms if not calibrated`],
      ['Mismatch inside the DAC', 'same ENOB for charge sharing and charge redistribution at the same total DAC capacitance', 'Rabuske 2017, section 4.4.3, p. 82, and Fig. 4.8, p. 83 (Monte Carlo)', 'lit', 'agrees with the 3σ page: the total for 3σ &lt; 0.5 LSB is the same for every array'],
      ['3σ rule for the mid-scale code step', 'σ ≈ 2<sup>B</sup> · A<sub>C</sub> / √C<sub>DAC</sub>', 'own derivation in the form of Pelgrom; Rabuske gives no closed form (section 4.4.3)', 'own', 'checked by Monte Carlo on the 3σ page'],
      ['Parasitics on the DAC capacitors', 'balanced: no linearity error; ENOB drop &lt; 0.2 bit if C<sub>p</sub> &lt; 0.2 · C<sub>0</sub>', 'Rabuske 2017, section 4.5, p. 82 to 86 (simulation)', 'lit', `not modelled. The parasitic on the summing node is a value of its own (now ${eng(P.cpar, 'F')}) and only dilutes the signal`],
      ['ENOB from the INL', 'V<sub>noise</sub>² = V<sub>LSB</sub>²/12 + V<sub>LSB</sub>² · mean(φ²)', 'Rabuske 2017, eq. 4.73, p. 92', 'lit', 'not used: the workbench takes ENOB from a sine FFT'],
      ['Quantisation noise', 'V<sub>LSB</sub>² / 12', 'Rabuske 2017, eq. 4.69, p. 92', 'lit', '0.289 LSB rms'],
      ['Precharge energy with multi-step LSB precharge', 'E = (2<sup>B − Nsteps</sup> − 1) · C · V<sub>PC</sub>²', 'Rabuske 2017, eq. 3.16, p. 41; the scheme is from Craninckx 2007', 'lit', `${NAME.cdacPre} ${eng(referenceCharge(P, d) / P.vref, 'F')}: ${eng(referenceCharge(P, d) * P.vref, 'J')} per conversion from a source at V<sub>PC</sub> (Q = ${eng(referenceCharge(P, d), 'C')}, the same charge as on the Power and Reference pages)`],
      ['Comparator noise in LSB', 'σ = v<sub>n</sub> · C<sub>node,last</sub> / Q<sub>LSB</sub>', 'follows from the attenuation in eq. 4.21; Rabuske treats noise in section 4.7, which I have not seen', 'from', `${num((P.compNoise * d.cNode[d.decisions - 1]) / d.qLsb, 3)} LSB for ${eng(P.compNoise, 'V')}`],
      ['Comparator noise against its size', 'σ² ≈ 4kTγ / (C · V · g<sub>m</sub>/I<sub>D</sub>)', 'own derivation; Rabuske 2017, chapter 5 finds comparator noise by simulation (PSS and PNOISE) and gives no closed form', 'own', 'not used in the code; the Power page only states the scaling σ² proportional to 1 / C'],
      ['kT/C noise of the memory cells', 'σ<sub>Q</sub> = √(2kT · N · C<sub>M</sub>)', 'standard sampling noise; no page reference yet', 'own', ''],
      ['CDAC precharge noise', 'σ<sub>Q</sub> = √(4kT · C<sub>DAC</sub> + n<sub>½</sub> · 4kT · C<sub>u</sub> / 2)', 'kT/C estimate; Chen 2018 charges with a gated current, so this is a placeholder', 'own', `C<sub>DAC</sub>: ${NAME.cdac}; n<sub>½</sub>: halving steps, each opens the switch between its two halves. Without the halving term ${num(Math.sqrt(4 * 1.381e-23 * P.temperature * d.cdac) / d.qLsb, 4)} LSB (the old Zaan chapters), with it ${num(ctx.budget.lines.find((l) => l.id === 'pre').lsb, 4)} LSB (Noise budget)`],
      ['Jitter on the precharge time', 'σ<sub>Q</sub> = (σ<sub>t</sub> / T<sub>int</sub>) · Q<sub>FS</sub> / (2√2)', 'Chen 2018, p. 3056 (mechanism); the expression is derived', 'from', ''],
      ['Tolerance of a redundant search', 't<sub>i</sub> = Σ later steps + last step − w<sub>i</sub>', 'own derivation; to be tied to Chang 2013 or Liu 2011', 'own', ''],
      ['Loss by rounding calibrated weights', 'ΔENOB = log₂ √(w<sub>last</sub>² + q²)', 'own derivation from two independent quantisations', 'own', 'checked by simulation on the Levels tab'],
      ['Offset calibration loop', 'one extra comparison per conversion', 'Chen 2018, p. 3058; Rabuske 2017, section 6.4: up to 11 % more conversion time', 'lit', ''],
      ['Delay cells and beam pattern', 'M = ⌈τ<sub>max</sub> / T<sub>s</sub>⌉ + 1; array factor', 'Yu 2012 (cells); standard array theory', 'from', ''],
    ];
    const count = (k) => rows.filter((r) => r[3] === k).length;
    const USED = [['Voltage at the comparator', 'sar', 'Conversion'], ['Input range', 'balance', 'Charge balance'], ['Capacitance ratio', 'balance', 'Charge balance'], ['Voltage left', 'balance', 'Charge balance'], ['Offset factor', 'offset', 'Comparator offset'], ['Shift of the transfer', 'offset', 'Comparator offset'], ['Worst DNL', 'offset', 'Comparator offset'], ['No missing codes', 'offset', 'Comparator offset'], ['Gain error', 'budget', 'Noise budget'], ['Read-slot', 'budget', 'Noise budget'], ['Mismatch inside', 'matching', 'The 3σ rule'], ['3σ rule', 'matching', 'The 3σ rule'], ['Parasitics', 'balance', 'Charge balance'], ['ENOB from the INL', 'levels', 'Levels and rounding'], ['Quantisation noise', 'budget', 'Noise budget'], ['Precharge energy', 'power', 'Power estimate'], ['Comparator noise in LSB', 'budget', 'Noise budget'], ['kT/C noise', 'budget', 'Noise budget'], ['CDAC precharge', 'budget', 'Noise budget'], ['Jitter on the precharge', 'budget', 'Noise budget'], ['Tolerance', 'redundancy', 'Weights'], ['Loss by rounding', 'levels', 'Levels and rounding'], ['Offset calibration', 'offset', 'Comparator offset'], ['Delay cells', 'beamformer', 'Beamformer']];
    const usedOn = (t) => { const u = USED.find(([k]) => t.startsWith(k)); return u ? `<br><a href="#${u[1]}" class="ks">used on ${u[2]}</a>` : ''; };
    fill('srcTab', `<div class="tablewrap"><table class="tbl"><thead><tr><th>What</th><th>Formula</th><th>Source</th><th>Status</th><th>Check with the present values</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${r[0]}${usedOn(r[0])}</td><td class="fx">${r[1]}</td><td>${r[2]}</td><td>${tag(r[3])}</td><td>${r[4]}</td></tr>`).join('')}</tbody></table></div>`,
      `${count('lit')} formulas come straight from literature, ${count('from')} are derived from a formula in literature, and ${count('own')} are my own derivations that still need a source. Rabuske 2017 is: T. Rabuske and J. Fernandes, Charge-Sharing SAR ADCs for Low-Voltage Low-Power Applications, Springer. Page numbers are those of the book.`);
    fill('srcSym', `<div class="tablewrap"><table class="tbl"><thead><tr><th>Workbench</th><th>Rabuske</th><th>Meaning</th><th>Now</th></tr></thead><tbody>
      <tr><td>N · C<sub>M</sub></td><td>C<sub>TH</sub></td><td>sampling capacitance per side: the N memory cells that are read together</td><td class="num">${eng(cTh, 'F')}</td></tr>
      <tr><td>V<sub>REF</sub></td><td>V<sub>PC</sub></td><td>precharge voltage of the DAC capacitors</td><td class="num">${eng(P.vref, 'V')}</td></tr>
      <tr><td>V<sub>in,max</sub></td><td>V<sub>IR</sub></td><td>differential input range, peak to peak</td><td class="num">${eng(P.fullScale, 'V')}</td></tr>
      <tr><td>C<sub>u</sub> / n<sub>u</sub></td><td>C<sub>0</sub></td><td>capacitance worth one LSB</td><td class="num">${eng(c0, 'F')}</td></tr>
      <tr><td>charge halving</td><td>multi-step LSB precharge</td><td>the LSB capacitor shares its charge with an equal auxiliary capacitor during precharge (Fig. 3.10, p. 40)</td><td></td></tr>
    </tbody></table></div>`);
  },
};
