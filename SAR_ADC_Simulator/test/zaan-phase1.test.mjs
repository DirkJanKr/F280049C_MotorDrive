// Phase 1: registry, conflicts, budget allocator, exports.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRegistry, si } from '../src/zaan/params.js';
import { computeBudget } from '../src/zaan/budget.js';
import { signalRms, lsbVolts, quantNoise, rss, sndrDb, enobFromSndr, allocateNoise, evaluateNoise, DEFAULT_SHARES, noiseForEnob } from '../src/zaan/noiseBudget.js';
import { timingLines, decisionTime } from '../src/zaan/timingBudget.js';
import { buildDecisions } from '../src/zaan/decisions.js';
import { latexParamTable, matlabStruct, latexEscape } from '../src/zaan/exportFormats.js';
import { buildSpecSheets, capForKtc } from '../src/zaan/specSheets.js';
import { defaultLevels, blockIncluded } from '../src/zaan/sourceLevels.js';

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: expected ${b}, got ${a}`);

test('every parameter has a value, a unit factor and a label', () => {
  for (const p of createRegistry()) {
    assert.ok(Number.isFinite(p.value) && p.si > 0 && p.label, p.id);
    assert.equal(typeof p.estimate, 'boolean', p.id);
  }
});

test('ideal 10-bit quantisation alone gives SQNR 61.96 dB and ENOB 10.0', () => {
  const vSig = signalRms(1); // 0.3536 V rms
  const q = quantNoise(lsbVolts(1, 10)); // 282 uV rms
  near(q * 1e6, 281.9, 0.1, 'quantisation noise uV');
  const sndr = sndrDb(vSig, q);
  near(sndr, 61.96, 0.01, 'SQNR');
  near(enobFromSndr(sndr), 10.0, 0.002, 'ENOB');
});

test('ENOB decision numbers: 282, 399 and 564 uV rms', () => {
  const c = buildDecisions(createRegistry()).find((x) => x.id === 'enobBasis');
  const text = c.math.join(' ').replace(/<[^>]+>/g, '');
  for (const v of ['281.9', '398.7', '563.8']) assert.ok(text.includes(v), v);
  near(noiseForEnob(signalRms(1), 9.5) * 1e6, 398.7, 0.3, 'noise for ENOB 9.5');
});

test('decisions reproduce the hand numbers in the notes', () => {
  const t = buildDecisions(createRegistry()).map((c) => c.math.join(' ')).join(' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ');
  assert.ok(t.includes('= 32 fF'), 'MIM 32 fF');
  assert.ok(t.includes('= 10.8 → 11 decisions'), 'radix 1.9 needs 11');
  assert.ok(t.includes('= 504.2 ns'), 'steering delay');
  assert.ok(t.includes('= 20.2 steps'), '20.2 steps');
});

test('allocation with shares summing to 100 % lands exactly on the target ENOB', () => {
  const vSig = signalRms(1);
  const q = quantNoise(lsbVolts(1, 10));
  const shares = { ktc: 20, compNoise: 20, compOffset: 10, mismatch: 20, jitter: 20, refCharge: 10 };
  const a = allocateNoise({ vSig, quant: q, targetEnob: 9.5, shares });
  const e = evaluateNoise({ vSig, lines: a.lines, included: () => true });
  near(e.enob, 9.5, 1e-9, 'ENOB');
  near(rss(Object.values(a.lines)), noiseForEnob(vSig, 9.5), 1e-12, 'total');
});

test('setting every block to ideal leaves only quantisation (ENOB 10.0)', () => {
  const vSig = signalRms(1);
  const q = quantNoise(lsbVolts(1, 10));
  const a = allocateNoise({ vSig, quant: q, targetEnob: 9.5, shares: DEFAULT_SHARES });
  const levels = Object.fromEntries(Object.keys(defaultLevels()).map((b) => [b, 'ideal']));
  const e = evaluateNoise({ vSig, lines: a.lines, included: (b) => blockIncluded(levels, b) });
  near(e.enob, 10.0, 0.002, 'ENOB');
});

test('choosing "range loss" for comparator offset removes it from the noise total', () => {
  const reg = createRegistry();
  const levels = defaultLevels();
  const a = computeBudget({ reg, shares: DEFAULT_SHARES, levels, decisions: { offsetAsNoise: 'noise' } });
  const b = computeBudget({ reg, shares: DEFAULT_SHARES, levels, decisions: { offsetAsNoise: 'range' } });
  near(b.result.total ** 2, a.result.total ** 2 - a.alloc.lines.compOffset ** 2, 1e-18, 'power');
  assert.ok(b.result.enob > a.result.enob);
});

test('timing lines add up to the conversion period when the split is equal', () => {
  const tConv = 25e-9;
  const t = timingLines({ tConv, tSample: 5e-9, tLogic: 0.1e-9, n: 12 });
  near(t.used, tConv, 1e-21, 'sum');
  near(t.slack, 0, 1e-21, 'slack');
  near(decisionTime({ tConv, tSample: 5e-9, tLogic: 0, n: 12 }) * 1e9, 1.6667, 1e-4, 'tdec');
});

test('kT/C helper: C = 2 k T / sigma^2', () => {
  // sigma = 100 uV, T = 300 K: 2 x 1.381e-23 x 300 / 1e-8 = 828.6 fF
  near(capForKtc(100e-6, 300) * 1e15, 828.6, 0.1, 'C');
});

test('spec sheets cover all five blocks and mark budget shares as estimates', () => {
  const reg = createRegistry();
  const vSig = signalRms(si(reg, 'fullScale'));
  const alloc = allocateNoise({ vSig, quant: quantNoise(lsbVolts(1, 10)), targetEnob: 9.5, shares: DEFAULT_SHARES });
  const s = buildSpecSheets({ reg, alloc, vSig, timing: { tDec: 1.6e-9 } });
  assert.deepEqual(Object.keys(s), ['CDAC', 'Reference', 'Comparator', 'Sampling switch', 'SAR logic']);
  assert.ok(s.Comparator.find((r) => r.name.startsWith('Noise at ADC input')).estimate);
  assert.ok(!s.CDAC.find((r) => r.name === 'Resolution').estimate);
});

test('exports: LaTeX table is balanced and escaped, MATLAB struct has every field', () => {
  const reg = createRegistry();
  const tex = latexParamTable(reg);
  assert.equal((tex.match(/\\begin\{/g) || []).length, (tex.match(/\\end\{/g) || []).length);
  assert.ok(tex.includes('60 & \\%'), 'percent escaped');
  assert.equal(latexEscape('a_b & 5%'), 'a\\_b \\& 5\\%');
  const m = matlabStruct(reg);
  for (const p of reg) assert.ok(m.includes(`zaan.${p.id} = `), p.id);
  assert.ok(m.includes('zaan.f0 = 10000000; % Hz'), 'SI value');
});

test('no em or en dashes in Zaan source text', async () => {
  const { readdir, readFile } = await import('node:fs/promises');
  const dir = new URL('../src/zaan/', import.meta.url);
  const walk = async (d) => {
    for (const e of await readdir(d, { withFileTypes: true })) {
      const u = new URL(e.name + (e.isDirectory() ? '/' : ''), d);
      if (e.isDirectory()) await walk(u);
      else assert.ok(!/[–—]/.test(await readFile(u, 'utf8')), e.name);
    }
  };
  await walk(dir);
});
