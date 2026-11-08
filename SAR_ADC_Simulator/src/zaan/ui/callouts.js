import { esc } from './fmt.js';

/** Amber box: a contradiction or an open choice, with what each side costs. */
export function check(title, body) {
  return `<aside class="callout check"><b>${esc(title)}</b><div>${body}</div></aside>`;
}

/** Teal box: what the result means for the design. */
export function insight(title, body) {
  return `<aside class="callout insight"><b>${esc(title)}</b><div>${body}</div></aside>`;
}

/** Big number readouts. items: [label, value, sub]. */
export function readouts(id) {
  return `<div class="readouts" id="${id}"></div>`;
}

export function fillReadouts(el, items) {
  if (!el) return;
  el.innerHTML = items.map(([k, v, s, cls]) => `<div class="ro ${cls || ''}"><span class="rk">${esc(k)}</span><span class="rv">${v}</span>${s ? `<span class="rs">${s}</span>` : ''}</div>`).join('');
}
