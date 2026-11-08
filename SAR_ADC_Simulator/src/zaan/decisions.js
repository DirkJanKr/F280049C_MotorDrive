// Decisions to make. Each one shows the numbers behind it (recomputed from the
// specifications) and the options with what each costs. Nothing is chosen for you.
// `math` holds typeset formula lines (HTML built with ui/math.js).

import { si } from './params.js';
import { dacToSampleRatio } from './specSheets.js';
import { decisionTime } from './timingBudget.js';
import { v, t, frac, sqrt, sup, paren, eq, n } from './ui/math.js';

const f = (x, d = 3) => n(Number(x.toFixed(d)).toString());

export function buildDecisions(reg) {
  const fsV = si(reg, 'fullScale');
  const q = (enob) => fsV / 2 ** enob / Math.sqrt(12);
  const side = si(reg, 'mimSide') * 1e6;
  const density = si(reg, 'capDensity') * 1e3;
  const mimArea = side * side * density;
  const mimPdk = si(reg, 'mimMin') * 1e15;
  const radix = si(reg, 'radix');
  const bits = si(reg, 'bits');
  const needed = Math.log(2 ** bits) / Math.log(radix);
  const nDec = si(reg, 'rawDecisions');
  const aperture = (si(reg, 'elements') - 1) * si(reg, 'pitch');
  const theta = si(reg, 'steer');
  const c = si(reg, 'c');
  const delay = (aperture * Math.sin(theta)) / c;
  const tw = 1 / si(reg, 'fs');
  const ratio = dacToSampleRatio(reg);
  const cs = si(reg, 'channels') * si(reg, 'cmExample');
  const cdac = ratio * cs;
  const qref = cdac * si(reg, 'vref');
  const tDec = decisionTime({ tConv: tw, tSample: si(reg, 'tSample'), tLogic: si(reg, 'tLogic'), n: nDec });
  const f0 = si(reg, 'f0');
  const fs = si(reg, 'fs');
  const lambda = (fc) => (c / fc) * 1e6;
  const qLine = (e) => eq(v('σ', 'q'), '=', frac(`${f(fsV)} ${t('V')}`, `${sup('2', e)} · ${sqrt('12')}`), '=', `${f(q(e) * 1e6, 1)} ${t('µV rms')}`, t(`(ENOB ${e})`));

  return [
    {
      id: 'fsRatio', question: 'Sample rate against centre frequency: is fs really not 4 × f0?',
      why: 'You decided that the sample rate is deliberately not 4 times the centre frequency. With the current values it is exactly 4.',
      math: [
        eq(frac(v('f', 's'), v('f', '0')), '=', frac(`${f(fs / 1e6, 2)} ${t('MS/s')}`, `${f(f0 / 1e6, 2)} ${t('MHz')}`), '=', f(fs / f0, 3)),
        eq(v('λ'), '=', frac(v('c'), v('f', '0')), ':', `${f(lambda(10e6), 0)} ${t('µm at 10 MHz')},`, `${f(lambda(8e6), 0)} ${t('µm at 8 MHz')}`),
      ],
      options: [
        { value: 'f0', label: 'Move f0 inside 8 to 10 MHz', cost: `For example 8 MHz gives fs / f0 = ${Number((fs / 8e6).toFixed(2))}; longer wavelength (${f(lambda(8e6), 0)} µm instead of ${f(lambda(10e6), 0)} µm), so coarser axial resolution.` },
        { value: 'fs', label: 'Move fs', cost: 'Changes the 25 ns write clock, the delay step, the memory capacitor count and the timing budget.' },
        { value: 'keep', label: 'Keep 40 MS/s at 10 MHz', cost: 'Ratio is exactly 4; the IQ demodulator must not rely on it, and the "not 4 × f0" decision no longer holds as written.' },
      ],
      usedBy: 'IQ demodulator (phase 7), beamformer timing (phase 5)',
    },
    {
      id: 'enobBasis', question: 'Which ENOB should the signal chain noise budget use?',
      why: 'Your 13 Oct chain uses 280 µV rms of ADC noise, which is the ideal 10-bit value, but the chain was built on ENOB 9.',
      math: [qLine(10), qLine(9.5), qLine(9)],
      options: [
        { value: 10, label: 'ENOB 10', cost: 'Matches the 280 µV in the chain, but is the ideal converter; no room for real noise.' },
        { value: 9.5, label: 'ENOB 9.5', cost: 'Your aim. ADC noise 399 µV, still far above the 14.6 µV after the beamformer.' },
        { value: 9, label: 'ENOB 9', cost: 'What the chain was built on. ADC noise 564 µV, the most pessimistic.' },
      ],
      usedBy: 'Sampling and noise block (phase 4)',
    },
    {
      id: 'mimValue', question: 'Which minimum MIM capacitance do you trust?',
      why: 'Area times density does not give the PDK value.',
      math: [
        eq(v('C'), '=', v('W'), '×', v('L'), '×', v('ρ', 'C'), '=', `${f(side, 2)} ${t('µm')} × ${f(side, 2)} ${t('µm')} × ${f(density, 2)} ${frac(t('fF'), t('µm²'))}`, '=', `${f(mimArea, 2)} ${t('fF')}`),
        eq(t('PDK:'), `${f(mimPdk, 2)} ${t('fF')},`, t('difference'), `${f(mimPdk - mimArea, 2)} ${t('fF')}`, paren(`${f(((mimPdk - mimArea) / mimArea) * 100, 1)} %`)),
      ],
      options: [
        { value: 'density', label: `${f(mimArea, 0)} fF (density)`, cost: 'Consistent with using 2 fF/µm² everywhere; underestimates small capacitors if the PDK is right.' },
        { value: 'pdk', label: `${f(mimPdk, 0)} fF (PDK)`, cost: 'Includes the extra, possibly fringe or perimeter capacitance (not confirmed); density alone is then wrong for small capacitors.' },
      ],
      usedBy: 'CDAC block (phase 2): unit capacitor and matching',
    },
    {
      id: 'delayStep', question: 'Which delay step do you design for?',
      why: 'The steering delay across the tile sets how many memory capacitors one channel needs.',
      math: [
        eq(v('D'), '=', paren(`${v('N', 'el')} − 1`), '×', v('p'), '=', `${si(reg, 'elements') - 1} × ${f(si(reg, 'pitch') * 1e6, 0)} ${t('µm')}`, '=', `${f(aperture * 1e3, 2)} ${t('mm')}`),
        eq(v('τ', 'steer'), '=', frac(`${v('D')} sin ${v('θ')}`, v('c')), '=', frac(`${f(aperture, 4)} ${t('m')} × ${f(Math.sin(theta), 4)}`, `${f(c, 0)} ${t('m/s')}`), '=', `${f(delay * 1e9, 1)} ${t('ns')}`),
        eq(frac(v('τ', 'steer'), `${f(tw * 1e9, 1)} ${t('ns')}`), '=', `${f(delay / tw, 1)} ${t('steps')},`, frac(v('τ', 'steer'), `12.5 ${t('ns')}`), '=', `${f(delay / 12.5e-9, 1)} ${t('steps')}`),
      ],
      options: [
        { value: 25, label: '25 ns', cost: `Fits your ${si(reg, 'memCaps')} memory capacitors at a 25 ns write clock; higher sidelobes (flagged by Yahua).` },
        { value: 12.5, label: '12.5 ns', cost: 'Lower sidelobes; needs a mechanism you do not have yet, or about twice the memory capacitors.' },
      ],
      usedBy: 'Beamformer block (phase 5)',
    },
    {
      id: 'offsetAsNoise', question: 'Should comparator offset count as noise in the budget?',
      why: 'A constant offset shifts every code transition by the same voltage. In the FFT it lands in the DC bin, which SNDR leaves out. It costs input range instead.',
      math: [eq(t('Range lost'), '=', frac(v('V', 'os'), v('V', 'FS')), t('of the full scale, at one end'))],
      options: [
        { value: 'noise', label: 'Count it as noise', cost: 'Conservative; takes budget from the other blocks.' },
        { value: 'range', label: 'Count it as range loss', cost: 'Frees its noise share. Only offset that changes during operation (temperature, common mode) then counts as noise.' },
      ],
      usedBy: 'Budget page (takes effect now)',
    },
    {
      id: 'ratioConfirm', question: 'Is this DAC to sampling capacitance ratio right?',
      why: 'With V REF = 200 mV the DAC capacitors must carry enough charge to cancel a full-scale input. This is my derivation, not a checked fact.',
      math: [
        eq(t('Balance:'), `Σ ±${v('C', 'dac,i')} ${v('V', 'REF')}`, '=', `${v('C', 's')} ${v('V', 'in')}`, t('so'), v('V', 'in,max'), '=', v('V', 'REF'), frac(`Σ${v('C', 'dac')}`, v('C', 's'))),
        eq(frac(`Σ${v('C', 'dac')}`, v('C', 's')), '=', frac(`${v('V', 'FS')} / 2`, v('V', 'REF')), '=', frac(`${f(fsV / 2, 3)} ${t('V')}`, `${f(si(reg, 'vref'), 3)} ${t('V')}`), '=', f(ratio, 2)),
        eq(t('Example:'), v('C', 's'), '=', `${si(reg, 'channels')} × ${f(si(reg, 'cmExample') * 1e15, 0)} ${t('fF')}`, '=', `${f(cs * 1e15, 0)} ${t('fF')},`, `Σ${v('C', 'dac')}`, '=', `${f(cdac * 1e15, 0)} ${t('fF')}`, t('before redundancy')),
        eq(t('Comparator sees the input scaled by'), frac('1', `1 + ${f(ratio, 2)}`), '=', f(1 / (1 + ratio), 3)),
        eq(v('Q', 'ref'), '=', `Σ${v('C', 'dac')} ${v('V', 'REF')}`, '=', `${f(qref * 1e15, 0)} ${t('fC')},`, v('I'), '=', `${v('Q', 'ref')} ${v('f', 's')}`, '=', `${f((qref / tw) * 1e6, 2)} ${t('µA')}`, t('(during precharge)')),
      ],
      options: [
        { value: 'ok', label: 'Looks right', cost: 'The CDAC block starts from this ratio.' },
        { value: 'check', label: 'Check the topology first', cost: 'The CDAC block computes it from the real connection instead (single-ended view used here).' },
      ],
      usedBy: 'CDAC block (phase 2)',
    },
    {
      id: 'decisionCount', question: 'How many raw decisions?', info: true,
      why: 'Redundancy costs extra decisions. The real count follows from the weights, which the CDAC block will compute.',
      math: [
        eq(v('n'), '=', frac(`ln ${sup('2', bits)}`, `ln ${f(radix, 2)}`), '=', frac(f(Math.log(2 ** bits), 3), f(Math.log(radix), 3)), '=', f(needed, 2), t(`→ ${Math.ceil(needed)} decisions`)),
        eq(t(`You plan ${nDec}: ${nDec - Math.ceil(needed)} more. Time per decision now`), v('t', 'dec'), '=', `${f(tDec * 1e9, 3)} ${t('ns')}`, t('(Ts is an estimate)')),
      ],
      options: [],
      usedBy: 'CDAC block (phase 2)',
    },
  ];
}
