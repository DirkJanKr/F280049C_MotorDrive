// Comparator, SAR timing and conversion (animation) graphs.

import { COL, lp, needs, log10Ticks } from './common.js';
import { eng, num } from '../../zaan/ui/fmt.js';
import { siOf } from '../derive.js';
import { anim } from '../convAnim.js';

export const COMP_GRAPHS = [
  {
    id: 'meta', tab: 'comparator', title: 'Decision time against input voltage (metastability)',
    spec(ctx) {
      const tau = ctx.D.tauComp.value;
      const pts = [];
      for (let e = -7; e <= -1; e += 0.1) pts.push([e, tau * Math.log(ctx.P.vfinal / 10 ** e) * 1e9]);
      const vl = Math.log10(ctx.D.vLsbLast.value);
      return { x: { min: -7, max: -1, label: 'comparator input [V]', ticks: log10Ticks(-7, -1), format: (v) => `10^${v}` }, y: { min: 0, max: pts[0][1] * 1.05, label: 'decision time [ns]' }, series: [{ points: pts, color: COL.an, width: 2, label: 't = τ ln(V final / V in)' }], vlines: [{ x: vl, color: COL.ref, label: '1 LSB, last decision' }], legend: true };
    },
    caption: (ctx) => `τ = C load / gm = ${eng(ctx.D.tauComp.value, 's')} from the assumed bias (A). One LSB at the last decision is ${eng(ctx.D.vLsbLast.value, 'V')} (D).`,
  },
  {
    id: 'metaProb', tab: 'comparator', title: 'Probability of a metastable last decision against the time allowed',
    spec(ctx) {
      const tau = ctx.D.tauComp.value;
      const vl = ctx.D.vLsbLast.value;
      const pts = [];
      for (let t = 0; t <= 2e-9; t += 0.02e-9) pts.push([t * 1e9, Math.log10(Math.min(1, (ctx.P.vfinal * Math.exp(-t / tau)) / vl))]);
      return { x: { min: 0, max: 2, label: 'time allowed for the last decision [ns]' }, y: { min: -12, max: 0, label: 'log10 P', ticks: [-12, -9, -6, -3, 0] }, series: [{ points: pts, color: COL.an, width: 2 }] };
    },
    caption: () => 'P = V final e^(−t/τ) / V LSB, assuming the input of the last decision is spread evenly within ±1 LSB (A).',
  },
  {
    id: 'compNoiseBias', tab: 'comparator', title: 'Input-referred noise against bias current',
    html: () => needs(['a comparator noise model (comparator block, 16 Nov)']),
    caption: (ctx) => `Meanwhile: the assumed ${eng(ctx.P.compNoise, 'V')} rms is ${num(ctx.P.compNoise / ctx.D.vLsbLast.value, 2)} LSB at the last decision.`,
  },
  {
    id: 'offsetDist', tab: 'comparator', title: 'Offset distribution before and after calibration',
    spec(ctx, values) {
      const s = siOf(values, 'vosSigma');
      if (s === null) return null;
      const res = ctx.P.vosCal;
      const g = (x, sg) => Math.exp(-(x * x) / (2 * sg * sg)) / (sg * Math.sqrt(2 * Math.PI));
      const pts = (sg) => {
        const out = [];
        for (let x = -4 * s; x <= 4 * s; x += s / 25) out.push([x * 1e3, g(x, sg) * 1e-3]);
        return out;
      };
      return { x: { min: -4 * s * 1e3, max: 4 * s * 1e3, label: 'offset [mV]' }, y: { min: 0, max: g(0, Math.min(s, res)) * 1e-3 * 1.1, label: 'density [1/mV]' }, series: [{ points: pts(s), color: COL.bad, width: 2, label: 'before' }, { points: pts(res), color: COL.an, width: 2, label: 'after (residual σ)' }], legend: true };
    },
    needs: ['vosSigma'],
    caption: () => 'After calibration the residual is taken as a Gaussian with σ equal to the offset left after calibration (A).',
  },
  {
    id: 'convTiming', tab: 'timing', title: 'Timing diagram of one conversion', anim: 'conv',
    html: (ctx, values, w) => `<div id="tdiag" data-w="${w}"></div>`,
    caption: (ctx) => `Sample, then per decision: DAC settle (to the next tolerance), comparator decision (metastability), logic and handshake. Input ${num(anim.plan?.vin ?? 0, 3)} V. Budget 1 / fs = ${eng(ctx.tw, 's')}.`,
  },
  {
    id: 'convHist', tab: 'timing', title: 'Conversion time over many samples against 1 / fs',
    spec(ctx) {
      const tm = ctx.timing;
      const hi = Math.max(tm.tConv, ...tm.totals) * 1.12;
      const nb = 70;
      const h = new Array(nb).fill(0);
      for (const x of tm.totals) h[Math.min(nb - 1, Math.floor((x / hi) * nb))]++;
      return { x: { min: 0, max: hi * 1e9, label: 'conversion time [ns]' }, y: { min: 0, max: Math.max(...h) * 1.15, label: 'samples' }, series: [{ points: h.map((c, i) => [((i * hi) / nb) * 1e9, c]).concat([[hi * 1e9, 0]]), color: COL.an, step: true, width: 2 }], vlines: [{ x: tm.tConv * 1e9, color: COL.bad, label: '1/fs' }] };
    },
    caption: (ctx) => `Median ${eng(ctx.timing.median, 's')}, worst of ${ctx.timing.totals.length}: ${eng(ctx.timing.totals[ctx.timing.totals.length - 1], 's')}; ${num(ctx.timing.late * 100, 2)} % finish after 1 / fs (D from A values).`,
  },
  {
    id: 'snrJitter', tab: 'timing', title: 'SNR against input frequency for several jitter values',
    spec(ctx) {
      const { P } = ctx;
      const sq = 6.02 * P.bits + 1.76;
      const js = [0.5, 1, 2, 5].map((k) => k * P.jitter);
      const cols = [COL.muted, COL.an, COL.ref, COL.bad];
      return {
        height: 230, x: { min: 1, max: 20, label: 'input frequency [MHz]' }, y: { min: 40, max: sq + 3, label: 'SNR [dB]' },
        series: js.map((j, i) => ({ points: Array.from({ length: 40 }, (_, k) => { const f = (1 + (k * 19) / 39) * 1e6; const sj = -20 * Math.log10(2 * Math.PI * f * j); return [f / 1e6, -10 * Math.log10(10 ** (-sj / 10) + 10 ** (-sq / 10))]; }), color: cols[i], width: i === 1 ? 2.2 : 1.4, label: `${num(j * 1e12, 2)} ps` })),
        vlines: [{ x: (P.f0 * (1 + P.fbw / 2)) / 1e6, color: COL.dig, label: 'band edge' }], legend: true,
      };
    },
    caption: (ctx) => `SNR = −20 log10(2π fin σt), combined with the ideal ${num(6.02 * ctx.P.bits + 1.76, 1)} dB. Jitter ${eng(ctx.P.jitter, 's')} rms is an assumption (A); the curves show 0.5×, 1×, 2× and 5× that value.`,
  },
  {
    id: 'scope', tab: 'conversion', title: 'Scope: node voltage, decision by decision', anim: 'conv',
    html: (ctx, values, w) => `<div id="scope" data-w="${w}"></div>`,
  },
  {
    id: 'convTiming2', tab: 'conversion', title: 'Timing diagram, in sync with the schematic', anim: 'conv',
    html: (ctx, values, w) => `<div id="tdiag2" data-w="${w}"></div>`,
  },
  {
    id: 'dtable', tab: 'conversion', title: 'Decision table of the model', anim: 'conv',
    html: () => '<div id="dtable" class="tablewrap"></div>',
  },
];

