// The receive chain: block list, diagram, and the plain explanation of each block
// written with the current project numbers.

import { si } from '../params.js';
import { esc, eng, num } from './fmt.js';
import { v, t, frac, eq } from './math.js';

export const PHASES = [
  { n: 1, name: 'Specifications, decisions, budget', when: 'done' },
  { n: 2, name: 'Charge-sharing CDAC and reference', when: 'from 9 Nov' },
  { n: 3, name: 'Comparator and self-timed timing', when: '16 Nov' },
  { n: 4, name: 'Sampling switch and noise', when: '23 Nov' },
  { n: 5, name: 'Beamformer (memory capacitors, delays)', when: 'after 23 Nov' },
  { n: 6, name: 'SAR logic, calibration and combiner', when: '30 Nov block' },
  { n: 7, name: 'IQ demodulator and full chain', when: '30 Nov block' },
];

export const BLOCKS = [
  { id: 'pmut', name: 'PMUT tile', short: '16 elements', phase: null, mine: false },
  { id: 'lna', name: 'Front end', short: 'LNA, 30 dB', phase: null, mine: false },
  { id: 'memory', name: 'Memory caps', short: 'delay by storage', phase: 5, mine: true },
  { id: 'sum', name: 'Charge sum', short: 'delay and sum', phase: 5, mine: true },
  { id: 'cdac', name: 'CDAC', short: 'charge sharing', phase: 2, mine: true },
  { id: 'comparator', name: 'Comparator', short: 'self-timed', phase: 3, mine: true },
  { id: 'logic', name: 'SAR logic', short: '12 raw decisions', phase: 6, mine: true },
  { id: 'combiner', name: 'Combiner', short: 'LUT weights', phase: 6, mine: true },
  { id: 'iq', name: 'IQ demod', short: 'digital', phase: 7, mine: true },
];

/** Signal chain diagram. Horizontal on wide screens, vertical on phones (CSS picks one). */
export function chainDiagram(activeId = null) {
  return `<div class="chain">${horizontal(activeId)}${vertical(activeId)}</div>`;
}

function box(b, x, y, w, h, active) {
  const cls = ['blk', b.mine ? 'mine' : 'ctx', b.phase === 1 ? 'built' : '', active ? 'active' : ''].join(' ');
  const tag = b.phase ? `phase ${b.phase}` : 'outside the ADC';
  return `<a href="#${b.id}" class="${cls}" aria-label="${esc(b.name)}">
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8"/>
    <text x="${x + w / 2}" y="${y + 22}" text-anchor="middle" class="bn">${esc(b.name)}</text>
    <text x="${x + w / 2}" y="${y + 39}" text-anchor="middle" class="bs">${esc(b.short)}</text>
    <text x="${x + w / 2}" y="${y + h - 9}" text-anchor="middle" class="bp">${tag}</text></a>`;
}

function horizontal(activeId) {
  const w = 104, h = 72, gap = 18, x0 = 8, y = 34;
  const W = x0 * 2 + BLOCKS.length * w + (BLOCKS.length - 1) * gap;
  const parts = [];
  const first = x0 + 2 * (w + gap) - 8;
  const last = x0 + 8 * (w + gap) - gap + 8;
  parts.push(`<rect x="${first}" y="8" width="${last - first}" height="${h + 40}" rx="12" class="zone"/>`);
  parts.push(`<text x="${first + 10}" y="24" class="zt">Your converter: delay, sum and convert in the charge domain</text>`);
  BLOCKS.forEach((b, i) => {
    const x = x0 + i * (w + gap);
    if (i > 0) parts.push(`<path d="M${x - gap + 2} ${y + h / 2}H${x - 3}" class="wire" marker-end="url(#arr)"/>`);
    parts.push(box(b, x, y, w, h, b.id === activeId));
  });
  return `<svg class="chain-h" viewBox="0 0 ${W} ${h + 56}" role="img" aria-label="Receive chain">${defs()}${parts.join('')}</svg>`;
}

function vertical(activeId) {
  const w = 230, h = 64, gap = 16, x = 40;
  const H = BLOCKS.length * (h + gap) + 10;
  const parts = [];
  const top = 2 * (h + gap) - 6;
  const bottom = 9 * (h + gap) - gap + 6;
  parts.push(`<rect x="8" y="${top}" width="${w + 64}" height="${bottom - top}" rx="12" class="zone"/>`);
  parts.push(`<text x="18" y="${top + 16}" class="zt" transform="rotate(90 18 ${top + 16})">Your converter</text>`);
  BLOCKS.forEach((b, i) => {
    const y = i * (h + gap) + 4;
    if (i > 0) parts.push(`<path d="M${x + w / 2} ${y - gap + 2}V${y - 3}" class="wire" marker-end="url(#arr2)"/>`);
    parts.push(box(b, x, y, w, h, b.id === activeId));
  });
  return `<svg class="chain-v" viewBox="0 0 310 ${H}" role="img" aria-label="Receive chain">${defs('arr2')}${parts.join('')}</svg>`;
}

function defs(id = 'arr') {
  return `<defs><marker id="${id}" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" class="arrowhead"/></marker></defs>`;
}

