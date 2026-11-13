// Budget page: the noise of the converter as charge on the summing node, in a
// budget table that adds in power, every check with why it fails and what fixes
// it, and the ENOB against one value at a time.

import { group, knobs, card, fill, widthOf, plot, explain, eng, num, esc, COL, fv } from '../kit.js';
import { designCdac, chargeBalance } from '../../zaan/model/cdac.js';
import { chargeBudget } from '../budget.js';
import { changed } from '../store.js';

const FID = { sar: 'b-sar', round: 'b-round', lut: 'b-lut', quant: 'b-quant', comp: 'b-comp', tint: 'b-tint', slot: 'b-slot', samp: 'b-samp', pre: 'b-pre', jit: 'b-jit' };
const SWEEPS = {
  compNoise: { label: 'Comparator input noise', unit: 'mV rms', si: 1e-3, lo: 0, hi: 0.2 },
  alpha: { label: 'alpha', unit: '', si: 1, lo: 0.1, hi: 3 },
  cm: { label: 'Memory capacitor C M', unit: 'fF', si: 1e-15, lo: 30, hi: 400 },
  jitter: { label: 'Sampling clock jitter', unit: 'ps rms', si: 1e-12, lo: 0, hi: 10 },
  temperature: { label: 'Temperature', unit: 'K', si: 1, lo: 250, hi: 360 },
};

export const page = {
  id: 'budget',
  title: 'Budget',
  side(store) {
    const used = new Set();
    return group('Target', knobs(store.values, ['enobAim', 'bits', 'outBits', 'fullScale'], used)) +
      group('Calibration', knobs(store.values, ['calMethod'], used)) +
      group('Noise sources', knobs(store.values, ['compNoise', 'vosCal', 'temperature', 'jitter'], used)) +
      group('Charge balance', knobs(store.values, ['cm', 'alpha', 'lsbPerUnit'], used), false);
  },
  main(store) {
    const on = store.ui.arrayGain !== false;
    return `<div id="bgVerdict"></div>
      <section class="card wide"><header><h3>Noise budget on the summing node</h3><span class="ctl"><button class="mini ${on ? 'on' : ''}" data-gain="1">beamformer gain ${on ? 'on' : 'off'}</button>${fv('gain', `${num(10 * Math.log10(store.ctx.P.channels), 1)} dB on cell noise`)}<button class="mini ${store.ui.splitRes !== false ? 'on' : ''}" data-split="1">quantisation, rounding, LUT: ${store.ui.splitRes !== false ? 'separate' : 'one line'}</button><button class="mini" id="allocReset">equal allocation</button></span></header>
        <div class="cbody" id="bgTable"></div><p class="cap" id="bgTable-cap"></p></section>
      <section class="card wide"><header><h3>Where the allowed noise power goes</h3></header><div class="cbody" id="bgBar"></div><p class="cap" id="bgBar-cap"></p></section>
      <section class="card wide"><header><h3>Every check, why it passes or fails</h3></header><div class="cbody" id="bgChecks"></div></section>
      <div class="grid2">${card('bgCmp', 'Comparator noise: what it is', '')}${card('bgOff', 'Comparator offset and trimming', '')}</div>
      <div class="grid2">${card('bgSweep', 'ENOB against one value', `<select id="bgSweepSel" class="sel inline">${Object.entries(SWEEPS).map(([k, s]) => `<option value="${k}" ${store.ui.sweep === k ? 'selected' : ''}>${esc(s.label)}</option>`).join('')}</select>`)}${card('bgDec', 'Comparator noise and offset as charge, per decision')}</div>
      ${explain('Why charge', [
        'In a charge-sharing SAR the input is a charge: the selected memory cells bring Q in = N CM V in to the node, and every step adds or takes a fixed charge. The node capacitance grows during the conversion, so a voltage at the comparator means a different charge at every decision. Charge is the one quantity that does not change along the way, so every noise source is referred to it.',
        'Noise sources are independent, so they add in power: σ total = √(σ1² + σ2² + …). That is why the budget is in shares of the allowed power, which do add up to 100 %.',
        'The beamformer gain: the signal from 16 aligned channels adds as 16, noise that is independent per channel adds as √16 = 4, a gain of 10 log10 16 = 12 dB in power. In this model only the kT/C of the memory cells is per channel. Everything after the summing node (CDAC, comparator, quantisation) gets no gain.',
      ])}`;
  },
  mount(store) {
    document.getElementById('allocReset').onclick = () => {
      store.ui.alloc = {};
      changed('values');
    };
    document.getElementById('bgSweepSel').onchange = (e) => {
      store.ui.sweep = e.target.value;
      sweep(store, store.ctx);
    };
  },
  update(store, ctx) {
    verdict(ctx);
    table(ctx);
    powerBar(ctx);
    checks(ctx);
    sweep(store, ctx);
    perDecision(ctx);
    comparatorNoise(ctx);
    offsetCard(ctx);
  },
};

