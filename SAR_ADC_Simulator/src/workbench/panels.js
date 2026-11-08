// Values bar, parameters panel, inspector and open questions.

import { BLOCKS, STATUS, OPEN_DECISIONS } from './values.js';
import { ELEMENTS } from './elements.js';
import { store } from './state.js';
import { eng, num, esc } from '../zaan/ui/fmt.js';
import { termify } from './terms.js';

export function badge(status) {
  const cls = status === 'S*' ? 'Ss' : status === '?' ? 'q' : status;
  return `<span class="badge st-${cls}" data-tip="${esc(STATUS[status] || '')}">${esc(status)}</span>`;
}

/** Display a derived entry value with its unit. */
export function showDerived(e) {
  if (e.value === null || e.value === undefined || !Number.isFinite(e.value)) return '?';
  if (e.unitShow) return `${num(e.value * (e.scale || 1), 4)} ${e.unitShow}`;
  if (e.unit === '%') return `${num(e.value * (e.scale || 1), 3)} %`;
  if (['F', 's', 'V', 'C', 'A', 'Ω'].includes(e.unit)) return eng(e.value, e.unit, 3);
  if (e.unit === 'V rms') return `${eng(e.value, 'V', 3)} rms`;
  return `${num(e.value, 3)}${e.unit ? ` ${e.unit}` : ''}`;
}

function showValue(v) {
  if (v.value === null || v.value === '') return '?';
  return `${v.kind === 'num' ? num(v.value, 4) : esc(v.value)}${v.unit ? ` ${v.unit}` : ''}`;
}

// ---------------- values bar ----------------
export function valuesBar(ctx) {
  const g = (id) => store.values.find((x) => x.id === id);
  const { D, P, d, timing } = ctx;
  const worst = timing.totals[timing.totals.length - 1];
  const items = [
    ['fs', showValue(g('fs')), g('fs').status, false, 'clk'],
    ['delay step', showValue(g('delayStep')), g('delayStep').status, false, 'clk180'],
    ['channels', showValue(g('channels')), g('channels').status, false, 'bf'],
    ['cells per channel', `${showValue(g('memCells'))} <small>needs ${ctx.need.m}</small>`, g('memCells').status, (P.memCells ?? 0) < ctx.need.m, 'cell'],
    ['raw decisions', `${showValue(g('rawDecisions'))} <small>weights give ${d.decisions}</small>`, g('rawDecisions').status, (g('rawDecisions').value ?? d.decisions) !== d.decisions, 'logic'],
    ['output bits', showValue(g('bits')), g('bits').status, false, 'comb'],
    ['Cu', showValue(g('cu')), g('cu').status, false, 'cdacP'],
    ['CDAC', showDerived(D.cdac), 'D', false, 'cdacP'],
    ['memory cell', showDerived(D.cm), 'D', false, 'cell'],
    ['VREF', showValue(g('vref')), g('vref').status, false, 'ref'],
    ['full scale', showValue(g('fullScale')), g('fullScale').status, false, 'lna'],
    ['ENOB', `<b>${num(ctx.enob.enob, 2)}</b> <small>aim ${num(P.enobAim, 1)}</small>`, 'D', ctx.enob.enob < P.enobAim, 'sys'],
    ['conversion', `${eng(timing.median, 's')} <small>worst ${eng(worst, 's')} of ${eng(ctx.tw, 's')}</small>`, 'D', worst > ctx.tw, 'logic'],
    ['ADC area', showDerived(D.area), 'D', false, 'cdacP'],
  ];
  return items.map(([k, v, s, bad, el]) => `<button class="vb ${bad ? 'bad' : ''}" data-sel="${el}"><span class="vk">${esc(k)}</span><span class="vv">${v}</span>${badge(s)}</button>`).join('');
}

