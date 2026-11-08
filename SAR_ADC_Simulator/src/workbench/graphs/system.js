// System and IQ/image graphs.

import { COL, lp, hbars, needs } from './common.js';
import { eng, num } from '../../zaan/ui/fmt.js';
import { siOf, CHIP_AREA } from '../derive.js';
import { convert, combine } from '../../zaan/model/chargeSar.js';
import { sineMetrics, coherentCycles } from '../../zaan/model/analysis.js';
import { echoLine } from '../../zaan/model/echo.js';
import { fft } from '../../analysis/fft.js';
import { createRng } from '../../model/rng.js';

const dbv = (x) => 20 * Math.log10(x);

export const SYSTEM_GRAPHS = [
  {
    id: 'levels', tab: 'system', title: 'Signal level diagram, PMUT to ADC (dBV, rms)',
    spec(ctx, values) {
      const g = (id) => siOf(values, id);
      const rss = (a, b) => (a === null || b === null ? null : Math.hypot(a, b));
      const stages = ['PMUT', 'after AFE', 'after beamformer', 'ADC'];
      const smax = [g('sMax'), g('sMaxAfe'), g('sMaxAfe'), g('sMaxAfe')];
      const smin = [g('sMin'), g('sMinAfe'), g('sMinAfe'), g('sMinAfe')];
      const noise = [rss(g('pmutNoise'), g('lnaNoise')), rss(g('pmutNoiseAfe'), g('lnaNoiseAfe')), g('noiseAfterBf'), g('noiseAfterBf')];
      const pts = (arr) => arr.map((y, i) => (y === null ? null : [i, dbv(y)])).filter(Boolean);
      return {
        height: 250, x: { min: -0.2, max: 3.2, ticks: [0, 1, 2, 3], format: (v) => stages[v] ?? '' }, y: { min: -130, max: 10, label: 'dBV rms' },
        series: [
          { points: pts(smax), color: COL.an, width: 2, label: 'Smax' }, { points: pts(smin), color: COL.an, width: 1.5, dash: '5 3', label: 'Smin' },
          { points: pts(noise), color: COL.muted, width: 1.5, label: 'noise' },
          { points: [[2.8, dbv(ctx.vrms)], [3.2, dbv(ctx.vrms)]], color: COL.bad, width: 2.5, label: 'full scale' },
          { points: [[2.8, dbv(ctx.noise.find((n) => n.id === 'q').sigma)], [3.2, dbv(ctx.noise.find((n) => n.id === 'q').sigma)]], color: COL.dig, width: 2.5, label: 'quantisation' },
        ],
        legend: true,
      };
    },
    caption: (ctx) => `Full scale ${eng(ctx.vrms, 'V')} rms. Smax after the AFE is above it: see Open questions. 13 Oct chain values (U), ADC values derived (D).`,
  },
  {
    id: 'noise', tab: 'system', title: 'Noise budget and predicted ENOB',
    html(ctx) {
      const tot2 = ctx.total ** 2;
      const rows = ctx.noise.map((n) => [n.label, n.sigma === null ? null : +(((n.sigma ** 2) / tot2) * 100).toFixed(1), n.sigma === null ? '? (unknown)' : `${eng(n.sigma, 'V')}`]);
      const ok = ctx.enob.enob >= ctx.P.enobAim;
      return `${hbars(rows, '%')}<div class="bigline"><span>Predicted ENOB <b class="${ok ? 'ok' : 'bad'}">${num(ctx.enob.enob, 2)}</b> <span class="badge st-D">D</span></span><span>aim <b>${num(ctx.P.enobAim, 1)}</b> <span class="badge st-U">U</span></span><span>total ${eng(ctx.total, 'V')} rms</span></div>`;
    },
    caption: () => 'Bars: share of the total noise power. Root sum of squares; the reference noise line is left out while it is unknown.',
  },
  {
    id: 'spectrum', tab: 'system', title: 'Output spectrum of a sine near f0', heavy: true,
    spec(ctx) {
      const { P, d, sim } = ctx;
      const M = 2048;
      const J = coherentCycles(M, P.f0 / P.fs);
      const rng = createRng(P.seed + 7);
      const sig = Math.hypot(ctx.noise.find((n) => n.id === 'samp').sigma, ctx.noise.find((n) => n.id === 'bf').sigma ?? 0, ctx.noise.find((n) => n.id === 'pre').sigma);
      const amp = (d.codes / 2) * 10 ** (-0.5 / 20);
      const codes = [];
      for (let k = 0; k < M; k++) {
        const x = amp * Math.sin((2 * Math.PI * J * k) / M) + ((sig * rng.gaussian()) / P.fullScale) * d.codes;
        codes.push(combine(convert(sim.chip, d, x, { vos: P.vosCal, noise: P.compNoise, rng }), sim.cal, d.codes));
      }
      const m = sineMetrics(codes, J, P.bits);
      ctx._spec = { m, J, M };
      const f = (k) => ((k / M) * P.fs) / 1e6;
      const pts = Array.from(m.spectrum, (y, k) => [f(k), y]).slice(1);
      const marks = m.harmonicBins.slice(0, 2).map((b, i) => ({ x: f(b), color: COL.ref, label: `HD${i + 2}` }));
      return { height: 240, x: { min: 0, max: P.fs / 2e6, label: 'frequency [MHz]' }, y: { min: -130, max: 5, label: 'dBFS' }, series: [{ points: pts, color: COL.an, width: 0.9 }], vlines: marks };
    },
    caption(ctx) {
      const s = ctx._spec;
      if (!s) return '';
      const hd = s.m.harmonicBins.slice(0, 2).map((b) => num(s.m.spectrum[b], 1));
      return `fin = ${eng((s.J / s.M) * ctx.P.fs, 'Hz')} (${s.J} cycles in ${s.M}, coherent). SNDR ${num(s.m.sndr, 1)} dB, SFDR ${num(s.m.sfdr, 1)} dB, ENOB ${num(s.m.enob, 2)}, HD2 ${hd[0]} dBFS, HD3 ${hd[1]} dBFS. With fs = 4 f0 the third harmonic folds next to the signal.`;
    },
  },
  {
    id: 'powerArea', tab: 'system', title: 'Power and area per block',
    html(ctx, values) {
      const g = (id) => siOf(values, id);
      const vdd = g('vdd');
      const pRef = ctx.D.refI.value * ctx.P.vref;
      const pComp = vdd === null ? null : ctx.P.ibias * vdd;
      const p = [['Reference (I ref × VREF)', +(pRef * 1e6).toFixed(2), `${eng(pRef, 'W')} (D)`], ['Comparator (I bias × VDD)', pComp === null ? null : +(pComp * 1e6).toFixed(2), pComp === null ? '? needs VDD' : `${eng(pComp, 'W')} (D)`]];
      for (const [id, label] of [['pBeam', 'Beamformer'], ['pLogic', 'SAR logic and combiner'], ['pIq', 'IQ demodulator']]) {
        const x = g(id);
        p.push([label, x === null ? null : +(x * 1e6).toFixed(2), x === null ? '?' : eng(x, 'W')]);
      }
      const memArea = (ctx.d.memCaps * ctx.d.cm * ctx.P.routing) / ctx.P.density;
      const cdacArea = (ctx.d.cdac * ctx.P.routing) / ctx.P.density;
      const a = [['CDAC', +(cdacArea * 1e6).toFixed(4), `${num(cdacArea * 1e6, 4)} mm² (D)`], ['Memory cells', +(memArea * 1e6).toFixed(4), `${num(memArea * 1e6, 4)} mm² (D)`], ['Comparator, logic, IQ', null, '?']];
      return `<div class="two">${'<div><h4>Power</h4>' + hbars(p, 'µW') + '</div>'}${'<div><h4>Area</h4>' + hbars(a, 'mm²') + `<p class="cap">Capacitors: ${num(((cdacArea + memArea) / CHIP_AREA) * 100, 2)} % of the 3.2 mm × 5 mm chip.</p></div>`}</div>`;
    },
  },
  {
    id: 'iqSpec', tab: 'iq', title: 'Spectrum before and after mixing (one image line)', heavy: true,
    spec(ctx) {
      const e = echo(ctx);
      const n = 1 << Math.floor(Math.log2(e.codes.length));
      const spec = (re, im) => {
        const R = Float64Array.from(re.slice(0, n));
        const I = Float64Array.from(im.slice(0, n));
        fft(R, I);
        const out = [];
        for (let k = 0; k < n; k++) out.push(Math.hypot(R[k], I[k]));
        const mx = Math.max(...out);
        return out.map((x) => 20 * Math.log10(Math.max(x / mx, 1e-7)));
      };
      const P = ctx.P;
      const codes = Array.from(e.codes);
      const sRf = spec(codes, new Array(n).fill(0));
      const I = codes.map((c, k) => c * Math.cos((2 * Math.PI * P.f0 * k) / P.fs));
      const Q = codes.map((c, k) => -c * Math.sin((2 * Math.PI * P.f0 * k) / P.fs));
      const sBb = spec(I, Q);
      const fk = (k) => (((k + n / 2) % n) - n / 2) * (P.fs / n) / 1e6;
      const sorted = (s) => s.map((y, k) => [fk(k), y]).sort((a, b) => a[0] - b[0]);
      return { height: 230, x: { min: -P.fs / 2e6, max: P.fs / 2e6, label: 'frequency [MHz]' }, y: { min: -80, max: 3, label: 'dB' }, series: [{ points: sorted(sRf), color: COL.muted, width: 1, label: 'ADC codes' }, { points: sorted(sBb), color: COL.dig, width: 1.4, label: 'after mixing with f0' }], legend: true };
    },
    caption: () => 'Mixing moves the echo band from f0 to 0 Hz; the low-pass then removes the copy at 2 f0. Example scene, see below.',
  },
  {
    id: 'envelope', tab: 'iq', title: 'Envelope of one image line', heavy: true,
    spec(ctx) {
      const e = echo(ctx);
      return {
        height: 240, x: { min: 0, max: e.depth[e.depth.length - 1] * 1e3, label: 'depth [mm]' }, y: { min: -70, max: 3, label: 'dB' },
        series: [{ points: e.envDb.map((y, i) => [e.depth[i] * 1e3, y]), color: COL.an, width: 1.8 }],
        vlines: e.targets.map((t) => ({ x: t.z * 1e3, color: t.a > 5 ? COL.bad : COL.ref, label: t.a > 5 ? 'bone' : '' })),
      };
    },
    caption: () => 'Example scene (A): reflectors at 8, 14 and 20 mm (the last 20 dB weaker), bone at 26 mm, strongest echo at −6 dBFS, attenuation assumed compensated before the ADC.',
  },
];

let echoKey = '';
let echoCache = null;
function echo(ctx) {
  const key = JSON.stringify([ctx.P, ctx.d.weights]);
  if (key === echoKey) return echoCache;
  const rng = createRng(ctx.P.seed);
  echoCache = echoLine(ctx.P, ctx.d, ctx.sim.chip, ctx.sim.cal, { reflectors: [{ z: 0.008, a: 1 }, { z: 0.014, a: 0.7 }, { z: 0.02, a: 0.1 }], bone: { z: 0.026, a: 8 }, level: -6, rng });
  echoKey = key;
  return echoCache;
}

export { needs };
