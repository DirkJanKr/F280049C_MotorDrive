// CDAC and reference graphs.

import { COL, lp, needs } from './common.js';
import { bars } from '../../zaan/ui/charts.js';
import { eng, num, esc } from '../../zaan/ui/fmt.js';
import { siOf, CHIP_AREA } from '../derive.js';
import { designCdac } from '../../zaan/model/cdac.js';
import { drawChip, convert, combine } from '../../zaan/model/chargeSar.js';
import { testChip } from '../../zaan/model/testbench.js';
import { summarise } from '../../zaan/model/montecarlo.js';
import { referenceWaveforms } from '../../zaan/model/reference.js';
import { sineMetrics, coherentCycles } from '../../zaan/model/analysis.js';
import { createRng } from '../../model/rng.js';

export const mc = { result: null, yieldCu: null, running: false, key: '' };

export const CDAC_GRAPHS = [
  {
    id: 'weights', tab: 'cdac', title: 'Step weights per decision',
    html(ctx, values, w) {
      const { d } = ctx;
      return bars({ labels: d.weights.map((_, i) => `${i + 1}`), series: [{ label: 'weight [LSB]', values: d.weights, color: 'var(--an)' }], width: w, height: 210 });
    },
    caption: (ctx) => `${ctx.d.weights.map((w) => num(w, 0)).join(', ')} LSB. ${ctx.d.decisions} decisions (D) against ${ctx.P.rawDecisions ?? 12} planned. Sum ${num(ctx.d.cover.sum, 0)} LSB, needed ${ctx.d.cover.need}.`,
  },
  {
    id: 'tolerance', tab: 'cdac', title: 'Tolerance per decision against comparator offset and noise',
    html(ctx, values, w) {
      const { d, P } = ctx;
      const n = d.decisions;
      const off = d.cNode.slice(0, n).map((c) => (c * P.vosCal) / d.qLsb);
      const nz = d.cNode.slice(0, n).map((c) => (3 * c * P.compNoise) / d.qLsb);
      return bars({ labels: Array.from({ length: n }, (_, i) => `${i + 1}`), series: [{ label: 'tolerance', values: d.tol.map((x) => Math.min(x, 20)), color: 'var(--an)' }, { label: 'offset left', values: off, color: 'var(--bad)' }, { label: '3σ noise', values: nz, color: 'var(--ref)' }], width: w, height: 220, y: { label: 'LSB' } });
    },
    caption: (ctx) => `Offset ${eng(ctx.P.vosCal, 'V')} and noise ${eng(ctx.P.compNoise, 'V')} rms (A) referred to charge through the node capacitance before each decision. Tolerance capped at 20 in the plot.`,
  },
  {
    id: 'mmsigma', tab: 'cdac', title: 'Mismatch σ per step',
    html(ctx, values, w) {
      const { d, P } = ctx;
      const su = ctx.D.sigmaU.value;
      const s = d.steps.map((st, i) => (st.kind === 'cap' ? (d.weights[i] * su) / Math.sqrt(st.units) : (d.weights[i] * su) / Math.SQRT2));
      return bars({ labels: d.weights.map((_, i) => `${i + 1}`), series: [{ label: 'σ of the step [LSB]', values: s, color: 'var(--cal)' }], width: w, height: 210 });
    },
    caption: (ctx) => `σ = w × σu / √units for whole capacitors; about w × σu / √2 for a halving step (A). σu = ${num(ctx.D.sigmaU.value * 100, 3)} % at Cu = ${eng(ctx.P.cu, 'F')} (D).`,
  },
  {
    id: 'dnl', tab: 'cdac', title: 'DNL and INL before and after calibration', heavy: true,
    html(ctx, values, w) {
      const { d, P, sim } = ctx;
      const r = testChip(sim.chip, d, P, createRng(P.seed + 3), { samplesPerCode: 8 });
      const k = Array.from({ length: d.codes }, (_, i) => i).slice(1, d.codes - 1);
      const mk = (arr, title, lim) => lp({ height: 170, x: { min: 0, max: d.codes, label: 'code' }, y: { min: -lim, max: lim, label: title }, series: [{ points: k.map((i) => [i, arr.raw[i]]), color: COL.muted, width: 0.9, label: 'design weights' }, { points: k.map((i) => [i, arr.cal[i]]), color: COL.an, width: 1.1, label: 'calibrated' }], legend: true }, w);
      ctx._dnl = r;
      const lim1 = Math.max(1, r.linRaw.peakDnl, r.linCal.peakDnl) * 1.1;
      const lim2 = Math.max(1, r.linRaw.peakInl, r.linCal.peakInl) * 1.1;
      return mk({ raw: r.linRaw.dnl, cal: r.linCal.dnl }, 'DNL [LSB]', lim1) + mk({ raw: r.linRaw.inl, cal: r.linCal.inl }, 'INL [LSB]', lim2);
    },
    caption: (ctx) => (ctx._dnl ? `Peak |DNL| ${num(ctx._dnl.linRaw.peakDnl, 2)} → ${num(ctx._dnl.linCal.peakDnl, 2)} LSB, peak |INL| ${num(ctx._dnl.linRaw.peakInl, 2)} → ${num(ctx._dnl.linCal.peakInl, 2)} LSB on this chip (seed ${ctx.P.seed}); ramp histogram, 8 samples per code.` : ''),
  },
  {
    id: 'mc', tab: 'cdac', title: 'Monte Carlo ENOB over many chips, and yield against Cu', button: 'Run Monte Carlo',
    html(ctx, values, w) {
      if (!mc.result) return `<p class="cap">${mc.running ? 'Running…' : 'Press Run Monte Carlo. It simulates the chips set on the left with the current values.'}</p>`;
      const r = mc.result;
      const lo = Math.min(r.enobRaw.min, r.enobCal.min, ctx.P.enobAim) - 0.05;
      const hi = Math.max(r.enobRaw.max, r.enobCal.max, ctx.P.enobAim) + 0.05;
      const nb = 30;
      const hist = (vals) => {
        const h = new Array(nb).fill(0);
        for (const x of vals) h[Math.max(0, Math.min(nb - 1, Math.floor(((x - lo) / (hi - lo)) * nb)))]++;
        return h.map((c, i) => [lo + (i * (hi - lo)) / nb, c]).concat([[hi, 0]]);
      };
      const h1 = hist(r.enobRaw.values);
      const h2 = hist(r.enobCal.values);
      let out = lp({ height: 200, x: { min: lo, max: hi, label: 'ENOB [bit]' }, y: { min: 0, max: Math.max(...h1.map((p) => p[1]), ...h2.map((p) => p[1])) * 1.15, label: 'chips' }, series: [{ points: h1, color: COL.muted, step: true, width: 1.5, label: 'design weights' }, { points: h2, color: COL.an, step: true, width: 2, label: 'calibrated' }], vlines: [{ x: ctx.P.enobAim, color: COL.ref, label: 'aim' }], legend: true }, w);
      if (mc.yieldCu) out += lp({ height: 180, x: { min: Math.min(...mc.yieldCu.map((p) => p[0])), max: Math.max(...mc.yieldCu.map((p) => p[0])), label: 'Cu [fF]' }, y: { min: 0, max: 100, label: 'yield [%]' }, series: [{ points: mc.yieldCu, color: COL.an, width: 2 }, { points: mc.yieldCu, color: COL.an, mode: 'dots', r: 4 }] }, w);
      return out;
    },
    caption: () => (mc.result ? `${mc.result.n} chips: mean ENOB ${num(mc.result.enobRaw.mean, 2)} → ${num(mc.result.enobCal.mean, 2)}, worst ${num(mc.result.enobCal.min, 2)} after calibration. Yield = chips with calibrated ENOB at or above the aim, 30 chips per Cu point.` : ''),
  },
  {
    id: 'areaChip', tab: 'cdac', title: 'Capacitance and area, to scale on the 3.2 mm × 5 mm chip',
    html(ctx, values, w) {
      const { d, P } = ctx;
      const cw = 150;
      const ch = (cw * 5) / 3.2;
      const s = (a) => (Math.sqrt(a) / 3.2e-3) * cw;
      const memA = (d.memCaps * d.cm * P.routing) / P.density;
      const cdA = (d.cdac * P.routing) / P.density;
      return `<svg viewBox="0 0 ${w} ${ch + 20}" class="tsvg"><rect x="10" y="10" width="${cw}" height="${ch}" class="die"/><rect x="20" y="20" width="${s(memA)}" height="${s(memA)}" class="ar-mem"/><rect x="${24 + s(memA)}" y="20" width="${s(cdA)}" height="${s(cdA)}" class="ar-cdac"/>
        <text x="${cw + 30}" y="40" class="lbl">memory cells: ${d.memCaps} × ${eng(d.cm, 'F')}</text><text x="${cw + 30}" y="62" class="lbl dim">${num(memA * 1e6, 4)} mm², ${num((memA / CHIP_AREA) * 100, 2)} % of the chip</text>
        <text x="${cw + 30}" y="100" class="lbl">CDAC: ${d.units} × ${eng(P.cu, 'F')} = ${eng(d.cdac, 'F')}</text><text x="${cw + 30}" y="122" class="lbl dim">${num(cdA * 1e6, 4)} mm², ${num((cdA / CHIP_AREA) * 100, 2)} % of the chip</text>
        <text x="${cw + 30}" y="160" class="lbl dim">× ${num(P.routing, 1)} for routing and switches (A)</text></svg>`;
    },
  },
  {
    id: 'calanim', tab: 'cdac', title: 'Calibration mode: ramp in, weights converge, DNL improves', button: 'Play calibration', anim: 'cal',
    html: () => '<div class="calbox" id="calbox"><p class="cap">Press Play calibration.</p></div>',
  },
  {
    id: 'refPulses', tab: 'reference', title: 'Reference charge per decision against time, per variant', anim: 'ref', button: 'Play pulses',
    html(ctx, values, w) {
      return `<canvas id="refcv" width="${w}" height="260" class="cv"></canvas>`;
    },
    caption: (ctx, values) => `Charge redistribution (comparison) draws a signal-dependent charge at every decision. Ping-pong and the external pin draw ${eng(ctx.D.refQ.value, 'C')} once per conversion while the other CDAC converts; the reservoir supplies it from C RSV and its servo refills C RSV (servo profile ?). Selected variant: ${esc(values.find((v) => v.id === 'refVariant').value ?? '?')}.`,
  },
  {
    id: 'droop', tab: 'reference', title: 'Reservoir droop per conversion against C RSV',
    spec(ctx, values) {
      const { d, P } = ctx;
      const q = ctx.D.refQ.value;
      const pts = [];
      for (let c = 1e-12; c <= 200e-12; c *= 1.12) pts.push([c * 1e12, (q / c / P.vref) * (d.codes / 2)]);
      const cr = siOf(values, 'cRsv');
      return { x: { min: 1, max: 200, label: 'C RSV [pF]' }, y: { min: 0, max: Math.min(200, (q / 1e-12 / P.vref) * (d.codes / 2)), label: 'droop [LSB at full scale]' }, series: [{ points: pts, color: COL.ref, width: 2, label: 'ΔV / VREF × 512' }, ...(cr === null ? [] : [{ points: [[cr * 1e12, (q / cr / P.vref) * (d.codes / 2)]], color: COL.an, mode: 'dots', r: 5 }])], legend: true };
    },
    caption: (ctx, values) => `ΔV = Q pre / C RSV before the servo refills it; the same relative error on every step is a gain error. Settling of the servo between conversions is ?. ${siOf(values, 'cRsv') === null ? 'C RSV is ?.' : ''}`,
  },
  {
    id: 'refEnob', tab: 'reference', title: 'ENOB against reference noise', heavy: true,
    spec(ctx, values) {
      const { d, P, sim } = ctx;
      const M = 1024;
      const J = coherentCycles(M, 0.1);
      const amp = (d.codes / 2) * 10 ** (-0.5 / 20);
      const levels = [0, 100, 300, 1000, 3000, 10000];
      const pts = levels.map((ppm) => {
        const rng = createRng(11);
        const codes = [];
        for (let k = 0; k < M; k++) {
          const e = 1 + ppm * 1e-6 * rng.gaussian();
          const chip = { ...sim.chip, q: sim.chip.q.map((q) => q * e) };
          codes.push(combine(convert(chip, d, amp * Math.sin((2 * Math.PI * J * k) / M), { vos: P.vosCal }), sim.cal, d.codes));
        }
        return [Math.log10(Math.max(ppm, 30)), sineMetrics(codes, J, P.bits).enob];
      });
      const rn = siOf(values, 'refNoise');
      return { x: { min: Math.log10(30), max: 4, label: 'reference noise [ppm rms]', ticks: [2, 3, 4], format: (v) => `10^${v}` }, y: { min: Math.min(...pts.map((p) => p[1])) - 0.2, max: P.bits + 0.1, label: 'ENOB' }, series: [{ points: pts, color: COL.ref, width: 2 }, { points: pts, color: COL.ref, mode: 'dots', r: 3.5 }], vlines: rn === null ? [] : [{ x: Math.log10(rn * 1e6), color: COL.an }], hlines: [{ y: P.enobAim, color: COL.muted }] };
    },
    caption: () => 'Each conversion draws all step charges with the same random reference error; the leftmost point is a noiseless reference. Simulated chip, calibrated weights.',
  },
];

