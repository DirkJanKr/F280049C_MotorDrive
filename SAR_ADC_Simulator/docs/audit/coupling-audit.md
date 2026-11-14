# Coupling audit of the workbench values

Date: 14 Nov 2026. Scope: every value in `src/workbench/values.js` (48 values: 44 numbers, 4 choices), the context built by `design()` in `src/workbench/design.js`, the side panel in `src/workbench/designSide.js` and what the pages read.

Method: `test/coupling.test.mjs` changes each value by a sensible amount (one tenth, the middle of the range for an empty value, the other option of a choice), runs `design()` again and compares about 55 outputs (`test/coupling-outputs.mjs`): P.vref, P.cu, P.aC, d.cdac, d.cm, d.qLsb, d.qFs, d.cNode first and last, d.decisions, d.units, budget.enob, budget.total, every budget line in charge and in LSB, areaTotal, need.m, tauMax, tw, phaseErr, sigmaU, binCu, tauC, timing.median, the first row of tolNeed, the main timing case of `timingBudget.js` at 0 and 500 ohm, and the power estimate of `pages/power.js` (written out again in the helper, because the page computes it inside `update()`). Page reads were found by grep for `P.<field>`, `store.values` and `store.ui.<name> || <number>`.

Test result after the edits: `npm test`: 101 tests, 94 pass, 0 fail, 7 todo (the todo tests are the broken links and missing values below).

## Dead values

None. Every value changes something in the context, or a page reads it:

| Value | Changes in ctx | Read by |
|---|---|---|
| rawDecisions | only `ctx.checks` (decisions check) | checks.js, pages/system.js, pages/sar.js |
| iqTaps, iqCut, iqTest | nothing | pages/iq.js only |
| iqDecim | nothing | pages/iq.js, pages/system.js |
| chips | nothing | pages/mismatch.js only (Monte Carlo) |
| vos | only tolNeed offsetRaw | budget.js, pages/budget.js, pages/balance.js, pages/sar.js; not by pages/offset.js (see below) |
| gmId, vfinal | tauC, timing.median | until now not in any side panel group; reachable only on the Values page (fixed, see What I changed) |

Two pages are not mounted in `app.js` (`PAGES` does not list them), so what they read is unreachable: `pages/optimizer.js` and `pages/sarOptimizer.js`.

## Hard coded numbers in pages

Lines as of 14 Nov 2026; other agents are editing these files, so search for the quoted text if a line has moved.

| file:line | Current | Should read |
|---|---|---|
| pages/offset.js:74 | `(store.ui.osV ?? 1) * 1e-3`, its own 1 mV offset | start from `P.vosCal` (or `P.vos`); the page ignores both values of the side panel |
| pages/offset.js:75 | `(store.ui.osRaw \|\| 8) * 1e-3`, untrimmed offset 8 mV | `P.vos`; values.js has 1 mV for the same quantity, so the two disagree |
| pages/beamformer.js:71 | `quantise(delays.tau, 12.5e-9)` | `P.delayStep`; the beam pattern labelled 12.5 ns does not follow the delay step |
| pages/beamformer.js:72, 68 | `25e-9` (one write slot) | `ctx.tw` (1 / fs) |
| pages/beamformer.js:76, 22 | labels '12.5 ns', '25 ns' | `eng(P.delayStep)` and `eng(ctx.tw)` |
| pages/beamformer.js:24 to 26, 77 | text '25 ns', '12.5 ns', 'all 16 channels' | `ctx.tw`, `ctx.tw / 2`, `P.channels` |
| pages/reference.js:31 | `0.75 / P.fs` (T int) | a T int share value (see Missing tunables) |
| pages/chen.js:50, 67 | `0.75 * s.T` for Zaan | the same T int share; for the Chen setup 0.75 is the paper value and can stay |
| pages/balance.js:66, 92 | `35e-15` PDK minimum | one shared value (`P.cuMin`), the same as checks.js |
| pages/sar.js:96 | `35e-15` | `P.cuMin` |
| pages/matching.js:116, 88 | `store.ui.mmCu \|\| 35` | start from `P.cu * 1e15` |
| pages/system.js:39 | `3.2e-3 * 5e-3` chip area | `CHIP.w * CHIP.h` from design.js, as pages/mismatch.js does |
| pages/power.js:28, 61 | `store.ui.pwVdd \|\| 1.8` | a supply value `P.vdd` in values.js; the 1.8 V of Chen in `CHEN.vdd` stays |
| pages/timing.js:39 | title 'How the 25 ns are spent' | `ns(1 / P.fs)` |
| pages/timing.js:78 | ticks `[0, 5, 10, 15, 20, 25]` ns | ticks up to `1 / P.fs`; at 10 MS/s the axis stops at 25 ns of 100 ns |
| pages/budget.js:41 | text '16 aligned channels', '√16 = 4', '12 dB' | `P.channels`, `budget.arrayGainDb` |
| pages/power.js:23 | text 'delay logic for 16 channels' | `P.channels` |
| pages/logic.js:27, 28 | `1.5e-9` for the done phase | illustrative; fine as it is, or a value with status A |
| pages/chen.js:11, 12 | `REDIS = 0.1`, `RESET = 0.12` | read off Chen Fig. 4(b) and also applied to Zaan; status A values if they are meant for Zaan |
| pages/reference.js:10 | `pulse: 2e-9, gm: 50e-6, cycles: 4000` (A placeholders) | values with status A in a reference group, so they are saved with a version |

