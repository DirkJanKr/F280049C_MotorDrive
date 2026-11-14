# Theory audit of the Zaan workbench

Date: 14 Nov 2026. Scope: every formula and sourced claim in src/workbench/pages/sources.js, src/workbench/formulas.js, src/workbench/budget.js, src/zaan/model (cdac.js, matching.js, chargeSar.js, noise.js, timingBudget.js, reference.js, beamformer.js, plus steps.js where the others depend on it), src/workbench/pages/offset.js, power.js, values.js and src/workbench/values.js.

Ground truth: Rabuske and Fernandes 2017 (book pages 33 to 44, 70 to 92, 103 to 113 and 126 to 130 were provided), Chen 2018 JSSC, Guo 2024 JSSC, Malki 2014 JSSC. Equations that were garbled in the text extract were read from page images (Rabuske eq. 3.16 p. 41, eq. 4.21 p. 73, eq. 4.42 p. 81; Malki p. 1174; Chen Fig. 4(b) and Fig. 9(c); Guo Fig. 9 p. 2609).

All numbers below are for the default values (16 channels, C M = 112 fF, alpha = 0.40, V in,max = 1 V, B = 10, n u = 8 LSB per unit, default weights 256 136 72 40 24 16 8 4 2 1 1 LSB). `npm test` passes (94 pass, 7 todo, 0 fail). The check scripts are in the session scratchpad (audit/a1.mjs to a5.mjs) and only import the model; no source file was changed.

## Summary table

