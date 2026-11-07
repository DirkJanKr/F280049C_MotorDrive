// Budget, Design tab: source levels, shares, timing inputs.

import { NOISE_LINES } from '../noiseBudget.js';
import { BLOCKS, LEVELS } from '../sourceLevels.js';
import { eng, num, esc, pill } from './fmt.js';

function paramInput(state, id) {
  const p = state.reg.find((x) => x.id === id);
  return `<input type="number" step="any" data-param="${id}" value="${p.value}" aria-label="${esc(p.label)}"/> <span class="note">${esc(p.unit)}</span> ${pill(p.status)}`;
}

export function budgetDesign(state, b) {
  const levelRows = BLOCKS.map((blk) => {
    const opts = LEVELS.map((l) => `<option value="${l.id}" ${state.levels[blk] === l.id ? 'selected' : ''} ${l.needsImport ? 'disabled' : ''}>${esc(l.label)}${l.needsImport ? ' (no import yet)' : ''}</option>`).join('');
    return `<tr><td>${esc(blk)}</td><td><select data-level="${esc(blk)}">${opts}</select></td></tr>`;
  }).join('');
  const shareRows = NOISE_LINES.map((line) => {
    const sigma = b.alloc.lines[line.id];
    const input = line.fixed
      ? '<span class="note">fixed by resolution</span>'
      : `<input type="number" min="0" max="100" step="1" data-share="${line.id}" value="${state.shares[line.id]}" aria-label="share ${esc(line.label)}"/>`;
    const formula = line.fixed
      ? `sigma q = LSB / sqrt(12) = ${eng(b.lsb, 'V')} / 3.464 = ${eng(sigma, 'V rms')}`
      : `sigma = sqrt(share / 100) x sigma left = sqrt(${state.shares[line.id]} / 100) x ${eng(b.alloc.left, 'V')} = ${eng(sigma, 'V rms')}`;
    return `<tr><td>${esc(line.label)}${line.id === 'compOffset' ? '<div class="note">see flag F8</div>' : ''}</td><td class="hide-phone">${esc(line.block)}</td><td>${input}</td><td>${pill(line.fixed ? 'D' : 'A')}</td>
      <td class="num">${eng(sigma, 'V rms')}<details><summary>formula</summary><div class="formula">${esc(formula)}</div></details></td></tr>`;
  }).join('');
  const reserve = 100 - b.alloc.shareSum;
  return `<div class="card"><h2>Source level per block</h2>
      <p>Set a block to Ideal to remove its lines from the budget. Schematic and post-layout levels unlock when you import a CSV (phase 3).</p>
      <div class="scroll"><table><thead><tr><th>Block</th><th>Source level</th></tr></thead><tbody>${levelRows}</tbody></table></div></div>
    <div class="card"><h2>Noise shares (status A until you confirm)</h2>
      <p>Target ENOB ${num(b.targetEnob, 2)} bit from the registry. Shares are percent of the noise power left after quantisation.</p>
      <div class="scroll"><table><thead><tr><th>Line</th><th class="hide-phone">Block</th><th>Share %</th><th>Status</th><th>Allocated sigma</th></tr></thead><tbody>${shareRows}</tbody></table></div>
      <p class="${reserve < 0 ? 'bad' : 'note'}">Shares sum to ${num(b.alloc.shareSum, 1)} %; reserve ${num(reserve, 1)} %.${reserve < 0 ? ' Over 100 %: the target ENOB is missed.' : ''}</p></div>
    <div class="card"><h2>Timing inputs</h2>
      <div class="scroll"><table><tbody>
        <tr><td>Sampling time Ts</td><td>${paramInput(state, 'tSample')}</td></tr>
        <tr><td>SAR logic delay per decision</td><td>${paramInput(state, 'tLogic')}</td></tr>
        <tr><td>Raw decisions n</td><td class="mono">${b.n} ${pill('U')}</td></tr>
        <tr><td>Conversion period</td><td class="mono">${eng(b.tConv, 's')} ${pill('D')}<details><summary>formula</summary><div class="formula">Tconv = 1 / fs = 1 / (${num(1 / b.tConv / 1e6, 2)}e6 1/s) = ${eng(b.tConv, 's')}</div></details></td></tr>
      </tbody></table></div></div>`;
}
