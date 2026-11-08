// Timing page: for understanding. Nothing here is decided; the sliders are illustrative.

import { group, knobs, card, fill, widthOf, plot, explain, eng, num, COL } from '../kit.js';
import { failBox } from '../checks.js';

const T = { raf: 0, t: 0 };

export const page = {
  id: 'timing',
  title: 'Timing',
  side(store) {
    const used = new Set();
    return `<p class="ks pad">No timing value is decided yet. Move these to see what each one does.</p>` + group('Illustrative values', knobs(store.values, ['fs', 'tSample', 'tauDac', 'ibias', 'gmId', 'cload', 'vfinal', 'tLogic'], used));
  },
  main() {
    return `<div id="tmFails"></div>${explain('One conversion has to fit in one sample period', [
      'At 40 MS/s a new sample comes every 25 ns. In that time the converter must take the sample (connect the selected memory cells), and then for every decision let the DAC settle, let the comparator decide, and let the logic set the next switch.',
    ])}
      <section class="card wide"><header><h3>One conversion: synchronous against self-timed</h3><span class="ctl"><button class="mini" id="tmPlay">play</button></span></header><div id="tmBars"></div><p class="cap" id="tmBars-cap"></p></section>
      <div class="grid2">${card('tmRegen', 'Why a small input makes the comparator slow')}${card('tmMeta', 'Decision time against comparator input')}</div>
      <div class="grid2">${card('tmSettle', 'Why redundancy saves settling time')}${card('tmClk', 'The write clocks and the conversion period')}</div>
      ${explain('Words used on this page', [
        '<b>Synchronous</b>: an external clock gives every decision the same time slot, long enough for the slowest case. <b>Self-timed (asynchronous)</b>: each decision starts as soon as the previous one reports done, so fast decisions leave time for slow ones.',
        '<b>Metastability</b>: a dynamic comparator amplifies its input exponentially, V(t) = V in · e^(t / τ). A tiny input needs a long time to reach a valid logic level. τ = C load / gm is set by the comparator design.',
        '<b>Settling</b>: after a step is shared, the node needs a few time constants to reach its new value. Without redundancy it must settle to half an LSB; with redundancy only to within the tolerance of the next decision.',
      ])}`;
  },
  mount(store) {
    document.getElementById('tmPlay').onclick = () => {
      cancelAnimationFrame(T.raf);
      T.t = 0;
      const t0 = performance.now();
      const tick = (now) => {
        T.t = ((now - t0) / 1000) * 4e-9;
        drawBars(store.ctx);
        if (T.t < store.ctx.tw * 1.1 && document.getElementById('tmBars')) T.raf = requestAnimationFrame(tick);
      };
      T.raf = requestAnimationFrame(tick);
    };
  },
  update(store, ctx) {
    fill('tmFails', failBox(ctx, ['time']));
    T.t = ctx.tw * 2;
    drawBars(ctx);
    const { P, d, tauC } = ctx;
    const w = widthOf('tmRegen');
    const vins = [1e-1, 1e-2, 1e-3, 1e-4, 1e-5];
    const tmax = tauC * Math.log(P.vfinal / 1e-5) * 1.1;
    const cols = [COL.dig, COL.an, COL.ref, COL.clk, COL.bad];
    fill('tmRegen', plot({ x: { min: 0, max: tmax * 1e9, label: 'time after the comparator starts [ns]' }, y: { min: 0, max: P.vfinal * 1.1, label: 'comparator output [V]' }, series: vins.map((vi, i) => ({ points: Array.from({ length: 80 }, (_, k) => { const t = (k / 79) * tmax; return [t * 1e9, Math.min(P.vfinal * 1.05, vi * Math.exp(t / tauC))]; }), color: cols[i], width: 2, label: `${eng(vi, 'V')} in` })), hlines: [{ y: P.vfinal, color: COL.muted }], legend: true }, w), `Each tenfold smaller input costs another τ · ln 10 = ${eng(tauC * Math.log(10), 's')} (τ = ${eng(tauC, 's')}, illustrative).`);
    const pts = [];
    for (let e = -7; e <= -1; e += 0.1) pts.push([e, tauC * Math.log(P.vfinal / 10 ** e) * 1e9]);
    const lsbEnd = d.qLsb / d.cNode[d.decisions - 1];
    fill('tmMeta', plot({ x: { min: -7, max: -1, label: 'comparator input [V]', ticks: [-7, -6, -5, -4, -3, -2, -1], format: (v) => `10^${v}` }, y: { min: 0, max: pts[0][1] * 1.05, label: 'decision time [ns]' }, series: [{ points: pts, color: COL.an, width: 2.2 }], vlines: [{ x: Math.log10(lsbEnd), color: COL.ref, label: '1 LSB at the last decision' }] }, w), `t = τ ln(V final / V in). At the last decision one LSB is only ${eng(lsbEnd, 'V')} at the comparator, because the node capacitance has grown.`);
    const w1 = d.weights[0];
    const tNext = d.tol[1];
    const tau = P.tauDac;
    const tEnd = tau * Math.log(w1 / 0.25) * 1.1;
    const curve = Array.from({ length: 100 }, (_, k) => { const t = (k / 99) * tEnd; return [t * 1e9, w1 * Math.exp(-t / tau)]; });
    const tb = tau * Math.log(w1 / 0.5);
    const tr = tau * Math.log(w1 / Math.max(0.5, tNext));
    fill('tmSettle', plot({ x: { min: 0, max: tEnd * 1e9, label: 'time after the first share [ns]' }, y: { min: 0, max: w1, label: 'error left [LSB]' }, series: [{ points: curve, color: COL.an, width: 2.2 }], hlines: [{ y: 0.5, color: COL.bad, dash: '4 3' }, { y: Math.max(0.5, tNext), color: COL.dig, dash: '6 3' }], vlines: [{ x: tb * 1e9, color: COL.bad, label: 'binary' }, { x: tr * 1e9, color: COL.dig, label: 'redundant' }] }, w), `Step 1 (${num(w1, 0)} LSB) settles exponentially with τ DAC = ${eng(tau, 's')}. Binary waits until ${num(0.5, 1)} LSB is left: ${eng(tb, 's')}. With the next tolerance of ${num(tNext, 0)} LSB it may go on after ${eng(tr, 's')}.`);
    fill('tmClk', clockView(ctx, w), `Write slots of ${eng(ctx.tw, 's')}; CLK 180° is ${eng(ctx.tw / 2, 's')} later. One conversion must finish within one slot, so that the next read can start.`);
  },
};

