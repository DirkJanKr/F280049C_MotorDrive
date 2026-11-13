// The lead of every page: the one question the page answers and the number that answers it.
// Display only: every number here is read from the design context or from the page itself,
// nothing is calculated that the pages do not already calculate.

import { eng, num, esc } from './kit.js';
import { absorbedOffset } from './pages/offset.js';

/** The first readout the page drew, as [value, note]: for pages whose key number lives on the page. */
const firstReadout = (id) => () => {
  const ro = document.querySelector(`${id ? `#${id} ` : '#main '}.ro`);
  if (!ro) return null;
  const k = ro.querySelector('.rk')?.textContent || '';
  return [ro.querySelector('.rv')?.textContent || '', k];
};

const LEADS = {
  system: { q: 'Does the design reach the ENOB it aims for?', a: (c) => [`${num(c.budget.enob, 2)} bit`, `aim ${num(c.P.enobAim, 1)} bit, from the noise budget`] },
  balance: { q: 'Which reference voltage and CDAC follow from C M and alpha?', a: (c) => [`V REF = ${eng(c.P.vref, 'V')}`, `binary C DAC ${eng(c.P.cdacBalance, 'F')}, alpha ${num(c.P.alphaIn, 2)} (Chen 2018 eq. 3, Rabuske 2017 eq. 4.58)`] },
  budget: {
    q: 'Which noise source limits the ENOB?',
    a: (c) => {
      const top = c.budget.lines.slice().sort((x, y) => y.share - x.share)[0];
      return [`${num(top.share, 0)} %`, `of the allowed noise power: ${top.label.toLowerCase()}`];
    },
  },
  power: { q: 'How much power do the beamformer and converter take?', a: firstReadout('pwRo') },
  redundancy: { q: 'Which CDAC weights does every page use?', a: (c) => [`${c.d.decisions} decisions`, `weights ${c.d.weights.slice(0, 5).map((w) => num(w, 1)).join(', ')} … LSB, budget ENOB ${num(c.budget.enob, 2)} bit`] },
  sar: {
    q: 'Can the later steps repair every error, decision by decision?',
    a: (c) => {
      const k = c.checks.find((x) => x.id === 'tol');
      return k ? [k.state === 'ok' ? 'yes' : 'no', `${k.value}; ${k.limit}`] : null;
    },
  },
  levels: { q: 'How much does rounding to 10 bits cost?', a: (c) => [`${num(c.res.round, 3)} LSB rms`, `added on top of ${num(c.res.sar, 3)} LSB rms of the converter itself`] },
  matching: { q: 'How much CDAC capacitance does matching need without calibration?', a: (c) => [eng((6 * 2 ** c.P.bits * (c.P.aC / 100)) ** 2 * 1e-15, 'F'), 'in total, for 3σ below ½ LSB with the PDK matching'] },
  mismatch: { q: 'What does mismatch do to a real chip, before and after calibration?', a: firstReadout('mmro') },
  offset: { q: 'How much comparator offset can the redundancy repair?', a: (c) => [eng(absorbedOffset(c.d), 'V'), `with the present weights; a binary search allows α · V LSB = ${eng(c.dBin.alpha * (c.P.fullScale / 2 ** c.P.bits), 'V')} (Rabuske 2017, eq. 4.60)`] },
  beamformer: { q: 'How many memory cells does the longest delay need?', a: (c) => [`${c.need.m} cells`, `longest delay ${eng(c.tauMax, 's')}, ${c.P.memCells} set`] },
  chen: { q: 'How does the clock sequence of Chen 2018 fit in one 25 ns period?', a: firstReadout() },
  logic: { q: 'What must the self-timed logic do for every decision?', a: () => null },
  timing: { q: 'Does one conversion fit in one sample period?', a: (c) => [eng(c.timing.median, 's'), `of ${eng(c.tw, 's')}; illustrative timing values, nothing decided`] },
  reference: { q: 'How much reference charge does each conversion take?', a: firstReadout('rfRo') },
  iq: { q: 'How much SNR is left after the IQ demodulator?', a: firstReadout() },
  values: { q: 'Which values are decided, and which are still assumptions?', a: (c, store) => [`${store.values.filter((v) => v.status === 'U').length} of ${store.values.length}`, 'values are my decision (U); the rest come from papers, derivations or assumptions'] },
  sources: {
    q: 'Where does every formula come from?',
    a: () => {
      const tags = [...document.querySelectorAll('#srcTab td b')].map((b) => b.textContent);
      return tags.length ? [`${tags.filter((t) => t !== 'own derivation').length} of ${tags.length}`, 'formulas come from literature or follow from it; the rest are own derivations that still need a source'] : null;
    },
  },
};

export function leadHtml(id, ctx, store) {
  const L = LEADS[id];
  if (!L) return '';
  let a = null;
  try {
    a = L.a(ctx, store);
  } catch {
    a = null;
  }
  return `<h2 class="lq">${esc(L.q)}</h2>${a ? `<span class="la">${esc(a[0])}</span><span class="ln">${esc(a[1])}</span>` : ''}`;
}
