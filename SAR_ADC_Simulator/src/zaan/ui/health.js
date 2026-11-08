// The live strip under the header: the numbers that tell whether the design works.

import { buildDecisions } from '../decisions.js';
import { eng, num } from './fmt.js';

export function openDecisionCount(state) {
  return buildDecisions(state.reg).filter((d) => !d.info && state.decisions[d.id] === undefined).length;
}

export function healthStrip(state, b) {
  const m = b.margin95.bits;
  const open = openDecisionCount(state);
  const items = [
    ['Predicted ENOB', `${num(b.result.enob, 2)} bit`, m >= -1e-9 ? 'ok' : 'bad', '#budget'],
    ['Margin to 9.5', `${m >= 0 ? '+' : ''}${num(m, 3)} bit`, m >= -1e-9 ? 'ok' : 'bad', '#budget'],
    ['Time per decision', eng(b.timing.tDec, 's'), b.timing.tDec > 0 ? '' : 'bad', '#budget'],
    ['Open decisions', `${open}`, open ? 'warn' : 'ok', '#decisions'],
  ];
  return `<div class="health-inner">${items
    .map(([k, v, cls, href]) => `<a class="hm ${cls}" href="${href}"><span class="hk">${k}</span><span class="hv">${v}</span></a>`)
    .join('')}</div>`;
}