| # | Item | File and line | Source | Verdict | One line |
|---|------|---------------|--------|---------|----------|
| 1 | Read-slot gain variation | budget.js:246, sources.js:47, formulas.js:119 | Rabuske eq. 4.30, 4.33, 4.38, 4.42, p. 75 to 81 | WRONG | Only the common part of the two sides changes the gain: sigma G = sigma(C M) / sqrt(2 N), not sigma(C M) / sqrt(N); the code is a factor sqrt(2) too high |
| 2 | Reference charge per conversion | reference.js:7 | Rabuske eq. 3.14 p. 39, eq. 4.3 to 4.6 p. 71; Chen eq. 2 p. 3056 | WRONG | Q = 2 V REF C DAC is twice the charge a source delivers, and counts the empty halving capacitors; correct Q = V REF times the capacitance charged from the source (0.490 pC, not 1.022 pC) |
| 3 | Gain error from TH against DAC | sources.js:46, formulas.js:119 | Rabuske eq. 4.42 p. 81 | WRONG | Minus sign dropped: the book has gain error = -100 dC / (C TH + dC) percent. No numeric effect (only sigma is used) |
| 4 | Comparator noise pop-up note | formulas.js:117 (and formulas.js:67) | cdac.js:67; own simulation | WRONG | Says the node parasitic is not in C node, but cdac.js:67 adds it; the sigma squared over 2 explanation is not what the model does (binary weights also give the full sigma squared) |
| 5 | Mismatch inside the DAC, Fig. 4.8 | sources.js:48 | Rabuske section 4.4.3 p. 82, Fig. 4.8 p. 83 | CITATION WRONG | Text is on p. 82, Fig. 4.8 is on p. 83 |
| 6 | Comparator noise against its size, "used on Power estimate" | sources.js:55 and sources.js:65 | power.js | CITATION WRONG | The formula appears nowhere in power.js; the cross link and "used only for the rough power estimate" are false |
| 7 | Chen time per comparison 2.4 ns, 78 % read off Fig. 4 | offset.js:122, offset.js:126 | Chen Fig. 4(b) p. 3054 | CITATION WRONG | Chen gives no per-comparison time and Fig. 4(b) has no time scale; 2.4 ns = 33.3 ns times 0.78 / 11 is the author's own assumption |
| 8 | alpha from Rabuske 2016 eq. 3 p. 1411 | cdac.js:14, formulas.js:49, pages/values.js:100, values.js:58 | not in the provided sources | UNVERIFIABLE | Same definition is Rabuske 2017 eq. 4.58 p. 89 (provided); cite that |
| 9 | "Rabuske eq. 5" differential-mode charge C TH / 2 times V | cdac.js:24, formulas.js:37 | not in the provided sources | UNVERIFIABLE | Equivalent statement is Rabuske 2017 eq. 4.21 and its text, p. 72 to 73 |
| 10 | PDK pair mismatch 1.193 % and density 2 fF per square micrometre (status S) | values.js:60, values.js:61 | PDK not provided | UNVERIFIABLE | Arithmetic checks: 0.0499 um / sqrt(17.5 um2) = 1.193 % |
| 11 | Rabuske section 4.7 on noise | sources.js:54 | not in the provided sources | UNVERIFIABLE | Provided pages stop at p. 92 (section 4.6.3) |
| 12 | Comparator noise sigma squared = 4 k T gamma / (C V gm/ID) | sources.js:55 | not in the provided sources | UNVERIFIABLE | Units are volt squared; Rabuske ch. 5 (p. 105) does use PSS and PNOISE, as stated |
| 13 | Yu 2012, Chang 2013, Liu 2011, Craninckx 2007 as origin of halving | sources.js:59, sources.js:62, steps.js:264, steps.js:300, values.js:69 | not in the provided sources | UNVERIFIABLE | Rabuske p. 41 cites "[8]" (reference list not provided); Malki p. 1180 and Chen p. 3056 do support halving |
| 14 | Charge balance: V REF, C DAC, Q FS, Q LSB, C u | cdac.js:33 to 40 | Chen eq. 3 p. 3056, Rabuske eq. 4.24 p. 74 and 4.58 p. 89 | DERIVED OK | V REF = 0.200 V, C DAC = 2.240 pF, Q LSB = 1.750 fC, C u = 35.0 fF; Chen eq. 3 holds exactly with these |
| 15 | Node capacitance grows by 2 C j per step; step charge 2 V REF C j | cdac.js:64 to 68, chargeSar.js:214 to 233 | Rabuske eq. 4.21 p. 73 | DERIVED OK | eq. 4.21 multiplied by 2 in numerator and denominator gives the Q+ minus Q- convention |
| 16 | Voltage left at the last decision alpha / (1 + alpha) | sources.js:41 | from Rabuske eq. 4.21 | DERIVED OK | (C TH / 2) / (C TH / 2 + C DAC) = alpha / (1 + alpha) |
| 17 | Comparator noise in LSB, sigma = v n C node,last / Q LSB | sources.js:54, budget.js:194, noise.js:272 | Rabuske eq. 4.47 to 4.49 p. 88 | DERIVED OK | Equals eta times v n / V LSB; simulation 0.1970 LSB against 0.1972 LSB (default), 0.1824 against 0.1832 (binary) |
| 18 | kT/C of the memory cells sqrt(2 k T N C M) | budget.js:241, noise.js:257, sources.js:56 | Malki p. 1174 (k T C s per sampling capacitor) | DERIVED OK | A page reference now exists: Malki 2014 p. 1174 |
| 19 | CDAC precharge noise sqrt(4 k T C DAC), plus halving term | budget.js:213, noise.js:265, sources.js:57 | Malki p. 1174 (k T C dac as plate charge) | DERIVED OK | Plate charge variance k T C becomes 4 k T C in Q+ minus Q- |
| 20 | Jitter on the precharge time | budget.js:244, formulas.js:120, sources.js:58 | Chen p. 3056, eq. 1 | DERIVED OK | Q REF = I P T int, so relative error sigma t / T int on a full-scale sine of rms Q FS / (2 sqrt 2) |
| 21 | Sampling clock jitter | budget.js:247, noise.js:277 | standard | DERIVED OK | 2 pi f sigma t V rms at f = f0 (1 + bw / 2), worst case coherent over channels |
| 22 | Allowed charge and ENOB | budget.js:181 to 191, noise.js:288 to 297, formulas.js:76 to 91 | standard SNDR = 6.02 ENOB + 1.76 dB | DERIVED OK | 0.4086 LSB allowed at ENOB 9.5; quantisation is half of it |
| 23 | Tolerance and coverage of a redundant search | steps.js:302, steps.js:318, sources.js:59, formulas.js:126, formulas.js:140 | own | DERIVED OK | Re-derived below; default tolerances 49 33 25 17 9 1 1 1 1 1 0 0 LSB |
| 24 | Loss by rounding, dENOB = log2 sqrt(w last squared + q squared) | sources.js:60 | own | DERIVED OK | Two independent uniform quantisers add in power |
| 25 | 3 sigma rule, sigma = 2 to the B times A C / sqrt(C DAC) | matching.js:106 to 140, sources.js:49, cdac.js:84 to 93 | own (Rabuske p. 82 gives no closed form, correct) | DERIVED OK | Monte Carlo 4000 chips: 1.0768 LSB against formula 1.0727 LSB |
| 26 | Offset per decision, shift and repair limit | offset.js:2 to 21, budget.js:202, budget.js:292 | Rabuske eq. 4.45 to 4.49 | DERIVED OK | Error of decision i = V os (C node,last - C node,i) / Q LSB |
| 27 | Settling network, read, short and reset intervals, reservoir share | timingBudget.js:15 to 172 | Rabuske Fig. 3.7; Chen Fig. 9(c); Guo p. 2607 to 2610 | DERIVED OK | ngspice tests 1 to 12 pass (full single-ended netlist with C TH per side) |
| 28 | Beamformer delays, cells, phase error, array factor | beamformer.js:183 to 262, sources.js:62 formula, formulas.js:142 to 153 | standard array theory | DERIVED OK | tau max = 504.3 ns, M = 22 cells, phase error 22.5 degrees |
| 29 | Power scaling of Chen | power.js:154 to 166 | Chen p. 3056, 3057, 3059 | DERIVED OK | Algebra removes Chen's reference part exactly; assumptions labelled |
| 30 | Charge halving model of a chip | chargeSar.js:179 to 208, steps.js:272 to 287 | Malki p. 1180; Rabuske Fig. 3.10 p. 40 to 41 | DERIVED OK | Malki: LSB units at vdd, vdd/2, vdd/4, vdd/8, vdd/8, the repeated last step is the code's "rest" step |
| 31 | Comparator voltage in cycle i | sources.js:38, chargeSar.js:214 to 233 | Rabuske eq. 4.21 p. 73 | CONFIRMED | eq. gives 5.7976 mV, model 5.7976 mV at decision 3 for x = 137.3 LSB |
| 32 | Input range, and Chen eq. 3 as its approximation | sources.js:39, cdac.js:3, formulas.js:41 | Rabuske eq. 4.24 p. 74; Chen eq. 3 p. 3056 | CONFIRMED | V IR = 2 to the (B+1) C0 V PC / C TH = 1.000 V |
| 33 | alpha = C TH / (2 C DAC) | sources.js:40 | Rabuske eq. 4.58 p. 89 | CONFIRMED | binary 0.4008 |
| 34 | Offset factor eta i | sources.js:42 | Rabuske eq. 4.52 p. 88 | CONFIRMED | equals C node,i / C TH for an ideal binary array |
| 35 | Transfer curve shift (1 + 1/alpha) V OS | sources.js:43, offset.js:108 | Rabuske eq. 4.63 p. 91 | CONFIRMED | 3.579 LSB per mV; ramp simulation 3.725 LSB at 1 mV (halving caps and ramp mean, see contradictions) |
| 36 | Worst DNL and INL V OS / (alpha V LSB) | sources.js:44, offset.js:109 | Rabuske eq. 4.59 p. 89, eq. 4.67 p. 91 | CONFIRMED | 2.555 LSB at 1 mV; simulation 2.725 LSB including up to 0.5 LSB quantisation |
| 37 | No missing codes V OS less than alpha V LSB | sources.js:45, offset.js:110, offset.js:121 | Rabuske eq. 4.60 p. 89 | CONFIRMED | 391 uV |
| 38 | Same ENOB for CS and CR at equal total DAC capacitance | sources.js:48 (content) | Rabuske section 4.4.3 p. 82 | CONFIRMED | page of the figure, see item 5 |
| 39 | Parasitics: balanced gives no error; ENOB drop below 0.2 bit if Cp below 0.2 C0 | sources.js:50 | Rabuske section 4.5 p. 82 and p. 84 | CONFIRMED | |
| 40 | ENOB from the INL | sources.js:51 | Rabuske eq. 4.73 p. 92 | CONFIRMED | |
| 41 | Quantisation noise V LSB squared / 12 | sources.js:52, noise.js:283 | Rabuske eq. 4.69 p. 92 | CONFIRMED | |
| 42 | Precharge energy with multi-step LSB precharge; halving symbol row | sources.js:53, sources.js:74 | Rabuske eq. 3.16 p. 41, Fig. 3.10 p. 40 | CONFIRMED | Book writes V DD as the precharge voltage |
| 43 | Offset calibration costs one comparison; up to 11 % more time | sources.js:61, offset.js:122 | Chen p. 3058, Fig. 9 p. 3057; Rabuske section 6.4 p. 127 to 128 | CONFIRMED | |
| 44 | Offset after calibration 0.15 mV (status S) | values.js:72 | Malki p. 1174 (also p. 1181) | CONFIRMED | The value is at the cited page; it is a 40 nm foreground trim, so its use for Zaan is an assumption |
| 45 | Comparator noise 0.11 mV in Malki | values.js:73 | Malki p. 1181 | CONFIRMED | 110 uV low-noise comparator, 340 uV high-noise |
| 46 | Chen numbers in notes and in power.js | values.js:46 to 66, power.js:130 to 138, timingBudget.js:41 | Chen p. 3052, 3053, 3055, 3056, 3057, 3059 | CONFIRMED | 8 cells (p. 3053), 133 fF (p. 3055), 800 mV, 1.5 pF, 160 mV, 67 units, 3 LSBs by redistribution, T int 25 ns = 3/4 period (p. 3056), 10 bits plus 1 calibration cycle with CPRST (Fig. 9(c) p. 3057), 4.3 mW, 36 %, 1.58 mW, 1.8 V (p. 3059). alpha 0.40 is derived (9 times 133 fF / (2 times 1.5 pF) = 0.399), not printed |
| 47 | Guo numbers | timingBudget.js:10 to 13, 42, 169 | Guo p. 2607, 2609, 2610 | CONFIRMED | 25 ns, 11 comparisons, one CDAC, reservoir share in the MSB cycle, T CHG = 12.5 ns, C RSV similar to C DAC. Fig. 9 is on p. 2609, not 2610 (header comment, trivial) |
| 48 | Malki 5-bit MOS capacitors for offset trim | offset.js:123 | Malki p. 1180 | CONFIRMED | "5 bit controlled MOS capacitors added to the X and X nodes" |
| 49 | Common-mode dependent offset negligible | offset.js:126 | Chen p. 3058 | CONFIRMED | |

