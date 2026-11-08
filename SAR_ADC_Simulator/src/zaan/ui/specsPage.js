// Specifications: name, value, unit. Edit a value and everything that uses it follows.

import { GROUPS, OPEN_ITEMS } from '../params.js';
import { esc, estimateTag } from './fmt.js';
import { isEdited } from './state.js';

export function specsPage(state) {
  const groups = Object.entries(GROUPS).map(([g, title]) => {
    const rows = state.reg
      .filter((p) => p.group === g)
      .map((p) => {
        const ed = isEdited(p);
        return `<div class="spec">
          <label for="sp-${p.id}">${esc(p.label)} ${estimateTag(p.estimate)}${p.note ? `<small>${esc(p.note)}</small>` : ''}</label>
          <div class="specv"><input id="sp-${p.id}" type="number" step="any" min="${p.min}" max="${p.max}" data-param="${p.id}" value="${p.value}" class="${ed ? 'edited' : ''}"/><span class="unit">${esc(p.unit)}</span>${ed ? `<button class="linkbtn" data-reset="${p.id}">reset</button>` : ''}</div>
        </div>`;
      })
      .join('');
    return `<div class="card"><h2>${esc(title)}</h2><div class="specs">${rows}</div></div>`;
  });
  return `<header class="ch-head"><h1>All values</h1><p class="lede">Every knob of every chapter in one list. Edits are kept in this browser. <button class="linkbtn" data-resetall="1">Reset everything</button></p></header>${groups.join('')}
    <div class="card"><h2>Still open</h2><ul class="plain">${OPEN_ITEMS.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></div>`;
}