// ---------------- parameters ----------------
function inputFor(v) {
  if (v.kind === 'choice') return `<select data-val="${v.id}" aria-label="${esc(v.label)}"><option value="" ${v.value === null ? 'selected' : ''}>?</option>${v.options.map((o) => `<option ${o === v.value ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
  if (v.kind === 'text') return `<input type="text" data-val="${v.id}" value="${esc(v.value ?? '')}" placeholder="?" aria-label="${esc(v.label)}"/>`;
  return `<input type="number" step="any" data-val="${v.id}" value="${v.value ?? ''}" placeholder="?" aria-label="${esc(v.label)}" class="${v.value === null ? 'q' : ''}"/>`;
}

export function valueRow(v, used) {
  return `<div class="prow ${v.value === null ? 'unknown' : ''}" id="row-${v.id}">
    <div class="pl"><button class="lnk" data-sel="val:${v.id}">${termify(v.label, used)}</button>${badge(v.status)}</div>
    <div class="pv">${inputFor(v)}<span class="pu">${esc(v.unit || '')}</span></div>
    <div class="ps"><input type="text" class="src" data-src="${v.id}" value="${esc(v.source)}" aria-label="source of ${esc(v.label)}"/>${v.date ? `<span class="pd">${esc(v.date)}</span>` : ''}</div>
  </div>`;
}

export function derivedRow(e) {
  const key = e.unlock;
  const ov = key && store.overrides[key] !== undefined;
  const val = ov ? `<input type="number" step="any" data-ovr="${key}" data-unit="${e.unit}" value="${e.unit === 'F' ? store.overrides[key] * 1e15 : store.overrides[key]}"/><span class="pu">${e.unit === 'F' ? 'fF' : ''}</span>` : `<span class="dv">${showDerived(e)}</span>`;
  return `<div class="prow derived"><div class="pl"><button class="lnk" data-sel="der:${e.id}">${esc(e.label)}</button>${badge(ov ? 'U' : 'D')}</div><div class="pv">${val}${key ? `<button class="mini lock" data-unlock="${key}" data-cur="${e.value}" title="${ov ? 'Lock: use the formula again' : 'Unlock to type over the derived value'}">${ov ? 'lock' : 'unlock'}</button>` : ''}</div></div>`;
}

export function paramsPanel(ctx) {
  const open = store.ui.openGroups || ['system', 'cdac'];
  const used = new Set();
  return Object.entries(BLOCKS)
    .map(([b, title]) => {
      const rows = store.values.filter((v) => v.block === b).map((v) => valueRow(v, used)).join('');
      const der = Object.values(ctx.D).filter((e) => e.block === b).map(derivedRow).join('');
      const nq = store.values.filter((v) => v.block === b && v.value === null).length;
      return `<details class="pgroup" data-group="${b}" ${open.includes(b) ? 'open' : ''}><summary>${esc(title)}${nq ? ` <span class="qcount">${nq} ?</span>` : ''}</summary>${rows}${der ? `<div class="dhead">Derived</div>${der}` : ''}</details>`;
    })
    .join('');
}

// ---------------- inspector ----------------
export function inspector(ctx) {
  const sel = store.ui.sel || 'sys';
  const used = new Set();
  if (sel.startsWith('val:')) {
    const v = store.values.find((x) => x.id === sel.slice(4));
    if (!v) return '';
    const users = Object.entries(ELEMENTS).filter(([, e]) => e.values.includes(v.id)).map(([id, e]) => `<button class="chip" data-sel="${id}">${esc(e.name)}</button>`).join('');
    return `<h2>${termify(v.label, used)} ${badge(v.status)}</h2>
      <div class="ibig">${showValue(v)}</div>
      ${valueRow(v, used)}
      <dl><dt>Source</dt><dd>${esc(v.source)}${v.date ? ` · ${esc(v.date)}` : ''}</dd>${v.note ? `<dt>Note</dt><dd>${esc(v.note)}</dd>` : ''}<dt>Status</dt><dd>${esc(STATUS[v.status])}</dd></dl>
      ${users ? `<h4>Used by</h4><div class="chips">${users}</div>` : ''}`;
  }
  if (sel.startsWith('der:')) {
    const e = ctx.D[sel.slice(4)];
    if (!e) return '';
    return `<h2>${termify(e.label, used)} ${badge('D')}</h2><div class="ibig">${showDerived(e)}</div><h4>Formula, with your numbers</h4><div class="math">${e.formula}</div><p class="cap">Derived from the values on the left; every symbol is one of them or a constant (k = 1.381e-23 J/K).</p>`;
  }
  const el = ELEMENTS[sel] || ELEMENTS.sys;
  const vals = el.values.map((id) => store.values.find((x) => x.id === id)).filter(Boolean).map((v) => valueRow(v, used)).join('');
  const der = el.derived.map((id) => ctx.D[id]).filter(Boolean).map((e) => `<div class="drow"><button class="lnk" data-sel="der:${e.id}">${esc(e.label)}</button> <b>${showDerived(e)}</b> ${badge('D')}<div class="math">${e.formula}</div></div>`).join('');
  return `<h2>${esc(el.name)} ${badge(el.status)}</h2>
    <p class="what">${termify(el.what, used)}</p>
    <dl><dt>Structure from</dt><dd>${esc(el.source)}</dd></dl>
    ${vals ? `<h4>Values</h4>${vals}` : ''}
    ${der ? `<h4>Derived, with formulas</h4>${der}` : ''}`;
}

// ---------------- open questions ----------------
export function openQuestions(ctx) {
  const elOf = (vid) => Object.entries(ELEMENTS).find(([, e]) => e.values.includes(vid))?.[0] || 'sys';
  const unknown = store.values.filter((v) => v.value === null || v.status === '?');
  const decided = (id) => {
    const v = store.values.find((x) => x.id === id);
    return v && v.value !== null && v.status !== '?';
  };
  return `<h3>Open decisions</h3><ul class="oq">${OPEN_DECISIONS.map((o) => `<li class="${decided(o.value) ? 'done' : ''}"><button class="lnk" data-sel="${o.el}" data-focus="${o.value}">${esc(o.title)}</button>${decided(o.value) ? ' <span class="badge st-U">set</span>' : ' <span class="badge st-q">?</span>'}</li>`).join('')}</ul>
    <h3>Conflicts to resolve</h3><ul class="oq">${ctx.conflicts.map((c) => `<li><button class="lnk" data-sel="${c.el}"><b>${esc(c.title)}</b></button><div class="cap">${esc(c.body)}</div></li>`).join('')}</ul>
    <h3>Unknown values (${unknown.length})</h3><ul class="oq">${unknown.map((v) => `<li><button class="lnk" data-sel="${elOf(v.id)}" data-focus="${v.id}">${esc(v.label)}</button> <span class="cap">${esc(BLOCKS[v.block])}</span></li>`).join('')}</ul>`;
}
