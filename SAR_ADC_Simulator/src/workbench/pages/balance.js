// Charge balance page (Item 1): resolution from the prior-art charge balance.
//   Chen 2018, eq. 3, p. 3056:      N V_in,max C_M = 4 V_REF C_DAC
//   Rabuske 2016, eq. 3, p. 1411:   alpha = C_TH / (2 C_DAC), C_TH = N C_M
//   Rabuske 2016, eq. 5, p. 1412:   V_PN[i] = (Q_TH + Q_DAC[i]) / (C_TH / 2 + C_DAC[i])
//   Rabuske 2016, eq. 7, p. 1412:   phi_MSB ~ V_offset / (alpha V_LSB)
// Inputs: C_M, alpha, N, V_in,max, B. Outputs: V_REF, C_DAC, Q_FS, Q_LSB, C_u and the
// comparator voltage of one LSB in every bit cycle. Rabuske's equations are taken from the
// spec text; that PDF is not in the repo.

import { group, knobs, card, fill, widthOf, plot, readouts, explain, eng, num, esc, COL } from '../kit.js';
import { chargeBalance, designCdac, binarySteps } from '../../zaan/model/cdac.js';
import { offsetLsb } from '../budget.js';
import { v, frac, sup, eq } from '../../zaan/ui/math.js';

const CHEN = { N: 9, vin: 0.8, cm: 133e-15, cdac: 1.5e-12, units: 67, cu: 23e-15, bits: 10 };
const REF_ALPHA = [[0.4, 'Chen 2018: 0.40'], [0.5, '0.5'], [1, '1'], [3, '3']];

/** Marker lines: Chen's alpha and the present one (one label when they coincide). */
function marks(P) {
  const L = Math.log10;
  const same = Math.abs(P.alphaIn - 0.4) < 0.005;
  return same ? [{ x: L(0.4), color: COL.ink, label: 'now = Chen 0.40' }] : [{ x: L(0.4), color: COL.ref, label: 'Chen 0.40' }, { x: L(P.alphaIn), color: COL.ink, label: 'now' }];
}

/** The binary CDAC of the balance for another alpha (same C_M). */
function binaryAt(P, alpha) {
  const b = chargeBalance({ channels: P.channels, fullScale: P.fullScale, bits: P.bits, cm: P.cmIn, alpha, lsbPerUnit: P.lsbPerUnit });
  return designCdac({ ...P, vref: b.vref, cu: b.cu }, P.memCells, binarySteps(P.bits, P.lsbPerUnit));
}

