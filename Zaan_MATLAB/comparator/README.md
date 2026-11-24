# Comparator design flow (double-tail, as Chen 2018)

Goal now: the comparator **delay**, so the CDAC weights (MATLAB step 7b2) and the time per
decision can be fixed. Offset calibration comes later. Same way of working as the MATLAB steps:
story, hand check, then code; values marked S (paper, page), D (derived), A (assumption), U (decision).

| Step | Question | Where | Status |
|---|---|---|---|
| C0 | What does the converter ask of the comparator? | workbench `#comparator` | done (A for the input common mode) |
| C1 | Hand model: integration, regeneration, delay against input, noise | `c1_double_tail_timing.m` | first version (generic 180 nm values, A) |
| C2 | First schematic in Cadence, sized from C1 | Cadence, `zaan_analog` | next |
| C3 | Testbench: delay against input; then noise, offset Monte Carlo, kickback | Cadence, testbench library | next |
| C4 | Compare C3 with C1; put the delay in the workbench (Comparator page, Timing page) | workbench | later |

## Sources
- Schinkel et al., "A double-tail latch-type voltage sense amplifier with 18 ps setup+hold time", ISSCC 2007, pp. 314 to 315: operation, Fig. 17.7.2, delay 37 to 44 ps per decade of input.
- Razavi, "The StrongARM latch", IEEE SSC Magazine, spring 2015: amplification gain eq. 1, regeneration tau eq. 9, noise eq. 13 to 15, noise simulation by probability of ones, kickback paths.
- Chen et al. 2018, Fig. 10, p. 8: the double-tail used in the charge-sharing SAR, with an extra pair for offset calibration.

## Cadence: where things go (check the exact names with a colleague)
What we saw in the company repository: the design library is `zaan_analog`, with cells named like
`sub_ana_rx_adc_abf`; testbenches live in a private library like `.private_libs/TB_sub_ana_rx_adc_abf_cap_mm`.
So, following that pattern (A):
- the comparator cell in `zaan_analog`, for example `sub_ana_rx_adc_cmp` (schematic, later symbol and layout);
- its testbench in a private testbench library, for example `TB_sub_ana_rx_adc_cmp`.
Work on your own branch (`dkragt`), close Virtuoso before switching branches, and commit only the cells you mean to.

## C3 testbench recipe (delay first)
1. Ideal supply V DD = 1.8 V, ideal clock (fast edges, the period you will use, for example 2 ns).
2. Ideal differential input: V CM + dV/2 and V CM − dV/2 (V CM: set by the summing node, not known yet; sweep it).
3. Load the outputs like the SAR logic will: an SR latch or a few inverters of standard cells.
4. Transient, parametric sweep of dV: 10 µV, 30 µV, 100 µV, 0.3 mV, 1 mV, 3 mV, 10 mV, 30 mV, 100 mV, both signs.
5. Measure the delay: clock edge (50 %) to the output difference reaching V DD / 2.
6. Plot delay against log10(dV): a straight line. Slope per decade = 2.3 tau reg; compare with C1.
7. Also note the delay at 1 LSB (0.49 mV) and at sigma / 10 (the hard decisions), in the SS corner.
