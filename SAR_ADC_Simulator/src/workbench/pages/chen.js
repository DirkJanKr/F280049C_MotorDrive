// Item 2: timing after Chen 2018 (Fig. 4(b), p. 3054; Fig. 7(b), p. 3055), first with Chen's
// values, then scaled to Zaan. One clock period T = 1 / fs holds one conversion:
//   readout clock R rises -> charge is released to the summing nodes (p. 3053)
//   a short interval for passive charge redistribution, then the self-timed comparisons
//   CPRST resets the summing nodes at the end; one more comparison then calibrates the offset
// Meanwhile the other CDAC is reset (RST) and precharged by the gated current for T_int = 3/4 T.
// The shares of the period for redistribution and reset are read off Fig. 4(b): status A.

import { fill, widthOf, readouts, explain, eng, num } from '../kit.js';

const REDIS = 0.1; // share of the period for charge redistribution (A, from Fig. 4(b))
const RESET = 0.12; // share for CPRST (A, from Fig. 4(b))

function setup(ctx, which) {
  const { P, d } = ctx;
  return which === 'chen'
    ? { name: 'Chen 2018', T: 1 / 30e6, cells: 8, ch: 9, n: 10, half: false }
    : { name: 'Zaan', T: 1 / P.fs, cells: P.memCells, ch: P.channels, n: d.decisions, half: P.delayStep < 1 / P.fs - 1e-12 };
}

export const page = {
  id: 'chen',
  title: 'Timing after Chen',
  side() {
    return '';
  },
  main(store) {
    const w = store.ui.chenWhich || 'chen';
    return `<section class="card wide"><header><h3>All clocks over three conversions</h3><span class="seg sm2"><button class="${w === 'chen' ? 'on' : ''}" data-chen="chen">Chen 2018 values</button><button class="${w === 'zaan' ? 'on' : ''}" data-chen="zaan">scaled to Zaan</button></span></header>
      <div id="chRo"></div><div class="cbody" id="chView"></div><p class="cap" id="chView-cap"></p></section>
      <section class="card wide flagc"><header><h3>Where Zaan departs from Chen's sequence</h3></header><ul class="whyl" id="chFlags"></ul></section>
      ${explain('The sequence, from the paper', [
        'Each channel samples into its memory cells one after another: the sampling clocks S<1:M> do not overlap, and each is one clock period long. A cell is read when its readout clock R rises. The delay of a channel is the time between the falling edges of its sampling clock and its readout clock (p. 3053).',
        'A readout period is one conversion. The charge of the selected cells of all channels first spreads over the joined cells; then the self-timed comparator and logic make the decisions without any faster clock; at the end the summing nodes are shorted (CPRST), which removes the charge left on the parasitics and gives the moment to calibrate the comparator offset (p. 3053, p. 3058).',
        'There are two CDACs. While one converts, the other is reset and then charged by the gated current source for T int, 3/4 of the period. They swap every period (PC A, PC B) (p. 3056).',
      ])}`;
  },
  mount(store) {
    document.querySelectorAll('[data-chen]').forEach((b) => {
      b.onclick = () => {
        store.ui.chenWhich = b.dataset.chen;
        document.querySelectorAll('[data-chen]').forEach((x) => x.classList.toggle('on', x === b));
        page.update(store, store.ctx);
      };
    });
  },
  update(store, ctx) {
    const s = setup(ctx, store.ui.chenWhich || 'chen');
    const tDec = (s.T * (1 - REDIS - RESET)) / (s.n + 1);
    const tint = 0.75 * s.T;
    fill('chRo', readouts([
      ['Clock period T', eng(s.T, 's'), `${num(1e-6 / s.T, 0)} MS/s`],
      ['Memory cells', `${s.cells}`, `longest delay ${eng((s.cells - 1) * s.T, 's')}`],
      ['Decisions', `${s.n} + 1`, 'the extra one calibrates the offset'],
      ['Time per decision', eng(tDec, 's'), 'comparator, logic and settling together', tDec < 1.5e-9 ? 'bad' : 'ok'],
      ['T int', eng(tint, 's'), '3/4 of the period'],
      ['20 ps jitter on T int', `${num((20e-12 / tint) * 2 ** (ctx.P.bits - 1) / Math.SQRT2, 2)} LSB rms`, 'full-scale sine'],
    ]));
    diagram(s, widthOf('chView', 1000));
    const z = setup(ctx, 'zaan');
    const c = setup(ctx, 'chen');
    const td = (q) => (q.T * (1 - REDIS - RESET)) / (q.n + 1);
    fill('chFlags', [
      `<b>Less time per decision.</b> Chen: ${eng(td(c), 's')} for each of 10 + 1 decisions. Zaan: ${eng(td(z), 's')} for each of ${z.n} + 1, because the period is shorter (${eng(z.T, 's')} against ${eng(c.T, 's')}) and there are more decisions. Chen's process is the same 0.18 µm node.`,
      `<b>The 12.5 ns delay step needs a second sampling phase.</b> Chen has one set of sampling clocks and a delay step of one period. With the inverted clock a channel on the half step samples half a period later, so its cell has half a period less between sampling and readout: the shortest delay is no longer a full period for those channels. The readout stays common to all channels.`,
      `<b>More clocks to route.</b> ${z.cells} sampling clocks (twice that with the second phase) and ${z.cells} readout clocks for each of ${z.ch} channels, against 8 and 8 × 9.`,
      `<b>Shorter T int.</b> ${eng(0.75 * z.T, 's')} against 25 ns: the same clock jitter is ${num(25e-9 / (0.75 * z.T), 2)} times more reference noise.`,
      `<b>The longest hold is longer.</b> A cell holds its charge up to ${eng((z.cells - 1) * z.T, 's')} (Chen: 233 ns), so leakage and the settling of ${z.cells} switches per channel on the summing node count more.`,
    ].map((x) => `<li>${x}</li>`).join(''));
  },
};