/** Monte Carlo of chips and a coarse yield-against-Cu sweep, in chunks. */
export function runMc(ctx, done) {
  mc.running = true;
  mc.result = null;
  mc.yieldCu = null;
  const { P, d } = ctx;
  const rng = createRng(P.seed);
  const n = Math.round(P.chips);
  const rows = [];
  const cus = [35e-15, 50e-15, 70e-15, 100e-15, 150e-15];
  const yieldPts = [];
  let phase = 0;
  const step = () => {
    if (phase === 0) {
      for (let k = 0; k < 4 && rows.length < n; k++) {
        const chip = drawChip(d, P, rng);
        const r = testChip(chip, d, P, rng, { samplesPerCode: 2 });
        rows.push({ enobRaw: r.sRaw.enob, enobCal: r.sCal.enob, dnlRaw: r.linRaw.peakDnl, dnlCal: r.linCal.peakDnl, missRaw: 0, missCal: 0 });
      }
      if (rows.length >= n) {
        mc.result = summarise(rows);
        phase = 1;
        done(false);
      }
    } else {
      const cu = cus[yieldPts.length];
      const Pc = { ...P, cu };
      const dc = designCdac(Pc, d.memCaps / (2 * P.channels));
      const r2 = createRng(P.seed + 100 + yieldPts.length);
      let ok = 0;
      for (let k = 0; k < 30; k++) if (testChip(drawChip(dc, Pc, r2), dc, Pc, r2, { samplesPerCode: 1 }).sCal.enob >= P.enobAim) ok++;
      yieldPts.push([cu * 1e15, (ok / 30) * 100]);
      if (yieldPts.length === cus.length) {
        mc.yieldCu = yieldPts;
        mc.running = false;
        done(true);
        return;
      }
    }
    setTimeout(step, 0);
  };
  setTimeout(step, 0);
}

export function referenceSeries(ctx) {
  return referenceWaveforms(ctx.P, ctx.d, 4, 4);
}
