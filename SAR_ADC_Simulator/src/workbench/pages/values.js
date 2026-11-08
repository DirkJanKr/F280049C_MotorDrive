// Values page: every value in one list, design versions, and export.

import { GROUPS } from '../values.js';
import { exportJson } from '../store.js';
import { latexEscape } from '../../zaan/exportFormats.js';
import { esc } from '../kit.js';

export const page = {
  id: 'values',
  title: 'Values',
  side() {
    return '';
  },
  main(store) {
    const groups = Object.entries(GROUPS).map(([g, title]) => {
      const rows = store.values.filter((v) => v.group === g).map((v) => `<tr><td>${esc(v.label)}</td><td>${v.kind === 'choice' ? `<select data-choicesel="${v.id}">${v.options.map((o) => `<option ${o === v.value ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>` : `<input type="number" step="any" data-num="${v.id}" value="${v.value ?? ''}" placeholder="not set"/>`}</td><td>${esc(v.unit || '')}</td><td><input type="text" class="srcin" data-srcv="${v.id}" value="${esc(v.source || '')}"/></td></tr>`).join('');
      return `<section class="card"><header><h3>${esc(title)}</h3><button class="mini" data-resetg="${g}">reset group</button></header><div class="tablewrap"><table class="tbl vt"><thead><tr><th>Value</th><th></th><th>Unit</th><th>Source</th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
    });
    const vers = store.versions.map((v) => `<li><b>${esc(v.name)}</b> <span class="cap">${esc(v.date.slice(0, 16).replace('T', ' '))}</span> <button class="mini" data-loadv="${esc(v.name)}">load</button> <button class="mini" data-delv="${esc(v.name)}">delete</button></li>`).join('');
    return `<div class="grid2">${groups.join('')}</div>
      <div class="grid2">
        <section class="card"><header><h3>Design versions</h3></header><div class="row"><input type="text" id="verName" placeholder="name, e.g. radix 1.9, Cu 35 fF"/><button class="mini" id="saveVer">save current</button></div><ul class="vlist">${vers || '<li class="cap">No versions saved yet.</li>'}</ul>
          <h4>JSON file (current design and all versions)</h4><textarea id="jsonOut" readonly>${esc(exportJson())}</textarea><div class="row"><button class="mini" data-copy="jsonOut">copy</button><a class="mini" id="jsonDl" download="zaan-workbench.json">download</a></div>
          <h4>Import</h4><input type="file" id="jsonFile" accept=".json,application/json"/><textarea id="jsonIn" placeholder="or paste a zaan-workbench JSON here"></textarea><button class="mini" id="doImport">import</button><p class="cap" id="ioMsg"></p></section>
        <section class="card"><header><h3>LaTeX table and MATLAB struct</h3></header><textarea id="texOut" readonly>${esc(latex(store))}</textarea><button class="mini" data-copy="texOut">copy LaTeX</button><textarea id="matOut" readonly>${esc(matlab(store))}</textarea><button class="mini" data-copy="matOut">copy MATLAB</button></section>
      </div>`;
  },
  update() {},
};

function latex(store) {
  const rows = store.values.map((v) => [v.label, v.value === null ? 'not set' : String(v.value), v.unit || '', v.source || ''].map(latexEscape).join(' & ') + ' \\\\');
  return ['\\begin{table*}[!t]', '\\centering', '\\caption{Zaan workbench values}', '\\label{tab:zaan-values}', '\\footnotesize', '\\begin{tabular}{l l l l}', '\\hline', 'Parameter & Value & Unit & Source \\\\', '\\hline', ...rows, '\\hline', '\\end{tabular}', '\\end{table*}'].join('\n');
}

function matlab(store) {
  const s = (x) => `'${String(x ?? '').replace(/'/g, "''")}'`;
  const lines = ['% Zaan workbench values in SI units. NaN = not set.', 'zaan = struct();'];
  for (const v of store.values) {
    const val = v.kind === 'num' ? (v.value === null ? 'NaN' : String(Number((v.value * v.si).toPrecision(12)))) : s(v.value);
    lines.push(`zaan.${v.id} = ${val}; % ${v.siUnit || ''} ${v.label}${v.source ? `, ${v.source}` : ''}`);
  }
  if (store.ui.weightMode === 'custom') lines.push(`zaan.weightsLSB = [${store.ui.customWeights}];`);
  return lines.join('\n');
}
