// Design versions, JSON export/import, LaTeX and MATLAB export (with status and source).

import { store, saveVersion, deleteVersion, loadVersion, exportJson, importJson } from './state.js';
import { latexEscape } from '../zaan/exportFormats.js';
import { BLOCKS } from './values.js';
import { esc } from '../zaan/ui/fmt.js';

export function latexTable() {
  const rows = store.values.map((v) => [v.label, v.value === null ? '?' : String(v.value), v.unit || '', v.status, v.source].map(latexEscape).join(' & ') + ' \\\\');
  return ['\\begin{table*}[!t]', '\\centering', '\\caption{Zaan workbench values}', '\\label{tab:zaan-values}', '\\footnotesize', '\\begin{tabular}{l l l l l}', '\\hline', 'Parameter & Value & Unit & Status & Source \\\\', '\\hline', ...rows, '\\hline', '\\end{tabular}', '\\end{table*}'].join('\n');
}

export function matlabStruct() {
  const s = (x) => `'${String(x ?? '').replace(/'/g, "''")}'`;
  const lines = ['% Zaan workbench values, SI units. NaN = unknown (?).', 'zaan = struct();'];
  for (const v of store.values) {
    const val = v.kind === 'num' ? (v.value === null ? 'NaN' : String(Number((v.value * v.si).toPrecision(12)))) : s(v.value ?? '?');
    lines.push(`zaan.${v.id} = struct('value', ${val}, 'unit', ${s(v.siUnit || '')}, 'status', ${s(v.status)}, 'source', ${s(v.source)}, 'date', ${s(v.date)});`);
  }
  return lines.join('\n');
}

export function ioPanel() {
  const vers = store.versions.map((v) => `<li><b>${esc(v.name)}</b> <span class="cap">${esc(v.date.slice(0, 16).replace('T', ' '))}</span> <button class="mini" data-load="${esc(v.name)}">load</button> <button class="mini" data-del="${esc(v.name)}">delete</button></li>`).join('');
  return `<div class="iohead"><h2>Design versions and export</h2><button class="mini" data-close="1">close</button></div>
    <div class="iogrid">
      <section><h3>Save the current design</h3><div class="row"><input type="text" id="verName" placeholder="name, e.g. Cu 35 fF, VREF 200 mV"/><button class="mini" id="saveVer">save</button></div>
        <ul class="oq">${vers || '<li class="cap">No saved versions yet.</li>'}</ul>
        <p class="cap">Versions are kept in this browser and in the JSON file below, so nothing lives only in the browser.</p></section>
      <section><h3>JSON file (all versions and the current design)</h3><textarea id="jsonOut" readonly>${esc(exportJson())}</textarea>
        <div class="row"><button class="mini" data-copy="jsonOut">copy</button><a class="mini" id="jsonDl" download="zaan-workbench.json">download</a></div>
        <h3>Import</h3><input type="file" id="jsonFile" accept=".json,application/json"/><textarea id="jsonIn" placeholder="or paste a zaan-workbench JSON here"></textarea><button class="mini" id="doImport">import</button><p class="cap" id="ioMsg"></p></section>
      <section><h3>LaTeX table (IEEEtran)</h3><textarea id="texOut" readonly>${esc(latexTable())}</textarea><button class="mini" data-copy="texOut">copy</button>
        <h3>MATLAB struct</h3><textarea id="matOut" readonly>${esc(matlabStruct())}</textarea><button class="mini" data-copy="matOut">copy</button></section>
    </div>`;
}

export function bindIo(el, close) {
  el.addEventListener('click', (e) => {
    const b = e.target.closest('button,a');
    if (!b) return;
    if (b.dataset.close) close();
    else if (b.id === 'saveVer') {
      const name = el.querySelector('#verName').value.trim();
      if (name) saveVersion(name);
    } else if (b.dataset.load) loadVersion(b.dataset.load);
    else if (b.dataset.del) deleteVersion(b.dataset.del);
    else if (b.dataset.copy) {
      const ta = el.querySelector('#' + b.dataset.copy);
      if (navigator.clipboard) navigator.clipboard.writeText(ta.value).then(() => (b.textContent = 'copied'), () => ta.select());
      else ta.select();
    } else if (b.id === 'jsonDl') {
      b.href = URL.createObjectURL(new Blob([exportJson()], { type: 'application/json' }));
    } else if (b.id === 'doImport') {
      try {
        importJson(el.querySelector('#jsonIn').value);
        el.querySelector('#ioMsg').textContent = 'Imported.';
      } catch (err) {
        el.querySelector('#ioMsg').textContent = `Could not import: ${err.message}`;
      }
    }
  });
  el.addEventListener('change', (e) => {
    if (e.target.id !== 'jsonFile' || !e.target.files[0]) return;
    e.target.files[0].text().then((txt) => {
      try {
        importJson(txt);
        el.querySelector('#ioMsg').textContent = 'Imported.';
      } catch (err) {
        el.querySelector('#ioMsg').textContent = `Could not import: ${err.message}`;
      }
    });
  });
}

export { BLOCKS };
