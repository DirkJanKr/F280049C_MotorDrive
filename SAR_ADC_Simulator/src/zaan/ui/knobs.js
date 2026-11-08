// Slider knobs bound to the specifications (data-param) or to page-only values (data-ui).

import { esc, estimateTag } from './fmt.js';

function decimals(step) {
  const s = String(step);
  return s.includes('.') ? s.split('.')[1].length : 0;
}

export function showValue(v, step, unit) {
  return `${Number(v).toFixed(decimals(step))}${unit ? ` ${unit}` : ''}`;
}

/** Knob for a specification. */
export function knob(state, id, label = null) {
  const p = state.reg.find((x) => x.id === id);
  return `<div class="knob">
    <div class="kl"><label for="k-${id}">${esc(label || p.label)}</label>${estimateTag(p.estimate)}<output id="o-${id}">${showValue(p.value, p.step, p.unit)}</output></div>
    <input type="range" id="k-${id}" data-param="${id}" min="${p.min}" max="${p.max}" step="${p.step}" value="${p.value}"/>
    ${p.note ? `<div class="kn">${esc(p.note)}</div>` : ''}
  </div>`;
}

/** Knob for a page-only value kept in state.ui. */
export function uiKnob(state, id, { label, min, max, step, unit = '', note = '' }) {
  const v = state.ui[id];
  return `<div class="knob">
    <div class="kl"><label for="k-${id}">${esc(label)}</label><output id="o-${id}">${showValue(v, step, unit)}</output></div>
    <input type="range" id="k-${id}" data-ui="${id}" data-unit="${esc(unit)}" min="${min}" max="${max}" step="${step}" value="${v}"/>
    ${note ? `<div class="kn">${esc(note)}</div>` : ''}
  </div>`;
}

export function knobGroup(title, html) {
  return `<div class="kgroup"><div class="kgt">${esc(title)}</div>${html}</div>`;
}
