# Zaan MATLAB design flow

One step at a time (scripts in `steps`, constants in `steps/zaan_constants.m`), in the order a design is decided: specification first, then the
memory cell, then the charge balance, then the comparator, and only then the CDAC.
Each step answers one question, works in charge (Q = Q+ - Q-), prints the hand
calculation next to the simulation, and hands one result to the next step.
A step is done when its check passes and I can explain every line. alpha = 1.

| Step | Question | Needs | Gives | Status |
|---|---|---|---|---|
| 0 | Specification in charge: full scale, one LSB, noise we may add | spec, start value C_M | Q_FS, Q_LSB, noise allowed | done |
| 1 | Does an ideal binary conversion end within ½ LSB of the input? | 0 | a checked model of the conversion | done |
| 2a | How small may the memory cell be for its kT/C noise? | 0 | lower limit on C_M | done: 26 fF for 25 % of the other noise |
| 2b | How large are the tones from gain mismatch between cells, and what do they cost? | 0 | tone power against C_M | done: total -62.6 dBc at 280 fF, 0.26 bit of ENOB |
| 2c | Offset charge per cell (switch charge injection): how much spread may a cell have? | 0 | switch spec: at most 0.16 fC per cell | done; the real value needs Cadence |
| 3 | Charge balance at alpha = 1: V_REF, total CDAC charge, node growth per decision | 2 | V_REF, C_DAC | done: 0.5 V, 2.24 pF, 1 LSB = 0.98 mV at decision 1, 0.49 mV at the end |
| 4 | Noise budget so far: what is left for the comparator? | 0 to 3 | comparator noise target | done: studied sources leave 45 uV; placeholders (CDAC kT/C, extra charge, switch noise, jitter) listed apart with what is needed to check them |
| 5 | CDAC from real capacitors: mismatch, and which DNL formula is right | 3, PDK | unit 35 fF = 8 LSB, error per step | done: DNL (input width) 0.51 LSB = 2^(B-1) A_C / sqrt(C_DAC); output jump with real weights 1.04 LSB = 2^B A_C / sqrt(C_DAC). Binary 3 sigma < 0.5 LSB needs about 23.5 pF |
| 6 | Is a wrong decision repaired exactly when its error is within the tolerance? | 1 | the tolerance rule, proven | done: with steps 9 5 3 2 1 1 the largest repaired error equals t_k at every decision |
| 7 | Errors per decision against the tolerance; which tolerance each decision needs; what reaches the output | 5, 6 | required tolerance and settling budget per decision | done: tolerance covers mismatch and offset; with 1 % settling the binary tail (d6) is not covered, so the small steps must settle better; output error before rounding 0.354 LSB rms |
| 7b | Is adding the fixed errors per decision against the tolerance correct? (Monte Carlo proof) | 6, 7 | proof | done: rule met gives 0 of 500 chips failing; root-sum-square lets 5 to 14 % fail; the tolerance is the exact limit; noise needs none. Report in docs/tolerance_proof.md |
| 8 | Calibration and the second quantisation (rounding to 10 bit) | 7 | ENOB, DNL, INL | |
| 9 | How long must each step settle, given what the errors leave? | 7, Cadence switch | switch size, timing | |

Rule for every step: a noise or error source enters the model only in its own step, where it is explained and checked. Until then it may appear only as a placeholder, with its assumption and what is needed to check it.

Why this order:
- Step 1 uses textbook binary steps on purpose: it checks the model, it does not choose a CDAC.
- The memory cell (2) comes first because at alpha = 1 everything follows from it:
  V_REF is fixed, C_DAC = N C_M / 2, and the node capacitance the comparator sees.
- The comparator target (4) is needed early by Cadence and only needs steps 2 and 3.
- The CDAC (5 to 7) comes after the charge it has to deliver is known.
- Settling (9) needs a real switch resistance from the PDK.