export const page = {
  id: 'balance',
  title: 'Charge balance',
  side(store) {
    const used = new Set();
    return `<p class="ks pad">Inputs of the charge balance. V REF, C DAC, Q LSB and C u follow from them.</p>` +
      group('Inputs', knobs(store.values, ['cm', 'alpha', 'channels', 'fullScale', 'bits'], used)) +
      group('Array', knobs(store.values, ['lsbPerUnit'], used)) +
      group('Comparator offset, for φ MSB', knobs(store.values, ['vos', 'vosCal'], used));
  },
  main() {
    return `<section class="card wide"><header><h3>Charge balance: from C M and alpha to V REF, C DAC and Q LSB</h3></header>
        <div class="eqgrid"><div id="blEq"></div><div id="blOut"></div></div><p class="cap" id="blCap"></p></section>
      <div id="blFlags"></div>
      <section class="card wide"><header><h3>What alpha means: how much of the signal voltage is left at the comparator</h3></header><div class="cbody" id="blVis"></div><p class="cap" id="blVis-cap"></p></section>
      <div class="grid2">${card('blCycle', 'Comparator voltage of one LSB in every bit cycle (Rabuske eq. 5)')}${card('blAlpha', 'One LSB at the comparator against alpha')}</div>
      <div class="grid2">${card('blPhi', 'Offset error at the first decision, φ MSB, against alpha (Rabuske eq. 7)')}${card('blChen', 'Check: the same equations with the numbers of Chen 2018')}</div>
      ${explain('What alpha does', [
        'alpha compares the memory capacitance that holds the signal, C TH = N C M, with the CDAC. A small alpha means a large CDAC charged to a low V REF; a large alpha means a small CDAC charged to a high V REF. Both deliver the same reference charge.',
        'Every CDAC capacitor that joins the node makes the node larger, so the signal voltage at the comparator shrinks during the conversion. At the end it is alpha / (1 + alpha) of what it was. With alpha = 0.40 one LSB is 29 % of its input value at the last decision; with alpha = 3 it is 75 %.',
        'That is why a small alpha asks more of the comparator: its noise and its offset stay the same in volts while the LSB shrinks. A large alpha needs a higher reference voltage and smaller capacitors, which match worse.',
      ])}`;
  },
  update(store, ctx) {
    const { P, d, dBin } = ctx;
    const B = P.bits;
    const lsbV = P.fullScale / 2 ** B;
    fill('blEq', [
      eq(`${v('N')} ${v('V', 'in,max')} ${v('C', 'M')} = 4 ${v('V', 'REF')} ${v('C', 'DAC')}`),
      eq(`${v('α')} = ${frac(v('C', 'TH'), `2 ${v('C', 'DAC')}`)}, ${v('C', 'TH')} = ${v('N')} ${v('C', 'M')}`),
      eq(`${v('V', 'REF')} = ${frac(`${v('α')} ${v('V', 'in,max')}`, '2')}`),
      eq(`${v('C', 'DAC')} = ${frac(`${v('N')} ${v('C', 'M')}`, `2 ${v('α')}`)}`),
      eq(`${v('Q', 'FS')} = ${v('N')} ${v('C', 'M')} ${v('V', 'in,max')}, ${v('Q', 'LSB')} = ${frac(v('Q', 'FS'), sup('2', v('B')))}`),
      eq(`${v('C', 'u')} = ${frac(`${v('n', 'u')} ${v('Q', 'LSB')}`, `2 ${v('V', 'REF')}`)}`),
    ].join(''));
    const cuLow = P.cu < 35e-15 - 1e-21;
    fill('blOut', readouts([
      ['V REF', eng(P.vref, 'V'), 'D: alpha · V in,max / 2', '', 'vref'],
      ['C DAC, binary', eng(P.cdacBalance, 'F'), 'D: N C M / (2 alpha)', '', 'cdac'],
      ['Q FS', eng(d.qFs, 'C'), 'D: N C M V in,max, as Q+ − Q−', '', 'qfs'],
      ['Q LSB', eng(d.qLsb, 'C'), `D: Q FS / 2^${B}; ${eng(lsbV, 'V')} at the input`, '', 'qlsb'],
      ['Unit capacitor C u', eng(P.cu, 'F'), cuLow ? 'D: below the 35 fF PDK minimum' : 'D: n u Q LSB / (2 V REF)', cuLow ? 'bad' : 'ok', 'cu'],
      ['One LSB at the last decision', eng(dBin.qLsb / dBin.cNode[dBin.decisions - 1], 'V'), `binary; ${num((dBin.cNode[0] / dBin.cNode[dBin.decisions - 1]) * 100, 0)} % of the input LSB`],
    ]), `N: channels summed. V in,max: maximum peak-to-peak differential swing per channel. C M: one memory capacitor. C DAC: the CDAC capacitance that carries reference charge. n u = ${P.lsbPerUnit}: LSB per unit capacitor. The factor 4: a capacitor precharged single-ended to V REF and connected between the two summing nodes changes Q+ − Q− by 2 C V REF with either sign, so the whole CDAC spans 4 V REF C DAC peak to peak (Chen 2018, p. 3056). Charge convention: Q = Q+ − Q−; Rabuske eq. 5 uses (C TH / 2) V, half of this, with the same voltages.`);
    flags(ctx);
    cycles(ctx);
    alphaVisual(ctx);
    alphaPlot(ctx);
    phiPlot(ctx);
    chen();
  },
};

