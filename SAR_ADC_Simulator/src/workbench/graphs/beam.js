// Beamformer and sampling switch graphs.

import { COL, lp, needs } from './common.js';
import { eng, num } from '../../zaan/ui/fmt.js';
import { siOf } from '../derive.js';
import { receiveDelays, quantise, beamPattern, worstPhaseError } from '../../zaan/model/beamformer.js';
import { K_B } from '../../zaan/model/noise.js';

const ns = (x) => x * 1e9;

export const BEAM_GRAPHS = [
  {
    id: 'delays', tab: 'beamformer', title: 'Delay per element at the steering angle, exact and rounded',
    spec(ctx) {
      const { P, delays, qd } = ctx;
      const mx = Math.max(ns(Math.max(...delays.tau)), ns(Math.max(...qd)), 1) * 1.12;
      return {
        x: { min: 0.5, max: P.channels + 0.5, label: 'element', ticks: Array.from({ length: P.channels }, (_, i) => i + 1).filter((i) => i % 2 === 1 || P.channels <= 16) },
        y: { min: 0, max: mx, label: 'delay [ns]' },
        series: [
          { points: delays.tau.map((x, i) => [i + 1, ns(x)]), color: COL.an, width: 2, label: 'exact' },
          { points: qd.map((x, i) => [i + 1, ns(x)]), color: COL.ref, mode: 'dots', r: 4, label: `rounded to ${num(ns(P.delayStep), 2)} ns` },
        ],
        legend: true,
      };
    },
    caption: (ctx) => `Steering ±${num(ctx.P.steer * (180 / Math.PI), 1)}°, ${Number.isFinite(ctx.P.focus) ? `focus ${num(ctx.P.focus * 1e3, 1)} mm` : 'plane wave (receive focus is ?)'}. Longest delay ${eng(ctx.tauMax, 's')} (D).`,
  },
  {
    id: 'beam', tab: 'beamformer', title: 'Beam pattern: exact, 12.5 ns and 25 ns steps',
    spec(ctx) {
      const { P, delays } = ctx;
      const base = { N: P.channels, pitch: P.pitch, theta: P.steer, F: P.focus, c: P.c, f0: P.f0 };
      const e = beamPattern({ ...base, tau: delays.tau });
      const a = beamPattern({ ...base, tau: quantise(delays.tau, 12.5e-9) });
      const b = beamPattern({ ...base, tau: quantise(delays.tau, 25e-9) });
      ctx._beam = { e, a, b };
      const s = (bp) => bp.angles.map((x, i) => [x, bp.db[i]]);
      return { height: 240, x: { min: -90, max: 90, label: 'angle [°]' }, y: { min: -50, max: 2, label: 'level [dB]' }, series: [{ points: s(b), color: COL.muted, width: 1.2, label: '25 ns' }, { points: s(e), color: COL.an, width: 2, label: 'exact' }, { points: s(a), color: COL.ref, width: 1.6, dash: '5 3', label: '12.5 ns' }], legend: true };
    },
    caption(ctx) {
      const r = ctx._beam;
      if (!r) return '';
      const lam = ctx.P.c / ctx.P.f0;
      const sg = Math.sin(ctx.P.steer) - lam / ctx.P.pitch;
      const grating = ctx.P.pitch > lam / 2 && Math.abs(sg) <= 1 ? `Grating lobe at ${num(Math.asin(sg) * (180 / Math.PI), 1)}° (pitch ${num(ctx.P.pitch / lam, 2)} λ), so the highest lobe is 0 dB for every step; compare the steps by the other lobes. ` : '';
      return `${grating}Highest lobe outside the main lobe: exact ${num(r.e.sidelobe.level, 1)} dB, 12.5 ns ${num(r.a.sidelobe.level, 1)} dB, 25 ns ${num(r.b.sidelobe.level, 1)} dB. Worst phase error ${num(worstPhaseError(ctx.P.f0, 12.5e-9), 1)}° at 12.5 ns, ${num(worstPhaseError(ctx.P.f0, 25e-9), 1)}° at 25 ns. Array factor only, narrowband at f0.`;
    },
  },
  {
    id: 'clocks', tab: 'beamformer', title: 'Cell write and read timing: CLK and CLK 180°',
    html(ctx) {
      const { P, tw, halfSteps } = ctx;
      const W = 620;
      const per = 5;
      const sx = (t) => 110 + (t / (per * tw)) * (W - 120);
      const sq = (y, shift) => {
        let d = `M110 ${y + 18}`;
        for (let k = 0; k < per * 2; k++) {
          const t0 = (k * tw) / 2 + shift;
          const hi = k % 2 === 0;
          d += ` L${sx(Math.max(0, t0))} ${hi ? y : y + 18} L${sx(Math.min(per * tw, t0 + tw / 2))} ${hi ? y : y + 18}`;
        }
        return `<path d="${d}" class="wclk"/>`;
      };
      const mark = (y, shift, cls) => Array.from({ length: per }, (_, k) => `<rect x="${sx(k * tw + shift) - 2}" y="${y}" width="4" height="16" class="${cls}"/>${`<text x="${sx(k * tw + shift)}" y="${y + 30}" class="tiny" text-anchor="middle">cell ${k + 1}</text>`}`).join('');
      const c180 = halfSteps.findIndex((h) => h);
      return `<svg viewBox="0 0 ${W} 230" class="tsvg" role="img">
        <text x="6" y="34" class="lbl">CLK</text>${sq(20, 0)}
        <text x="6" y="74" class="lbl">CLK 180°</text>${sq(60, tw / 2)}
        <text x="6" y="114" class="lbl">ch 1 writes</text>${mark(100, 0, 'wev')}
        <text x="6" y="160" class="lbl">ch ${c180 + 1} writes</text>${mark(146, tw / 2, 'wev180')}
        <text x="6" y="206" class="lbl">read, all</text>${mark(192, tw * 0.75, 'rev')}
        <line x1="${sx(0)}" x2="${sx(tw / 2)}" y1="96" y2="96" class="dim-arrow"/><text x="${sx(tw / 4)}" y="92" class="tiny" text-anchor="middle">${eng(tw / 2, 's')}</text>
      </svg>`;
    },
    caption: (ctx) => `A channel whose rounded delay has an extra half slot writes on CLK 180°, ${eng(ctx.tw / 2, 's')} later; the cell count stays set by ${eng(ctx.tw, 's')} slots. ${ctx.halfSteps.filter((h) => h).length} of ${ctx.P.channels} channels use CLK 180° at this angle (D). Read timing within the slot is illustrative.`,
  },
  {
    id: 'atten', tab: 'beamformer', title: 'Signal attenuation from charge sharing',
    spec(ctx) {
      const { d } = ctx;
      const n = d.decisions;
      return { x: { min: 0.5, max: n + 0.5, label: 'decision', ticks: Array.from({ length: n }, (_, i) => i + 1) }, y: { min: 0, max: 1.05, label: 'C node,0 / C node' }, series: [{ points: d.cNode.slice(0, n).map((c, i) => [i + 1, d.cNode[0] / c]), color: COL.an, width: 2 }, { points: d.cNode.slice(0, n).map((c, i) => [i + 1, d.cNode[0] / c]), color: COL.an, mode: 'dots', r: 3.5 }] };
    },
    caption: (ctx) => `Memory capacitance 16 × CM = ${eng(ctx.d.cNode[0], 'F')}; after all shares the node holds ${eng(ctx.d.cNode[ctx.d.decisions - 1], 'F')}, so the comparator sees the input scaled by ${num(ctx.D.attenuation.value, 3)} at the end (D).`,
  },
  {
    id: 'cellNoise', tab: 'beamformer', title: 'Memory cell kT/C noise and hold time',
    spec(ctx) {
      const { P, d } = ctx;
      const pts = [];
      for (let c = 20e-15; c <= 1000e-15; c *= 1.15) pts.push([c * 1e15, Math.sqrt((2 * K_B * P.temperature) / (P.channels * c)) * 1e6]);
      const one = [];
      for (let c = 20e-15; c <= 1000e-15; c *= 1.15) one.push([c * 1e15, Math.sqrt((K_B * P.temperature) / c) * 1e6]);
      return { x: { min: 20, max: 1000, label: 'CM [fF]' }, y: { min: 0, max: 500, label: 'µV rms' }, series: [{ points: one, color: COL.muted, width: 1.2, label: 'one cell, √(kT / CM)' }, { points: pts, color: COL.an, width: 2, label: '16 cells summed, differential' }, { points: [[d.cm * 1e15, ctx.noise.find((x) => x.id === 'samp').sigma * 1e6]], color: COL.ref, mode: 'dots', r: 5 }], legend: true };
    },
    caption(ctx, values) {
      const leak = siOf(values, 'leakage');
      const hold = ctx.D.holdTime.value;
      const droop = leak === null ? null : (leak * hold) / ctx.d.cm;
      return `Hold time up to ${eng(hold, 's')} (D). Droop over the hold time: ${droop === null ? '? (needs the cell leakage current)' : `${eng(droop, 'V')} = ${num(droop / ctx.D.lsb.value, 3)} LSB (D)`}.`;
    },
  },
  {
    id: 'ron', tab: 'sampling', title: 'Switch on-resistance against input voltage',
    html: () => needs(['switch device data from the PDK (R on against V); this curve is not computed without it']),
  },
  {
    id: 'settle', tab: 'sampling', title: 'Settling time constant against the time available',
    spec(ctx, values) {
      const { P, d } = ctx;
      const pts = [];
      for (let r = 100; r <= 30000; r *= 1.12) pts.push([Math.log10(r), r * d.cm * 1e9]);
      const tauMax = P.tSample / Math.log(2 ** (P.bits + 1));
      const ron = siOf(values, 'rOn');
      return {
        x: { min: 2, max: Math.log10(30000), label: 'switch resistance [Ω]', ticks: [2, 3, 4], format: (v) => `10^${v}` }, y: { min: 0, max: Math.max(tauMax * 1e9 * 2.5, 0.5), label: 'τ = R CM [ns]' },
        series: [{ points: pts, color: COL.an, width: 2, label: 'τ of one memory cell' }, ...(ron === null ? [] : [{ points: [[Math.log10(ron), ron * d.cm * 1e9]], color: COL.ref, mode: 'dots', r: 5 }])],
        hlines: [{ y: tauMax * 1e9, color: COL.bad, dash: '5 3' }], legend: true,
      };
    },
    caption: (ctx, values) => `Red: largest τ that settles to half an LSB in Ts = ${eng(ctx.P.tSample, 's')} (A): τ ≤ Ts / ln(2^(N+1)) = ${eng(ctx.P.tSample / Math.log(2 ** (ctx.P.bits + 1)), 's')}. ${siOf(values, 'rOn') === null ? 'R on is ?, so no operating point is drawn.' : ''}`,
  },
  {
    id: 'swNoise', tab: 'sampling', title: 'Sampling kT/C noise against the memory cell',
    spec(ctx) {
      const { P, d } = ctx;
      const q = ctx.noise.find((x) => x.id === 'q').sigma * 1e6;
      const pts = [];
      for (let c = 20e-15; c <= 1000e-15; c *= 1.15) pts.push([c * 1e15, Math.sqrt((2 * K_B * P.temperature) / (P.channels * c)) * 1e6]);
      return { x: { min: 20, max: 1000, label: 'CM [fF]' }, y: { min: 0, max: 300, label: 'µV rms' }, series: [{ points: pts, color: COL.an, width: 2, label: '√(2kT / (16 CM))' }, { points: [[d.cm * 1e15, ctx.noise.find((x) => x.id === 'samp').sigma * 1e6]], color: COL.ref, mode: 'dots', r: 5 }], hlines: [{ y: q, color: COL.dig, dash: '5 3' }], legend: true };
    },
    caption: (ctx) => `Green dashed: quantisation noise ${eng(ctx.noise.find((x) => x.id === 'q').sigma, 'V')} rms. At CM = ${eng(ctx.d.cm, 'F')}: ${eng(ctx.noise.find((x) => x.id === 'samp').sigma, 'V')} rms (D).`,
  },
  {
    id: 'inject', tab: 'sampling', title: 'Charge injection error',
    spec(ctx, values) {
      const { d } = ctx;
      const lsb = ctx.D.lsb.value;
      const pts = [];
      for (let q = 0.1e-15; q <= 20e-15; q *= 1.15) pts.push([q * 1e15, q / 2 / d.cm / lsb]);
      const qi = siOf(values, 'qInj');
      return { x: { min: 0, max: 20, label: 'switch channel charge [fC]' }, y: { min: 0, max: (20e-15 / 2 / d.cm / lsb) * 1.05, label: 'error [LSB]' }, series: [{ points: pts, color: COL.an, width: 2, label: 'half the channel charge onto CM' }, ...(qi === null ? [] : [{ points: [[qi * 1e15, qi / 2 / d.cm / lsb]], color: COL.ref, mode: 'dots', r: 5 }])], legend: true };
    },
    caption: (ctx, values) => `Assumes half of the switch charge lands on the memory cell (A). Common to both sides of the differential pair, most of it cancels. ${siOf(values, 'qInj') === null ? 'The switch charge is ?, so no operating point is drawn.' : ''}`,
  },
];
