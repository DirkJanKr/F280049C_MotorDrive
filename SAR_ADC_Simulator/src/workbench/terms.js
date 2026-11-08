// Tooltips for technical terms: the first occurrence in each rendered panel gets a definition.

import { GLOSSARY } from '../zaan/glossary.js';
import { esc } from '../zaan/ui/fmt.js';

export const TERMS = {
  ...GLOSSARY,
  CLK: 'Write clock of the memory cells, 40 MHz.',
  'CLK 180°': 'The write clock shifted by half a period (12.5 ns); used for half delay steps.',
  'kT/C': 'Thermal noise frozen on a capacitor when its switch opens: rms voltage √(kT/C).',
  VREF: 'Reference voltage the CDAC capacitors are precharged to.',
  'C RSV': 'Reservoir capacitor that holds reference charge, refilled by a servo (Guo 2024).',
  DFT: 'Design for test: circuitry that only exists to measure or calibrate the chip.',
  HD2: 'Second harmonic distortion: power at twice the input frequency.',
  HD3: 'Third harmonic distortion: power at three times the input frequency.',
  'beam pattern': 'Response of the array against arrival angle; sidelobes are the unwanted peaks.',
  sidelobe: 'A secondary peak in the beam pattern, outside the main lobe.',
  tolerance: 'How far a decision may be off and still be repaired by the later steps (redundancy).',
  'charge halving': 'Making steps below one unit capacitor by sharing its charge with an empty equal capacitor.',
  handshake: 'Ready and valid signals: the next step starts when the previous one reports done.',
  droop: 'Drop of a stored voltage because charge is drawn or leaks away.',
};

const KEYS = Object.keys(TERMS).sort((a, b) => b.length - a.length);

/** Wrap the first occurrence of each known term (case-sensitive) in a tooltip span. */
export function termify(text, used) {
  let out = esc(text);
  for (const k of KEYS) {
    if (used.has(k)) continue;
    const i = out.indexOf(esc(k));
    if (i < 0) continue;
    const before = out.slice(0, i);
    if ((before.match(/</g) || []).length !== (before.match(/>/g) || []).length) continue;
    used.add(k);
    out = `${before}<span class="term" tabindex="0" data-tip="${esc(TERMS[k])}">${esc(k)}</span>${out.slice(i + esc(k).length)}`;
  }
  return out;
}