Counts: WRONG 4, CITATION WRONG 3, UNVERIFIABLE 6, DERIVED OK 17, CONFIRMED 19.

## WRONG items

### 1. Read-slot gain variation is a factor sqrt(2) too large

Files: budget.js:246 (`/ Math.sqrt(N)`), sources.js:47 (both occurrences), formulas.js:119 (pop-up rows).

Evidence. Each read slot has N fresh cells on node + and N fresh cells on node minus, drawn independently. Write the two sampling capacitances as a = C TH (1 + e p) and b = C TH (1 + e n). For one floating DAC capacitor C with plate charge q between the nodes, the two node equations are

a V P + C (V P - V N) = a V INP + q and b V N + C (V N - V P) = b V INN - q.

Eliminating the common mode gives exactly

V PN (2 a b / (a + b) + 2 C) = (2 a b / (a + b)) (V INP - V INN) + 2 q.

This is Rabuske eq. 4.21 and eq. 4.38 with an effective sampling capacitance C TH,eff = 2 a b / (a + b) = C TH (1 + (e p + e n) / 2) to first order. Only the common part (e p + e n) / 2 changes the gain; the difference e p - e n only gives the second order factor of Rabuske eq. 4.30 and 4.33 (p. 75 to 76), which the book shows is negligible. With e p and e n each of standard deviation sigma(C M) / sqrt(N):

