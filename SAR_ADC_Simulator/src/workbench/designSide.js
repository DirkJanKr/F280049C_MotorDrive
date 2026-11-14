// The inspector: one set of design values, the same on every page and in the same order.
// A page only decides which groups start open and may add values that matter on that page alone.
// The CDAC weights are not here: they are set in one place, SAR ADC > Weights.

import { group, knobs, num } from './kit.js';

const GROUPS = [
  ['target', 'Target', ['enobAim', 'bits', 'fs', 'fullScale']],
  ['balance', 'Charge balance', ['cm', 'alpha', 'lsbPerUnit', 'cpar']],
  ['caps', 'Capacitors', ['pairSigma', 'density', 'routing', 'slotCal']],
  ['comparator', 'Comparator', ['compNoise', 'vosCal', 'vos']],
  ['beam', 'Beamformer', ['channels', 'pitch', 'steer', 'delayStep', 'memCells']],
  ['sim', 'Simulation', ['seed', 'chips']],
];

const BUCKET = (ui) => `<label class="chk"><input type="checkbox" id="useOff" ${ui.useOff ? 'checked' : ''}/> include the offset before calibration</label><label class="chk"><input type="checkbox" id="useNoise" ${ui.useNoise ? 'checked' : ''}/> include comparator noise</label><label class="chk"><input type="checkbox" id="useChip" ${ui.useChip ? 'checked' : ''}/> use the simulated chip (mismatch)</label>`;

const PAGE = {
  balance: { open: ['balance', 'target'] },
  redundancy: { open: ['balance', 'comparator'] },
  budget: { open: ['target', 'comparator', 'balance'], extra: ['temperature', 'jitter', 'calMethod'] },
  power: { open: ['target'] },
  sar: { open: ['comparator'], html: (ui) => group('In the step-by-step view', BUCKET(ui), true) },
  levels: { open: ['caps', 'sim'] },
  matching: { open: ['caps'] },
  mismatch: { open: ['caps', 'balance', 'sim'] },
  offset: { open: ['balance'] },
  beamformer: { open: ['beam'], extra: ['rxFocus', 'c', 'f0', 'fbw'] },
  chen: { open: ['target'] },
  logic: { extra: ['tSample', 'tLogic', 'tauDac', 'ibias', 'cload'] },
  timing: { extra: ['ron', 'swSize', 'fs', 'cpar', 'vosCal'] },
  reference: { open: ['balance'] },
  iq: { extra: ['iqTaps', 'iqCut', 'iqDecim', 'iqTest', 'f0', 'fbw'] },
};

export function designSide(store, pageId) {
  const cfg = PAGE[pageId] || {};
  const used = new Set();
  const w = store.ctx.d.weights;
  let h = `<p class="ks pad">Design values. The same list on every page; change a value anywhere and every page follows.</p>
    <p class="ks pad">Weights: <b>${w.slice(0, 4).map((x) => num(x, 1)).join(' ')} …</b> (${store.ctx.d.decisions} decisions). <a href="#redundancy">Set them on SAR ADC › Weights</a>.</p>`;
  if (cfg.extra) h += group('Only on this page', knobs(store.values, cfg.extra, used), true);
  if (cfg.html) h += cfg.html(store.ui);
  for (const [id, title, ids] of GROUPS) h += group(title, knobs(store.values, ids, used), (cfg.open || []).includes(id));
  return h;
}
