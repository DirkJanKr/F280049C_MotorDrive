// IQ demodulator page: the digital hardware after the ADC, step by step in the
// frequency domain: ADC output, mixing with the NCO, low-pass filter, decimation,
// with the SNR measured after every step. Values are illustrative.

import { group, knobs, fill, widthOf, plot, readouts, explain, eng, num, COL } from '../kit.js';
import { runIq, response } from '../iq.js';

const R = { key: '', r: null };

const STAGES = [
  { id: 'adc', n: 1, title: 'ADC output: real samples at fs', text: (o) => `The converter output is real, so its spectrum is mirrored around 0 Hz: the echo band (shaded, ${eng(o.f0 - o.B / 2, 'Hz')} to ${eng(o.f0 + o.B / 2, 'Hz')}) appears at +f and −f. The noise of the converter is spread evenly from −fs/2 to fs/2, most of it outside the echo band.` },
  { id: 'mix', n: 2, title: 'After mixing with the NCO: shifted down by f0', text: (o) => `Multiplying by cos(2π f0 n / fs) and −sin(2π f0 n / fs) shifts the whole spectrum down by f0 = ${eng(o.f0, 'Hz')}. The echo band now sits around 0 Hz (shaded); the mirror image moves to −2 f0 and folds back to ${eng(o.image, 'Hz')}. The noise is still spread over the full width, and the SNR drops 3 dB because half of the signal power went into the image.` },
  { id: 'lpf', n: 3, title: 'After the low-pass filter on I and Q', text: (o) => `The FIR filter (${o.K} taps, cutoff ${eng(o.fc, 'Hz')}, response dashed) keeps the band around 0 Hz and removes the image and all noise outside the band. Only the noise inside the passband is left, so the SNR rises.` },
  { id: 'dec', n: 4, title: 'After decimation: every D-th sample', text: (o) => `Keeping every ${o.D}th output gives ${eng(o.fs / o.D, 'S/s')} complex samples; the spectrum now runs from −${eng(o.fs / o.D / 2, 'Hz')} to +${eng(o.fs / o.D / 2, 'Hz')}. What the filter left above that folds back into the band, so the stopband must be low enough at fs / D − fc = ${eng(o.fs / o.D - o.fc, 'Hz')}.` },
];

function settings(ctx) {
  const P = ctx.P;
  const B = P.fbw * P.f0;
  const fc = P.iqCut ?? B / 2;
  const ftest = P.iqTest ?? P.f0 + 0.2122 * B;
  // the chain rounds to the output bits itself, so take the ideal rounding out of the budget total
  const fb = Math.max(0, Math.round(P.outBits - P.bits));
  const lsbOut = ctx.d.qLsb * 2 ** -fb;
  const noise = Math.max(ctx.budget.total ** 2 - lsbOut ** 2 / 12, 0);
  return { fs: P.fs, f0: P.f0, B, fc, ftest, K: Math.round(P.iqTaps) | 1, D: Math.max(1, Math.round(P.iqDecim)), codes: ctx.d.codes * 2 ** fb, noiseLsb: (Math.sqrt(noise) / ctx.d.qLsb) * 2 ** fb, ampDbfs: -1, bits: Math.round(P.outBits) };
}

export const page = {
  id: 'iq',
  title: 'IQ demodulator',
  side(store) {
    const used = new Set();
    return `<p class="ks pad">Digital, after the ADC. Nothing here is decided; the values show what each one does.</p>` + group('Filter and decimation', knobs(store.values, ['iqTaps', 'iqCut', 'iqDecim', 'iqTest'], used)) + group('Signal', knobs(store.values, ['f0', 'fbw', 'fs'], used), false);
  },
  main() {
    return `<section class="card wide"><header><h3>The demodulator in hardware</h3></header><div id="iqBlocks"></div></section>
      <div id="iqro"></div>
      ${STAGES.map((s) => `<section class="card wide"><header><h3>${s.n}. ${s.title}</h3><span class="snrtag" id="iqSnr-${s.id}"></span></header><div class="cbody" id="iq-${s.id}"></div><p class="cap" id="iq-${s.id}-cap"></p></section>`).join('')}
      ${explain('Where the SNR gain comes from', [
        'The converter noise is spread evenly from 0 to fs/2 = 20 MHz, but the echo only occupies its band of about 6 MHz. After mixing and low-pass filtering only the noise inside the band is left. For white noise the gain is (fs / 2) / B, here 10 log10(20 MHz / 6 MHz) ≈ 5.2 dB for an ideal filter; a real filter lets through a little more noise, set by its noise bandwidth fs Σ h².',
        'In bits: every 6.02 dB is one bit, so 5 dB is about 0.9 bit more ENOB inside the band. Tones that are not white (harmonics, spurs) only drop when they fall outside the band.',
        'This is the converter noise only (from the Budget page); the noise of the echo itself before the beamformer is left out.',
      ])}`;
  },
  update(store, ctx) {
    const o = settings(ctx);
    const key = JSON.stringify(o);
    if (key !== R.key) {
      R.key = key;
      R.r = runIq(o);
    }
    const r = R.r;
    o.image = r.stages[1].image;
    blocks(ctx, o, r);
    const s = r.stages;
    const enob = (snr) => (snr - 1.76) / 6.02;
    fill('iqro', readouts([
      ['SNR at the ADC output', `${num(s[0].snr, 1)} dB`, `${num(enob(s[0].snr + 1), 2)} bit ENOB (tone at −1 dBFS)`],
      ['SNR after the demodulator', `${num(s[3].snr, 1)} dB`, `${num(enob(s[3].snr + 1), 2)} bit in the band`, 'ok'],
      ['Gain, measured', `${num(s[3].snr - s[0].snr, 2)} dB`, `${num((s[3].snr - s[0].snr) / 6.02, 2)} bit`],
      ['Gain, this filter', `${num(r.gainTheory, 2)} dB`, `1 / (2 Σ h²), noise bandwidth ${eng(r.noiseBw, 'Hz')}`],
      ['Gain, ideal filter', `${num(r.gainIdeal, 2)} dB`, `(fs/2) / (2 fc)`],
      ['Multiplications', `${eng(2 * o.fs + (2 * o.K * o.fs) / o.D, '/s')}`, `2 × fs for the mixer + 2 K fs / D for the filter`],
    ]));
    STAGES.forEach((st, i) => {
      const sg = s[i];
      fill(`iqSnr-${st.id}`, `SNR ${num(sg.snr, 1)} dB`);
      fill(`iq-${st.id}`, spectrumPlot(sg, i, o, r, widthOf(`iq-${st.id}`)), st.text(o));
    });
  },
};

