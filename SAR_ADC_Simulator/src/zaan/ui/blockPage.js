// One page per block of the chain: what it does, with your numbers, and what comes next.

import { BLOCKS, PHASES, chainDiagram, blockStory } from './chain.js';
import { esc } from './fmt.js';

export function blockPage(state, id) {
  const blk = BLOCKS.find((x) => x.id === id);
  // Story lines are generated text or typeset formulas (no user input), so they are inserted as HTML.
  const story = blockStory(id, state.reg).map((x) => (x.startsWith('<div') ? x : `<p>${x}</p>`)).join('');
  const phase = PHASES.find((p) => p.n === blk.phase);
  const status = !blk.mine
    ? '<p class="note">Outside the converter. Shown for context.</p>'
    : `<div class="soon"><b>Interactive model:</b> phase ${phase.n}, ${esc(phase.name)} (${esc(phase.when)}). Until then this page explains the block; the budget page already holds its numbers.</div>`;
  const idx = BLOCKS.indexOf(blk);
  const prev = BLOCKS[idx - 1];
  const next = BLOCKS[idx + 1];
  return `
  <section class="hero slim">${chainDiagram(id)}</section>
  <section class="card prose">
    <h1>${esc(blk.name)}</h1>
    ${story}
    ${status}
    <div class="pager">${prev ? `<a href="#${prev.id}">Previous: ${esc(prev.name)}</a>` : '<span></span>'}${next ? `<a href="#${next.id}">Next: ${esc(next.name)}</a>` : ''}</div>
  </section>`;
}