Outside the pages, in files I may not edit:

| file:line | Current | Should read |
|---|---|---|
| budget.js:74 | `0.75 / P.fs` in the T int jitter line | the T int share value |
| checks.js:5 | `PDK_MIN = 35e-15` | `P.cuMin` |
| checks.js:30 | 'Chen 2018 allows about 20 ps' | fine (paper value) |
| formulas.js:55 | 'The PDK minimum for the MIM device is 35 fF' | `P.cuMin` |
| formulas.js:69 | '(the 16 cells)' | `${c.P.channels}` |
| formulas.js:74 | 'the 1 V / 1024 LSB at the input' | `P.fullScale / d.codes` |
| formulas.js:80 | 'half of this power at ENOB 9.5' | true only at 9.5; compute from `P.enobAim` |
| formulas.js:104 | 'a worst case 12 dB higher' | `budget.arrayGainDb` |
| formulas.js:117 | 'The parasitic capacitance of the summing node is not in C node yet' | wrong now: `d.cNode[0]` includes C par; drop the sentence |
| formulas.js:119 | 'It repeats every 22 samples' | `P.memCells` |
| formulas.js:120 | `0.75 / c.P.fs` and 'T int is 3/4 of the clock period' | the T int share value |
| formulas.js:123 | 'the 16 errors add like the signal' | `P.channels` |
| src/zaan/model/timingBudget.js:171 | `cdac / 2` (C RSV = C DAC in series) | a reservoir ratio value |
| src/zaan/model/timingBudget.js:172 | `tInt: 12.5e-9` for the reservoir | Guo's T CHG; fine as a paper value, or tied to the period |

## Broken links

Checked links that hold (now protected by `test/coupling.test.mjs`): C M and N into Q FS, Q LSB, C DAC, C u, kT/C and area; alpha into V REF = alpha V in,max / 2, C DAC = N C M / (2 alpha), comparator noise and offset in LSB; full scale into V REF and Q LSB; bits into Q LSB, C u and the binary array; fs into period, timing budget, cells needed, T int jitter, power; pair mismatch into σ u, binary C u, mismatch need, read-slot line, simulated chip; C par into node capacitance, comparator noise in LSB and read time; pitch, steering angle, speed of sound into delays and cells; delay step into phase error and rounded delays; f0 into phase error, wavelength, band edge jitter; comparator noise and offsets into the budget and the tolerance needs; temperature into both kT/C lines (as √T); memory cells, density, routing into area; switch resistance and sizing into the timing budget; planned decisions into the decisions check.

Broken:

1. **Simulated chip did not follow C par or the output bits (fixed).** The cache key of the simulated chip in design.js left out the node capacitance and the output bits. After any other design had been computed, a change of C par or of the combiner output bits kept the old chip results: ENOB of the simulated chip, residual parts, the budget lines that use them and the conversion time. Example: C par 2000 fF gave simulated ENOB 9.441 from the cache against 9.338 computed fresh. Fixed by adding `d.qLsb`, `d.cNode` and `P.outBits` to the key; a test computes each case twice, with a warm and with a fresh copy of design.js.
2. **C par does not lower the effective alpha.** `d.alpha` in src/zaan/model/cdac.js is N C M / (2 C DAC,eff) without C par, although the value's own note says C par dilutes the signal like a lower alpha (Rabuske 2017, eq. 4.13). Test marked todo.
3. **A receive focus does not change the cells needed.** design.js takes tauMax from the plane wave at |steer| only. At steer 0 and focus 5 mm the focused delays need 7 cells, need.m says 1; at 15° and 10 mm the focus needs 21 and the plane wave 22, so the default case is safe. Fixing it changes a formula, so it is left as a todo test.
4. **Capacitor density does not change the matching.** pairSigma (1.193 %) is the PDK figure 0.0499 µm / √(W L) evaluated at W L = 35 fF / 2 fF/µm². A different density changes the area of a 35 fF capacitor and so its mismatch, but aC is computed from pairSigma alone (design.js, `Math.sqrt(35)`). Todo test. The fix is to store the PDK slope and compute aC from it and the density; that changes the default aC in the fourth digit, which is the owner's call.
5. **Offset page ignores the offset values.** pages/offset.js uses its own 1 mV and 8 mV (see the table above), so changing `vos` or `vosCal` in the side panel does not move that page.
6. **Beam pattern ignores the delay step.** pages/beamformer.js compares fixed 12.5 ns and 25 ns rounding, not `P.delayStep` and `ctx.tw`.
7. **Bits do not change the present weights.** By design: the weights are set on the Weights page and the coverage check flags a mismatch. Not counted as broken.
8. **fs to reference current** holds, but only inside pages/reference.js (`ipTarget`), not in ctx.

