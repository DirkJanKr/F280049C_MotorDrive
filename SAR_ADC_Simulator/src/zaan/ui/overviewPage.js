// Overview: the chain, the schedule, and where to start.

import { OPEN_ITEMS } from '../params.js';
import { chainDiagram, PHASES } from './chain.js';
import { esc, num } from './fmt.js';
import { openDecisionCount } from './health.js';

export function overviewPage(state, b) {
  const open = openDecisionCount(state);
  const phases = PHASES.map((p) => `<li class="${p.n === 1 ? 'done' : p.n === 2 ? 'next' : ''}"><span class="pn">${p.n}</span><span class="pt">${esc(p.name)}</span><span class="pw">${esc(p.when)}</span></li>`).join('');
  const openItems = OPEN_ITEMS.map((t) => `<li>${esc(t)}</li>`).join('');
  return `
  <section class="hero">
    <h1>Design and understand your converter, one block at a time</h1>
    <p class="lede">Tap a block to see what it does with your numbers. The strip at the top updates as you change the design.</p>
    ${chainDiagram()}
  </section>
  <section class="grid3">
    <a class="card link" href="#budget"><h2>Noise and timing budget</h2><p>Split the noise that ENOB ${num(b.targetEnob, 1)} allows over the blocks, and see how much time each of the ${b.n} decisions gets in 25 ns.</p><span class="go">Open budget</span></a>
    <a class="card link" href="#decisions"><h2>Decisions to make</h2><p>${open ? `${open} open questions where your notes disagree or a choice is needed, each with what it costs.` : 'All questions answered.'}</p><span class="go">Open decisions</span></a>
    <a class="card link" href="#specs"><h2>Specifications</h2><p>All your numbers in one place. Change one and everything that uses it follows.</p><span class="go">Open specifications</span></a>
  </section>
  <section class="grid2">
    <div class="card"><h2>Thesis schedule</h2><ol class="phases">${phases}</ol></div>
    <div class="card"><h2>Still open in the design</h2><ul class="plain">${openItems}</ul></div>
  </section>`;
}
