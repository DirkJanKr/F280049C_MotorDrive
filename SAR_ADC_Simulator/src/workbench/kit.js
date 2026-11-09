// Small UI helpers shared by the pages: knobs, cards, readouts, plots.

import { linePlot } from '../ui/plot.js';
import { bars as barsChart } from '../zaan/ui/charts.js';
import { eng, num, esc } from '../zaan/ui/fmt.js';
import { termify } from './terms.js';

export { eng, num, esc };

let uid = 0;
export function plot(spec, w) {
  return linePlot({ id: `w${++uid}`, height: 230, ...spec, width: Math.max(300, w) });
}
export function bars(o, w) {
  return barsChart({ ...o, width: Math.max(300, w) });
}

export const COL = { an: 'var(--an)', ref: 'var(--ref)', clk: 'var(--clk)', dig: 'var(--dig)', cal: 'var(--cal)', muted: 'var(--muted)', bad: 'var(--bad)', ink: 'var(--ink)' };

function decimals(step) {
  const s = String(step);
  return s.includes('.') ? s.split('.')[1].length : 0;
}

/** Slider plus number field for one value; both stay in sync. Empty field = not set. */
export function knob(v, used = new Set()) {
  if (v.kind === 'choice' && v.options.join('').length > 34) {
    return `<div class="knob"><div class="kl kcol"><label for="c-${v.id}">${termify(v.label, used)}</label><select id="c-${v.id}" class="sel" data-choicesel="${v.id}">${v.options.map((o) => `<option ${o === v.value ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select></div>${v.source || v.note ? `<div class="ks">${esc([v.source, v.note].filter(Boolean).join(' · '))}</div>` : ''}</div>`;
  }
  if (v.kind === 'choice') {
    return `<div class="knob"><div class="kl">${termify(v.label, used)}</div><div class="seg">${v.options
      .map((o) => `<button class="${o === v.value ? 'on' : ''}" data-choice="${v.id}" data-opt="${esc(o)}">${esc(o)}</button>`)
      .join('')}</div></div>`;
  }
  const set = v.value !== null && v.value !== '';
  const val = set ? v.value : v.min;
  return `<div class="knob ${set ? '' : 'unset'}">
    <div class="kl"><label for="n-${v.id}">${termify(v.label, used)}</label><span class="kv"><input type="number" id="n-${v.id}" data-num="${v.id}" value="${set ? +Number(v.value).toFixed(decimals(v.step) + 2) : ''}" placeholder="not set" step="any"/><span class="ku">${esc(v.unit || '')}</span></span></div>
    <input type="range" data-range="${v.id}" min="${v.min}" max="${v.max}" step="${v.step}" value="${val}" ${set ? '' : 'class="dim"'} aria-label="${esc(v.label)}"/>
    ${v.source || v.note ? `<div class="ks">${esc([v.source, v.note].filter(Boolean).join(' · '))}</div>` : ''}
  </div>`;
}

export function group(title, inner, open = true) {
  return `<details class="kg" ${open ? 'open' : ''}><summary>${esc(title)}</summary>${inner}</details>`;
}

export function knobs(values, ids, used) {
  return ids.map((id) => knob(values.find((v) => v.id === id), used)).join('');
}

export function card(id, title, extra = '', cls = '') {
  return `<section class="card ${cls}"><header><h3>${esc(title)}</h3>${extra}</header><div class="cbody" id="${id}"></div><p class="cap" id="${id}-cap"></p></section>`;
}

export function fill(id, html, cap = null) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
  if (cap !== null) {
    const c = document.getElementById(`${id}-cap`);
    if (c) c.innerHTML = cap;
  }
}

export function widthOf(id, fallback = 600) {
  const el = document.getElementById(id);
  return el && el.clientWidth ? el.clientWidth - 2 : fallback;
}

/** A charge shown as the user chose: in fC, or as the voltage it means at the input (Q / (N CM)). */
export function fq(ctx, q, rms = false) {
  const tail = rms ? ' rms' : '';
  if (ctx.ui && ctx.ui.qUnit === 'V') return `${eng(q / ctx.d.cNode[0], 'V')}${tail}`;
  return `${Number((q * 1e15).toPrecision(3))} fC${tail}`;
}

/** Unit label for tables: fC or µV at the input. */
export function qUnitLabel(ctx) {
  return ctx.ui && ctx.ui.qUnit === 'V' ? 'µV rms at the input' : 'fC rms';
}

/** A value that opens its formula when clicked. */
export function fv(id, text) {
  return `<button class="fv" data-f="${id}" title="show the formula">${text}</button>`;
}

/** Readout tiles: [label, value html, sub text, class, formula id]. */
export function readouts(items) {
  return `<div class="ros">${items.map(([k, v, s, cls, f]) => `<div class="ro ${cls || ''}"><span class="rk">${esc(k)}</span><span class="rv">${f ? fv(f, v) : v}</span>${s ? `<span class="rs">${s}</span>` : ''}</div>`).join('')}</div>`;
}

export function explain(title, paragraphs) {
  return `<section class="explain"><h3>${esc(title)}</h3>${paragraphs.map((p) => `<p>${p}</p>`).join('')}</section>`;
}
