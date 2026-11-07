/**
 * Average switching energy drawn from VREF (and VCM) over all output codes,
 * the figure of merit used to compare switching schemes. Inputs are placed at
 * code centres; with ideal sources the energy depends only on the code.
 * Sampling (input driver) energy is not included.
 */
import { convert } from '../model/sar.js';
import { createRng } from '../model/rng.js';

export function averageSwitchingEnergy(adc, { maxConversions = 4096, seed = 5 } = {}) {
  const { range, config } = adc;
  const count = Math.min(range.codes, maxConversions);
  const stride = range.codes / count;
  const rng = createRng(seed);
  let eRef = 0;
  let eVcm = 0;
  let eMax = -Infinity;
  for (let j = 0; j < count; j++) {
    const code = Math.floor(j * stride + stride / 2);
    const r = convert(adc, adc.reconstruct(Math.min(code, range.codes - 1)), { rng, trackEnergy: true });
    eRef += r.energyRef;
    eVcm += r.energyVcm;
    eMax = Math.max(eMax, r.energyRef);
  }
  const unit = config.unitCap * config.vref * config.vref;
  return {
    conversions: count,
    avgRef: eRef / count,
    avgVcm: eVcm / count,
    maxRef: eMax,
    avgRefNormalized: eRef / count / unit,
    avgVcmNormalized: eVcm / count / unit,
    unit,
  };
}