sigma G = sigma(C M) / sqrt(2 N).

Numerical check (audit/a2.mjs): 20 000 random slots with the exact two-node solution give sigma G = 0.0826 %; sigma(C M) / sqrt(2 N) = 0.0834 %; the code gives sigma(C M) / sqrt(N) = 0.1179 %. At full scale, if not calibrated, the line is 0.302 LSB rms, not 0.427 LSB rms. With the default "calibrated" the line is zero, so the default ENOB is not affected.

Fix:
- budget.js:246: `sigma: P.slotCal ? 0 : ((P.aC / 100 / Math.sqrt(d.cm * 1e15) / Math.sqrt(2 * N)) * d.qFs) / 2 / Math.SQRT2`
- sources.js:47: formula text "sigma G = sigma(C M) / sqrt(2 N)", and `Math.sqrt(N)` replaced by `Math.sqrt(2 * N)` in both numbers; source text "eq. 4.38 with independent cells on the two sides; the difference between the sides is second order (eq. 4.30, 4.33)".
- formulas.js:119: `√(2N)` in the symbol row and `Math.sqrt(2 * c.P.channels)` in the numeric row.

### 2. Reference charge per conversion is doubled

File: reference.js:7 (`const q = 2 * P.vref * d.cdac;`), used by referenceWaveforms (reference.js:22) on the old Zaan reference chapter.

