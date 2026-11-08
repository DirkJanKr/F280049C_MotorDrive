// Decisions: questions from your notes, with the numbers and what each option costs.

import { buildDecisions } from '../decisions.js';
import { esc } from './fmt.js';

export function decisionsPage(state) {
  const cards = buildDecisions(state.reg).map((d) => {
    const chosen = state.decisions[d.id];
    const opts = d.options
      .map((o) => {
        const on = chosen !== undefined && String(chosen) === String(o.value);
        return `<button class="opt ${on ? 'on' : ''}" data-decide="${d.id}" data-value="${esc(o.value)}" aria-pressed="${on}"><b>${esc(o.label)}</b><span>${esc(o.cost)}</span></button>`;
      })
      .join('');
    const state_ = d.info ? '<span class="chip">information</span>' : chosen !== undefined ? '<span class="chip ok">decided</span>' : '<span class="chip warn">open</span>';
    return `<article class="card decision">
      <div class="dhead"><h2>${esc(d.question)}</h2>${state_}</div>
      <p>${esc(d.why)}</p>
      <details ${chosen === undefined ? 'open' : ''}><summary>Show the numbers</summary><div class="math">${d.math.join('')}</div></details>
      ${opts ? `<div class="opts">${opts}</div>` : ''}
      <p class="note">Used by: ${esc(d.usedBy)}${chosen !== undefined ? ' <button class="linkbtn" data-undecide="' + d.id + '">undo choice</button>' : ''}</p>
    </article>`;
  });
  return `<section class="intro"><h1>Decisions to make</h1><p class="lede">Where your notes disagree or a choice is still open. Nothing is chosen for you; each option says what it costs.</p></section>${cards.join('')}`;
}
