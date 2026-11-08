// Chapter 4: how large the CDAC and the memory cells become.

import { knob, knobGroup } from '../knobs.js';
import { context } from '../ctx.js';
import { plot, figure, C } from '../charts.js';
import { eng, num } from '../fmt.js';
import { v, t, frac, sqrt, sup, eq } from '../math.js';
import { readouts, fillReadouts, check } from '../callouts.js';
import { designCdac, binaryMatchingCu } from '../../model/cdac.js';
import { samplingNoise, prechargeNoise, quantNoise, noiseForEnob } from '../../model/noise.js';

const CHIP = { w: 3.2e-3, h: 5e-3 };

export function cuLimits(P, d) {
  const th = Math.hypot(samplingNoise(P, d), prechargeNoise(P, d).volts);
  const allowed = Math.sqrt(Math.max(noiseForEnob(P, P.enobAim) ** 2 - quantNoise(P) ** 2, 1e-30));
  return { noise: P.cu * (th / allowed) ** 2, pdk: 35e-15, matching: binaryMatchingCu(P).cu, thermal: th, allowed };
}

export const chapter = {
  id: 'cdac', n: 4, short: 'CDAC sizing', title: 'How large does the CDAC become?',
  lede: 'One charge balance links the memory cell, V REF and the CDAC. Fix the unit capacitor, choose V REF, and the memory cell follows.',
  view(state) {
    return {
      knobs: knobGroup('Unit capacitor', ['cu', 'aC', 'density', 'routing'].map((id) => knob(state, id)).join('')) + knobGroup('Reference', knob(state, 'vref') + knob(state, 'lsbPerUnit')),
      main: `${readouts('cd-ro')}
        ${figure('cd-limits', 'What sets the unit capacitor')}
        <div class="grid2">${figure('cd-chip', 'On the chip, to scale (3.2 mm × 5 mm)')}${figure('cd-bal', 'Memory cell from the charge balance')}</div>
        <div class="grid3">${figure('cd-v1', 'Comparator LSB against V REF')}${figure('cd-v2', 'Offset per mV against V REF')}${figure('cd-v3', 'Memory cell against V REF')}</div>
        <div id="cd-check"></div>
        <details class="math-d"><summary>Show the math</summary><div class="math" id="cd-math"></div></details>`,
    };
  },
  update(state) {
    const { P, d, cells } = context(state);
    const lim = cuLimits(P, d);
    const bin = designCdac({ ...P, radix: 2, cu: lim.matching }, cells.m);
    // limits on a log axis
    const lg = (x) => Math.log10(x * 1e15);
    const W = 640;
    const sx = (x) => 30 + ((lg(x) - 0) / 3) * (W - 60);
    const mk = (x, label, cls, y) => `<line x1="${sx(x)}" x2="${sx(x)}" y1="34" y2="70" class="${cls}"/><circle cx="${sx(x)}" cy="52" r="6" class="${cls}"/><text x="${sx(x)}" y="${y}" text-anchor="middle" class="${cls}t">${label}</text>`;
    const setBy = Math.max(lim.noise, lim.pdk) === lim.pdk ? 'the PDK minimum' : 'noise';
    document.getElementById('cd-limits').innerHTML = `<svg viewBox="0 0 ${W} 136" role="img">
      <line x1="30" x2="${W - 30}" y1="52" y2="52" class="axis"/>
      ${[1, 10, 100, 1000].map((f) => `<text x="${sx(f * 1e-15)}" y="130" text-anchor="middle" class="muted" font-size="10">${f} fF</text><line x1="${sx(f * 1e-15)}" x2="${sx(f * 1e-15)}" y1="48" y2="56" class="axis"/>`).join('')}
      <rect x="${sx(Math.max(lim.noise, lim.pdk))}" y="44" width="${Math.max(0, sx(lim.matching) - sx(Math.max(lim.noise, lim.pdk)))}" height="16" class="okzone"/>
      ${mk(lim.noise, `noise ${num(lim.noise * 1e15, 1)} fF`, 'lm-n', 26)}
      ${mk(lim.pdk, `PDK min 35 fF`, 'lm-p', 90)}
      ${mk(lim.matching, `binary matching ${num(lim.matching * 1e15, 0)} fF`, 'lm-m', 26)}
      ${mk(P.cu, `your Cu ${num(P.cu * 1e15, 0)} fF`, 'lm-u', 108)}
    </svg>`;
    document.getElementById('cd-limits-cap').textContent = `With redundancy and calibration, matching no longer sets Cu; it shrinks until ${setBy} stops it. Thermal noise at your Cu: ${eng(lim.thermal, 'V')} rms against ${eng(lim.allowed, 'V')} rms allowed for ENOB ${num(P.enobAim, 1)}.`;
    // chip to scale
    const cw = 200;
    const ch = (cw * CHIP.h) / CHIP.w;
    const side = (a) => (Math.sqrt(a) / CHIP.w) * cw;
    const sb = side(bin.area);
    const sd = side(d.area);
    document.getElementById('cd-chip').innerHTML = `<svg viewBox="0 0 ${cw + 200} ${ch + 10}" role="img">
      <rect x="5" y="5" width="${cw}" height="${ch}" rx="4" class="die"/>
      <rect x="15" y="15" width="${sb}" height="${sb}" class="ar-bin"/><rect x="15" y="15" width="${sd}" height="${sd}" class="ar-you"/>
      <text x="${cw + 20}" y="30" class="lgt">Binary, ${num(lim.matching * 1e15, 0)} fF units</text><text x="${cw + 20}" y="46" class="muted" font-size="11">${num(bin.area * 1e6, 3)} mm², ${num((bin.area / (CHIP.w * CHIP.h)) * 100, 1)} % of the chip</text>
      <text x="${cw + 20}" y="76" class="lgt you">Your design, ${num(P.cu * 1e15, 0)} fF units</text><text x="${cw + 20}" y="92" class="muted" font-size="11">${num(d.area * 1e6, 3)} mm², ${num((d.area / (CHIP.w * CHIP.h)) * 100, 2)} % of the chip</text>
      <text x="${cw + 20}" y="122" class="muted" font-size="10.5">CDAC + ${d.memCaps} memory capacitors, × ${num(P.routing, 1)} routing</text>
    </svg>`;
    const lnaR = 1 / P.fs / 20 / d.cm;
    document.getElementById('cd-bal').innerHTML = `<div class="balance">
      <div class="bal-row"><span>CDAC</span><b>${eng(d.cdac, 'F')}</b><small>${d.units} units × ${num(P.cu * 1e15, 0)} fF</small></div>
      <div class="bal-row"><span>CM, half-range charge</span><b>${eng(d.cm, 'F')}</b><small>used in this app</small></div>
      <div class="bal-row"><span>CM, total CDAC (slide 25)</span><b>${eng(d.cmSlide, 'F')}</b><small>open: see below</small></div>
      <div class="bal-row"><span>LNA drive, R ≤ (Ts / 20) / CM</span><b>${eng(lnaR, 'Ω')}</b><small>binary design: ${eng(1 / P.fs / 20 / bin.cm, 'Ω')}</small></div></div>`;
    // V REF trade-off
    const vr = [];
    for (let x = 50; x <= 500; x += 10) vr.push(x * 1e-3);
    const at = vr.map((x) => designCdac({ ...P, vref: x }, cells.m));
    const n = d.decisions;
    const mark = (y) => [{ points: [[P.vref * 1e3, y]], color: C.b, mode: 'dots', r: 5 }];
    const small = { width: 300, height: 230, margin: { l: 44, b: 30, t: 10, r: 10 } };
    const lsbLast = (dd) => (dd.qLsb / dd.cNode[dd.decisions - 1]) * 1e3;
    document.getElementById('cd-v1').innerHTML = plot({ ...small, x: { min: 50, max: 500, label: 'V REF [mV]' }, y: { min: 0, max: Math.max(...at.map(lsbLast)) * 1.1, label: 'mV' }, series: [{ points: at.map((dd, i) => [vr[i] * 1e3, lsbLast(dd)]), color: C.a, width: 2 }, ...mark(lsbLast(d))] });
    const offLast = (dd) => (dd.cNode[dd.decisions - 1] * 1e-3) / dd.qLsb;
    document.getElementById('cd-v2').innerHTML = plot({ ...small, x: { min: 50, max: 500, label: 'V REF [mV]' }, y: { min: 0, max: Math.max(...at.map(offLast)) * 1.1, label: 'LSB per mV' }, series: [{ points: at.map((dd, i) => [vr[i] * 1e3, offLast(dd)]), color: C.bad, width: 2 }, ...mark(offLast(d))] });
    document.getElementById('cd-v3').innerHTML = plot({ ...small, x: { min: 50, max: 500, label: 'V REF [mV]' }, y: { min: 0, max: Math.max(...at.map((dd) => dd.cm * 1e15)) * 1.1, label: 'fF' }, series: [{ points: at.map((dd, i) => [vr[i] * 1e3, dd.cm * 1e15]), color: C.c, width: 2 }, ...mark(d.cm * 1e15)] });
    document.getElementById('cd-v2-cap').textContent = 'At the last decision, where the tolerance is 0.';
    document.getElementById('cd-v3-cap').textContent = 'A higher V REF helps the comparator twice but grows the memory cell, its area and the LNA load.';
    document.getElementById('cd-check').innerHTML =
      check('Charge balance with redundancy: which capacitance counts?', `Slide 25 puts the total CDAC (${d.units} units, including the redundant and halving capacitors) into N · Vin,max · CM = 4 · VREF · CDAC and gets CM = ${eng(d.cmSlide, 'F')}. Only the step charge that covers half the range has to balance the input, which gives CM = ${eng(d.cm, 'F')} (derived, please confirm). A larger CM than needed wastes LNA drive; a smaller one than needed leaves codes unused at the ends.`) +
      check('MOS capacitors for the CDAC', 'Not chosen. Everything here uses mim5_2, the only device with matching data. MOS would be denser and charge sharing tolerates its nonlinearity, but it settles slower and has more parasitic capacitance.');
    fillReadouts(document.getElementById('cd-ro'), [
      ['CDAC', eng(d.cdac, 'F'), `${d.units} units`],
      ['Memory cell CM', eng(d.cm, 'F'), `slide method ${eng(d.cmSlide, 'F')}`],
      ['Area', `${num(d.area * 1e6, 3)} mm²`, `${num((bin.area / d.area), 1)} × less than binary`],
      ['Unit set by', setBy, `noise limit ${num(lim.noise * 1e15, 1)} fF`],
    ]);
    const s1 = (P.aC / 100) / Math.sqrt(P.cu / 1e-15);
    document.getElementById('cd-math').innerHTML = [
      eq(`${v('N')} ${v('V', 'in,max')} ${v('C', 'M')}`, '=', `4 ${v('V', 'REF')} ${v('C', 'DAC')}`, t('(slide 15)')),
      eq(v('σ', 'u'), '=', frac(v('A', 'C'), sqrt(`${v('C', 'u')} / 1 ${t('fF')}`)), '=', frac(`${num(P.aC, 2)} %`, sqrt(num(P.cu * 1e15, 0))), '=', `${num(s1 * 100, 3)} %`),
      eq(t('binary:'), `3 · ${v('σ', 'u')} · ${t('LSB/unit')} · ${sqrt(`2 · ${t('first step')}`)}`, '<', '0.5 LSB', '→', v('C', 'u'), '≥', `${num(lim.matching * 1e15, 0)} ${t('fF')}`),
      eq(v('σ', 'samp'), '=', sqrt(frac(`2 ${v('k')} ${v('T')}`, `${v('N')} ${v('C', 'M')}`)), '=', eng(samplingNoise(P, d), 'V'), ',', v('σ', 'pre'), '=', frac(sqrt(`2 ${v('k')} ${v('T')} ${v('C', 'DAC')}`), v('Q', 'LSB')), '=', `${num(prechargeNoise(P, d).lsb, 3)} ${t('LSB')}`),
      eq(t('Both scale as'), frac('1', sqrt(v('C', 'u'))), ':', v('C', 'u,noise'), '=', v('C', 'u'), sup(`(${frac(v('σ', 'th'), v('σ', 'allowed'))})`, 2), '=', `${num(lim.noise * 1e15, 1)} ${t('fF')}`),
    ].join('');
  },
};
