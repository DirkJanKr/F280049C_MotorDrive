# Fixes applied after the theory and coupling audits

Date: 14 Nov 2026. Sources: docs/audit/theory-audit.md, docs/audit/coupling-audit.md. Nothing was committed.

Result: `npm test`: 113 tests, 112 pass, 0 fail, 1 todo (receive focus, link 2, not approved). Browser check (Playwright, chromium): all 18 pages of zaan_workbench.html load with 0 console errors and 0 page errors; zaan.html chapters also load with 0 errors.

New tests: test/audit-fixes.test.mjs (11 tests, written before each fix; the A1 and A2 values failed before the fix). In test/coupling.test.mjs six todo tests are now real tests; the receive focus test stays todo.

test/fixtures/coupling-baseline.json: not changed. Every number in it is identical after the fixes (snapshot test passes at 1e-12). test/coupling-outputs.mjs now takes the power from `powerEstimate` of pages/power.js and also watches d.alphaEff, chipArea and the reservoir switch limit (not in the fixture).

## Default numbers that changed

| Where | Before | After | Why |
|---|---|---|---|
| Read-slot gain σ G (shown only with "Gain of each read slot" = not calibrated) | 0.1179 % | 0.0834 % | A1 |
| Budget line "Read-slot gain variation, at full scale" (not calibrated) | 0.4268 LSB (0.747 fC) | 0.3018 LSB (0.528 fC) | A1 |
| Budget ENOB with not calibrated | 8.865 bit | 9.050 bit | A1 |
| Old Zaan chapter "Reference & offset" (zaan.html): precharge per conversion | 1.022 pC | 0.490 pC | A2 |
| Same chapter: average reference current | 40.9 µA | 19.6 µA | A2 |
| Offset page, Chen time per comparison | "Chen has 2.4 ns" | Chen at most 3.03 ns, Guo at most 2.27 ns per cycle (PRIOR, cycleOf) | A7 |

With the default values the workbench Power and Reference pages do not change: the precharged capacitance is 69 whole units plus the one halving source unit = 70 units, the same as the 70 charge-carrying units used so far: Q REF = 0.2 V × 70 × 35 fF = 490 fC, I P = 26.1 µA, reference power 35.3 µW, total 2.50 mW. With a binary list on the Weights page the charge goes from 447.1 fC (63.875 units) to 448.0 fC (64 units).

## A. Theory

1. Read-slot gain variation. Done. Own two-node Monte Carlo first (20 000 slots, N = 16 cells per side, exact node equations, conversion gain = plate charge that cancels the input): σ G = 0.0835 %; σ(C M) / √(2 N) = 0.0834 %; old σ(C M) / √N = 0.1179 %. (The voltage gain at fixed plate charge is 0.0611 %; it is not the conversion gain.) Files: src/workbench/budget.js, src/workbench/pages/sources.js, src/workbench/formulas.js. Numbers above.
2. Reference charge. Done. Checked: Rabuske 2017 eq. 3.14 (p. 39) gives the energy (2^(B−1) − 1) C V PC², which is the charge C V PC per capacitor times V PC; Chen 2018 eq. 2 (p. 3056) defines Q REF = C DAC V REF. New shared functions `prechargedUnits(steps)` and `referenceCharge(P, d)` in src/zaan/model/reference.js; used by `prechargeCharge` (old Zaan chapter), src/workbench/pages/reference.js and src/workbench/pages/power.js (new exported `powerEstimate`), so the three cannot diverge. The local supply field of the Power page is gone; it reads the new value vdd. Old chapter labels updated (src/zaan/ui/chapters/reference.js). Numbers above.
3. Minus sign of Rabuske eq. 4.42. Done: "ΔG = −ΔC / (C TH + ΔC)" in sources.js and in the formulas.js pop-up. No number changes.
4. Stale notes. Done (formulas.js): the comparator noise note now says C node includes C par and gives the simulated check (0.197 against 0.197 LSB default, 0.182 against 0.183 LSB binary); the σ² / 2 explanation is removed. The node capacitance pop-up shows + C par in symbols and numbers.
5. Fig. 4.8 page. Done: "section 4.4.3, p. 82, and Fig. 4.8, p. 83".
6. Comparator noise against size. Done: check column now "not used in the code; the Power page only states the scaling σ² proportional to 1 / C"; the link to the Power page is removed.
7. Chen 2.4 ns and 78 %. Done (pages/offset.js): "Chen has 2.4 ns" replaced by the sourced bounds from timingBudget.js (Chen at most 3.03 ns, Guo at most 2.27 ns per cycle, with their page references). The 78 % is now a named constant `COMPARE_SHARE`, labelled assumption A, my own estimate, "Chen Fig. 4(b) has no time scale"; the time per comparison it gives (1.63 ns, 1.5 ns) is unchanged.
8. Citations Rabuske 2016 eq. 3 and eq. 5. Done: moved to Rabuske 2017 eq. 4.58 (p. 89) and eq. 4.21 (p. 72 to 73) in src/zaan/model/cdac.js, formulas.js, pages/balance.js (comments, card title, captions), pages/values.js. Left: "Rabuske 2016 simulates 0.5 to 3" (a range, not an equation) and "Rabuske 2016, eq. 7" in a balance.js comment (not in the audit).

## B. Contradictions

