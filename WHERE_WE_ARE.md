# Where we are (updated 23 Nov 2026)

One page. Tick a box when done. If you get lost: come back here.
The same list with links to every page and script: workbench page Progress (first page, `#progress`).

## Done: gm/ID slides (ET4252 deck, `gmid_all.pdf`)

- [x] Slides 7 to 10: DC sweep, lookup tables, `look_up` function
- [x] Slides 12 to 20: cost of gm, gm/ID, fT, gm/gds, VDsat
- [x] Slides 21 to 28: design flow, sizing a differential pair (your input pair)
- [x] Slides 29 to 31: gm/ID x fT peaks in moderate inversion (12 to 18 1/V)
- [x] Slides 32 and 33: find the course scripts (techsweep, look_up); need a Spectre setup
- Skip slides 34 to 87 (OTA, feedback, OTA noise, project). Slide 58 only: 1 % settling = 4.6 tau.

## Reminder (25 Nov)

- [ ] Remove the two MOM test capacitors, sources and ground from `zaan_analog / sub_ana_rx_adc_abf` after the Monte Carlo (do not check them in). Next time build tests in the TB library.

## New (25 Nov): MOM matching

- PDK Monte Carlo (MOM, mismatch only, 200 points): A C is below the binary limit for C DAC 2.24 pF (value kept in `local-data/`, NDA). Chen 2018 uses MOM for the CDAC (symmetric plate parasitics, p. 3055).
- [ ] Check: twice-larger cap gives the same A C; same Monte Carlo for MIM (where does 0.0499 come from?)
- [ ] Rerun steps 5, 7b and 8 locally with the PDK A C: fewer tolerances? calibration still needed? (no calibration means no second rounding)
- MIM Monte Carlo: matches worse than MOM (value local).
- [ ] Rerun step 2b (memory tones) locally with the PDK MIM A C: the budget uses 0.0499; if MIM is worse, the tones are larger than -65.6 dBc. MOM memory cells would lower the tones (tones scale with A C squared), at an area cost.
- [ ] Decide (owner): MOM for the CDAC; memory cells MIM or MOM
- 27 Nov: workbench and MATLAB now use A C = 0.0103 for the MOM CDAC (U, stand-in, not the PDK value) and 0.0499 for MIM memory cells.
  Step 5: binary σ DNL 0.11 LSB, no missing codes, binary needs only 1.0 pF. Step 7b: still 12 decisions down to 3.2 τ.
  Redundancy now pays for: settling time (conversion 8 to 38 % shorter than binary, for r = 10 to 2), absorbing up to about 5 mV raw comparator offset (binary 0.98 mV), cheaper early decisions.
  Shrinking MOM memory cells: bottleneck is fixed charge per cell (switch injection, placeholder 0.16 fC) and the second rounding (smaller CDAC units); power barely drops.

## Parked (27 Nov, pick up later)

- [ ] Step 8 in Octave with the MOM A C; per-step waits (7b2) with the new weights; republish the workbench
- [x] Why the calibrated ENOB dropped with MOM: the design weights are already exact (ENOB 9.81 on one chip); the calibrated weights rounded to 10 bits bring back the second rounding (9.39). With MOM: no weight calibration, or raw decisions out
- [ ] Comparator offset Monte Carlo: below about 5 mV (3σ), the offset calibration could go
- [ ] Cell switch Monte Carlo: injection per memory cell (the bottleneck for smaller MOM cells)
- [ ] PDK MIM figure (0.0499) is in values.js and zaan_constants.m: NDA check

## Now: Cadence comparator (in this order)

1. [ ] gm/ID lookup tables (generic 180 nm tables from Murmann used for now, see `Zaan_MATLAB/gmid/README.md`; PDK tables when at the office): one NMOS, one PMOS, VDS = VDD/2, sweep VGS, L = Lmin, 2 Lmin, 4 Lmin. Save ID, gm, gds, Cgg. Store in `SAR_ADC_Simulator/local-data/` (NDA).
   Check: gm/ID about 30 1/V at low current, about 10 at high current.
2. [ ] Choose StrongArm or double-tail (Chen 2018 uses double-tail, Schinkel 2007, with an extra input pair for the offset calibration). Read Razavi "The StrongARM latch" (SSC Magazine 2015) and Schinkel ISSCC 2007 first.
3. [ ] First schematic, sized from the tables.
4. [ ] Delay testbench: sweep dVin 0.1 mV to 100 mV, plot delay against ln(dVin). Slope = tau_reg. Hand estimate: 0.3 to 0.5 ns (generic values).
   Gives r = (comparator + logic delay) / tau_switch for the 7b time table.
5. [ ] Noise testbench (probability of a 1 against input, Rabuske ch. 5). Target 45 uV; 100 uV costs only 0.12 bit.
6. [ ] Offset Monte Carlo: the range Chen's calibration must cover. Left after calibration: at most 0.39 mV with w design at 3.7 tau and 0.2 LSB margin (4.2 mV was at 4.6 tau without margin).
7. [ ] Kickback onto 4.48 pF and 8.96 pF nodes, in LSB (1 LSB = 4.375 fC).

Specs from MATLAB: 1 LSB at the last node = 0.49 mV; about 1.8 to 2.1 ns per decision in total.

## Still to do: MATLAB teach-back (one step per day, next to Cadence)

Done together: 5, 6, 7a, 7b. New: 7b2 (a wait per step: 26.4 tau instead of 40.7 tau of settling).
- [ ] 7c rule met: does every chip convert right?
- [ ] 7d rule broken: do chips fail as predicted?
- [ ] 7e added versus root-sum-square
- [ ] 7f comparator offset (limit 4.2 mV with w_design)
- [ ] 7g plate parasitics (gain change, not nonlinearity)
- [ ] 7h noise sources (CDAC kT/C, comparator, jitter)
- [ ] 8 calibration and rounding (ENOB 9.26 with 12 decisions, 9.42 with 13, with memory tones)
How: read the story, do the hand check on paper, run it, tell the story back.

## Supervisor meeting (24 Nov)

- [ ] Weight design method and questions: https://claude.ai/artifact/6Gu4HmfiHjnYApi2Lp8x7b
- [ ] After the meeting: read Hotta 2010, Chang 2011 and the 2014 IEICE methodology paper in full

## Decisions

Made: alpha = 1; Guo reservoir; external V_REF; LUT calibration; Chen-style offset calibration; ENOB below 9.5 accepted;
w_design = 200 160 80 40 16 16 8 4 2 1 1 (7b, 3.7 tau, 2 % gain margin, 0.2 LSB decision margin).
Open: comparator noise target (45 uV needs about 5 times the comparator energy of 100 uV, and 100 uV costs only 0.12 bit); 12 or 13 decisions (waits for r from Cadence; break-even r about 6); new ENOB target; StrongArm or double-tail.

## Ask at the office

- [ ] Company MATLAB: is there a company licence or in-house scripts? Use that for anything with PDK data (NDA), not the school licence.
- [ ] PDK model files for Spectre: in ADE, Setup > Model Libraries shows the include path and corner section; Simulation > Netlist > Display shows the device model names. Copy those into techsweep.scs and the config.
