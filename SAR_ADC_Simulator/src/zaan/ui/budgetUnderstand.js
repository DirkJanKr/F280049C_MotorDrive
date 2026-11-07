// Budget, Understand tab: the allocation step by step with your numbers.

import { NOISE_LINES } from '../noiseBudget.js';
import { eng, num, esc } from './fmt.js';

export function budgetUnderstand(state, b) {
  const t = b.alloc.target;
  const rows = [
    ['1', 'Signal rms of a full-scale sine', 'V sig = FS / 2 / sqrt(2)', `${num(b.fullScale)} V / 2 / 1.414`, eng(b.vSig, 'V rms')],
    ['2', 'LSB (least significant bit: input step of one code)', 'LSB = FS / 2^N', `${num(b.fullScale)} V / 2^${b.bits}`, eng(b.lsb, 'V')],
    ['3', 'Quantisation noise', 'sigma q = LSB / sqrt(12)', `${eng(b.lsb, 'V')} / 3.464`, eng(b.quant, 'V rms')],
    ['4', `Total noise allowed for ENOB ${b.targetEnob}`, 'sigma tot = V sig / 10^((6.02 ENOB + 1.76) / 20)', `${eng(b.vSig, 'V')} / 10^((6.02 x ${b.targetEnob} + 1.76) / 20)`, eng(t, 'V rms')],
    ['5', 'Noise left for the other lines', 'sigma left = sqrt(sigma tot^2 - sigma q^2)', `sqrt(${eng(t, 'V')}^2 - ${eng(b.quant, 'V')}^2)`, b.alloc.feasible ? eng(b.alloc.left, 'V rms') : 'none: target above the resolution'],
    ['6', 'One line', 'sigma i = sqrt(share i / 100) x sigma left', `e.g. kT/C: sqrt(${state.shares.ktc} / 100) x ${eng(b.alloc.left, 'V')}`, eng(b.alloc.lines.ktc, 'V rms')],
    ['7', 'Total of the included lines (RSS: root sum of squares)', 'sigma total = sqrt(sum sigma i^2)', 'lines of blocks set to ideal are left out', eng(b.result.total, 'V rms')],
    ['8', 'SNDR (signal to noise and distortion ratio)', 'SNDR = 20 log10(V sig / sigma total)', `20 log10(${eng(b.vSig, 'V')} / ${eng(b.result.total, 'V')})`, `${num(b.result.sndr, 2)} dB`],
    ['9', 'ENOB (effective number of bits)', 'ENOB = (SNDR - 1.76 dB) / 6.02 dB', `(${num(b.result.sndr, 2)} dB - 1.76 dB) / 6.02 dB`, `${num(b.result.enob, 3)} bit`],
  ];
  const trs = rows.map((r) => `<tr><td>${r[0]}</td><td>${esc(r[1])}</td><td class="mono">${esc(r[2])}</td><td class="mono">${esc(r[3])}</td><td class="num">${esc(r[4])}</td></tr>`).join('');
  const tsteps = [
    ['1', 'Conversion period', 'Tconv = 1 / fs', eng(b.tConv, 's')],
    ['2', 'Time per decision, equal split', 'tdec = (Tconv - Ts - n x tlogic) / n', eng(b.timing.tDec, 's')],
    ['3', 'Slack', 'Tconv - (Ts + n x tdec + n x tlogic)', eng(b.timing.slack, 's')],
  ];
  const ttrs = tsteps.map((r) => `<tr><td>${r[0]}</td><td>${esc(r[1])}</td><td class="mono">${esc(r[2])}</td><td class="num">${esc(r[3])}</td></tr>`).join('');
  return `<div class="card"><h2>How the noise budget is built</h2>
    <p>Top down: start from the ENOB target, take out quantisation, and split the rest over the other lines. Uncorrelated noise adds in power, so shares are shares of noise power. ${NOISE_LINES.length - 1} lines share the remainder.</p>
    <div class="scroll"><table><thead><tr><th>Step</th><th>Quantity</th><th>Formula</th><th>Numbers</th><th>Result</th></tr></thead><tbody>${trs}</tbody></table></div>
    <p class="differs">Differs from the real circuit: the lines are allocations (status A), not results of a circuit model. Later phases replace them block by block.</p></div>
    <div class="card"><h2>How the timing budget is built</h2>
    <div class="scroll"><table><thead><tr><th>Step</th><th>Quantity</th><th>Formula</th><th>Result</th></tr></thead><tbody>${ttrs}</tbody></table></div>
    <p class="note">Ts and tlogic have status ?. In a self-timed SAR (asynchronous: each decision starts when the previous one finishes) the decisions are not equal; phase 3 replaces the equal split with metastability-based times.</p></div>`;
}