## Missing tunables

| Quantity | Where it is fixed now | Suggested value |
|---|---|---|
| T int share of the period | 0.75 in budget.js:74, formulas.js:120, pages/reference.js:31, pages/chen.js:50 and 67 | `tIntShare`, 0.75, status S (Chen 2018 p. 3056); P.tIntShare read by those four places |
| Supply voltage | `store.ui.pwVdd`, fallback 1.8, pages/power.js:28 (not in values, not in a saved version) | `vdd`, 1.8 V, status A |
| Comparator power | pages/power.js treats all of Chen's 1.58 mW as switching power; the noise to power trade is text only | a comparator energy per decision, value null, status A, until a schematic exists |
| PDK minimum capacitor | 35e-15 in checks.js, pages/balance.js, pages/sar.js, pages/optimizer.js, formulas.js | `cuMin`, 35 fF, status S |
| Size the pair mismatch figure is given for | `Math.sqrt(35)` in design.js | better: the PDK slope 0.0499 µm itself, so density follows (broken link 4) |
| C RSV to C DAC ratio | `cdac / 2` in src/zaan/model/timingBudget.js:171 | `rsvRatio`, 1, status S (Guo 2024 p. 2610) |
| Reservoir recharge time | `12.5e-9` in timingBudget.js:172 | paper value; tunable only if the reservoir scheme is chosen |
| Chip size | `CHIP` in design.js (3.2 mm by 5 mm), copied as a literal in pages/system.js:39 | two values with status A if the die is still open |
| Number of elements of the whole array | not modelled; channels N is one tile | a value only when tiles are combined |
| Reference loop placeholders | pages/reference.js:10 (pulse, gm, cycles) | values with status A |
| Charge redistribution and reset shares | pages/chen.js:11, 12 | values with status A, if they are meant for Zaan |

Already tunable and wired: memory cells per channel (`memCells`), switch resistance (`ron`, null, swept on the Timing page), routing factor (`routing`). Not added in this audit: every value above is read only by code outside my three files, so adding it now would create a dead value. Each is a todo test in coupling.test.mjs (T int share, supply, PDK minimum, reservoir ratio), so it turns into a real test once wired.

## What I changed

All edits keep every number of the default context identical: the key outputs are compared with `test/fixtures/coupling-baseline.json`, written before any edit, and a full JSON dump of the default ctx was byte identical before and after.

- `src/workbench/design.js`: the cache key of the simulated chip now holds `d.qLsb`, `d.cNode` and `P.outBits` (broken link 1). No formula changed.
- `src/workbench/values.js`, ranges only (the slider stopped short of sensible values; the number field never clamped):
  - `memCells` max 48 to 128: at the allowed ±30° the default tile needs 79 cells.
  - `pitch` min 100 to 50 µm: λ/2 at 10 MHz is 77 µm, at 15 MHz 51 µm.
  - `topUnits` max 64 to 256: a binary array at 12 bits needs 2^10 / n u = 128 units with n u = 8.
  - `enobAim` max 11 to 12, so a 12 bit design can aim above 11.
  - Units and si factors of all 48 values checked; none wrong. No value is missing from modelParams.
- `src/workbench/designSide.js`:
  - Budget: adds outBits (rounding line), f0 and fbw (band edge jitter line).
  - Levels: adds outBits.
  - Weights and Conversion: add rawDecisions (the decisions check sits on that tab).
  - SAR logic: adds gmId and vfinal, which set the comparator time constant and the decision time and were in no group at all.
  - Reference: adds jitter (T int jitter readout).
  - Power opens the charge balance group; Offset opens the comparator group; Timing after Chen opens the beamformer group.
  - A value lifted into 'Only on this page' is no longer repeated in its group. Before, the Timing page showed fs, C par and the offset after calibration twice, with the same element ids.
- New: `test/coupling.test.mjs` (26 tests, 7 of them todo), `test/coupling-outputs.mjs` (the outputs, the main timing case and the power estimate), `test/fixtures/coupling-baseline.json` (the snapshot taken before the edits).