function flags(ctx) {
  const { P, d, dBin } = ctx;
  const items = [
    `<b>Eq. 3 and a real binary array differ by 2 LSB.</b> Eq. 3 makes the CDAC span exactly 2^B LSB. A binary array spans 2^B − 2 (${num(2 * dBin.sumW, 0)} LSB here), because the last decision has no capacitor. The model uses the real array: C DAC that carries charge is ${eng(dBin.cdacEff, 'F', 4)} against ${eng(P.cdacBalance, 'F', 4)} from eq. 3.`,
    `<b>Which capacitors count as C DAC.</b> Only the ones that are precharged. The ${dBin.steps.filter((s) => s.kind === 'half').length} halving capacitors start empty: the binary array has ${num(dBin.sumW / P.lsbPerUnit + 1 / P.lsbPerUnit, 0)} charge-carrying units and ${num(dBin.units, 0)} physical units. Chen counts 67 physical units as "about 1.5 pF"; 64 of them carry charge.`,
    `<b>The present weights are not binary.</b> They add up to ${num(d.sumW, 0)} LSB (${num(2 * d.sumW, 0)} as code weights), so their CDAC carries charge on ${eng(d.cdacEff, 'F')} and their alpha is ${num(d.alpha, 3)}, not ${num(P.alphaIn, 3)}. The balance above stays as it is; the extra charge is overrange (${num(d.cover.overrange * 100, 1)} %). Item 4 treats this.`,
    `<b>Weight convention.</b> In this workbench every step is added or subtracted, so a step of weight w moves the code by 2 w: the binary list is ${dBin.weights.map((w) => num(w, 0)).join(', ')}. Code weights, as in the Item 4 derivation, are twice these.`,
  ];
  if (P.cu < 35e-15 - 1e-21) items.unshift(`<b>C u = ${eng(P.cu, 'F')} is below the 35 fF PDK minimum.</b> Raise C M or n u, or lower alpha.`);
  fill('blFlags', `<section class="card wide flagc"><header><h3>To keep in mind (flags, not resolved silently)</h3></header><ul class="whyl">${items.map((x) => `<li>${x}</li>`).join('')}</ul></section>`);
}

function cycles(ctx) {
  const { P, d, dBin } = ctx;
  const mv = (dd) => dd.cNode.map((c, i) => [i + 1, (dd.qLsb / c) * 1e6]);
  const cols = [COL.ref, COL.clk, COL.dig, COL.cal];
  const series = REF_ALPHA.filter(([a]) => Math.abs(a - P.alphaIn) > 1e-6).map(([a, label], k) => ({ points: mv(binaryAt(P, a)), color: cols[k], width: 1.3, label: `α = ${label}` }));
  series.push({ points: mv(d), color: COL.muted, width: 1.6, dash: '5 3', label: 'present weights' });
  series.push({ points: mv(dBin), color: COL.an, width: 2.6, label: `binary, α = ${num(P.alphaIn, 2)}` });
  const n = Math.max(d.decisions, dBin.decisions);
  const ymax = (P.fullScale / 2 ** P.bits) * 1e6 * 1.08;
  fill('blCycle', plot({ height: 280, x: { min: 0.5, max: n + 0.5, label: 'bit cycle (decision)', ticks: Array.from({ length: n }, (_, i) => i + 1) }, y: { min: 0, max: ymax, label: 'one LSB at the comparator [µV]' }, series, legend: true }, widthOf('blCycle')),
    `V PN of one LSB = Q LSB / (N C M + 2 C DAC[i]), which is Rabuske eq. 5 for a charge of one LSB (both sides multiplied by 2). Every cycle starts at the input LSB of ${eng(P.fullScale / 2 ** P.bits, 'V')} and drops as capacitors join. Comparator noise and offset must be compared with the value in their cycle.`);
}

function alphaPlot(ctx) {
  const { P } = ctx;
  const lsb = (P.fullScale / 2 ** P.bits) * 1e6;
  const pts = [];
  const exact = [];
  for (let k = 0; k <= 80; k++) {
    const a = 0.1 * (40 ** (k / 80));
    pts.push([Math.log10(a), (lsb * a) / (1 + a)]);
    if (k % 8 === 0) {
      const dd = binaryAt(P, a);
      exact.push([Math.log10(a), (dd.qLsb / dd.cNode[dd.decisions - 1]) * 1e6]);
    }
  }
  const L = Math.log10;
  fill('blAlpha', plot({
    height: 280, x: { min: -1, max: L(4), label: 'alpha', ticks: [0.1, 0.2, 0.4, 1, 2, 3, 4].map(L), format: (t) => `${+(10 ** t).toFixed(2)}` }, y: { min: 0, max: lsb * 1.08, label: 'one LSB at the last decision [µV]' },
    series: [{ points: pts, color: COL.an, width: 2.4, label: 'V LSB · α / (1 + α)' }, { points: exact, color: COL.an, mode: 'dots', r: 4, label: 'model, binary array' }],
    hlines: [{ y: lsb, color: COL.muted }],
    xbands: [{ x0: L(0.5), x1: L(3), color: 'color-mix(in srgb, var(--dig) 12%, transparent)' }],
    vlines: marks(P), legend: true,
  }, widthOf('blAlpha')), `D: at the end of the conversion the node is N C M + 2 C DAC = N C M (1 + 1 / alpha), so one LSB is the input LSB times alpha / (1 + alpha). Shaded: the range Rabuske 2016 simulates, alpha 0.5 to 3. Grey line: the input LSB, ${eng(P.fullScale / 2 ** P.bits, 'V')}. The dots are the model with the halving capacitors included, which adds a little capacitance.`);
}

