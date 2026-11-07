/**
 * Behavioral comparator model.
 *
 *   diff = (V+ - V-) + Vos(Vcm,in) + vn,   decision = diff > 0 ? 1 : 0
 *
 *   Vos(Vcm,in) = Vos0 + k_cm (Vcm,in - Vcm,ref)  (input common-mode dependent offset)
 *   vn ~ N(0, sigma_n^2), drawn independently for every decision
 *
 * Ideal assumptions kept even when non-idealities are on: infinite gain,
 * zero delay, no metastability, no kickback, no hysteresis.
 */
export function createComparator({ offset = 0, noiseRms = 0, cmCoefficient = 0, cmReference = 0 } = {}) {
  return Object.freeze({
    offset,
    noiseRms,
    cmCoefficient,
    cmReference,
    /** Decision only (no allocation); consumes the RNG exactly like decide(). */
    decideBit(vPlus, vMinus, rng) {
      const vos = offset + cmCoefficient * (0.5 * (vPlus + vMinus) - cmReference);
      const noise = noiseRms > 0 ? noiseRms * rng.gaussian() : 0;
      return vPlus - vMinus + vos + noise > 0 ? 1 : 0;
    },
    decide(vPlus, vMinus, rng) {
      const vcmIn = 0.5 * (vPlus + vMinus);
      const vos = offset + cmCoefficient * (vcmIn - cmReference);
      const noise = noiseRms > 0 ? noiseRms * rng.gaussian() : 0;
      const diff = vPlus - vMinus + vos + noise;
      return { decision: diff > 0 ? 1 : 0, vPlus, vMinus, vos, noise, diff };
    },
  });
}
