// Module A: parameter registry.

import { GROUPS, STATUS, OPEN_ITEMS } from '../params.js';
import { LEVELS } from '../sourceLevels.js';
import { latexParamTable, matlabStruct } from '../exportFormats.js';
import { esc, pill } from './fmt.js';
import { isEdited } from './store.js';

export function registryUnderstand() {
  const rows = Object.entries(STATUS).map(([k, v]) => `<tr><td>${pill(k)}</td><td>${esc(v)}</td></tr>`).join('');
  const lv = LEVELS.map((l) => `<li><b>${esc(l.label)}</b>${l.needsImport ? ': needs a CSV import from Cadence (phase 3)' : ''}</li>`).join('');
  return `<div class="card"><h2>What this module does</h2>
    <p>Every number the other modules use lives here once, with a status code, a source and a date. Editing a value here changes every calculation that uses it.</p>
    <p>Values you edit are stored in this browser only. The defaults are your values; no paper value is a default.</p>
    <h3>Status codes</h3><div class="scroll"><table><tbody>${rows}</tbody></table></div>
    <h3>Source level of a block</h3>
    <p><b>Source level</b> (where a block's numbers come from). Each block in the budget can be switched separately:</p><ul class="plain">${lv}</ul>
    <p class="differs">Differs from the real circuit: nothing is simulated in this module.</p></div>`;
}

export function registryDesign(state) {
  const groups = Object.entries(GROUPS).map(([g, title]) => {
    const rows = state.reg
      .filter((p) => p.group === g)
      .map((p) => {
        const ed = isEdited(p);
        return `<tr><td>${esc(p.label)}</td>
          <td><input type="number" step="any" data-param="${p.id}" value="${p.value}" class="${ed ? 'edited' : ''}" aria-label="${esc(p.label)}"/></td>
          <td>${esc(p.unit)}</td><td>${pill(p.status)}</td><td>${esc(p.source)}</td><td class="note">${p.date ? esc(p.date) : 'not given'}</td>
          <td class="note">${esc(p.note)}${ed ? ' <button class="btn" data-reset="' + p.id + '">reset</button>' : ''}</td></tr>`;
      })
      .join('');
    return `<h3>${esc(title)}</h3><div class="scroll"><table><thead><tr><th>Parameter</th><th>Value</th><th>Unit</th><th>Status</th><th>Source</th><th>Date</th><th>Note</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  });
  const open = OPEN_ITEMS.map((t) => `<li>${pill('?')} ${esc(t)}</li>`).join('');
  return `<div class="card"><h2>Parameters</h2>${groups.join('')}</div>
    <div class="card"><h2>Open decisions</h2><p>These stay switches or parameters in later phases; none is hard-coded.</p><ul class="plain">${open}</ul></div>`;
}

export function registrySimulate(state) {
  const tex = latexParamTable(state.reg, { wide: state.wideTable });
  const m = matlabStruct(state.reg);
  return `<div class="card"><h2>Export: LaTeX table (IEEEtran)</h2>
      <label class="row"><input type="checkbox" id="wideTable" ${state.wideTable ? 'checked' : ''}/> span both columns (table*)</label>
      <textarea id="texOut" readonly>${esc(tex)}</textarea><div class="row"><button class="btn" data-copy="texOut">Copy LaTeX</button></div></div>
    <div class="card"><h2>Export: MATLAB struct (SI units)</h2>
      <textarea id="matOut" readonly>${esc(m)}</textarea><div class="row"><button class="btn" data-copy="matOut">Copy MATLAB</button></div></div>`;
}