function phiPlot(ctx) {
  const { P } = ctx;
  const lsbV = P.fullScale / 2 ** P.bits;
  const L = Math.log10;
  const curve = (vos) => Array.from({ length: 81 }, (_, k) => { const a = 0.1 * (40 ** (k / 80)); return [L(a), vos / (a * lsbV)]; });
  const dots = (vos) => [0.2, 0.4, 0.7, 1, 2, 3].map((a) => { const dd = binaryAt(P, a); return [L(a), Math.abs(offsetLsb(dd, vos, 0).differential)]; });
  const ymax = Math.min(curve(P.vos)[0][1], 12);
  fill('blPhi', plot({
    height: 280, x: { min: -1, max: L(4), label: 'alpha', ticks: [0.1, 0.2, 0.4, 1, 2, 3, 4].map(L), format: (t) => `${+(10 ** t).toFixed(2)}` }, y: { min: 0, max: ymax, label: 'φ MSB [LSB]' },
    series: [
      { points: curve(P.vos), color: COL.muted, width: 1.8, dash: '5 3', label: `before trimming, ${eng(P.vos, 'V')}` },
      { points: curve(P.vosCal), color: COL.an, width: 2.4, label: `after trimming, ${eng(P.vosCal, 'V')}` },
      { points: dots(P.vosCal).concat(dots(P.vos)), color: COL.ink, mode: 'dots', r: 3.5, label: 'model' },
    ],
    xbands: [{ x0: L(0.5), x1: L(3), color: 'color-mix(in srgb, var(--dig) 12%, transparent)' }],
    hlines: [{ y: 0.5, color: COL.bad, dash: '4 3' }],
    vlines: marks(P), legend: true,
  }, widthOf('blPhi')), `φ MSB ≈ V offset / (alpha · V LSB), with V LSB = V in,max / 2^B = ${eng(lsbV, 'V')}. D: the same offset voltage is the charge V offset · C node, and the node grows by 2 C DAC from the first to the last decision; in LSB that difference is V offset · 2 C DAC / Q LSB = V offset / (alpha V LSB). Now: ${num(P.vosCal / (P.alphaIn * lsbV), 2)} LSB after trimming, ${num(P.vos / (P.alphaIn * lsbV), 2)} LSB before. Shaded: Rabuske's range, alpha 0.5 to 3. Red: ½ LSB. Dots: the charge model (first decision against the last), which agrees.`);
}

function chen() {
  const c = CHEN;
  const alpha = (c.N * c.cm) / (2 * c.cdac);
  const vref = (c.N * c.vin * c.cm) / (4 * c.cdac);
  const row = (a, b, s, note) => `<tr><td>${a}</td><td class="num">${b}</td><td>${esc(s)}</td><td class="dim">${note}</td></tr>`;
  fill('blChen', `<div class="tablewrap"><table class="tbl"><thead><tr><th>Quantity</th><th>Value</th><th>Status</th><th>Where from</th></tr></thead><tbody>
    ${row('N', c.N, 'S', 'p. 3056')}${row('V in,max', eng(c.vin, 'V'), 'S', 'p. 3056')}${row('C M', eng(c.cm, 'F'), 'S', 'p. 3055')}
    ${row('C DAC', '≈ 1.5 pF', 'S', 'p. 3056: 67 unit capacitors of 23 fF')}
    ${row('alpha = N C M / (2 C DAC)', num(alpha, 3), 'D', '9 × 133 fF / (2 × 1.5 pF)')}
    ${row('V REF from eq. 3', eng(vref, 'V'), 'D', 'the paper says "approximately 160 mV" (p. 3056)')}
    ${row('67 units × 23 fF', eng(c.units * c.cu, 'F'), 'D', `gives alpha ${num((c.N * c.cm) / (2 * c.units * c.cu), 3)}, V REF ${eng((c.N * c.vin * c.cm) / (4 * c.units * c.cu), 'V')}`)}
    ${row('64 charge-carrying units', eng(64 * c.cu, 'F'), 'D', `gives alpha ${num((c.N * c.cm) / (2 * 64 * c.cu), 3)}, V REF ${eng((c.N * c.vin * c.cm) / (4 * 64 * c.cu), 'V')}`)}
    ${row('Q LSB = N C M V in,max / 2^10', eng((c.N * c.cm * c.vin) / 1024, 'C'), 'D', '')}
    ${row('T int', '25 ns', 'S', 'p. 3056: 3/4 of the 33.3 ns period')}
  </tbody></table></div>`, 'The equations of this page reproduce the 160 mV of the paper. The binary array of this model with n u = 8 has 63 bank units, one source unit and 3 empty halving units: 67 units, the number in the paper (7 precharged capacitors: 32, 16, 8, 4, 2, 1, 1; the last one feeds the 3 LSBs by charge redistribution).');
}

