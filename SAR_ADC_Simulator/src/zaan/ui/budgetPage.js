// Budget page: noise shares and timing with sliders. The page is drawn once;
// budgetRefresh() updates only the numbers so a slider keeps working while dragged.

import { NOISE_LINES } from '../noiseBudget.js';
import { BLOCKS, LEVELS } from '../sourceLevels.js';
import { eng, num, esc, estimateTag, siValue } from './fmt.js';
import { v, t, frac, sqrt, sup, paren, eq, n } from './math.js';

function slider(id, attr, value, min, max, step, label) {
  return `<input type="range" id="${id}" ${attr} min="${min}" max="${max}" step="${step}" value="${value}" aria-label="${esc(label)}"/>`;
}

export function budgetPage(state) {
  const p = (id) => state.reg.find((x) => x.id === id);
  const shareRows = NOISE_LINES.filter((l) => !l.fixed)
    .map(
      (l) => `<div class="srow">
        <div class="sl"><b>${esc(l.label)}</b><span class="chip">${esc(l.block)}</span></div>
        ${slider('sh-' + l.id, `data-share="${l.id}"`, state.shares[l.id], 0, 60, 1, l.label)}
        <div class="sv"><span id="shv-${l.id}"></span><span class="sig" id="sig-${l.id}"></span></div>
      </div>`
    )
    .join('');
  const levels = BLOCKS.map(
    (blk) => `<label class="lvl">${esc(blk)}<select data-level="${esc(blk)}">${LEVELS.map(
      (l) => `<option value="${l.id}" ${state.levels[blk] === l.id ? 'selected' : ''} ${l.needsImport ? 'disabled' : ''}>${esc(l.label)}${l.needsImport ? ' (needs import)' : ''}</option>`
    ).join('')}</select></label>`
  ).join('');
  return `
  <section class="intro"><h1>Noise and timing budget</h1>
    <p class="lede">Start from your ENOB target, take out quantisation, and share what is left over the blocks. Drag the sliders; the result follows.</p></section>
  <section class="grid2 budget">
    <div class="card">
      <h2>Share the noise ${estimateTag()}</h2>
      <p id="noiseIntro" class="note"></p>
      <div class="sliders">${shareRows}</div>
      <p id="reserve" class="note"></p>
      <details><summary>Model used for each block</summary><p class="note">Ideal removes a block's noise. Schematic and post-layout need imported Cadence results (from phase 3).</p><div class="lvls">${levels}</div></details>
    </div>
    <div class="card result">
      <div class="big"><span class="bk">Predicted ENOB</span><span class="bv" id="enobBig"></span></div>
      <div class="margins" id="margins"></div>
      <div class="chart" id="noiseChart"></div>
      <details><summary>Show the math</summary><div class="math" id="noiseMath"></div></details>
    </div>
  </section>
  <section class="grid2 budget">
    <div class="card">
      <h2>Time inside one conversion</h2>
      <div class="srow"><div class="sl"><b>Sampling time T<sub>s</sub></b> ${estimateTag(p('tSample').estimate)}</div>
        ${slider('ts', 'data-param="tSample"', p('tSample').value, 0.5, 15, 0.1, 'Sampling time')}<div class="sv"><span id="tsv"></span></div></div>
      <div class="srow"><div class="sl"><b>Logic delay per decision</b> ${estimateTag(p('tLogic').estimate)}</div>
        ${slider('tl', 'data-param="tLogic"', p('tLogic').value, 0, 1, 0.01, 'Logic delay')}<div class="sv"><span id="tlv"></span></div></div>
      <p class="note">Sampling time is not known yet, so it is a slider: drag it and watch the time each decision is left with.</p>
    </div>
    <div class="card result">
      <div class="big"><span class="bk">Time per decision</span><span class="bv" id="tdecBig"></span></div>
      <div class="chart" id="timingChart"></div>
      <details><summary>Show the math</summary><div class="math" id="timingMath"></div></details>
    </div>
  </section>
  <section class="card"><h2>What each block must achieve</h2><p class="note">Follows from the shares above. Estimates stay estimates until you confirm the shares.</p><div id="sheets"></div></section>`;
}

export function budgetRefresh(state, b) {
  const set = (id, html) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
  };
  set('noiseIntro', `ENOB ${num(b.targetEnob, 1)} allows ${eng(b.alloc.target, 'V')} rms in total. Quantisation takes ${eng(b.quant, 'V')}; ${b.alloc.feasible ? `${eng(b.alloc.left, 'V')} rms is left to share.` : 'nothing is left: the target is above the resolution.'}`);
  for (const l of NOISE_LINES.filter((x) => !x.fixed)) {
    const row = b.result.rows.find((r) => r.id === l.id);
    set(`shv-${l.id}`, `${state.shares[l.id]} %`);
    set(`sig-${l.id}`, row.included ? eng(row.sigma, 'V') : 'left out');
  }
  const reserve = 100 - b.alloc.shareSum;
  set('reserve', reserve >= 0 ? `Unshared reserve: ${num(reserve, 0)} %` : `<span class="bad">Shares add up to ${num(b.alloc.shareSum, 0)} %, over 100 %: the target is missed.</span>`);
  const ok = b.margin95.bits >= -1e-9;
  set('enobBig', `<span class="${ok ? 'ok' : 'bad'}">${num(b.result.enob, 3)}</span> <small>bit</small>`);
  set('margins', [['to ENOB 9.5', b.margin95], ['to ENOB 9', b.margin9]].map(([k, m]) => `<span class="${m.bits >= -1e-9 ? 'ok' : 'bad'}">${m.bits >= 0 ? '+' : '−'}${num(Math.abs(m.bits), 3)} bit ${k}</span>`).join(''));
  set('noiseChart', noiseChart(b));
  set('noiseMath', noiseMath(state, b));
  set('tsv', eng(b.timing.lines[0].value, 's'));
  set('tlv', eng(b.tLogic, 's'));
  set('tdecBig', `<span class="${b.timing.tDec > 0 ? '' : 'bad'}">${num(b.timing.tDec * 1e9, 3)}</span> <small>ns</small>`);
  set('timingChart', timingChart(b));
  set('timingMath', timingMath(b));
  set('sheets', sheets(b, state));
}

