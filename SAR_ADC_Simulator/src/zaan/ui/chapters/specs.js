// Chapter 1: what one conversion must deliver.

import { knob, knobGroup } from '../knobs.js';
import { context } from '../ctx.js';
import { eng, num } from '../fmt.js';
import { v, t, frac, sup, eq } from '../math.js';
import { check } from '../callouts.js';

export const chapter = {
  id: 'specs', n: 1, short: 'Specs', title: 'What must one conversion deliver?',
  lede: 'Four numbers from the front end set the converter. Each card translates one into time, levels, voltage or noise.',
  view(state) {
    return {
      knobs: knobGroup('Targets', ['fs', 'bits', 'fullScale', 'enobAim', 'f0', 'fbw'].map((id) => knob(state, id)).join('')),
      main: `<div class="cards4" id="spec-cards"></div>
        <figure class="fig"><figcaption class="fig-title">One tile, one converter</figcaption><div class="fig-body">${chainSvg()}</div>
        <p class="fig-cap">The ADC adds 16 channels with the right delays and converts the sum: one converter per tile.</p></figure>
        <div id="spec-check"></div>
        <details class="math-d"><summary>Show the math</summary><div class="math" id="spec-math"></div></details>`,
    };
  },
  update(state) {
    const { P } = context(state);
    const tc = 1 / P.fs;
    const lv = 2 ** P.bits;
    const sndr = 6.02 * P.enobAim + 1.76;
    document.getElementById('spec-cards').innerHTML = [
      [`${num(P.fs / 1e6, 0)} MS/s`, 'one sample every', eng(tc, 's')],
      [`${P.bits} bit`, 'the search ends in', `${lv} levels`],
      [`${num(P.fullScale, 2)} V pp`, 'differential: each side swings', `±${num(P.fullScale / 4, 3)} V`],
      [`ENOB ${num(P.enobAim, 1)}`, `${num(P.bits - P.enobAim, 1)} bit for noise:`, `SNDR ${num(sndr, 1)} dB`],
    ].map(([a, b, c]) => `<div class="card4"><div class="c4a">${a}</div><div class="c4b">${b}</div><div class="c4c">${c}</div></div>`).join('');
    const ratio = P.fs / P.f0;
    document.getElementById('spec-check').innerHTML =
      Math.abs(ratio - 4) < 1e-9
        ? check('Sample rate is exactly 4 × f0', `${num(P.fs / 1e6, 0)} MS/s ÷ ${num(P.f0 / 1e6, 1)} MHz = 4. Your notes say the rate is deliberately not 4 × f0. Moving f0 (8 MHz gives 5) costs axial resolution; moving fs changes the write clock, the delay step and the memory cells; keeping it means the IQ demodulator must not rely on it.`)
        : '';
    document.getElementById('spec-math').innerHTML = [
      eq(v('T', 'conv'), '=', frac('1', v('f', 's')), '=', frac('1', `${num(P.fs / 1e6, 0)} ${t('MS/s')}`), '=', eng(tc, 's')),
      eq(t('levels'), '=', sup('2', v('N')), '=', sup('2', P.bits), '=', lv),
      eq(t('SNDR'), '=', `6.02 ${t('dB')} × ${num(P.enobAim, 1)} + 1.76 ${t('dB')}`, '=', `${num(sndr, 1)} ${t('dB')}`),
    ].join('');
  },
};

function chainSvg() {
  const blocks = [['Tile', '16 elements'], ['LNA', 'per channel'], ['Beamformer', '16 → 1, charge'], ['ADC', 'charge sharing'], ['IQ demod', 'digital'], ['Image', 'one line']];
  const w = 96;
  const g = 14;
  const parts = blocks.map(([a, b], i) => {
    const x = 6 + i * (w + g);
    const mine = i === 2 || i === 3 || i === 4;
    return `<g class="cb ${mine ? 'mine' : ''}"><rect x="${x}" y="22" width="${w}" height="54" rx="8"/><text x="${x + w / 2}" y="45" text-anchor="middle" class="t1">${a}</text><text x="${x + w / 2}" y="63" text-anchor="middle" class="t2">${b}</text></g>${i ? `<path d="M${x - g + 2} 49H${x - 3}" class="wire"/>` : ''}`;
  });
  const x0 = 6 + 2 * (w + g) - 6;
  const x1 = 6 + 5 * (w + g) - g + 6;
  return `<svg viewBox="0 0 ${6 * (w + g) + 6} 92" role="img" aria-label="Receive chain"><rect x="${x0}" y="10" width="${x1 - x0}" height="76" rx="12" class="zone"/><text x="${x0 + 8}" y="9" class="zt">my blocks, one per tile</text>${parts.join('')}</svg>`;
}
