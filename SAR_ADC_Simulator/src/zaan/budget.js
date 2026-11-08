// Runs the whole budget from the registry, shares and source levels.

import { si } from './params.js';
import { signalRms, lsbVolts, quantNoise, allocateNoise, evaluateNoise, noiseForEnob, sndrDb } from './noiseBudget.js';
import { conversionPeriod, timingLines, sweepSampleTime } from './timingBudget.js';
import { blockIncluded } from './sourceLevels.js';
import { buildSpecSheets } from './specSheets.js';

export function computeBudget({ reg, shares, levels, decisions = {} }) {
  const fullScale = si(reg, 'fullScale');
  const bits = si(reg, 'bits');
  const targetEnob = si(reg, 'enobAim');
  const vSig = signalRms(fullScale);
  const lsb = lsbVolts(fullScale, bits);
  const quant = quantNoise(lsb);
  const alloc = allocateNoise({ vSig, quant, targetEnob, shares });
  const included = (block, id) => blockIncluded(levels, block) && !(id === 'compOffset' && decisions.offsetAsNoise === 'range');
  const result = evaluateNoise({ vSig, lines: alloc.lines, included });
  const margin = (enob) => ({
    bits: result.enob - enob,
    db: result.sndr - sndrDb(vSig, noiseForEnob(vSig, enob)),
  });
  const n = si(reg, 'rawDecisions');
  const tConv = conversionPeriod(si(reg, 'fs'));
  const tLogic = si(reg, 'tLogic');
  const timing = timingLines({ tConv, tSample: si(reg, 'tSample'), tLogic, n });
  const sweep = sweepSampleTime({ tConv, tLogic, n, values: [1e-9, 2e-9, 3e-9, 5e-9, 7e-9, 10e-9] });
  const sheets = buildSpecSheets({ reg, alloc, vSig, timing });
  return { fullScale, bits, targetEnob, vSig, lsb, quant, alloc, result, margin95: margin(9.5), margin9: margin(9), n, tConv, tLogic, timing, sweep, sheets };
}