function spectrumPlot(sg, i, o, r) {
  const sp = sg.sp;
  const pts = [];
  const step = Math.max(1, Math.floor(sp.N / 1400));
  for (let k = 0; k < sp.N; k += step) {
    let m = -200;
    for (let j = k; j < Math.min(sp.N, k + step); j++) m = Math.max(m, sp.p[j]);
    pts.push([sp.f[k] / 1e6, 10 * Math.log10(Math.max(m, 1e-30) / sg.ref)]);
  }
  const half = sp.fs / 2 / 1e6;
  const band = i === 0 ? [{ x0: (o.f0 - o.B / 2) / 1e6, x1: (o.f0 + o.B / 2) / 1e6, color: 'color-mix(in srgb, var(--dig) 14%, transparent)', label: 'echo band' }, { x0: -(o.f0 + o.B / 2) / 1e6, x1: -(o.f0 - o.B / 2) / 1e6, color: 'color-mix(in srgb, var(--dig) 8%, transparent)', label: 'mirror' }] : [{ x0: -o.B / 2e6, x1: o.B / 2e6, color: 'color-mix(in srgb, var(--dig) 14%, transparent)', label: 'echo band' }];
  const series = [{ points: pts, color: COL.an, width: 1 }];
  if (i === 2) {
    const fr = pts.map((p) => p[0] * 1e6);
    const hr = response(r.h, o.fs, fr);
    series.push({ points: fr.map((f, j) => [f / 1e6, hr[j]]), color: COL.ref, width: 1.6, dash: '6 3', label: 'filter response' });
  }
  return plot({ height: 240, x: { min: -half, max: half, label: 'frequency [MHz]' }, y: { min: -140, max: 5, label: 'power per bin [dBFS]' }, series, xbands: band, legend: i === 2 }, Math.max(320, widthOf(`iq-${STAGES[i].id}`)));
}

function blocks(ctx, o, r) {
  const w = Math.max(760, widthOf('iqBlocks', 1000));
  const H = 250;
  const bw = (w - 60) / 5;
  const items = [
    ['ADC', `${o.bits} bit, ${eng(o.fs, 'S/s')}`, `SNR ${num(r.stages[0].snr, 1)} dB`],
    ['NCO + mixers', '2 multipliers at fs', `cos and −sin of 2π f0 n / fs`],
    ['FIR low-pass', `${o.K} taps on I and on Q`, `cutoff ${eng(o.fc, 'Hz')}`],
    [`↓ ${o.D}`, 'keep every D-th', `${eng(o.fs / o.D, 'S/s')} out`],
    ['I and Q out', 'to the image processing', `SNR ${num(r.stages[3].snr, 1)} dB`],
  ];
  const p = [`<svg viewBox="0 0 ${w} ${H}" class="lsvg" role="img" aria-label="IQ demodulator blocks"><defs><marker id="iqa" markerUnits="userSpaceOnUse" markerWidth="12" markerHeight="12" refX="10" refY="6" orient="auto"><path d="M0,0 L12,6 L0,12 z" class="lah"/></marker></defs>`];
  items.forEach(([t, a, b], i) => {
    const x = 14 + i * (bw + 10);
    p.push(`<rect x="${x}" y="40" width="${bw - 14}" height="110" rx="12" class="lb ${i === 0 || i === 4 ? '' : 'act'}"/><text x="${x + 12}" y="34" class="ls">${i < 4 ? `step ${i + 1}` : ''}</text><text x="${x + (bw - 14) / 2}" y="74" class="lt" text-anchor="middle">${t}</text><text x="${x + (bw - 14) / 2}" y="100" class="ls" text-anchor="middle">${a}</text><text x="${x + (bw - 14) / 2}" y="122" class="ls" text-anchor="middle">${b}</text>`);
    if (i < 4) p.push(`<path d="M${x + bw - 14} 95 H${x + bw + 8}" class="lw act" marker-end="url(#iqa)"/>`);
  });
  p.push(`<text x="14" y="${H - 52}" class="ls">The filter runs in polyphase form: it only computes the outputs that are kept,</text><text x="14" y="${H - 36}" class="ls">so it needs K multiplications per output per branch at fs / D instead of at fs. A symmetric filter halves that again.</text>`);
  p.push(`<text x="14" y="${H - 18}" class="ls">Word width: the in-band SNR of ${num(r.stages[3].snr + 1, 1)} dB for a full-scale tone is about ${num((r.stages[3].snr + 1 - 1.76) / 6.02, 1)} bit, so I and Q need at least that many bits after the filter, more than the ${o.bits} bits of the ADC.</text>`);
  p.push('</svg>');
  fill('iqBlocks', p.join(''));
}