Evidence. Rabuske eq. 4.3 to 4.6 (p. 71): a DAC capacitor C is precharged with one plate at V PC and the other at 0, so it holds C V PC and the source delivers C V PC. Rabuske eq. 3.14 and 3.16 (p. 39, 41) give the energy C V PC squared per capacitor, which is that charge times V PC. Chen eq. 2 (p. 3056) defines the reference charge as Q REF = C DAC V REF. The factor 2 belongs to the Q+ minus Q- bookkeeping of the summing nodes, not to the charge drawn from the source. In addition d.cdac counts the halving capacitors, which start empty and receive their charge from the source unit, not from V REF. The power page (power.js:162) already uses Q REF = C DAC,eff V REF, so the two files disagree: 1.022 pC (reference.js) against 0.490 pC (power.js). The source actually charges 69 whole units plus the one halving source unit = 70 units times 35 fF times 0.2 V = 0.490 pC.

Fix: reference.js:7 `const q = P.vref * P.cu * (d.steps.filter((s) => s.kind === 'cap' || s.kind === 'small').reduce((a, s) => a + s.units, 0) + (d.steps.some((s) => s.kind === 'half') ? 1 : 0));` and the comment "every capacitor charged from V REF once: Q = C V REF (Rabuske eq. 3.14, Chen eq. 2)". With the default weights this equals `P.vref * d.cdacEff`; for a binary array it is 64 units against 63.875.

### 3. Sign of Rabuske eq. 4.42

Files: sources.js:46 (`ΔG = ΔC / (C TH + ΔC)`), formulas.js:119 note ("gain error = ΔC / (C TH + ΔC)").

Evidence. Rabuske p. 81, eq. 4.42 (read from the page image): gain error (percent) = -100 dC / (C TH + dC). Table 4.2 confirms: dC = -20 fF gives +8.4746 %, dC = +20 fF gives -7.2464 %. Only the standard deviation is used, so no number changes.

Fix: write "ΔG = −ΔC / (C TH + ΔC)" in both places.

### 4. Comparator noise pop-up note contradicts the model

File: formulas.js:117 (note), formulas.js:67 (formula row of the node capacitance pop-up).

Evidence. (a) The note says "The parasitic capacitance of the summing node is not in C node yet". cdac.js:67 sets `cNode = [cTh + (P.cpar || 0)]`, so the parasitic is in C node and in the comparator line of the budget as soon as it is set. The node capacitance pop-up (formulas.js:67) shows C node,i = N C M + sum 2 C j without it. (b) The note explains that "a noisy decision that the later steps cannot repair adds half of that power, sigma squared / 2" and that only the repeated last step makes it sigma squared. Direct simulation (audit/a3.mjs, 200 000 conversions, error power with noise minus without) gives 0.1970 LSB for the default weights and 0.1824 LSB for binary weights against the formula 0.1972 and 0.1832 LSB: the full sigma squared in both cases, although binary has no repeated step. The budget formula is right; the explanation is not.

