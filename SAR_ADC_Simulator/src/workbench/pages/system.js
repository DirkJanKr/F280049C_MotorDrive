// System page: the chain from the beamformer to the IQ demodulator, large and
// clickable. Horizontal on wide screens, vertical on narrow ones.

import { eng, num, esc, readouts } from '../kit.js';

export const page = {
  id: 'system',
  title: 'System',
  side(store, ctx) {
    return summaryPanel(ctx);
  },
  main() {
    return '<div class="sysview" id="sysview"></div>';
  },
  update(store, ctx) {
    const el = document.getElementById('sysview');
    if (!el) return;
    const wide = el.clientWidth > el.clientHeight * 1.15 && el.clientWidth > 700;
    el.innerHTML = wide ? horizontal(ctx) : vertical(ctx);
    const side = document.getElementById('sysside');
    if (side) side.outerHTML = summaryPanel(ctx);
  },
};

function summaryPanel(ctx) {
  const { d, P, noise, total, enob } = ctx;
  const tot2 = total ** 2;
  return `<div id="sysside"><h3 class="sh">At a glance</h3>${readouts([
    ['ENOB, converter only', `${num(enob.enob, 2)}`, `aim ${num(P.enobAim, 1)}`, enob.enob >= P.enobAim ? 'ok' : 'bad'],
    ['Decisions', `${d.decisions}`, `planned ${P.rawDecisions}`],
    ['CDAC', eng(d.cdac, 'F'), `${d.units} × ${eng(P.cu, 'F')}`],
    ['Memory cell', eng(d.cm, 'F'), `${d.memCaps} in the array`],
    ['Capacitor area', `${num(ctx.areaTotal * 1e6, 3)} mm²`, `${num((ctx.areaTotal / (3.2e-3 * 5e-3)) * 100, 2)} % of the chip`],
    ['Conversion time', eng(ctx.timing.median, 's'), `of ${eng(ctx.tw, 's')} (illustrative)`],
  ])}
  <h3 class="sh">Noise of the converter</h3><div class="nb">${noise
    .map((n) => `<div class="nbr"><span>${esc(n.label)}</span><span class="nbt"><span style="width:${((n.sigma ** 2 / tot2) * 100).toFixed(1)}%"></span></span><b>${eng(n.sigma, 'V')}</b></div>`)
    .join('')}</div><p class="cap">Root sum of squares: ${eng(total, 'V')} rms. Everything before the beamformer is left out.</p></div>`;
}

const T = (x, y, s, cls, a = 'start') => `<text x="${x}" y="${y}" class="${cls}" text-anchor="${a}">${s}</text>`;

function blockBox(id, go, x, y, w, h, title, lines, extra = '') {
  return `<g class="sb" data-go="${go}" tabindex="0" role="link" aria-label="${esc(title)}">
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="18" class="sbr"/>
    ${T(x + 22, y + 46, esc(title), 'st')}
    ${lines.map((l, i) => T(x + 22, y + 86 + i * 34, l, 'sl')).join('')}
    ${extra}
    ${go ? T(x + w - 20, y + h - 18, 'open ›', 'sgo', 'end') : ''}
  </g>`;
}

function cellGrid(ctx, x, y, w, h) {
  const { P, qd, tw } = ctx;
  const N = P.channels;
  const M = P.memCells;
  const cw = w / M;
  const ch = h / N;
  let s = '';
  for (let n = 0; n < N; n++) {
    const back = Math.ceil(Math.round(qd[n] / (tw / 2)) / 2);
    const c180 = ctx.halfSteps[n];
    for (let k = 0; k < M; k++) {
      const read = k === (M - 1 - back + M) % M;
      s += `<rect x="${x + k * cw}" y="${y + n * ch}" width="${cw - 1.5}" height="${ch - 1.5}" class="${read ? 'gr' : c180 ? 'g180' : 'g0'}"/>`;
    }
  }
  return s;
}

function capRow(ctx, x, y, w) {
  const { d } = ctx;
  const n = d.weights.length;
  const cw = w / n;
  const mx = Math.max(...d.weights);
  return d.weights
    .map((wt, i) => {
      const hh = 12 + 60 * Math.sqrt(wt / mx);
      return `<rect x="${x + i * cw}" y="${y + 72 - hh}" width="${cw - 5}" height="${hh}" rx="3" class="${d.steps[i].kind === 'cap' ? 'cw' : 'ch'}"/>${T(x + i * cw + (cw - 5) / 2, y + 96, num(wt, 0), 'sw', 'middle')}`;
    })
    .join('');
}

function bits(n, x, y, w) {
  const bw = w / n;
  return Array.from({ length: n }, (_, i) => `<rect x="${x + i * bw}" y="${y}" width="${bw - 4}" height="30" rx="4" class="bt"/>${T(x + i * bw + (bw - 4) / 2, y + 21, `d${i + 1}`, 'sbit', 'middle')}`).join('');
}

const wire = (d, cls) => `<path d="${d}" class="sw-n ${cls}"/>`;

