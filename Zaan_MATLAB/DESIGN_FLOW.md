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
| 5 | CDAC from real capacitors: mismatch, and which DNL formula is right | 3, PDK | unit 35 fF = 8 LSB, error per step | done: full range, DNL and INL ladder. DNL (input width) 0.50 LSB = 2^(B-1) A_C / sqrt(C_DAC); output jump with real weights 1.02 LSB = 2^B A_C / sqrt(C_DAC); INL about 0.5 LSB. Binary 3 sigma < 0.5 LSB needs about 23.5 pF |
| 6 | How large a mistake can redundancy repair? | 1 | the tolerance t_k, proven | done (story + hand check + simulation) |
| 7a | Which fixed errors must each decision absorb? | 5, 6 | need per decision: mismatch + offset + settling | done |
| 7b | Design the weights backwards from that need, for every settling time | 7a | weight list and time table | done: exact per decision (build_weights.m, verbose option), gain margin 2 % and decision margin 0.2 LSB (A); greedy checked against an exhaustive search (same decision count). 12 decisions down to 3.7 tau, 13 down to 2.8 tau; which is faster depends on comparator delay / tau (Cadence) |
| 7b2 | A wait per step instead of one wait for all | 7a, 7b | wait per step, time | done: w_design needs 3.3 3.0 2.3 1.0 3.7 3.4 2.5 1.7 1.0 2.3 2.3 tau (at least 1 tau, A); settling 26.4 tau instead of 40.7; 200 chips convert right |
| 7c | Proof 1: rule met, does every chip convert right? | 7a | proof | done: every chip that meets its own rule converts right |
| 7d | Proof 2: rule broken, do chips fail where and as much as predicted? | 7a | proof | done |
| 7e | Proof 3: must the errors be added, or is root-sum-square enough? | 7a | proof | done: root-sum-square lets 19 % of chips fail |
| 7f | Comparator offset: how much may it have? | 7a | offset limit | done: binary needs v_os < alpha V_LSB = 0.98 mV (Rabuske eq. 4.60, simulated); w_design allows 3.5 mV, set by decision 6. 15 mV would need more tolerance in the small steps |
| 7g | Plate parasitics of the CDAC (Rabuske 4.5) | 7b | parasitic limits | done: no nonlinearity (< 0.1 bit) even fully unbalanced; they change the gain (range lost or codes unused), set by V_REF trim or C_TH. Real C_p from the PDK |
| 7h | The placeholder noise sources of step 4, simulated | 7b | noise per source | done: CDAC kT/C 0.19 fC, comparator 45 uV = 0.41 fC at the last node, jitter 1 ps 0.13 fC; all match their formula. Switch noise stays a placeholder (Cadence) |
| 8 | Calibration and the second quantisation (rounding to 10 bit) | 7 | ENOB, DNL, INL | done: calibrated 12 decisions ENOB 9.53 with 13 missing codes from the rounding; 13 decisions (extra 0.5 LSB step) ENOB 9.79, no missing codes. With the memory tones: 9.26 and 9.43, below 9.5. Contradicts step 4, which counted the quantisation once |
| 9 | How long must each step settle, given what the errors leave? | 7, Cadence switch | switch size, timing | moved to Cadence (comparator and switches) |

Rule for every step: a noise or error source enters the model only in its own step, where it is explained and checked. Until then it may appear only as a placeholder, with its assumption and what is needed to check it.

Why this order:
- Step 1 uses textbook binary steps on purpose: it checks the model, it does not choose a CDAC.
- The memory cell (2) comes first because at alpha = 1 everything follows from it:
  V_REF is fixed, C_DAC = N C_M / 2, and the node capacitance the comparator sees.
- The comparator target (4) is needed early by Cadence and only needs steps 2 and 3.
- The CDAC (5 to 7) comes after the charge it has to deliver is known.
- Settling (9) needs a real switch resistance from the PDK.