/** Scope, timing diagrams and decision table at the current animation time. */
export function drawConversionPanels(ctx) {
  const plan = anim.plan;
  if (!plan) return;
  const t = anim.t;
  const n = ctx.d.decisions;
  const decided = plan.phases.filter((p) => p.kind === 'decide' && p.t1 <= t).length;
  const scope = document.getElementById('scope');
  if (scope) {
    const w = Number(scope.dataset.w) || 600;
    const vs = plan.r.steps.slice(0, n).map((s) => s.v * 1e3);
    const vmax = Math.max(...vs.map(Math.abs), 1e-3) * 1.15;
    const shown = vs.slice(0, Math.max(1, decided + 1)).map((y, i) => [i + 1, y]);
    scope.innerHTML = lp({ height: 220, x: { min: 0.5, max: n + 0.5, label: 'decision', ticks: Array.from({ length: n }, (_, i) => i + 1) }, y: { min: -vmax, max: vmax, label: 'node voltage [mV]' }, series: [{ points: shown, color: COL.an, step: true, width: 2.2 }, { points: shown, color: COL.an, mode: 'dots', r: 4 }], hlines: [{ y: 0, color: COL.muted, dash: '' }, { y: -ctx.P.vosCal * 1e3, color: COL.bad, dash: '4 3' }] }, w);
  }
  for (const id of ['tdiag', 'tdiag2']) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = timingSvg(ctx, plan, t, Number(el.dataset.w) || 600);
  }
  const tb = document.getElementById('dtable');
  if (tb) {
    tb.innerHTML = `<table class="tbl"><thead><tr><th>Decision</th><th>Step [LSB]</th><th>Q [fC]</th><th>C node [pF]</th><th>V [mV]</th><th>Bit</th></tr></thead><tbody>${plan.r.steps
      .slice(0, n)
      .map((s, i) => `<tr class="${i === decided ? 'cur' : i < decided ? 'done' : ''}"><td>${i + 1}</td><td class="num">${i < n - 1 ? num(ctx.sim.chip.wTrue[i], 2) : 'none'}</td><td class="num">${num(s.Q * 1e15, 2)}</td><td class="num">${num(s.cn * 1e12, 3)}</td><td class="num">${num(s.v * 1e3, 3)}</td><td>${i < decided ? s.bit : '·'}</td></tr>`)
      .join('')}</tbody></table>`;
  }
}