function verdict(ctx) {
  const c = ctx.checks.find((x) => x.id === 'enob');
  const b = ctx.budget;
  fill('bgVerdict', `<div class="verdict ${c.state}"><div class="vbig">${fv('enob', `${num(b.enob, 2)} bit`)}</div><div><b>${c.state === 'ok' ? 'ENOB meets the aim' : 'ENOB is below the aim'} of ${num(ctx.P.enobAim, 1)} bit</b><p>${c.why}</p>${c.fix ? `<p class="fix">Fix: ${c.fix}</p>` : ''}</div></div>`);
}

function table(ctx) {
  const { budget: b, d } = ctx;
  const V = ctx.ui.qUnit === 'V';
  const val = (q) => (V ? num((q / d.cTh) * 1e6, 1) : num(q * 1e15, 3));
  const bar = (l) => `<span class="shb"><span class="shf ${l.ok ? '' : 'over'}" style="width:${Math.min(100, l.share)}%"></span><span class="sha" style="left:${Math.min(100, l.alloc)}%"></span></span>`;
  const rows = b.lines.map((l) => `<tr class="${l.ok ? '' : 'over'}"><td>${fv(FID[l.id], esc(l.label))}${l.perChannel ? ` <span class="tag">${b.arrayGain ? 'with beamformer gain' : 'no beamformer gain'}</span>` : ''}${l.simulated ? ` <span class="tag">simulated, ${ctx.res.enob.length} chips</span>` : ''}</td>
    <td class="num">${val(l.sigma)}</td><td class="num">${num(l.lsb, 3)}</td>
    <td class="shc">${bar(l)}<span class="num">${num(l.share, 1)} %</span></td>
    <td class="num">${l.fixed ? `${num(l.alloc, 1)}` : `<input type="number" class="alloc" data-alloc="${l.id}" aria-label="allocation for ${esc(l.label)} in %" value="${+l.alloc.toFixed(1)}" step="1" min="0" max="100"/>`} %</td>
    <td class="num">${num(l.enobWithout, 2)}</td><td>${l.ok ? '<span class="okc">within</span>' : '<span class="badc">over</span>'}</td></tr>`).join('');
  const allocSum = b.lines.reduce((a, l) => a + l.alloc, 0);
  fill('bgTable', `<div class="tablewrap"><table class="tbl budget"><thead><tr><th>Line (click for the formula)</th><th>σ [${V ? 'µV rms at the input' : 'fC rms'}]</th><th>LSB</th><th>share of the allowed power</th><th>allocation</th><th>ENOB without it</th><th></th></tr></thead><tbody>${rows}
    <tr class="tot"><td>Total, root sum of squares</td><td class="num">${val(b.total)}</td><td class="num">${num(b.total / d.qLsb, 3)}</td><td class="num">${num(b.used, 1)} %</td><td class="num ${allocSum > 100.05 ? 'badc' : ''}">${num(allocSum, 1)} %</td><td class="num">${fv('enob', num(b.enob, 2))}</td><td>${b.ok ? '<span class="okc">pass</span>' : '<span class="badc">fail</span>'}</td></tr>
    <tr class="tot"><td>${fv('allowed', `Allowed for ENOB ${num(ctx.P.enobAim, 1)}`)}</td><td class="num">${val(b.allowed)}</td><td class="num">${num(b.allowed / d.qLsb, 3)}</td><td class="num">100 %</td><td></td><td></td><td></td></tr>
  </tbody></table></div>`, `${V ? `Shown as the voltage each charge means at the input: V = Q / (${ctx.P.channels} CM) = Q / ${eng(d.cNode[0], 'F')}. Switch to fC in the header.` : `Differential charge on the node at the start of the conversion, Q in = ${ctx.P.channels} CM · V in. Switch to µV at the input in the header.`} One LSB = ${fv('qlsb', eng(d.qLsb, 'C'))} = ${eng(d.qLsb / d.cNode[0], 'V')} at the input. The allocation is yours to set; it starts with quantisation as it is and the rest split evenly. A line is over when its share exceeds its allocation.`);
}

