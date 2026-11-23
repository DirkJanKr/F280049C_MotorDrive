# Workbench backlog

Changes discussed in chat that are not in the workbench yet. Nothing here is built.
Add new items at the bottom with the date; strike them when done.

## Decisions to set as defaults (owner's values, U)
1. alpha = 1 (V_REF = 0.5 V) and C_M = 280 fF, from the review of 18 Nov. The workbench still starts at alpha 0.4, C_M 112 fF.
2. Reference: Guo reservoir (one CDAC), V_REF supplied externally, no MOS capacitors in the CDAC, external calibration with LUT (review 18 Nov).

## Memory cells (MATLAB steps 2a to 2c, 19 Nov)
3. Gain mismatch tones of the memory cells: total tone power sigma_eps^2 / N relative to the signal, sigma_eps = A_C / sqrt(C_M); ENOB loss log2 sqrt(1 + P_tone / P_noise). About -62.6 dBc and 0.26 bit at 280 fF. Show against C_M, with the spectrum.
4. Extra (offset) charge per cell from switch charge injection: allowed spread per cell sigma_q <= share^0.5 Q_LSB / sqrt(12) / sqrt(N (M-1)/M), 0.16 fC at 280 fF. Input for the switch design.
5. IQ band: only tones in 7 to 13 MHz remain, but the ADC noise shrinks by the same factor, so the ratio stays about the same.
6. kT/C of the memory cells: smallest C_M = 24 kT 4^B / (share N V_FS^2), 26 fF at 25 %.

## Noise
7. Switch thermal noise while the steps are connected, about sqrt(2 kT C_node) at each decision (Rabuske p. 99); at alpha 1 about 60 % of the comparator noise in charge. Missing in the budget.
8. Noise of the reservoir current and jitter of T_CHG: a random gain per sample. Missing.
9. Halving term in the precharge noise is counted twice (budget 0.1188 against 0.1176 LSB at alpha 0.4); remove it (equipartition, checked by Monte Carlo).
10. kT/C floor readout: C_DAC,min = 12 kT 4^B (1 + alpha) / (alpha^2 V_FS^2), about 0.5 pF at alpha 0.4, 0.1 pF at alpha 1.
11. Rounding with exact weights: the ½ LSB grid lines up with the 10 bit grid (ideal 10 bit); with calibrated weights it does not. Make the budget say which case it uses.

## CDAC and redundancy
12. Candidate list 216 128 72 40 24 16 8 4 2 1 ½ ½ as a preset; flag its missing overrange.
13. ENOB search: test at full scale and require a few LSB of overrange.
14. Table "what redundancy repairs and what not" on the Weights page.
15. Settling delay scheme: one delay for all steps against a short delay for the redundant steps and a long one for the binary tail; MSB switches may be smaller than proportional.

## Reference and timing
16. Guo charges 12.5 ns because his 80 MHz clock gives edges 12.5 ns apart (my reading); about 20 ns would fit with a clean edge. Make T_CHG a value on the timing page.

## Other
17. Receive focus and cells needed: the plane-wave formula underestimates with a focus (7 cells needed at 0 deg and 5 mm, 1 shown). Formula change needs approval.
18. Read-side parasitics and reset of the summing node (review feedback): C_par lowers alpha; without a reset leftover charge gives memory between samples (MATLAB step C).
19. Charge convention note on the Sources page: Q = Q+ - Q- is twice Rabuske's charge; results in LSB are equal.

## Interface with the front end (19 Nov)
20. Full scale V_FS: 1 to 2 V pp halves the relative ADC noise and offset (or allows C_M 4x smaller for the same kT/C); the cost is front-end linearity (HD3 about +12 dB for +6 dB swing), switch linearity, V_REF = 1 V at alpha 1. Joint decision with Zehou: which swing his output stage gives at HD3 below -60 dBc, and at what power.

## Contradiction found in MATLAB step 5 (20 Nov)
21. Mid-scale DNL of a binary charge-sharing CDAC: simulation and a two-step derivation give sigma = sqrt(sum of step spreads^2) ~ 2^(B-1) A_C / sqrt(C_DAC), half of the formula 2^B A_C / sqrt(C_DAC) used in cdac.js (binaryMatchingCu), the Matching page and backup slides 17, 18 and 51. The first decision needs no capacitor, so the step errors count once. Consequence: 3 sigma < 0.5 LSB needs about 23.5 pF, not 94 pF; at 18 pF 3 sigma is about 0.57 LSB, not 1.1. To verify against literature (Saberi 2011) and the workbench's own Monte Carlo before changing anything. DONE 23 Nov: cdac.js, the Mismatch page text, test and baseline changed to 2^(B-1); MATLAB step 5 is the check. Slides dropped by the owner.
   Update after the physical simulation (step 5, 20 Nov): both formulas are right for different quantities. DNL as code width on the input axis (nominal weights): 2^(B-1) A_C / sqrt(C_DAC), 0.51 LSB simulated. Jump of the output value at mid-scale with the real weights: 2^B A_C / sqrt(C_DAC), 1.04 LSB simulated. The slide claim "binary, no calibration, 3 sigma DNL < 0.5 LSB" is the first one: about 23.5 pF. Check which one the workbench Monte Carlo measured.