function timingSvg(ctx, plan, t, w) {
  const tEnd = Math.max(plan.tEnd, ctx.tw) * 1.04;
  const sx = (x) => 90 + (x / tEnd) * (w - 100);
  const rows = { sample: 30, share: 60, decide: 90, logic: 120 };
  const names = { sample: 'sample', share: 'DAC settle', decide: 'decide', logic: 'logic' };
  const cls = { sample: 'ph-s', share: 'ph-d', decide: 'ph-c', logic: 'ph-l' };
  const bars = plan.phases.map((p) => `<rect x="${sx(p.t0)}" y="${rows[p.kind] - 10}" width="${Math.max(1, sx(p.t1) - sx(p.t0))}" height="18" class="${cls[p.kind]} ${t >= p.t0 && t < p.t1 ? 'now' : ''}"/>`).join('');
  const labels = Object.keys(rows).map((k) => `<text x="6" y="${rows[k] + 4}" class="lbl">${names[k]}</text>`).join('');
  const ticks = [];
  for (let k = 0; k <= Math.floor(tEnd * 1e9 / 5); k++) ticks.push(`<line x1="${sx(k * 5e-9)}" x2="${sx(k * 5e-9)}" y1="138" y2="144" class="tick"/><text x="${sx(k * 5e-9)}" y="158" class="tiny" text-anchor="middle">${k * 5} ns</text>`);
  return `<svg viewBox="0 0 ${w} 166" class="tsvg">${labels}${bars}<line x1="${sx(ctx.tw)}" x2="${sx(ctx.tw)}" y1="14" y2="140" class="budget"/><text x="${sx(ctx.tw) - 4}" y="12" class="tiny bad" text-anchor="end">1/fs</text><line x1="${sx(t)}" x2="${sx(t)}" y1="14" y2="140" class="cursor"/>${ticks.join('')}</svg>`;
}