function powerBar(ctx) {
  const b = ctx.budget;
  const w = Math.max(340, widthOf('bgBar'));
  const top = Math.max(100, b.used) * 1.04;
  const sx = (p) => 12 + (p / top) * (w - 24);
  const cols = { sar: 'var(--muted)', quant: 'var(--muted)', round: 'var(--cal)', lut: 'var(--warn)', comp: 'var(--ref)', tint: 'var(--warn)', slot: 'var(--cal)', samp: 'var(--an)', pre: 'var(--clk)', jit: 'var(--dig)' };
  let acc = 0;
  let accA = 0;
  const segs = [];
  const alloc = [];
  for (const l of b.lines) {
    segs.push(`<rect x="${sx(acc)}" y="34" width="${Math.max(0, sx(acc + l.share) - sx(acc))}" height="40" fill="${cols[l.id]}" opacity="0.9"><title>${esc(l.label)}: ${num(l.share, 1)} %</title></rect>`);
    if (sx(acc + l.share) - sx(acc) > 36) segs.push(`<text x="${(sx(acc) + sx(acc + l.share)) / 2}" y="59" class="onbar" text-anchor="middle">${num(l.share, 0)} %</text>`);
    acc += l.share;
    alloc.push(`<rect x="${sx(accA)}" y="104" width="${Math.max(0, sx(accA + l.alloc) - sx(accA))}" height="18" fill="${cols[l.id]}" opacity="0.45"/>`);
    accA += l.alloc;
  }
  const legend = `<div class="pleg">${b.lines.map((l) => `<span><i style="background:${cols[l.id]}"></i>${esc(l.label)}</span>`).join('')}</div>`;
  fill('bgBar', `<svg viewBox="0 0 ${w} 136" class="tsvg" role="img" aria-label="Noise power shares"><text x="12" y="24" class="lbl">noise power now</text>${segs.join('')}<text x="12" y="98" class="lbl dim">your allocation</text>${alloc.join('')}<line x1="${sx(100)}" x2="${sx(100)}" y1="20" y2="130" class="budget"/><text x="${sx(100) - 4}" y="16" class="tiny ${b.ok ? '' : 'bad'}" text-anchor="end">allowed for ENOB ${num(ctx.P.enobAim, 1)}</text></svg>${legend}`,
    `Powers add, so the shares stack. Everything left of the red line fits the ENOB aim; ${b.ok ? `${num(100 - b.used, 1)} % of the allowance is still free` : `the total is ${num(b.used - 100, 1)} % over`}.`);
}