/** Plain explanation of each block, with the current numbers. */
export function blockStory(id, reg) {
  const fs = si(reg, 'fs');
  const tw = 1 / fs;
  const ch = si(reg, 'channels');
  const m = si(reg, 'memCaps');
  const vref = si(reg, 'vref');
  const n = si(reg, 'rawDecisions');
  const bits = si(reg, 'bits');
  const stories = {
    pmut: [
      `One tile has ${si(reg, 'elements')} PMUT elements in a line, ${num(si(reg, 'pitch') * 1e6, 0)} um apart, at a centre frequency of ${eng(si(reg, 'f0'), 'Hz')} with ${num(si(reg, 'fbw') * 100, 0)} % fractional bandwidth.`,
      `Each element turns the returning echo into a small electrical signal: ${eng(si(reg, 'sMin'), 'V')} to ${eng(si(reg, 'sMax'), 'V')} rms at the PMUT in the 13 Oct chain.`,
      `${si(reg, 'tiles')} tiles fire one after another; without gel, the array follows the curve of the arm.`,
    ],
    lna: [
      `Each of the ${ch} channels has its own amplifier with ${num(si(reg, 'afeGain'), 0)} dB gain. After it, the largest signal is ${eng(si(reg, 'sMaxAfe'), 'V')} rms and the noise of the PMUT and LNA is ${eng(si(reg, 'pmutNoiseAfe'), 'V')} and ${eng(si(reg, 'lnaNoiseAfe'), 'V')} rms.`,
      'This block is outside the converter. The workbench uses its numbers only.',
    ],
    memory: [
      `Each channel writes its amplifier output onto one of its ${m} memory capacitors every ${eng(tw, 's')} (the write clock equals the sample rate, ${eng(fs, 'S/s')}), in rotation.`,
      `A sample that waits k write periods before it is read is delayed by k × ${eng(tw, 's')}. Choosing which capacitor to read sets each channel's delay. That is how the beam is steered and focused.`,
      `Delay step: ${eng(si(reg, 'delayStep'), 's')} is the baseline. See the delay step question on the Decisions page.`,
    ],
    sum: [
      `For one output sample, the capacitor holding the right delay is taken from each of the ${ch} channels and all ${ch} are connected to one node. Their charges add.`,
      eq(v('V', 'node'), '=', frac(v('Q', 'total'), v('C', 'total')), '=', frac(`${v('C', '1')}${v('V', '1')} + ${v('C', '2')}${v('V', '2')} + … + ${v('C', ch)}${v('V', ch)}`, `${v('C', '1')} + ${v('C', '2')} + … + ${v('C', ch)}`)),
      `With equal capacitors this is the average of the ${ch} delayed voltages: the delay-and-sum, done without an amplifier.`,
      'This node is also the input of the converter, so the beamformer and the ADC share it.',
    ],
    cdac: [
      'CDAC (capacitive DAC): the capacitor array that moves the node voltage step by step towards zero.',
      `In charge sharing, each DAC capacitor is first charged to V REF = ${eng(vref, 'V')}. During the conversion it is connected to the input node, with a polarity set by the previous comparator decision. Its charge spreads over the node; the total charge is kept.`,
      'No current is drawn from the reference during the decisions. The reference charge is drawn earlier, during precharge, which is why this topology suits a shared reference.',
      'Sub-radix-2 weights (each step a bit less than half the previous one) make the ranges overlap, so a wrong early decision can be corrected later. This is the innovative part of your design.',
    ],
    comparator: [
      'The comparator decides whether the node is above or below zero (differential).',
      'Self-timed: the next step starts when the comparator signals it is done, instead of on a fixed clock.',
      'A small input makes the comparator slow (metastability). The decision time is',
      eq(v('t', 'dec'), '=', v('τ'), 'ln', frac(v('V', 'final'), v('V', 'in')), ',', v('τ'), '=', frac(v('C', 'load'), v('g', 'm'))),
      'with gm set by the bias current. The budget page shows how much time each decision has.',
    ],
    logic: [
      `The SAR logic stores ${n} raw decisions (comparator outputs) per sample and sets the DAC polarity for the next step.`,
      `${n} decisions for ${bits} bits: the extra ones are the price of redundancy.`,
    ],
    combiner: [
      `The combiner turns the ${n} raw decisions into a ${bits}-bit code, with the weights w from a look-up table (LUT):`,
      eq(t('code'), '=', `${v('d', '1')}${v('w', '1')} + ${v('d', '2')}${v('w', '2')} + … + ${v('d', n)}${v('w', n)}`, '=', `Σ ${v('d', 'k')}${v('w', 'k')}`),
      'Foreground calibration measures the real weights with a known ramp or sine; they are solved off chip and stored in the LUT.',
    ],
    iq: [
      `The digital IQ demodulator multiplies the samples by a cosine and a sine at the centre frequency, low-pass filters and decimates. That gives the envelope of one image line.`,
      'See the sample rate question on the Decisions page: with the current values fs is exactly 4 × f0.',
    ],
  };
  return stories[id] || [];
}