Fix: formulas.js:117 delete the last sentence and replace the sigma squared / 2 sentences by "Simulated (error power with noise minus without): 0.197 LSB against 0.197 LSB for the default weights and 0.182 against 0.183 LSB for binary weights." formulas.js:67: add "+ C par" to the symbol row and `${eng(c.P.cpar, 'F')}` to the numeric row.

## CITATION WRONG items

### 5. Fig. 4.8 page

sources.js:48 cites "section 4.4.3 and Fig. 4.8, p. 82". The text of section 4.4.3 is on p. 82; Fig. 4.8 is printed on p. 83. Fix: "Rabuske 2017, section 4.4.3, p. 82, and Fig. 4.8, p. 83 (Monte Carlo)".

### 6. Comparator noise against its size is not used on the Power page

sources.js:55 says "used only for the rough power estimate" and sources.js:65 links it to the Power estimate page. power.js contains no comparator noise expression (it only says in prose that half the noise costs four times the power, which is consistent with sigma squared proportional to 1 / C). Fix: change the check column to "not used in the code; the Power page only states the scaling sigma squared proportional to 1 / C" and remove the entry `['Comparator noise against', 'power', 'Power estimate']` from USED, or implement it on the Power page.

### 7. Chen's 2.4 ns per comparison and the 78 %

offset.js:122 states "Chen has 2.4 ns"; offset.js:126 says the 78 % is "read off Chen Fig. 4". Chen gives no time per comparison anywhere in the paper; Fig. 4(b) (p. 3054) is a timing diagram without a time scale; Fig. 9(c) (p. 3057) also has no scale. 33.3 ns times 0.78 / 11 = 2.36 ns, so the 2.4 ns is the author's own 78 % assumption. Fix: offset.js:122 "33.3 ns × 0.78 / 11 = 2.4 ns with the same 78 % assumption; Chen gives no value"; offset.js:126 "Time per comparison takes 78 % of the period (assumption A; Chen Fig. 4(b) has no time scale)". Note that timingBudget.js already uses the upper bound period / cycles = 3.03 ns for Chen, which is the defensible number.

## Short notes on UNVERIFIABLE and DERIVED OK items

- Item 8 and 9: the alpha definition and the differential-mode charge are both in the provided book, so the citations can move to Rabuske 2017 eq. 4.58 p. 89 and eq. 4.21 with the text on p. 73 ("The value of C TH is divided by two because the TH capacitances appear in series for differential signals").
- Item 14: from Chen eq. 3, N V in,max C M = 4 V REF C DAC, and alpha = C TH / (2 C DAC) with C TH = N C M: substituting C DAC = N C M / (2 alpha) gives V REF = alpha V in,max / 2. One LSB: Q LSB = N C M V in,max / 2 to the B; one unit moves 2 V REF C u = n u Q LSB. Numbers: 16 times 1 V times 112 fF = 1.792 pC = 4 times 0.2 V times 2.24 pF.
- Item 16: with all capacitors connected, eq. 4.21 attenuates the input by (C TH / 2) / (C TH / 2 + C DAC) = 1 / (1 + 1 / alpha) = alpha / (1 + alpha).
- Item 17: Rabuske eq. 4.47 refers V OS to the input with eta = 1 + (2 / C TH) sum C j = C node / C TH. In LSB: eta v n / V LSB = (C node / C TH) v n 2 to the B / V in,max = C node v n / Q LSB because Q LSB = C TH V in,max / 2 to the B.
- Item 18 and 19: Malki 2014 p. 1174 gives the charge noise power k T C dac of a DAC capacitor and k T C s of a sampling capacitor. With Q = Q+ minus Q-, a plate charge q enters node + as +q and node minus as -q, so the variance is 4 k T C; each sampling cell sits on one node, so N cells on two nodes give 2 N k T C M. Both lines can now cite Malki p. 1174 instead of "no page reference yet".
- Item 23: if decision i is wrong for a residue of size delta, the residue after step i is delta + w i. The later steps plus the final half step can bring back at most sum over j greater than i of w j + w last. So delta is at most sum over j greater than i of w j + w last - w i = t i. Binary gives t i = 0, as it should.
- Item 25: k = 2 to the B / M codes per unit, the mid-scale step error has variance sum of (W i sigma u)^2 / u i = k^2 sigma u^2 (M - 1), so sigma is about 2 to the B sigma u / sqrt(M) = 2 to the B A C / sqrt(M C u). The Monte Carlo of matching.js uses the same bit-error model, so it checks the algebra, not the charge model.
- Item 27: the network matches a full single-ended ngspice netlist (spice/settling.mjs uses C TH on each side). The reset time constant R on C j assumes one switch across the capacitor, which is what Guo Fig. 9(a) p. 2609 shows.

