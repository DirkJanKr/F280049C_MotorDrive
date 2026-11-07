/** Binary weights in unit capacitors, MSB first: [2^(count-1), ..., 2, 1]. */
export function binaryWeights(count) {
  return Array.from({ length: count }, (_, i) => 2 ** (count - 1 - i));
}

/** One switch event: bottom plate of capacitor `cap` in array `array` is connected to terminal `to`. */
export function change(array, cap, to) {
  return { array, cap, to };
}

/*
 * Switching-scheme interface
 * --------------------------
 * A scheme is a pure description of *where the switches go*; it contains no
 * physics. The SAR engine (sar.js) combines it with the CDAC model (cdac.js)
 * and the comparator (comparator.js).
 *
 *   id, name, differential, minBits, samplingStyle, description
 *   arrays(N)            -> [{ name, weights, dummyUnits, inputTerminal, rails }]
 *   sampling(N)          -> { top: [terminal per array], bottoms: [[terminal per cap] per array] }
 *                           top-plate switch closed (node forced) during sampling
 *   preset(N)            -> [change]  switching applied right after the top-plate switch opens
 *   afterDecision(k,d,N) -> [change]  switching applied after decision k (0 = MSB) with result d
 *                           must depend only on (k, d, N) (it is precomputed); a scheme that needs
 *                           the full decision history can set `historyDependent: true`
 *   comparator           -> { plus: node, minus: node } with node = {type:'top', array} | {type:'terminal', terminal}
 *                           wired so that comparator output 1 <=> output bit 1
 *   comparatorCmReference(config) -> nominal comparator input common mode (for CM-dependent offset)
 *   narrate(k, d, N)     -> human-readable description of the switching after decision k
 */
