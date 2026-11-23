// Progress page: where the design is, what step and why, what was done and what comes next,
// with links to the workbench pages and the MATLAB scripts. Content: src/workbench/progress.js.

import { esc } from '../kit.js';
import { UPDATED, NOW, PHASES, DECIDED, OPEN, ASK } from '../progress.js';

const WORD = { done: 'done', now: 'now', next: 'next', later: 'later' };
const link = ([label, href]) => `<a href="${esc(href)}"${href.startsWith('#') ? '' : ' target="_blank" rel="noopener"'}>${esc(label)}</a>`;
const tag = (s) => `<span class="pg-tag pg-${s}">${WORD[s]}</span>`;

export const page = {
  id: 'progress',
  title: 'Progress',
  side() {
    return `<p class="ks pad">Updated ${esc(UPDATED)}. The same list is in WHERE_WE_ARE.md at the top of the repository.</p>`;
  },
  main() {
    const phases = PHASES.map((p) => `<section class="card wide pg-phase pg-${p.status}"><header><h3>${tag(p.status)} ${esc(p.title)}</h3></header><div class="cbody">
      <p class="cap">${esc(p.why)}</p>
      <ul class="pg-steps">${p.steps.map(([t, s, links]) => `<li class="pg-${s}">${tag(s)} <span>${esc(t)}</span> <span class="pg-links">${links.map(link).join(' · ')}</span></li>`).join('')}</ul>
    </div></section>`).join('');
    return `<section class="card wide pg-now"><header><h3>Now: ${esc(NOW.title)}</h3></header><div class="cbody"><p>${esc(NOW.why)}</p><p class="pg-links">${NOW.links.map(link).join(' · ')}</p></div></section>
      ${phases}
      <div class="grid2">
        <section class="card"><header><h3>Decided</h3></header><div class="cbody"><ul class="pg-steps">${DECIDED.map((d) => `<li>${tag('done')} ${esc(d)}</li>`).join('')}</ul></div></section>
        <section class="card"><header><h3>Open decisions</h3></header><div class="cbody"><ul class="pg-steps">${OPEN.map(([t, w, h]) => `<li><b>${esc(t)}</b>: ${esc(w)} <span class="pg-links">${link(['page', h])}</span></li>`).join('')}</ul></div></section>
      </div>
      <section class="card wide"><header><h3>Ask at the office</h3></header><div class="cbody"><ul class="pg-steps">${ASK.map((a) => `<li>${esc(a)}</li>`).join('')}</ul></div></section>`;
  },
  update() {},
};