function horizontal(ctx) {
  const { P, d } = ctx;
  const W = 1760;
  const H = 760;
  const p = [];
  p.push(`<svg viewBox="0 0 ${W} ${H}" class="sysvg" role="img" aria-label="Signal chain from beamformer to IQ demodulator">`);
  p.push('<defs><marker id="sa" markerWidth="12" markerHeight="12" refX="9" refY="6" orient="auto"><path d="M0,0 L12,6 L0,12 z" class="sah"/></marker></defs>');
  // inputs
  for (let n = 0; n < 16; n++) p.push(wire(`M20 ${190 + n * 22} H150`, 'an thin'));
  p.push(T(20, 170, `${P.channels} channels in`, 'sl'));
  // beamformer
  p.push(blockBox('bf', 'beamformer', 160, 90, 420, 560, 'Beamformer', [`${P.channels} × ${P.memCells} memory cells`, `step ${eng(P.delayStep, 's')} (CLK, CLK 180°)`, `longest delay ${eng(ctx.tauMax, 's')}`], `<g>${cellGrid(ctx, 182, 250, 376, 310)}</g>${T(182, 592, 'violet: CLK 180° · green: read now', 'sxs')}`));
  p.push(wire('M580 360 H630', 'an thick') );
  // node + cdac
  p.push(blockBox('cdac', 'sar', 630, 90, 430, 380, 'Charge sharing + CDAC', [`${d.decisions} decisions`, `CDAC ${eng(d.cdac, 'F')}, ${d.units} units`, `memory cell ${eng(d.cm, 'F')}`], `<g>${capRow(ctx, 652, 280, 386)}</g>`));
  p.push(blockBox('ref', 'sar', 630, 490, 430, 160, 'Reference', [`VREF ${eng(P.vref, 'V')}`, 'precharge per conversion']));
  p.push(wire('M845 490 V470', 'ref thick'));
  // comparator and logic
  p.push(blockBox('cmp', 'timing', 1110, 90, 260, 220, 'Comparator', [`τ ${eng(ctx.tauC, 's')}`, `end LSB ${eng(d.qLsb / d.cNode[d.decisions - 1], 'V')}`], `<path d="M1300 190 L1300 250 L1345 220 Z" class="csym"/>`));
  p.push(blockBox('logic', 'logic', 1110, 350, 260, 300, 'SAR logic', ['self-timed', `${d.decisions} steps`, `median ${eng(ctx.timing.median, 's')}`], `<path d="M1180 600 C1180 640, 1300 640, 1300 600" class="loop" marker-end="url(#sa)"/>`));
  p.push(wire('M1060 200 H1110', 'an thick'));
  p.push(wire('M1240 310 V350', 'dig thick'));
  p.push(wire('M1110 520 H1090 V470', 'clk thick dashed'));
  // digital out
  p.push(blockBox('reg', 'logic', 1420, 90, 320, 200, 'Output register', [`${d.decisions} raw decisions`], `<g>${bits(Math.min(d.decisions, 14), 1442, 210, 276)}</g>`));
  p.push(blockBox('comb', 'mismatch', 1420, 320, 320, 170, 'Combiner + LUT', [`Σ dᵢ wᵢ → ${P.bits} bit`, 'calibrated weights']));
  p.push(blockBox('iq', '', 1420, 520, 320, 130, 'IQ demodulator', [`mix with ${eng(P.f0, 'Hz')}`]));
  p.push(wire('M1370 470 H1395 V190 H1420', 'dig thick'));
  p.push(wire('M1580 290 V320', 'dig thick'));
  p.push(wire('M1580 490 V520', 'dig thick'));
  // clocks
  p.push(wire(`M160 700 H1740`, 'clk'));
  p.push(wire(`M160 730 H1740`, 'clk'));
  p.push(T(170, 692, `CLK ${num(P.fs / 1e6, 0)} MHz`, 'sxs clk-t'));
  p.push(T(170, 722, `CLK 180°: ${eng(ctx.tw / 2, 's')} later`, 'sxs clk-t'));
  p.push(wire('M370 700 V650', 'clk dashed'));
  p.push(wire('M400 730 V650', 'clk dashed'));
  p.push('</svg>');
  return p.join('');
}

function vertical(ctx) {
  const { P, d } = ctx;
  const W = 700;
  const H = 1900;
  const p = [`<svg viewBox="0 0 ${W} ${H}" class="sysvg" role="img" aria-label="Signal chain">`];
  p.push(T(30, 40, `${P.channels} channels in ↓`, 'sl'));
  p.push(blockBox('bf', 'beamformer', 20, 60, 660, 470, 'Beamformer', [`${P.channels} × ${P.memCells} memory cells`, `step ${eng(P.delayStep, 's')} (CLK, CLK 180°)`, `longest delay ${eng(ctx.tauMax, 's')}`], `<g>${cellGrid(ctx, 42, 230, 616, 260)}</g>`));
  p.push(wire('M350 530 V570', 'an thick'));
  p.push(blockBox('cdac', 'sar', 20, 570, 660, 330, 'Charge sharing + CDAC', [`${d.decisions} decisions`, `CDAC ${eng(d.cdac, 'F')}, ${d.units} units`, `memory cell ${eng(d.cm, 'F')}`], `<g>${capRow(ctx, 42, 760, 616)}</g>`));
  p.push(blockBox('ref', 'sar', 20, 930, 660, 130, 'Reference', [`VREF ${eng(P.vref, 'V')}, charged once per conversion`]));
  p.push(blockBox('cmp', 'timing', 20, 1090, 320, 200, 'Comparator', [`τ ${eng(ctx.tauC, 's')}`]));
  p.push(blockBox('logic', 'logic', 360, 1090, 320, 200, 'SAR logic', ['self-timed', `${d.decisions} steps`]));
  p.push(blockBox('reg', 'logic', 20, 1320, 660, 170, 'Output register', [`${d.decisions} raw decisions`], `<g>${bits(Math.min(d.decisions, 14), 42, 1430, 616)}</g>`));
  p.push(blockBox('comb', 'mismatch', 20, 1520, 660, 150, 'Combiner + LUT', [`Σ dᵢ wᵢ → ${P.bits} bit`]));
  p.push(blockBox('iq', '', 20, 1700, 660, 130, 'IQ demodulator', [`mix with ${eng(P.f0, 'Hz')}`]));
  p.push('</svg>');
  return p.join('');
}
