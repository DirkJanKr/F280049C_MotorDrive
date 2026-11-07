// Budget, Simulate tab: results, charts, sweep, spec sheets.

import { latexSpecSheet } from '../exportFormats.js';
import { eng, num, esc, pill, siValue } from './fmt.js';

function tile(k, v, s, cls = '') {
  return `<div class="tile"><div class="k">${esc(k)}</div><div class="v ${cls}">${esc(v)}</div><div class="s">${esc(s)}</div></div>`;
}

function noiseChart(b) {
  const rows = b.result.rows;
  const total2 = b.result.total ** 2;
  const W = 640;
  const rowH = 26;
  const L = 230;
  const H = rows.length * rowH + 24;
  const bars = rows.map((r, i) => {
    const frac = r.included ? (r.sigma * r.sigma) / total2 : 0;
    const y = 8 + i * rowH;
    return `<text x="0" y="${y + 15}">${esc(r.label)}</text>
      <rect x="${L}" y="${y + 4}" width="${(W - L - 110) * frac}" height="14" fill="var(--bar)"/>
      <text x="${L + (W - L - 110) * frac + 6}" y="${y + 15}" class="${r.included ? '' : 'muted'}">${r.included ? `${num(frac * 100, 1)} %, ${eng(r.sigma, 'V')}` : 'ideal (left out)'}</text>`;
  });
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Share of total noise power per line">${bars.join('')}<text x="${L}" y="${H - 2}" class="muted">share of total noise power</text></svg>`;
}

function timingChart(b) {
  const W = 640;
  const x = (t) => (t / b.tConv) * (W - 20) + 10;
  let t = 0;
  const parts = [];
  for (const [i, line] of b.timing.lines.entries()) {
    if (line.value <= 0) continue;
    const fill = i === 0 ? 'var(--warn)' : i <= b.n ? (i % 2 ? 'var(--bar)' : 'var(--bar-2)') : 'var(--st-d)';
    parts.push(`<rect x="${x(t)}" y="10" width="${Math.max(0, x(t + line.value) - x(t))}" height="22" fill="${fill}"><title>${esc(line.label)}: ${eng(line.value, 's')}</title></rect>`);
    t += line.value;
  }
  const over = b.timing.slack < -1e-15;
  return `<svg viewBox="0 0 ${W} 60" role="img" aria-label="Timing budget">${parts.join('')}
    <line x1="${x(b.tConv)}" x2="${x(b.tConv)}" y1="4" y2="38" stroke="var(--bad)" stroke-width="2"/>
    <text x="10" y="52" class="muted">0</text><text x="${x(b.tConv)}" y="52" text-anchor="end" class="${over ? 'bad' : 'muted'}">Tconv = ${eng(b.tConv, 's')}</text>
    <text x="${x(0) + 2}" y="26">Ts</text></svg>`;
}

export function budgetSimulate(state, b) {
  const m = b.margin95;
  const m9 = b.margin9;
  const tiles = [
    tile('Total noise', eng(b.result.total, 'V rms'), 'RSS of included lines'),
    tile('SNDR', `${num(b.result.sndr, 2)} dB`, `signal ${eng(b.vSig, 'V rms')}`),
    tile('ENOB', `${num(b.result.enob, 3)} bit`, '(SNDR - 1.76) / 6.02'),
    tile('Margin vs ENOB 9.5', `${m.bits >= 0 ? '+' : ''}${num(m.bits, 3)} bit`, `${num(m.db, 2)} dB`, m.bits >= -1e-9 ? 'good' : 'bad'),
    tile('Margin vs ENOB 9', `${m9.bits >= 0 ? '+' : ''}${num(m9.bits, 3)} bit`, `${num(m9.db, 2)} dB`, m9.bits >= 0 ? 'good' : 'bad'),
    tile('Time per decision', eng(b.timing.tDec, 's'), `Ts ${eng(b.timing.lines[0].value, 's')} (status ?)`, b.timing.tDec > 0 ? '' : 'bad'),
  ];
  const sweep = b.sweep.map((r) => `<tr><td class="num">${eng(r.tSample, 's')}</td><td class="num">${eng(r.tDec, 's')}</td></tr>`).join('');
  const sheets = Object.entries(b.sheets).map(([blk, rows]) => {
    const trs = rows.map((r) => `<tr><td>${esc(r.name)}</td><td class="num">${esc(siValue(r.value, r.unit))}</td><td>${pill(r.status)}</td><td class="note">${esc(r.line)}</td></tr>`).join('');
    return `<h3>${esc(blk)} ${state.levels[blk] === 'ideal' ? '<span class="note">(set to ideal)</span>' : ''}</h3><div class="scroll"><table><thead><tr><th>Quantity</th><th>Value</th><th>Status</th><th>Budget line</th></tr></thead><tbody>${trs}</tbody></table></div>`;
  });
  const tex = Object.entries(b.sheets).map(([blk, rows]) => latexSpecSheet(blk, rows, (r) => siValue(r.value, r.unit))).join('\n\n');
  return `<div class="card"><h2>Result</h2><div class="tiles">${tiles.join('')}</div></div>
    <div class="card"><h2>Where the noise goes</h2><div class="chart">${noiseChart(b)}</div></div>
    <div class="card"><h2>Timing within one conversion</h2><div class="chart">${timingChart(b)}</div>
      <p class="note">Orange: sampling. Blue: the ${b.n} decisions (equal split). Purple: logic delay.</p>
      <h3>Ts is unknown: time per decision for a range of Ts</h3>
      <div class="scroll"><table class="narrow"><thead><tr><th>Ts</th><th>tdec (tlogic = ${eng(b.tLogic, 's')})</th></tr></thead><tbody>${sweep}</tbody></table></div></div>
    <div class="card"><h2>Spec sheet per block</h2>${sheets.join('')}
      <details><summary>LaTeX of all spec sheets</summary><textarea id="specTex" readonly>${esc(tex)}</textarea><button class="btn" data-copy="specTex">Copy LaTeX</button></details></div>`;
}
