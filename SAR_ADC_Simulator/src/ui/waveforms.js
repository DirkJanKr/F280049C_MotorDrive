/** Time-domain view built from the recorded snapshots (piecewise-constant, ideal settling). */
import { linePlot } from './plot.js';
import { eng, fx } from './format.js';

export function renderWaveforms({ adc, trace, step, width }) {
  const snaps = trace.snapshots;
  const diff = adc.scheme.differential;
  const N = adc.config.bits;
  const { tSample, tBit } = adc.config.timing;
  const tEnd = tSample + (N + 0.6) * tBit;
  const ns = 1e9;
  const W = Math.max(520, Math.min(1400, width || 900));
  const cur = snaps[step];
  const cursor = (cur.tCompare ?? cur.tStart) * ns;

  // node voltages: one step series per array
  const nodeSeries = snaps[0].arrays.map((_, a) => {
    const pts = [];
    for (const s of snaps) pts.push([s.tStart * ns, s.arrays[a].vTop]);
    return {
      points: pts,
      step: true,
      until: tEnd * ns,
      color: a === 0 ? 'var(--s-p)' : 'var(--s-n)',
      width: 2,
      label: diff ? (a === 0 ? 'Vx+ (top plate P)' : 'Vx− (top plate N)') : 'Vx (top plate)',
    };
  });
  const src = trace.sources;
  const inSeries = diff
    ? [
        { points: [[0, src.VINP], [tEnd * ns, src.VINP]], color: 'var(--s-in)', dash: '5 4', width: 1.3, label: 'Vin+' },
        { points: [[0, src.VINN], [tEnd * ns, src.VINN]], color: 'var(--s-in)', dash: '2 3', width: 1.3, label: 'Vin−' },
      ]
    : [{ points: [[0, src.VINP], [tEnd * ns, src.VINP]], color: 'var(--s-in)', dash: '5 4', width: 1.3, label: 'Vin (analog input)' }];
  const allV = [...nodeSeries.flatMap((s) => s.points.map((p) => p[1])), src.VINP, src.VINN, 0, adc.config.vref];
  if (!diff) allV.push(src.VCM);
  let vmin = Math.min(...allV);
  let vmax = Math.max(...allV);
  const pad = (vmax - vmin) * 0.08 || 0.1;
  vmin -= pad;
  vmax += pad;
  const xbands = [{ x0: 0, x1: tSample * ns, color: 'color-mix(in srgb, var(--s-in) 8%, transparent)', label: 'track' }];
  const vlines = [{ x: tSample * ns, color: 'var(--s-in)', label: 'sampling instant', dash: '4 2' }];
  for (let k = 1; k <= N; k++) vlines.push({ x: (tSample + k * tBit) * ns, color: 'var(--grid)', dash: '1 3' });
  const hl = diff ? [] : [{ y: src.VCM, color: 'var(--t-vcm)', dash: '2 3' }];
  const p1 = linePlot({
    id: 'wf1',
    width: W,
    height: 230,
    x: { min: 0, max: tEnd * ns, label: 'time [ns]' },
    y: { min: vmin, max: vmax, label: 'node voltage [V]' },
    series: [...inSeries, ...nodeSeries],
    xbands,
    vlines,
    hlines: hl,
    cursor,
    legend: true,
  });

  // successive approximation: DAC level vs held input
  const dacPts = [];
  for (const s of snaps) if (Number.isFinite(s.dacLevel) && s.phase !== 'hold') dacPts.push([s.tStart * ns, s.dacLevel]);
  if (!dacPts.length) for (const s of snaps) if (Number.isFinite(s.dacLevel)) dacPts.push([s.tStart * ns, s.dacLevel]);
  const lo = adc.range.low;
  const hi = adc.range.high;
  const x = trace.input;
  const recon = adc.reconstruct(trace.code);
  const p2 = linePlot({
    id: 'wf2',
    width: W,
    height: 200,
    x: { min: 0, max: tEnd * ns, label: 'time [ns]' },
    y: { min: lo - 0.04 * (hi - lo), max: hi + 0.04 * (hi - lo), label: diff ? 'differential [V]' : 'input domain [V]' },
    series: [
      { points: [[0, x], [tEnd * ns, x]], color: 'var(--s-in)', dash: '5 4', width: 1.3, label: diff ? 'Vd (held input)' : 'Vin (held input)' },
      { points: dacPts, step: true, until: tEnd * ns, color: 'var(--s-dac)', width: 2, label: 'DAC trial level (input-referred)' },
      { points: [[(tSample + N * tBit) * ns, recon], [tEnd * ns, recon]], color: 'var(--text)', width: 2.5, label: 'code → reconstruction' },
    ],
    bands: [{ y0: x - adc.range.lsb / 2, y1: x + adc.range.lsb / 2, color: 'color-mix(in srgb, var(--s-in) 14%, transparent)' }],
    xbands: [{ x0: 0, x1: tSample * ns, color: 'color-mix(in srgb, var(--s-in) 8%, transparent)' }],
    vlines: [{ x: tSample * ns, color: 'var(--s-in)', dash: '4 2' }],
    cursor,
    legend: true,
  });

  // digital: track/hold, comparator decisions
  const decs = snaps.filter((s) => s.phase === 'compare');
  const p3 = linePlot({
    id: 'wf3',
    width: W,
    height: 120,
    margin: { b: 30 },
    x: { min: 0, max: tEnd * ns, label: 'time [ns]' },
    y: { min: -0.2, max: 2.6, ticks: [0, 1, 1.6, 2.4], format: (v) => (v === 0 ? '0' : v === 1 ? '1' : v === 1.6 ? 'H' : 'T') },
    series: [
      { points: [[0, 2.4], [tSample * ns, 1.6]], step: true, until: tEnd * ns, color: 'var(--s-in)', width: 1.5, label: 'track/hold' },
      {
        points: [[0, 0], ...decs.map((s) => [s.tCompare * ns, s.comparator.decision]), ...decs.map((s) => [s.tEnd * ns, s.comparator.decision])].sort((a, b) => a[0] - b[0]),
        step: true,
        until: tEnd * ns,
        color: 'var(--ok)',
        width: 1.8,
        label: 'comparator output (latched)',
      },
    ],
    cursor,
    legend: true,
    overlay: (sx, sy) =>
      decs
        .map(
          (s) =>
            `<text x="${sx((s.tCompare + s.tEnd) * 0.5 * ns)}" y="${sy(s.comparator.decision) - 4}" text-anchor="middle" font-size="10" class="mono" fill="var(--ok)">b${s.bitIndex}=${s.comparator.decision}</text>`
        )
        .join('') +
      `<text x="${sx(tEnd * ns) - 4}" y="${sy(0.45)}" text-anchor="end" font-size="11" class="mono" font-weight="700">D = ${trace.code}</text>`,
  });
  const info = `<div class="derived">Sampled input ${diff ? 'Vd' : 'Vin'} = <b>${fx(trace.sampledInput, 6)} V</b>${
    Math.abs(trace.sampledInput - trace.input) > 0 ? ` (incl. ${eng(trace.sampledInput - trace.input, 'V', 3)} input noise)` : ''
  }${trace.kTCvoltage.some((v) => v !== 0) ? ` · kT/C step at hold ${trace.kTCvoltage.map((v) => eng(v, 'V', 3)).join(' / ')}` : ''} · T<sub>bit</sub> ${eng(tBit, 's')} · fs ${eng(adc.timing.fs, 'S/s')}</div>`;
  return `<div class="plot">${p1}</div><div class="plot">${p2}</div><div class="plot">${p3}</div>${info}`;
}