function checks(ctx) {
  fill('bgChecks', `<div class="checks">${ctx.checks.map((c) => `<div class="ck ${c.state}"><div class="ckh"><span class="dot"></span><b>${esc(c.label)}</b><span class="ckv">${c.f ? fv(c.f, esc(c.value)) : esc(c.value)}</span><span class="ckl">${esc(c.limit)}</span><a href="#${c.go}" class="mini">open page</a></div><p>${c.why}</p>${c.fix ? `<p class="fix">Fix: ${c.fix}</p>` : ''}</div>`).join('')}</div>`);
}

function sweep(store, ctx) {
  const id = store.ui.sweep && SWEEPS[store.ui.sweep] ? store.ui.sweep : 'compNoise';
  const s = SWEEPS[id];
  const { P, d, budget } = ctx;
  const res = ctx.res;
  const pts = [];
  for (let k = 0; k <= 60; k++) {
    const x = s.lo + ((s.hi - s.lo) * k) / 60;
    let Pk = { ...P, [id]: x * s.si };
    if (id === 'alpha' || id === 'cm') {
      // the balance sets V_REF and C_u: recompute them, then the CDAC
      const bal = chargeBalance({ channels: P.channels, fullScale: P.fullScale, bits: P.bits, cm: id === 'cm' ? x * s.si : P.cmIn, alpha: id === 'alpha' ? x : P.alphaIn, lsbPerUnit: P.lsbPerUnit });
      Pk = { ...P, vref: bal.vref, cu: bal.cu };
    }
    const dk = id === 'alpha' || id === 'cm' ? designCdac(Pk, P.memCells, ctx.steps) : d;
    pts.push([x, chargeBudget(Pk, dk, { arrayGain: budget.arrayGain, res }).enob]);
  }
  const ys = pts.map((p) => p[1]);
  const now = (id === 'alpha' ? P.alphaIn : id === 'cm' ? P.cmIn : P[id]) / s.si;
  fill('bgSweep', plot({ height: 250, x: { min: s.lo, max: s.hi, label: `${s.label} [${s.unit}]` }, y: { min: Math.min(...ys, P.enobAim) - 0.1, max: Math.max(...ys, P.enobAim) + 0.1, label: 'ENOB [bit]' }, series: [{ points: pts, color: COL.an, width: 2.2 }], hlines: [{ y: P.enobAim, color: COL.ref, dash: '6 3' }], vlines: [{ x: now, color: COL.ink, label: 'now' }] }, widthOf('bgSweep')),
    `Charge budget with everything else as it is now; quantisation, rounding and LUT error are kept at their simulated values in LSB (${num(res.sar, 3)}, ${num(res.round, 3)}, ${num(res.lut, 3)}). ${id === 'alpha' ? `alpha sets V REF = alpha · V in,max / 2 and C DAC = N C M / (2 alpha): a larger alpha means a smaller CDAC, so less attenuation at the comparator.` : id === 'cm' ? 'C M scales every capacitor and the charge per LSB together; kT/C noise in LSB falls as 1 / √C M.' : ''}`);
}

function perDecision(ctx) {
  const { d, P } = ctx;
  const n = d.decisions;
  const idx = Array.from({ length: n }, (_, i) => i + 1);
  const noise = idx.map((i) => [i, (d.cNode[i - 1] * P.compNoise) / d.qLsb]);
  const off = idx.map((i) => [i, (d.cNode[i - 1] * P.vosCal) / d.qLsb]);
  const offRaw = idx.map((i) => [i, (d.cNode[i - 1] * P.vos) / d.qLsb]);
  const ymax = Math.max(...offRaw.map((p) => p[1]), ...noise.map((p) => p[1])) * 1.1;
  fill('bgDec', plot({ height: 250, x: { min: 0.5, max: n + 0.5, label: 'decision', ticks: idx }, y: { min: 0, max: ymax, label: 'as charge [LSB]' }, series: [
    { points: offRaw, color: COL.muted, width: 1.6, dash: '5 3', label: 'offset before calibration' },
    { points: off, color: COL.ref, width: 2.2, label: 'offset after calibration' },
    { points: noise, color: COL.clk, width: 2.2, label: 'noise σ' },
  ], legend: true }, widthOf('bgDec')), `The same ${eng(P.vos, 'V')} offset and ${eng(P.compNoise, 'V')} noise at the comparator are ${num(d.cNode[n - 1] / d.cNode[0], 1)} × more charge at the last decision than at the first, because the node grows from ${eng(d.cNode[0], 'F')} to ${eng(d.cNode[n - 1], 'F')}. Calibrating the comparator scales the offset line down.`);
}