function diagram(s, w) {
  const per = 3;
  const L = 96;
  const rows = ['CLK', ...(s.half ? ['CLK 180°'] : []), 'S<1>', 'S<2>', 'S<3>', 'R<1>', 'R<2>', 'COMP', 'CPRST', 'RST', 'INT', 'PC A', 'PC B', 'V DAC'];
  const rh = 30;
  const H = rows.length * rh + 40;
  const sx = (t) => L + (t / (per * s.T)) * (w - L - 12);
  const y = (name) => 14 + rows.indexOf(name) * rh;
  const pulses = (name, list, cls = 'wv') => {
    let dd = `M${sx(0)} ${y(name) + 20}`;
    for (const [a, b] of list) dd += ` H${sx(a)} V${y(name) + 4} H${sx(Math.min(b, per * s.T))} V${y(name) + 20}`;
    return `<path d="${dd} H${sx(per * s.T)}" class="${cls}"/>`;
  };
  const p = [`<svg viewBox="0 0 ${w} ${H}" class="tsvg" role="img" aria-label="Timing diagram">`];
  rows.forEach((r) => p.push(`<text x="6" y="${y(r) + 18}" class="lbl">${r}</text>`));
  const k3 = [0, 1, 2];
  p.push(pulses('CLK', k3.map((k) => [k * s.T, (k + 0.5) * s.T])));
  if (s.half) p.push(pulses('CLK 180°', [[-0.5 * s.T, 0], ...k3.map((k) => [(k + 0.5) * s.T, (k + 1) * s.T])].map(([a, b]) => [Math.max(a, 0), b])));
  k3.forEach((k) => p.push(pulses(`S<${k + 1}>`, [[k * s.T, (k + 1) * s.T]])));
  // readout: cell 1 is read in period 2 (delay of one period), cell 2 in period 3
  p.push(pulses('R<1>', [[1 * s.T + 0.02 * s.T, 2 * s.T]]), pulses('R<2>', [[2 * s.T + 0.02 * s.T, 3 * s.T]]));
  const comp = [];
  const rst = [];
  const pre = [];
  const int = [];
  for (const k of k3) {
    const t0 = k * s.T + REDIS * s.T;
    const td = (s.T * (1 - REDIS - RESET)) / (s.n + 1);
    for (let i = 0; i < s.n; i++) comp.push([t0 + i * td + td * 0.25, t0 + i * td + td * 0.75]);
    rst.push([(k + 1 - RESET) * s.T, (k + 1) * s.T - 0.01 * s.T]);
    comp.push([(k + 1 - RESET * 0.6) * s.T, (k + 1 - RESET * 0.3) * s.T]);
    pre.push([k * s.T, (k + 0.06) * s.T]);
    int.push([(k + 0.08) * s.T, (k + 0.83) * s.T]);
  }
  p.push(pulses('COMP', comp), pulses('CPRST', rst), pulses('RST', pre), pulses('INT', int));
  p.push(pulses('PC A', [[0, s.T], [2 * s.T, 3 * s.T]]), pulses('PC B', [[s.T, 2 * s.T]]));
  let vd = `M${sx(0)} ${y('V DAC') + 22}`;
  for (const k of k3) vd += ` L${sx((k + 0.08) * s.T)} ${y('V DAC') + 22} L${sx((k + 0.83) * s.T)} ${y('V DAC') + 4} H${sx((k + 1) * s.T)} V${y('V DAC') + 22}`;
  p.push(`<path d="${vd}" class="wv"/>`);
  for (let k = 0; k <= per; k++) p.push(`<line x1="${sx(k * s.T)}" x2="${sx(k * s.T)}" y1="8" y2="${H - 26}" class="tick"/><text x="${sx(k * s.T)}" y="${H - 8}" class="tiny" text-anchor="middle">${num(k * s.T * 1e9, 1)} ns</text>`);
  p.push('</svg>');
  fill('chView', p.join(''), `${s.name}. COMP: ${s.n} self-timed comparisons after the redistribution interval, and one more during CPRST for the offset calibration. RST and INT belong to the CDAC that is being precharged (PC A or PC B high); the other one converts. V DAC ramps to V REF during T int. Only the first cells and two readout clocks are drawn; redistribution (${num(REDIS * 100, 0)} % of the period) and reset (${num(RESET * 100, 0)} %) are read off Fig. 4(b) and are assumptions.`);
}
