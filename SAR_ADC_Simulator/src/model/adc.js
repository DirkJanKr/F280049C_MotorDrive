/**
 * Assembles an ADC instance from a configuration: physical CDAC arrays
 * (cdac.js), switching scheme (switching/), comparator (comparator.js) and
 * the precomputed switch plan used by the SAR engine (sar.js).
 */
import { buildCapacitorArray, terminalId } from './cdac.js';
import { createComparator } from './comparator.js';
import { getScheme } from './switching/index.js';
import { normalizeConfig } from './config.js';
import { createRng } from './rng.js';

export const BOLTZMANN = 1.380649e-23;

function compileChanges(list, arrays) {
  return list.map((c) => {
    if (c.array < 0 || c.array >= arrays.length) throw new Error('Scheme addressed a non-existent array');
    if (c.cap < 0 || c.cap >= arrays[c.array].n) throw new Error('Scheme addressed a non-existent capacitor');
    return { a: c.array, i: c.cap, t: terminalId(c.to) };
  });
}

function compileNode(node) {
  return node.type === 'top' ? { top: true, a: node.array } : { top: false, t: terminalId(node.terminal) };
}

export function createAdc(userConfig = {}) {
  const config = normalizeConfig(userConfig);
  const scheme = getScheme(config.scheme);
  const N = config.bits;
  if (N < scheme.minBits) throw new Error(`${scheme.name} needs at least ${scheme.minBits} bits`);
  const ni = config.nonIdeal;

  // ---- physical CDAC -------------------------------------------------------
  const defs = scheme.arrays(N);
  const mismatchRng = createRng(ni.mismatch.seed);
  const arrays = defs.map((def, a) => {
    const units = def.dummyUnits > 0 ? [...def.weights, def.dummyUnits] : [...def.weights];
    let rel;
    if (config.capErrorOverride && config.capErrorOverride[a]) {
      rel = units.map((_, i) => config.capErrorOverride[a][i] ?? 0);
    } else if (ni.mismatch.enabled && ni.mismatch.sigmaUnit > 0) {
      // Pelgrom-style: a capacitor of u parallel unit caps has sigma(dC/C) = sigma_unit / sqrt(u)
      rel = units.map((u) => (ni.mismatch.sigmaUnit / Math.sqrt(u)) * mismatchRng.gaussian());
    } else {
      rel = units.map(() => 0);
    }
    return buildCapacitorArray({
      ...def,
      unitCap: config.unitCap,
      relErrors: rel,
      topParasitic: ni.topParasitic.enabled ? ni.topParasitic.cap : 0,
      bottomParasiticRatio: ni.bottomParasitic.enabled ? ni.bottomParasitic.ratio : 0,
    });
  });

  // ---- comparator ----------------------------------------------------------
  const comparator = createComparator({
    offset: ni.comparatorOffset.enabled ? ni.comparatorOffset.offset : 0,
    cmCoefficient: ni.comparatorOffset.enabled ? ni.comparatorOffset.cmCoefficient : 0,
    noiseRms: ni.comparatorNoise.enabled ? ni.comparatorNoise.rms : 0,
    cmReference: scheme.comparatorCmReference(config),
  });

  // ---- references and input ------------------------------------------------
  const vrefActual = config.vref * (1 + (ni.referenceError.enabled ? ni.referenceError.relative : 0));
  const differential = scheme.differential;
  const range = differential
    ? { low: -config.vref, high: config.vref }
    : { low: 0, high: config.vref };
  range.fullScale = range.high - range.low;
  range.lsb = range.fullScale / 2 ** N;
  range.codes = 2 ** N;

  function sourceVoltages(input, out = new Float64Array(5)) {
    if (differential) {
      out[0] = config.vinCM + input / 2;
      out[1] = config.vinCM - input / 2;
    } else {
      out[0] = input;
      out[1] = input;
    }
    out[2] = vrefActual;
    out[3] = 0;
    out[4] = config.vcm;
    return out;
  }

  const noise = {
    kTC: ni.samplingNoise.enabled && ni.samplingNoise.kTC,
    temperature: ni.samplingNoise.temperature,
    extraRms: ni.samplingNoise.enabled ? ni.samplingNoise.extraRms : 0,
    jitterRms: ni.jitter.enabled ? ni.jitter.rms : 0,
  };

  // ---- precomputed switching plan -----------------------------------------
  const samp = scheme.sampling(N);
  const plan = {
    samplingTop: samp.top.map(terminalId),
    samplingBottoms: samp.bottoms.map((b) => Int8Array.from(b.map(terminalId))),
    preset: compileChanges(scheme.preset(N), arrays),
    after: scheme.historyDependent
      ? null
      : Array.from({ length: N }, (_, k) => [0, 1].map((d) => compileChanges(scheme.afterDecision(k, d, N), arrays))),
    plus: compileNode(scheme.comparator.plus),
    minus: compileNode(scheme.comparator.minus),
  };
  plan.samplingBottoms.forEach((b, a) => {
    if (b.length !== arrays[a].n) throw new Error('Sampling configuration does not match array size');
  });

  const tConv = config.timing.tSample + N * config.timing.tBit;
  const timing = { ...config.timing, tConv, fs: 1 / tConv };

  function idealCode(x) {
    const c = Math.floor((x - range.low) / range.lsb);
    return Math.min(range.codes - 1, Math.max(0, c));
  }
  function reconstruct(code) {
    return range.low + (code + 0.5) * range.lsb;
  }

  // Theory figures used in the UI and in validation.
  const nodeCap = arrays[0].nodeCap;
  const theory = {
    totalCapPerSide: arrays[0].totalCap,
    nominalTotalPerSide: arrays[0].nominalTotal,
    unitsPerSide: arrays[0].units.reduce((s, u) => s + u, 0),
    attenuation: arrays[0].totalCap / nodeCap,
    kTCrms: Math.sqrt((BOLTZMANN * ni.samplingNoise.temperature) / nodeCap) * (differential ? Math.SQRT2 : 1),
    idealSQNR: 6.02 * N + 1.76,
  };

  return Object.freeze({
    config,
    scheme,
    arrays,
    comparator,
    vrefActual,
    range,
    noise,
    plan,
    timing,
    theory,
    sourceVoltages,
    idealCode,
    reconstruct,
  });
}