/** P(output = 1) against the comparator input: a step blurred by the noise, an S-curve. */
function comparatorNoise(ctx) {
  const { P, d } = ctx;
  const vn = P.compNoise;
  const lsbLast = d.qLsb / d.cNode[d.decisions - 1];
  const lsbFirst = d.qLsb / d.cNode[0];
  const span = Math.max(4 * vn, 1.2 * lsbLast);
  const erf = (x) => {
    const t = 1 / (1 + 0.3275911 * Math.abs(x));
    const y = 1 - (((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t) * Math.exp(-x * x);
    return x >= 0 ? y : -y;
  };
  const pts = [];
  for (let k = 0; k <= 200; k++) {
    const v = -span + (2 * span * k) / 200;
    pts.push([v * 1e6, vn > 0 ? 50 * (1 + erf(v / (vn * Math.SQRT2))) : v >= 0 ? 100 : 0]);
  }
  const pWrong = vn > 0 ? 50 * (1 - erf(lsbLast / 2 / (vn * Math.SQRT2))) : 0;
  fill('bgCmp', plot({ height: 220, x: { min: -span * 1e6, max: span * 1e6, label: 'input of the comparator [µV]' }, y: { min: 0, max: 100, label: 'P(output = 1) [%]' }, series: [{ points: pts, color: COL.clk, width: 2.4 }], vlines: [{ x: (lsbLast / 2) * 1e6, color: COL.ref, label: '½ LSB, last decision' }, { x: (-lsbLast / 2) * 1e6, color: COL.ref }] }, widthOf('bgCmp')),
    `A comparator compares two voltages, but its own transistors add a random voltage v n at the input (thermal noise of the input pair, mostly while it amplifies). An input of exactly 0 V gives 1 or 0 with 50 % each; the further from 0, the surer the answer. The width of this S-curve is the input noise: here σ = ${eng(vn, 'V')}. You measure it in Spectre with a transient noise simulation: sweep a small DC input, count how often the output is 1, and fit this curve. At the last decision one LSB is only ${eng(lsbLast, 'V')} at the comparator (${eng(lsbFirst, 'V')} at the first), because the node has grown; an input half an LSB away is decided wrongly ${num(pWrong, 2)} % of the time. As charge the same noise is C node · v n, which is why it is in the budget at the largest node.`);
}

function offsetCard(ctx) {
  const { P, d } = ctx;
  const n = d.decisions;
  fill('bgOff', `<p class="cap" style="margin:0">An offset is a constant error at the comparator input: every decision compares against v os instead of 0. A constant does not add noise, so it is not a line in the budget: a sine still has the same SNDR, only shifted by a DC value.</p>
    <p class="cap">But in a charge-sharing SAR the node grows, so the same v os is a different charge at every decision: v os · C node,i, from ${num((P.vosCal * d.cNode[0]) / d.qLsb, 2)} LSB at decision 1 to ${num((P.vosCal * d.cNode[n - 1]) / d.qLsb, 2)} LSB at the last (after trimming, v os = ${eng(P.vosCal, 'V')}; before, ${eng(P.vos, 'V')}). The common part shifts all codes; the part that differs between decisions must fit in the redundancy. That is checked per decision on the SAR ADC page.</p>
    <p class="cap">Trimming the gates of the input pair removes most of it once, at test. What is left after trimming is the value you set; a finer trim step means a smaller value.</p>`);
}
