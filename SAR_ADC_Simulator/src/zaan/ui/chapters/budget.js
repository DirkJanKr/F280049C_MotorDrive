// Chapter 7: noise and time budget, from the models of the earlier chapters.

import { knob, knobGroup } from '../knobs.js';
import { context } from '../ctx.js';
import { plot, bars, figure, C } from '../charts.js';
import { eng, num, esc } from '../fmt.js';
import { v, t, frac, sqrt, sup, eq } from '../math.js';
import { readouts, fillReadouts, insight } from '../callouts.js';
import { samplingNoise, prechargeNoise, comparatorNoiseAt, jitterNoise, quantNoise, enobOf, noiseForEnob } from '../../model/noise.js';
import { conversionTimes, comparatorTau } from '../../model/timing.js';
import { drawChip, convert } from '../../model/chargeSar.js';
import { testChip } from '../../model/testbench.js';
import { createRng } from '../../../model/rng.js';

export function noiseBudget(P, d) {
  const rng = createRng(P.seed);
  const chip = drawChip(d, P, rng);
  const r = testChip(chip, d, { ...P, compNoise: 0 }, rng, { samplesPerCode: 2 });
  const vrms = P.fullScale / 2 / Math.SQRT2;
  // The test sine is at -0.5 dBFS: noise = signal rms / 10^(SNDR / 20).
  const conv = (vrms * 10 ** (-0.5 / 20)) / 10 ** (r.sCal.sndr / 20);
  const q = quantNoise(P);
  const lines = [
    ['Quantisation', q, 'LSB / √12'],
    ['Mismatch, offset and rounding after calibration', Math.sqrt(Math.max(conv ** 2 - q ** 2, 0)), 'simulated chip, seed ' + P.seed],
    ['Comparator noise', comparatorNoiseAt(P, d, d.decisions - 1), 'referred at the last decision'],
    ['kT/C of the 16 memory cells', samplingNoise(P, d), '√(2kT / (16 CM))'],
    ['CDAC precharge noise', prechargeNoise(P, d).volts, '√(2kT CDAC) / QLSB'],
    ['Clock jitter', jitterNoise(P).volts, `full-scale sine at ${eng(jitterNoise(P).f, 'Hz')}`],
  ];
  const total = Math.sqrt(lines.reduce((a, l) => a + l[1] ** 2, 0));
  return { lines, total, ...enobOf(P, total), chip };
}