Shared names in src/workbench/names.js (`NAME`), used in the labels of app.js (summary bar), checks.js, formulas.js, leads.js, pages/balance.js, budget.js, mismatch.js, offset.js, power.js, redundancy.js, reference.js, sar.js, sources.js, system.js, values.js. No calculation uses another number than before.

- alpha: "alpha, input" (0.400), "alpha of the binary array" (0.4008), "alpha with the present weights" (0.3657), "alpha with the present weights incl. C par" (0.3657 while C par = 0).
- C DAC: "C DAC, binary balance" (2.240 pF), "C DAC of the binary array, charge carrying" (2.2356 pF), "C DAC of the binary array incl. halving capacitors" (2.345 pF), "C DAC with the present weights, charge carrying" (2.450 pF), "C DAC with the present weights incl. halving capacitors" (2.555 pF), and "C DAC charged from V REF" (2.450 pF, the reference charge capacitance of A2).
- Node at the last decision: "C node at the last decision, present weights" (6.902 pF), "..., binary array" (6.412 pF), "..., ideal binary C TH (1 + 1 / alpha)". The sources table now says the eq. 4.52 factor 1 + 1/α is for an ideal binary array and shows the model value next to it.
- Precharge noise 0.1176 against 0.1188 LSB. Cause: src/zaan/model/noise.js `prechargeNoise` (old Zaan chapters) uses √(4 kT C DAC) only; src/workbench/budget.js adds n½ · 4 kT C u / 2 for the switch between the two halves of every halving step (3 × 17.5 fF on 2.555 pF, factor √1.0205 = 1.0102). Not plainly a bug, so no number changed. The texts that showed the short formula next to the budget number (checks.js fix text, sources.js row) now show the halving term and both values.

## C. Coupling

1. Effective alpha with C par. Done: `d.alphaEff = C TH / (2 C DAC,charge carrying + C par)` in src/zaan/model/cdac.js, from Rabuske 2017 eq. 4.21 and 4.58 with C par in the denominator only (eq. 4.13): then C TH / (C TH + C par + 2 C DAC) = alphaEff / (1 + alphaEff). d.alpha is unchanged (in the fixture, and used by redundancy and balance pages). Shown on the Values page, the Charge balance flags and the sources table. Example: C par 1 pF gives 0.3037.
2. Receive focus and cells needed: not touched (owner has not approved); test stays todo.
3. Matching follows the density. Done: `mismatchCoefficient(pairSigma, density)` in src/workbench/design.js, A C = pair / √2 · √(35 · ρ / 2 fF/µm²); the 35 fF and 2 fF/µm² are the size and density the PDK pair figure is given for (constant `PAIR_AT`, from the pairSigma source). Default A C identical (4.9907 % √fF). Label of pairSigma now "at 35 fF and 2 fF/µm²"; Values page derivation text updated.
4. Offset page. Done: the tried offset starts from `vos` of the design and follows it when the design value changes (`offsetValues`); a new readout shows the shift and the first-decision error for `vosCal`. Not done: the 8 mV "untrimmed offset, 1σ" field stays. It is a 1σ spread, not the example offset vos (1 mV), and taking vos would change the default feasibility numbers. It is labelled on the page as an assumption.
5. Beam pattern. Done: `beamSteps(ctx)` compares the delay step and one write slot 1 / fs; the cells plot uses 1 / fs; labels and texts no longer say 12.5 ns, 25 ns or 16 channels.

New values (values.js), each with its present number, and where they are wired:

| id | Value | Status, source | Wired in | Side panel group |
|---|---|---|---|---|
| tIntShare | 0.75 | S, Chen 2018 p. 3056 | budget.js T int line, formulas.js, pages/reference.js, pages/chen.js (Zaan only; Chen keeps 0.75) | Reference and supply |
| cuMin | 35 fF | S, PDK mim5_2 (as density and pair mismatch) | checks.js, formulas.js, pages/balance.js, pages/sar.js | Capacitors |
| vdd | 1.8 V | A, placeholder | pages/power.js (`powerEstimate`) | Reference and supply |
| chipW, chipH | 3.2 mm, 5 mm | A, placeholder | ctx.chipArea in design.js; pages/system.js, pages/mismatch.js (CHIP removed) | Chip |
| rsvRatio | 1 | S, Guo 2024 p. 2610 "similar capacitance" | src/zaan/model/timingBudget.js (series C RSV C DAC / (C RSV + C DAC)), pages/timing.js text | Reference and supply |

The Power, Reference and Timing pages open the Reference and supply group; the Monte Carlo page opens Chip. Values: 48 before, 54 after.

Other: comment in src/zaan/model/timing.js that the timing budget uses the RC network of timingBudget.js, not settlingTimes (kept for the optimizer). Hard coded text fixed on the way: formulas.js "16 cells", "1 V / 1024", "ENOB 9.5", "12 dB", "16 errors", "22 samples"; Timing page card title no longer says 25 ns.

Not touched, report only: pages/optimizer.js and pages/sarOptimizer.js (not mounted; still use 35e-15 and their own numbers). Left from the coupling audit table because they were not in this list: matching.js slider start 35 fF, timing.js axis ticks, pages/budget.js text "16 aligned channels", reference.js placeholders (pulse, gm, cycles), chen.js REDIS and RESET.
