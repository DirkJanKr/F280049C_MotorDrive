/** Numerical results: single conversion, static linearity, dynamic performance, energy. */
import { linePlot, envelope, maxDecimate } from './plot.js';
import { esc, eng, fx, signed, bin } from './format.js';
import { tile } from './chargePanel.js';

export function renderResults({ adc, trace, analysis, width }) {
  const N = adc.config.bits;
  const lsb = adc.range.lsb;
  const diff = adc.scheme.differential;
  const convErr = trace.code - trace.idealCode;
  const qErrV = trace.input - adc.reconstruct(trace.code);
  const W = Math.max(360, Math.min(700, (width || 900) / 2 - 20));
  const single = [
    tile('Output code', `${trace.code}`, `0b${bin(trace.code, N)} · 0x${trace.code.toString(16).toUpperCase()}`),
    tile('Ideal code', `${trace.idealCode}`, `floor((x − ${fx(adc.range.low, 2)}) / LSB)`),
    tile('Conversion error', `${signed(convErr, 0)} LSB`, convErr === 0 ? 'matches ideal quantizer' : 'code ≠ ideal code', convErr === 0 ? 'good' : 'bad'),
    tile('Quantization error', `${signed(qErrV / lsb, 3)} LSB`, `${eng(qErrV, 'V', 4)} vs code centre`),
    tile('Reconstructed', `${fx(adc.reconstruct(trace.code), 6)} V`, `input ${fx(trace.input, 6)} V`),
    tile('LSB', eng(lsb, 'V', 4), `FS ${fx(adc.range.fullScale, 3)} V${diff ? ' (diff.)' : ''}`),
    tile('VREF energy / conv.', eng(trace.energyRef, 'J', 4), `${fx(trace.energyRef / (adc.config.unitCap * adc.config.vref ** 2), 2)} Cu·VREF²`),
  ];
  const parts = [`<h3>This conversion</h3><div class="tiles">${single.join('')}</div>`];

  if (!analysis) {
    parts.push('<div class="subsection hint">Static and dynamic analysis running…</div>');
    return parts.join('');
  }
  if (analysis.error) {
    parts.push(`<div class="errmsg">${esc(analysis.error)}</div>`);
    return parts.join('');
  }
  const s = analysis.static;
  const d = analysis.dynamic;
  const e = analysis.energy;
  const th = adc.theory;

  const stTiles = [
    tile('DNL (max / min)', `${signed(s.maxDnl, 3)} / ${signed(s.minDnl, 3)}`, 'LSB', s.peakDnl < 0.5 ? 'good' : s.peakDnl >= 1 ? 'bad' : ''),
    tile('INL (max / min)', `${signed(s.maxInl, 3)} / ${signed(s.minInl, 3)}`, 'LSB, endpoint fit', s.peakInl < 0.5 ? 'good' : s.peakInl >= 1 ? 'bad' : ''),
    tile('Missing codes', `${s.missingCodes}`, `of ${2 ** N - 2} inner codes`, s.missingCodes ? 'bad' : 'good'),
    tile('Offset error', `${signed(s.offsetErrorLsb, 3)} LSB`, 'T₁ vs ideal'),
    tile('Gain error', `${signed(s.gainErrorPct, 4)} %`, 'endpoint LSB vs ideal'),
    tile('Ramp', `${s.samplesPerCode} /code`, `${s.conversions.toLocaleString()} conv. · ±${fx(s.resolutionLsb, 3)} LSB`),
  ];
  const codesX = Float64Array.from({ length: s.dnl.length }, (_, i) => i);
  const dnlPts = envelope(codesX.subarray(1, s.dnl.length - 1), s.dnl.subarray(1, s.dnl.length - 1));
  const inlPts = envelope(codesX.subarray(1), s.inl.subarray(1));
  const lim = (lo, hi) => {
    const m = Math.max(0.25, Math.abs(lo), Math.abs(hi)) * 1.15;
    return { min: -m, max: m };
  };
  const dnlPlot = linePlot({
    id: 'dnl',
    width: W,
    height: 170,
    x: { min: 0, max: 2 ** N - 1, label: 'output code' },
    y: { ...lim(s.minDnl, s.maxDnl), label: 'DNL [LSB]' },
    series: [{ points: dnlPts, color: 'var(--s-p)', width: 1.1, mode: 2 ** N <= 512 ? 'stem' : 'line', base: 0 }],
    hlines: [{ y: 0, color: 'var(--muted)', dash: '' }],
  });
  const inlPlot = linePlot({
    id: 'inl',
    width: W,
    height: 170,
    x: { min: 0, max: 2 ** N - 1, label: 'code transition k' },
    y: { ...lim(s.minInl, s.maxInl), label: 'INL [LSB]' },
    series: [{ points: inlPts, color: 'var(--s-n)', width: 1.3 }],
    hlines: [{ y: 0, color: 'var(--muted)', dash: '' }],
  });

  const dyTiles = [
    tile('SNR', `${fx(d.snr, 2)} dB`, `ideal ${fx(th.idealSQNR, 2)} dB @ 0 dBFS`),
    tile('SNDR', `${fx(d.sndr, 2)} dB`, `${fx(d.amplitudeDbfs, 1)} dBFS input`),
    tile('ENOB', `${fx(d.enob, 3)} bit`, '(SNDR − 1.76) / 6.02', d.enob > N - 0.3 ? 'good' : ''),
    tile('SFDR', `${fx(d.sfdr, 2)} dBc`, `worst spur bin ${d.sfdrBin}`),
    tile('THD', `${fx(d.thd, 2)} dBc`, 'harmonics 2…7'),
    tile('Test tone', eng(d.fin, 'Hz', 4), `${d.cycles} cycles / ${d.points} pts · fs ${eng(d.fs, 'S/s', 3)}`),
  ];
  const nb = d.spectrumDbfs.length;
  const df = d.fs / d.points;
  const specPts = maxDecimate(d.spectrumDbfs.subarray(1), 700, df, df);
  let floor = Infinity;
  for (let k = 1; k < nb; k++) floor = Math.min(floor, d.spectrumDbfs[k]);
  const specMin = Math.max(-200, Math.floor(Math.min(floor, -6.02 * N - 40) / 20) * 20);
  const spec = linePlot({
    id: 'spec',
    width: W,
    height: 200,
    x: { min: 0, max: d.fs / 2, label: 'frequency [Hz]', format: (v) => eng(v, '', 3) },
    y: { min: specMin, max: 5, label: 'power [dBFS]' },
    series: [{ points: specPts, color: 'var(--s-p)', width: 1, mode: 'stem', base: specMin }],
    overlay: (sx, sy) =>
      d.harmonicBins
        .slice(0, 4)
        .map((b, i) => `<text x="${sx(b * df)}" y="${Math.max(24, sy(d.spectrumDbfs[b]) - 4)}" text-anchor="middle" font-size="9.5" class="muted">H${i + 2}</text>`)
        .join(''),
  });

  const enTiles = [
    tile('Avg. VREF energy', eng(e.avgRef, 'J', 4), `${fx(e.avgRefNormalized, 2)} Cu·VREF² (${e.conversions} codes)`),
    tile('Max. VREF energy', eng(e.maxRef, 'J', 4), 'worst-case code'),
    ...(adc.scheme.id === 'vcm' ? [tile('Avg. VCM energy', eng(e.avgVcm, 'J', 4), `${fx(e.avgVcmNormalized, 2)} Cu·VREF²`)] : []),
    tile('kT/C noise (diff.)'.replace(' (diff.)', diff ? ' (diff.)' : ''), eng(th.kTCrms, 'V', 3), `${fx(th.kTCrms / lsb, 3)} LSB rms at ${adc.config.nonIdeal.samplingNoise.temperature} K`),
    tile('Ct per side', eng(th.totalCapPerSide, 'F', 4), `${th.unitsPerSide} Cu · Ct/(Ct+Cp) = ${fx(th.attenuation, 4)}`),
  ];

  parts.push(`<div class="results-grid subsection">
    <div><h3>Static linearity (ramp histogram)</h3><div class="tiles">${stTiles.join('')}</div><div class="plot subsection">${dnlPlot}</div><div class="plot">${inlPlot}</div></div>
    <div><h3>Dynamic performance (coherent sine FFT)</h3><div class="tiles">${dyTiles.join('')}</div><div class="plot subsection">${spec}</div>
      <h3 class="subsection">Switching energy &amp; noise budget</h3><div class="tiles">${enTiles.join('')}</div></div>
  </div>`);
  return parts.join('');
}