## Internal contradictions (default values)

1. alpha. Input 0.400 (V REF, C u and C DAC pop-ups, formulas.js:47 to 60). Binary array, charge-carrying capacitance: 0.4008 (sources.js:40, offset page Rabuske table). Binary array, all physical capacitors: 0.3821. Present weights, charge-carrying: 0.3657 (Values page "alpha of the present weights"). Present weights, physical: 0.3507. The 0.4 against 0.4008 difference is the accepted approximation C DAC = 2 to the (B-1) C0 against (2 to the (B-1) - 1) C0 (Rabuske eq. 4.56 and 4.57).
2. C DAC. Charge balance 2.240 pF (formulas.js:60 "for a binary array"). Binary array charge-carrying 2.2356 pF, physical 2.345 pF. Present weights charge-carrying 2.450 pF, physical 2.555 pF. Chen eq. 3 with the physical present CDAC gives C M = 127.75 fF (cdac.js:62, shown on the old Zaan chapter) against the input C M = 112 fF.
3. V REF: 0.200 V everywhere. Q LSB: 1.750 fC from N C M V in,max / 2 to the B and from 2 V REF C u / n u. No contradiction.
4. Node capacitance at the last decision. Present weights 6.902 pF. Binary array as modelled 6.412 pF. Rabuske ideal binary, C TH (1 + 1 / alpha) = 1.792 pF times 3.4951 = 6.263 pF (6.272 pF with alpha = 0.4). The model is larger because each halving step adds a full unit capacitor, not half of one; physically that is right, but the "equals C node,i / C TH" label of sources.js:42 is only exact without halving (model 3.578 against eq. 4.52 3.495).
5. Comparator noise in LSB for 0.05 mV. Budget, present weights 0.1972; binary model 0.1832; Rabuske eta with alpha 0.4: 0.1792. Simulation 0.1970 and 0.1824.
6. Offset shift per mV. eq. 4.63 with binary alpha 3.579 LSB; binary model 3.664 LSB; present weights 3.944 LSB (offset page readout). Same cause as point 4.
7. CDAC precharge noise. noise.js:265 and the checks.js:26 text, sqrt(4 k T C DAC): 0.1176 LSB. budget.js:213 with the halving term: 0.1188 LSB.
8. Reference charge per conversion. reference.js:7: 1.022 pC. power.js:162: 0.490 pC. See WRONG item 2.
9. Read-slot gain sigma. Code 0.1179 % (0.427 LSB rms at full scale). Exact two-sided model 0.0834 % (0.302 LSB). See WRONG item 1.
10. Unit capacitor for 3 sigma DNL below 0.5 LSB. matching.js requiredCu 1.450 pF (factor 127.16); cdac.js binaryMatchingCu 1.469 pF (factor 128). sigma u at 35 fF = 0.8436 % in both.
11. Settling. timing.js:7 (ctx.settle, conversionTimes on the illustrative Timing chart) still uses one time constant, tau ln(w / t next). timingBudget.js and ngspice show that a small late step first overshoots and then returns with the time constant of the largest earlier capacitor; the single time constant form is the one ngspice disproved and should not feed any number shown as a result.
12. Node parasitic. formulas.js:117 says C node excludes it; cdac.js:67 includes it. See WRONG item 4.
13. Precharge time for the jitter line. budget.js:244 uses T int = 0.75 / f s = 18.75 ns (Chen ping-pong). timingBudget.js:172 uses T CHG = 12.5 ns for the reservoir scheme (Guo). The jitter line is 0.0193 LSB for 18.75 ns and 0.0290 LSB for 12.5 ns; the budget does not follow the chosen reference scheme.