function noiseChart(b) {
  const total2 = b.result.total ** 2;
  return b.result.rows
    .map((r) => {
      const frac_ = r.included ? (r.sigma * r.sigma) / total2 : 0;
      return `<div class="bar"><span class="bl">${esc(r.label)}</span><span class="bt"><span class="bf" style="width:${(frac_ * 100).toFixed(1)}%"></span></span><span class="bn">${r.included ? `${num(frac_ * 100, 0)} %` : 'out'}</span></div>`;
    })
    .join('') + '<p class="note">Share of the total noise power.</p>';
}

function noiseMath(state, b) {
  const s = state.shares.ktc;
  return [
    eq(v('V', 'sig'), '=', frac(v('V', 'FS'), `2${sqrt('2')}`), '=', frac(`${num(b.fullScale)} ${t('V')}`, '2.828'), '=', `${eng(b.vSig, 'V')} ${t('rms')}`),
    eq(t('LSB'), '=', frac(v('V', 'FS'), sup('2', v('N'))), '=', frac(`${num(b.fullScale)} ${t('V')}`, sup('2', b.bits)), '=', eng(b.lsb, 'V')),
    eq(v('σ', 'q'), '=', frac(t('LSB'), sqrt('12')), '=', frac(eng(b.lsb, 'V'), '3.464'), '=', `${eng(b.quant, 'V')} ${t('rms')}`),
    eq(v('σ', 'target'), '=', frac(v('V', 'sig'), sup('10', paren(`6.02 ${t('ENOB')} + 1.76`) + ' / 20')), '=', `${eng(b.alloc.target, 'V')} ${t('rms')}`),
    eq(v('σ', 'left'), '=', sqrt(`${sup(v('σ', 'target'), 2)} − ${sup(v('σ', 'q'), 2)}`), '=', `${eng(b.alloc.left, 'V')} ${t('rms')}`),
    eq(v('σ', 'i'), '=', sqrt(frac(t('share'), '100')), '·', v('σ', 'left'), `${t('e.g. kT/C:')}`, sqrt(frac(s, '100')), '×', eng(b.alloc.left, 'V'), '=', eng(b.alloc.lines.ktc, 'V')),
    eq(v('σ', 'total'), '=', sqrt(`Σ ${sup(v('σ', 'i'), 2)}`), '=', `${eng(b.result.total, 'V')} ${t('rms')}`),
    eq(t('SNDR'), '=', `20 log${'<sub>10</sub>'}`, frac(v('V', 'sig'), v('σ', 'total')), '=', `${num(b.result.sndr, 2)} ${t('dB')}`),
    eq(t('ENOB'), '=', frac(`${t('SNDR')} − 1.76 ${t('dB')}`, `6.02 ${t('dB')}`), '=', `${num(b.result.enob, 3)} ${t('bit')}`),
  ].join('');
}

function timingChart(b) {
  let x = 0;
  const seg = b.timing.lines
    .filter((l) => l.value > 0)
    .map((l, i) => {
      const w = (l.value / b.tConv) * 100;
      const cls = l.label.startsWith('Sampling') ? 'ts' : l.label.startsWith('Logic') ? 'tl' : i % 2 ? 'td2' : 'td';
      const out = `<span class="seg ${cls}" style="left:${x.toFixed(2)}%;width:${Math.max(0, w).toFixed(2)}%" title="${esc(l.label)}: ${eng(l.value, 's')}"></span>`;
      x += w;
      return out;
    })
    .join('');
  return `<div class="tbar">${seg}</div><div class="tscale"><span>0</span><span>${eng(b.tConv, 's')}</span></div>
    <p class="note"><span class="key ts"></span> sampling <span class="key td"></span> ${b.n} decisions, equal split <span class="key tl"></span> logic</p>`;
}

function timingMath(b) {
  return [
    eq(v('T', 'conv'), '=', frac('1', v('f', 's')), '=', eng(b.tConv, 's')),
    eq(v('t', 'dec'), '=', frac(`${v('T', 'conv')} − ${v('T', 's')} − ${v('n')} ${v('t', 'logic')}`, v('n')), '=', frac(`${eng(b.tConv, 's')} − ${eng(b.timing.lines[0].value, 's')} − ${b.n} × ${eng(b.tLogic, 's')}`, b.n), '=', eng(b.timing.tDec, 's')),
    '<p class="note">A self-timed SAR does not split the time equally: the comparator is slower when its input is small. Phase 3 replaces the equal split with real decision times.</p>',
  ].join('');
}

function sheets(b, state) {
  return Object.entries(b.sheets)
    .map(([blk, rows]) => {
      const lines = rows.map((r) => `<div class="sheetrow"><span>${esc(r.name)}</span><b class="mono">${esc(siValue(r.value, r.unit))}</b>${estimateTag(r.estimate)}</div>`).join('');
      return `<details class="sheet"><summary>${esc(blk)}${state.levels[blk] === 'ideal' ? ' (set to ideal)' : ''}</summary>${lines}</details>`;
    })
    .join('');
}
