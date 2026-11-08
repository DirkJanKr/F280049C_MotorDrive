// Export for the thesis and for the MATLAB model.

import { latexParamTable, latexSpecSheet, matlabStruct } from '../exportFormats.js';
import { esc, siValue } from './fmt.js';

export function exportPage(state, b) {
  const tex = latexParamTable(state.reg, { wide: state.wideTable });
  const sheets = Object.entries(b.sheets).map(([blk, rows]) => latexSpecSheet(blk, rows, (r) => siValue(r.value, r.unit))).join('\n\n');
  const box = (id, title, text, extra = '') => `<div class="card"><h2>${title}</h2>${extra}<textarea id="${id}" readonly>${esc(text)}</textarea><button class="btn" data-copy="${id}">Copy</button></div>`;
  return `<section class="intro"><h1>Export</h1><p class="lede">Copy into your IEEEtran thesis or your MATLAB model.</p></section>
    ${box('texOut', 'Specifications as a LaTeX table', tex, `<label class="row"><input type="checkbox" id="wideTable" ${state.wideTable ? 'checked' : ''}/> span both columns (table*)</label>`)}
    ${box('sheetOut', 'Spec sheet per block as LaTeX tables', sheets)}
    ${box('matOut', 'MATLAB struct (SI units)', matlabStruct(state.reg))}`;
}
