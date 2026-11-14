// Values page: every value in one list, design versions, and export.

import { NAME } from '../names.js';
import { GROUPS, STATUS } from '../values.js';
import { eng, num, tidyTables } from '../kit.js';
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
      const rows = store.values.filter((v) => v.group === g).map((v) => `<tr><td><select class="stsel st-${v.status}" data-statv="${v.id}" aria-label="status">${Object.keys(STATUS).map((k) => `<option ${k === v.status ? 'selected' : ''}>${k}</option>`).join('')}</select></td><td>${esc(v.label)}</td><td>${v.kind === 'choice' ? `<select data-choicesel="${v.id}" aria-label="${esc(v.label)}">${v.options.map((o) => `<option ${o === v.value ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>` : `<input type="number" step="any" data-num="${v.id}" value="${v.value ?? ''}" placeholder="not set" aria-label="${esc(v.label)}"/>`}</td><td>${esc(v.unit || '')}</td><td><input type="text" class="srcin" data-srcv="${v.id}" value="${esc(v.source || '')}"/></td></tr>`).join('');
      return `<section class="card"><header><h3>${esc(title)}</h3><button class="mini" data-resetg="${g}">reset group</button></header><div class="tablewrap"><table class="tbl vt"><thead><tr><th>Status</th><th>Value</th><th></th><th>Unit</th><th>Source</th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
    });
    const vers = store.versions.map((v) => `<li><b>${esc(v.name)}</b> <span class="cap">${esc(v.date.slice(0, 16).replace('T', ' '))}</span> <button class="mini" data-loadv="${esc(v.name)}">load</button> <button class="mini" data-delv="${esc(v.name)}">delete</button></li>`).join('');
    const c = store.ctx;
    const dv = [
      ['V REF', eng(c.P.vref, 'V'), 'alpha · V in,max / 2, with the alpha, input', 'Chen 2018 eq. 3 with Rabuske 2017 eq. 4.58'],
      [NAME.cdacBalance, eng(c.P.cdacBalance, 'F'), 'N · C M / (2 · alpha), with the alpha, input', 'Chen 2018 eq. 3'],
      ['Q FS', eng(c.d.qFs, 'C'), 'N · C M · V in,max', 'Q+ − Q−, peak to peak'],
      ['Q LSB', eng(c.d.qLsb, 'C'), 'Q FS / 2^B', ''],
      ['Unit capacitor C u', eng(c.P.cu, 'F'), 'n u · Q LSB / (2 · V REF)', 'one unit moves 2 V REF C u = n u LSB'],
      [NAME.cdac, eng(c.d.cdac, 'F'), 'units · C u', `${num(c.d.units, 2)} units; the halving capacitors start empty`],
      [NAME.cdacEff, eng(c.d.cdacEff, 'F'), 'Σ w / n u · C u', `${num(c.d.sumW / c.P.lsbPerUnit, 2)} units carry charge`],
      [NAME.alphaW, num(c.d.alpha, 3), `N · C M / (2 · ${NAME.cdacEff})`, 'Rabuske 2017 eq. 4.58'],
      [NAME.alphaEff, num(c.d.alphaEff, 3), `N · C M / (2 · ${NAME.cdacEff} + C par)`, 'Rabuske 2017 eq. 4.21 and 4.58 with C par on the node (eq. 4.13); equal to the one above while C par = 0'],
      ['σ of one unit capacitor', `${num(c.sigmaU * 100, 3)} %`, 'pair σ / √2 · √(35 fF · ρ / (2 fF/µm² · C u))', 'PDK area scaling: the pair figure is for 35 fF at 2 fF/µm², ρ is the capacitor density'],
      ['Longest delay', eng(c.tauMax, 's'), '(N − 1) · pitch · sin θ / c', ''],
    ];
    const legend = `<section class="card wide"><header><h3>Status of every value</h3></header><p class="cap" style="margin:0">${Object.entries(STATUS).map(([k, t]) => `<span class="stat st-${k}">${k}</span> ${esc(t)}`).join(' &nbsp; ')}. No value is decided unless it is marked U. Change a status with the selector in front of a value.</p>
      <div class="tablewrap"><table class="tbl"><thead><tr><th>Status</th><th>Derived value</th><th></th><th>Derivation</th><th>Note</th></tr></thead><tbody>${dv.map(([a, b, f, n]) => `<tr><td><span class="stat st-D">D</span></td><td>${a}</td><td class="num">${b}</td><td>${f}</td><td class="dim">${esc(n)}</td></tr>`).join('')}</tbody></table></div></section>`;
    return `${legend}<div class="vcols">${groups.join('')}</div>
      <div class="grid2">
        <section class="card"><header><h3>Design versions</h3></header><div class="row"><input type="text" id="verName" placeholder="name, e.g. radix 1.9, Cu 35 fF"/><button class="mini" id="saveVer">save current</button></div><ul class="vlist">${vers || '<li class="cap">No versions saved yet.</li>'}</ul>
          <h4>JSON file (current design and all versions)</h4><textarea id="jsonOut" readonly>${esc(exportJson())}</textarea><div class="row"><button class="mini" data-copy="jsonOut">copy</button><a class="mini" id="jsonDl" download="zaan-workbench.json">download</a></div>
          <h4>Import</h4><input type="file" id="jsonFile" accept=".json,application/json"/><textarea id="jsonIn" placeholder="or paste a zaan-workbench JSON here"></textarea><button class="mini" id="doImport">import</button><p class="cap" id="ioMsg"></p></section>
        <section class="card"><header><h3>LaTeX table and MATLAB struct</h3></header><textarea id="texOut" readonly>${esc(latex(store))}</textarea><button class="mini" data-copy="texOut">copy LaTeX</button><textarea id="matOut" readonly>${esc(matlab(store))}</textarea><button class="mini" data-copy="matOut">copy MATLAB</button></section>
      </div>`;
  },
  update() {
    tidyTables(document);
  },
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