/** Bars to scale: the capacitance that holds the signal against the CDAC that joins it, for three values of alpha. */
function alphaVisual(ctx) {
  const { P } = ctx;
  const w = Math.max(560, widthOf('blVis'));
  const lsbV = P.fullScale / 2 ** P.bits;
  const mem = P.channels * P.cmIn;
  const rows = [[P.alphaIn, 'now'], [0.4, 'Chen 2018'], [1, 'alpha 1']].filter(([a, l], i) => i === 0 || Math.abs(a - P.alphaIn) > 0.005);
  const L = 120;
  const R = 330;
  const maxC = Math.max(...rows.map(([a]) => mem * (1 + 1 / a)));
  const sx = (c) => (c / maxC) * (w - L - R);
  const p = [`<svg viewBox="0 0 ${w} ${60 + rows.length * 58}" class="tsvg" role="img" aria-label="Alpha as two capacitances">`];
  // headers on two lines and bar labels as name over value, so nothing overlaps at laptop width
  p.push(`<text x="${L}" y="14" class="tiny">capacitance on the node</text><text x="${L}" y="29" class="tiny">at the last decision, to scale</text><text x="${w - R + 20}" y="29" class="tiny">voltage left</text><text x="${w - R + 130}" y="14" class="tiny">1 LSB at</text><text x="${w - R + 130}" y="29" class="tiny">the comparator</text>`);
  const barText = (x, y, name, value) => `<text x="${x}" y="${y + 16}" text-anchor="middle" class="tiny" style="fill:var(--on-brand)">${name}</text><text x="${x}" y="${y + 31}" text-anchor="middle" class="tiny" style="fill:var(--on-brand)">${value}</text>`;
  rows.forEach(([a, label], i) => {
    const y = 42 + i * 58;
    const dac = mem / a;
    const keep = a / (1 + a);
    p.push(`<text x="8" y="${y + 18}" class="lbl" style="font-weight:600">α = ${num(a, 2)}</text><text x="8" y="${y + 34}" class="tiny">${label}</text>`);
    p.push(`<rect x="${L}" y="${y}" width="${sx(mem)}" height="38" fill="var(--an)"/>${barText(L + sx(mem) / 2, y, 'N·C M', eng(mem, 'F'))}`);
    p.push(`<rect x="${L + sx(mem)}" y="${y}" width="${sx(dac)}" height="38" fill="var(--ref)" opacity="0.75"/>${barText(L + sx(mem) + sx(dac) / 2, y, '2·C DAC', eng(dac, 'F'))}`);
    p.push(`<text x="${w - R + 20}" y="${y + 25}" class="lbl" style="font-weight:600">${num(keep * 100, 0)} %</text><text x="${w - R + 130}" y="${y + 25}" class="lbl" style="font-weight:600">${eng(lsbV * keep, 'V')}</text>`);
  });
  p.push('</svg>');
  fill('blVis', p.join(''), `alpha = N · C M / (2 · C DAC): the capacitance that holds the signal (blue) divided by the CDAC capacitance that joins the node during the conversion (teal). The signal is a charge, so when the node grows the voltage drops: at the last decision alpha / (1 + alpha) of it is left. The comparator noise and offset do not drop with it. Rows use the same memory cell (${eng(P.cmIn, 'F')}); a higher alpha then means a smaller CDAC, charged to a higher V REF = alpha · V in,max / 2. With the unit capacitor fixed at the PDK minimum it is the other way round: the CDAC stays and the memory cell grows with alpha.`);
}
