// Export for the thesis and for the MATLAB model.

import { latexParamTable, matlabStruct } from '../exportFormats.js';
import { esc } from './fmt.js';

export function exportPage(state) {
  const tex = latexParamTable(state.reg, { wide: state.wideTable });
  const box = (id, title, text, extra = '') => `<div class="card"><h2>${title}</h2>${extra}<textarea id="${id}" readonly>${esc(text)}</textarea><button class="btn" data-copy="${id}">Copy</button></div>`;
  return `<header class="ch-head"><h1>Export</h1><p class="lede">Copy your current values into the IEEEtran thesis or your MATLAB model.</p></header>
    ${box('texOut', 'LaTeX table', tex, `<label class="row"><input type="checkbox" id="wideTable" ${state.wideTable ? 'checked' : ''}/> span both columns (table*)</label>`)}
    ${box('matOut', 'MATLAB struct, SI units', matlabStruct(state.reg))}`;
}