function drawBars(ctx) {
  const { P, d, timing, tw, settle, tauC } = ctx;
  const w = widthOf('tmBars', 1000);
  const n = d.decisions;
  const tdec = timing.mean;
  const worstDec = Math.max(...tdec) * 2.5;
  const slot = Math.max(...settle.map((s) => s.binary)) + worstDec + P.tLogic;
  const syncT = P.tSample + n * slot;
  const tEnd = Math.max(tw, syncT, timing.median) * 1.05;
  const sx = (t) => 140 + (t / tEnd) * (w - 160);
  const row = (y, segs, label) => `<text x="8" y="${y + 20}" class="lbl">${label}</text>` + segs.map(([t0, t1, cls]) => `<rect x="${sx(t0)}" y="${y}" width="${Math.max(1, sx(t1) - sx(t0))}" height="28" class="${cls} ${T.t >= t0 && T.t < t1 ? 'now' : ''}"/>`).join('');
  const sync = [[0, P.tSample, 'ph-s']];
  for (let i = 0; i < n; i++) sync.push([P.tSample + i * slot, P.tSample + (i + 1) * slot, i % 2 ? 'ph-c' : 'ph-c2']);
  const asy = [[0, P.tSample, 'ph-s']];
  let t = P.tSample;
  for (let i = 0; i < n; i++) {
    if (i > 0) {
      asy.push([t, t + settle[i - 1].redundant, 'ph-d']);
      t += settle[i - 1].redundant;
    }
    asy.push([t, t + tdec[i], 'ph-c']);
    t += tdec[i];
    asy.push([t, t + P.tLogic, 'ph-l']);
    t += P.tLogic;
  }
  const ticks = [];
  for (let k = 0; k <= Math.floor((tEnd * 1e9) / 5); k++) ticks.push(`<line x1="${sx(k * 5e-9)}" x2="${sx(k * 5e-9)}" y1="118" y2="124" class="tick"/><text x="${sx(k * 5e-9)}" y="140" class="tiny" text-anchor="middle">${k * 5} ns</text>`);
  fill('tmBars', `<svg viewBox="0 0 ${w} 150" class="tsvg">${row(20, sync, 'synchronous')}${row(66, asy, 'self-timed')}<line x1="${sx(tw)}" x2="${sx(tw)}" y1="10" y2="110" class="budget"/><text x="${sx(tw) + 4}" y="14" class="tiny bad">1 / fs</text>${T.t < tEnd ? `<line x1="${sx(T.t)}" x2="${sx(T.t)}" y1="10" y2="110" class="cursor"/>` : ''}${ticks.join('')}</svg>`,
    `Pink: sample (${eng(P.tSample, 's')}). Synchronous: ${n} equal slots, each long enough for full binary settling and a slow decision (${eng(slot, 's')}), total ${eng(syncT, 's')}. Self-timed: amber settling to the next tolerance, cyan comparator (mean over many samples; small inputs take longer), violet logic, total ${eng(t, 's')}. All values illustrative.`);
}

function clockView(ctx, w) {
  const { tw } = ctx;
  const per = 4;
  const sx = (t) => 110 + (t / (per * tw)) * (w - 120);
  const sq = (y, shift) => {
    let d = `M110 ${y + 18}`;
    for (let k = 0; k <= per * 2; k++) {
      const t0 = (k * tw) / 2 + shift - tw / 2;
      const hi = k % 2 === 1;
      d += ` L${sx(Math.max(0, t0))} ${hi ? y : y + 18} L${sx(Math.min(per * tw, t0 + tw / 2))} ${hi ? y : y + 18}`;
    }
    return `<path d="${d}" class="wclk"/>`;
  };
  const conv = Array.from({ length: per }, (_, k) => `<rect x="${sx(k * tw + tw * 0.05)}" y="110" width="${sx(tw * 0.9) - sx(0)}" height="22" class="ph-c"/><text x="${sx(k * tw + tw / 2)}" y="126" class="onbar" text-anchor="middle">conversion ${k + 1}</text>`).join('');
  return `<svg viewBox="0 0 ${w} 150" class="tsvg"><text x="6" y="32" class="lbl">CLK</text>${sq(18, 0)}<text x="6" y="76" class="lbl">CLK 180°</text>${sq(62, tw / 2)}<text x="6" y="126" class="lbl">ADC</text>${conv}</svg>`;
}
