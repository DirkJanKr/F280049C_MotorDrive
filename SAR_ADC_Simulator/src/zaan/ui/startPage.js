// Start page: the thesis as a flow of questions, each with its live answer.

import { context } from './ctx.js';
import { eng, num, esc } from './fmt.js';
import { OPEN_ITEMS } from '../params.js';

const PLAN = [
  ['6 Nov', 'Architecture review', true],
  ['9 Nov', 'CDAC and reference'],
  ['16 Nov', 'Comparator'],
  ['23 Nov', 'Sampling switch'],
  ['30 Nov', 'SAR logic, IQ demodulator, integration'],
  ['14 Dec', 'Bias, output register'],
  ['Early Jan', 'Schematic review'],
  ['25 Jan', 'Full ADC integration'],
  ['31 Mar', 'Tape-out'],
];

export function startPage(state, chapters) {
  const { P, d, cells, tauMax } = context(state);
  const answers = {
    specs: `${eng(1 / P.fs, 's')} per sample, ${2 ** P.bits} levels, SNDR ${num(6.02 * P.enobAim + 1.76, 1)} dB`,
    beam: `${eng(tauMax, 's')} longest delay → ${cells.m} cells per channel`,
    sharing: `${d.decisions} decisions; node grows from ${eng(d.cNode[0], 'F')} to ${eng(d.cNode[d.cNode.length - 1], 'F')}`,
    cdac: `CDAC ${eng(d.cdac, 'F')}, memory cell ${eng(d.cm, 'F')}, ${num(d.area * 1e6, 3)} mm²`,
    redundancy: `${d.weights.slice(0, 3).map((w) => num(w, 0)).join(', ')} … LSB; first tolerance ${num(d.tol[0], 0)} LSB`,
    reference: `precharge once per conversion, no spikes during the decisions`,
    budget: 'all noise sources and every decision against 25 ns',
    chain: 'reflectors to envelope through this chip',
  };
  const flow = chapters
    .map((c) => `<a class="step" href="#${c.id}"><span class="sn">${c.n}</span><span class="sq">${esc(c.title)}</span><span class="sa">${esc(answers[c.id] || '')}</span></a>`)
    .join('');
  const plan = PLAN.map(([date, what, done]) => `<li class="${done ? 'done' : ''}"><span>${esc(date)}</span>${esc(what)}</li>`).join('');
  return `<section class="start-hero">
      <div class="eyebrow">Zaan · ABF + SAR ADC · BCD 180 nm · tape-out 31 March 2027</div>
      <h1>From echo to code, one question at a time</h1>
      <p class="lede">Each chapter follows your architecture review. Move a knob and every graph and number in that chapter follows; the results carry over to the next chapter.</p>
    </section>
    <section class="flow">${flow}</section>
    <section class="grid2">
      <div class="card"><h2>Plan to tape-out</h2><ol class="plan">${plan}</ol></div>
      <div class="card"><h2>Still open</h2><ul class="plain">${OPEN_ITEMS.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>
    </section>`;
}
