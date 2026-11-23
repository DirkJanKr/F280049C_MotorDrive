# Where we are (updated 23 Nov 2026)

One page. Tick a box when done. If you get lost: come back here.

## Done: gm/ID slides (ET4252 deck, `gmid_all.pdf`)

- [x] Slides 7 to 10: DC sweep, lookup tables, `look_up` function
- [x] Slides 12 to 20: cost of gm, gm/ID, fT, gm/gds, VDsat
- [x] Slides 21 to 28: design flow, sizing a differential pair (your input pair)
- [x] Slides 29 to 31: gm/ID x fT peaks in moderate inversion (12 to 18 1/V)
- [x] Slides 32 and 33: find the course scripts (techsweep, look_up); need a Spectre setup
- Skip slides 34 to 87 (OTA, feedback, OTA noise, project). Slide 58 only: 1 % settling = 4.6 tau.

## Now: Cadence comparator (in this order)

1. [ ] gm/ID lookup tables: one NMOS, one PMOS, VDS = VDD/2, sweep VGS, L = Lmin, 2 Lmin, 4 Lmin. Save ID, gm, gds, Cgg. Store in `SAR_ADC_Simulator/local-data/` (NDA).
   Check: gm/ID about 30 1/V at low current, about 10 at high current.
2. [ ] Choose StrongArm or double-tail (Chen 2018 uses double-tail, Schinkel 2007, with an extra input pair for the offset calibration). Read Razavi "The StrongARM latch" (SSC Magazine 2015) and Schinkel ISSCC 2007 first.
3. [ ] First schematic, sized from the tables.
4. [ ] Delay testbench: sweep dVin 0.1 mV to 100 mV, plot delay against ln(dVin). Slope = tau_reg. Hand estimate: 0.3 to 0.5 ns (generic values).
   Gives r = (comparator + logic delay) / tau_switch for the 7b time table.
5. [ ] Noise testbench (probability of a 1 against input, Rabuske ch. 5). Target 45 uV; 100 uV costs only 0.12 bit.
6. [ ] Offset Monte Carlo: the range Chen's calibration must cover. Left after calibration may be up to 4.2 mV.
7. [ ] Kickback onto 4.48 pF and 8.96 pF nodes, in LSB (1 LSB = 4.375 fC).

Specs from MATLAB: 1 LSB at the last node = 0.49 mV; about 1.8 to 2.1 ns per decision in total.

## Still to do: MATLAB teach-back (one step per day, next to Cadence)

Done together: 5, 6, 7a, 7b.
- [ ] 7c rule met: does every chip convert right?
- [ ] 7d rule broken: do chips fail as predicted?
- [ ] 7e added versus root-sum-square
- [ ] 7f comparator offset (limit 4.2 mV with w_design)
- [ ] 7g plate parasitics (gain change, not nonlinearity)
- [ ] 7h noise sources (CDAC kT/C, comparator, jitter)
- [ ] 8 calibration and rounding (ENOB 9.26 with 12 decisions, 9.42 with 13, with memory tones)
How: read the story, do the hand check on paper, run it, tell the story back.

## Decisions

Made: alpha = 1; Guo reservoir; external V_REF; LUT calibration; Chen-style offset calibration; ENOB below 9.5 accepted;
w_design = 200 160 80 40 16 16 8 4 2 1 1 (7b, 3.7 tau, 2 % gain margin, 0.2 LSB decision margin).
Open: 12 or 13 decisions (waits for r from Cadence; break-even r about 6); new ENOB target; StrongArm or double-tail.
