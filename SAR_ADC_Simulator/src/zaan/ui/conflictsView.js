// Conflicts panel: shown, never resolved.

import { buildConflicts } from '../conflicts.js';
import { esc, pill } from './fmt.js';

export function conflictsView(state) {
  const cards = buildConflicts(state.reg).map((c) => {
    const chooser = c.chooser
      ? `<h3>Basis for the noise budget of phase 4</h3><div class="row">${[10, 9.5, 9]
          .map((e) => `<label><input type="radio" name="enobBasis" value="${e}" ${state.enobBasis === e ? 'checked' : ''}/> ENOB ${e}</label>`)
          .join('')}</div>`
      : '';
    return `<div class="card conflict ${c.status === 'D' ? 'derived' : ''}"><h2>${esc(c.id)}. ${esc(c.title)} ${pill(c.status)}</h2>
      <div class="formula">${c.lines.map(esc).join('\n')}</div>
      <h3>Branches and what they cost</h3><ul class="plain">${c.branches.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>${chooser}</div>`;
  });
  return `<div class="card"><p>Conflicts 1 to 4 come from your notes. F5 to F8 are mine, derived, and need your confirmation before anything builds on them. Every number follows the registry.</p></div>${cards.join('')}`;
}