export const chapter = {
  id: 'budget', n: 7, short: 'Budget', title: `Does it add up to the ENOB aim, within one conversion period?`,
  lede: 'Every noise source from the earlier chapters, added as a root sum of squares; every decision, settled and timed.',
  view(state) {
    return {
      knobs:
        knobGroup('Noise', ['compNoise', 'temperature', 'jitter'].map((id) => knob(state, id)).join('')) +
        knobGroup('Comparator', ['ibias', 'gmId', 'cload', 'vfinal'].map((id) => knob(state, id)).join('')) +
        knobGroup('Timing', ['tSample', 'tauDac', 'tLogic'].map((id) => knob(state, id)).join('')),
      main: `${readouts('bg-ro')}
        ${figure('bg-noise', 'Where the noise comes from')}
        <div class="grid2">${figure('bg-dec', 'Time per decision')}${figure('bg-tot', 'Conversion time over many samples')}</div>
        <div id="bg-ins"></div>
        <details class="math-d"><summary>Show the math</summary><div class="math" id="bg-math"></div></details>`,
    };
  },
  update(state) {
    const { P, d } = context(state);
    const nb = noiseBudget(P, d);
    const tot2 = nb.total ** 2;
    document.getElementById('bg-noise').innerHTML = `<div class="nbars">${nb.lines
      .map(([name, s, how]) => `<div class="nbar"><span class="nl">${esc(name)}<small>${esc(how)}</small></span><span class="nt"><span class="nf" style="width:${((s * s) / tot2) * 100}%"></span></span><span class="nv">${eng(s, 'V')}</span></div>`)
      .join('')}<div class="nbar total"><span class="nl">Total (root sum of squares)</span><span class="nt"></span><span class="nv">${eng(nb.total, 'V')}</span></div></div>`;
    document.getElementById('bg-noise-cap').textContent = `Bars: share of the total noise power. ENOB ${num(P.enobAim, 1)} allows ${eng(noiseForEnob(P, P.enobAim), 'V')} rms in total.`;
    // timing from the node voltages of a sine
    const rng = createRng(P.seed + 1);
    const traces = [];
    for (let k = 0; k < 600; k++) {
      const x = (d.codes / 2) * 0.95 * Math.sin((2 * Math.PI * 61 * k) / 600) + (rng.uniform() - 0.5);
      const r = convert(nb.chip, d, x, { vos: P.vosCal, trace: true });
      traces.push(r.steps.slice(0, d.decisions).map((s) => s.v + P.vosCal));
    }
    const tm = conversionTimes(P, d, traces);
    const lab = Array.from({ length: d.decisions }, (_, i) => `${i + 1}`);
    document.getElementById('bg-dec').innerHTML = bars({ width: 400,
      labels: lab, height: 230, y: { label: 'ns' },
      series: [{ label: 'comparator (mean)', values: tm.mean.map((x) => x * 1e9), color: 'var(--accent)' }, { label: 'settling', values: tm.settle.map((s) => s.redundant * 1e9).concat([0]), color: 'var(--c3)' }],
    });
    document.getElementById('bg-dec-cap').textContent = `Comparator τ = C_load / gm = ${eng(tm.tauC, 's')}. Late decisions see small node voltages and take longer (metastability).`;
    const hi = Math.max(tm.tConv, ...tm.totals) * 1.14;
    const nbins = 70;
    const h = new Array(nbins).fill(0);
    for (const x of tm.totals) h[Math.min(nbins - 1, Math.floor((x / hi) * nbins))]++;
    const worst = tm.totals[tm.totals.length - 1];
    document.getElementById('bg-tot').innerHTML = plot({ width: 400,
      height: 230, x: { min: 0, max: hi * 1e9, label: 'conversion time [ns]' }, y: { min: 0, max: Math.max(...h) * 1.15, label: 'samples' },
      series: [{ points: h.map((c, i) => [((i * hi) / nbins) * 1e9, c]).concat([[hi * 1e9, 0]]), color: C.a, step: true, width: 2 }],
      vlines: [{ x: tm.tConv * 1e9, color: C.bad, label: '1/fs' }, { x: worst * 1e9, color: C.b, dash: '2 2' }],
    });
    document.getElementById('bg-tot-cap').textContent = `Includes Ts = ${eng(P.tSample, 's')}, settling with redundancy and logic. Worst of ${tm.totals.length} samples: ${eng(worst, 's')} (amber); ${num(tm.late * 100, 2)} % finish after 1/fs (red).`;
    const m95 = nb.enob - P.enobAim;
    fillReadouts(document.getElementById('bg-ro'), [
      ['Predicted ENOB', `${num(nb.enob, 2)} bit`, `${m95 >= 0 ? '+' : ''}${num(m95, 2)} bit to the aim`, m95 >= 0 ? 'ok' : 'bad'],
      ['Total noise', eng(nb.total, 'V'), 'rms, input referred'],
      ['Median conversion', eng(tm.median, 's'), `of ${eng(tm.tConv, 's')}`, tm.median < tm.tConv ? 'ok' : 'bad'],
      ['Late samples', `${num(tm.late * 100, 2)} %`, 'need a forced decision', tm.late < 0.001 ? 'ok' : 'warn'],
    ]);
    const biggest = [...nb.lines].sort((a, b) => b[1] - a[1])[1];
    document.getElementById('bg-ins').innerHTML = insight('Largest term after quantisation', `${esc(biggest[0])}: ${eng(biggest[1], 'V')} rms. That is where the next design effort pays off.`);
    document.getElementById('bg-math').innerHTML = [
      eq(v('σ', 'total'), '=', sqrt(`${sup(v('σ', 'q'), 2)} + ${sup(v('σ', 'cal'), 2)} + ${sup(v('σ', 'comp'), 2)} + ${sup(v('σ', 'kT/C'), 2)} + ${sup(v('σ', 'pre'), 2)} + ${sup(v('σ', 'jit'), 2)}`), '=', eng(nb.total, 'V')),
      eq(t('SNDR'), '=', `20 log<sub>10</sub>`, frac(v('V', 'sig,rms'), v('σ', 'total')), '=', `${num(nb.sndr, 2)} ${t('dB')}`, ',', t('ENOB'), '=', frac(`${t('SNDR')} − 1.76`, '6.02'), '=', num(nb.enob, 2)),
      eq(v('t', 'dec'), '=', `${v('τ')} ln ${frac(v('V', 'final'), `|${v('V', 'in')}|`)}`, ',', v('τ'), '=', frac(v('C', 'load'), `(${v('g', 'm')}/${v('I', 'D')}) ${v('I', 'bias')}`), '=', eng(comparatorTau(P), 's')),
      eq(v('t', 'settle,i'), '=', `${v('τ', 'DAC')} ln ${frac(v('w', 'i'), v('t', 'i+1'))}`, t('(redundancy: settle only to the next tolerance)')),
    ].join('');
  },
};
