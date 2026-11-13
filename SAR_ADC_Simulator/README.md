# SAR ADC Charge Simulator

An interactive **behavioral charge-domain simulator** of a successive-approximation ADC with a
capacitive DAC (CDAC). Every voltage in the simulator comes from charge conservation on the
floating top-plate node. It is **not** a transistor-level simulator: switches, sources and the
comparator are ideal unless a specific, listed non-ideality is switched on.

```
npm start          # zero-dependency static server -> http://localhost:8080
npm test           # 31 validation tests (node >= 18, no dependencies)
```

The dashboard runs from plain ES modules, so there is no build step. It needs an HTTP server
because browsers block module imports from `file://`.

## Architecture

| Layer | File(s) | Responsibility |
|---|---|---|
| Physical CDAC | `src/model/cdac.js` | Capacitor arrays (actual vs. nominal C, Cp, αCi), forced/floating node charge, plate charges, source charge per transition |
| Switching schemes | `src/model/switching/*.js` | Pure descriptions of switch positions: sampling, preset, switching after each decision, comparator wiring. No physics. |
| Comparator | `src/model/comparator.js` | Offset (incl. input-CM dependence), Gaussian noise, decision |
| SAR engine | `src/model/sar.js` | Sample → hold → preset → N × (compare, switch); `convert()` records full snapshots, `convertCode()` is the allocation-free fast path (bit-identical) |
| Assembly / config | `src/model/adc.js`, `config.js` | Builds arrays with mismatch, references, ranges, precompiled switch plan |
| Analysis | `src/analysis/` | Ramp-histogram INL/DNL, coherent-sine FFT (SNR/SNDR/ENOB/SFDR/THD), average switching energy |
| UI | `src/ui/` | Parameter panel, schematic, charge view, sequence log, waveforms, results. Only draws; heavy analyses run in a Web Worker |

### Core equations

```
Sampling (top plate forced to Vtop):  Q_X = Σ Ci (Vtop − Vb,i) + Cp·Vtop   (+ kT/C noise charge)
Floating (all later phases):          Vx  = (Q_X + Σ Ci·Vb,i) / (Σ Ci + Cp)
Step caused by switching:             ΔVx = Σ Ci·ΔVb,i / (Σ Ci + Cp)
Charge from a source during a step:   ΔQ_src = Σ over caps on that source of Δ[Ci(Vb,i − Vx) + αCi·Vb,i]
Energy from a source:                 E = V_src · ΔQ_src
```

### Switching architectures

| Scheme | Sampling | Caps per side | Ct per side |
|---|---|---|---|
| Conventional, single-ended | bottom plate (top → VCM) | N + dummy | 2^N Cu |
| Conventional, differential | bottom plate (top → VCM) | N + dummy | 2^N Cu |
| Monotonic (set-and-down) | top plate | N−1 + dummy | 2^(N−1) Cu |
| VCM-based (tri-level) | top plate, bottoms at VCM | N−1 + dummy | 2^(N−1) Cu |

To add a scheme (for example split-array, redundant or tri-level variants), write a module that
implements the interface documented in `src/model/switching/common.js` and register it in
`switching/index.js`. Nothing else changes.

## Ideal assumptions vs. modeled effects

**Always ideal:** switch resistance, charge injection and leakage; source impedance; complete DAC
settling; comparator gain, delay, metastability and kickback; linear capacitors; no rail clipping.

**Configurable physical effects:** capacitor mismatch (σ/√units, seeded), top-plate parasitic Cp,
bottom-plate parasitic αCi, comparator offset (static and input-CM dependent), comparator noise,
reference error, sampling noise (kT/C plus extra input noise) and aperture jitter (sine test).

## Validation (`test/`)

* **Hand calculations:** 4-bit conventional (Vin = 0.6 V → Vx = 0.4, 0.65, 0.525, 0.4625 V,
  code 9), the same with Cp = Ct (every step halved, code unchanged), 4-bit monotonic and 4-bit
  VCM-based node voltages, and the charge drawn from VREF at the conventional preset (C_MSB·Vref/2).
* **Ideal behaviour:** every scheme equals the floor quantizer for every code (4 to 12 bit).
  Charge on the floating node is conserved to < 1e-12 relative with mismatch and parasitics on,
  and the solver step equals the hand formula ΔVx = ΣCiΔVb/(Ct+Cp).
* **Published figures:** average 10-bit switching energy is 1363.3 (conventional), 255.5
  (monotonic) and 170.2 (VCM-based) Cu·Vref², and the conventional result follows
  Σ 2^(N+1−2i)(2^i−1) for N = 4 to 12.
* **Metrics:** ideal DNL = INL = 0 and SNDR = 6.02N + 1.76 dB (±0.6 dB) for 6 to 12 bit.
* **Non-idealities against closed forms:** reference error is a pure gain error; comparator offset
  shifts thresholds by −Vos(Ct+Cp)/Ct; monotonic Cp gives a gain of Ct/(Ct+Cp); a single MSB error
  gives the analytically predicted DNL and INL; mismatch follows Pelgrom scaling; kT/C rms equals
  √(kT/C); input-noise SNR and jitter SNR match theory; a VCM error leaves VCM-based decisions
  unchanged.
* **Engine consistency:** the fast and recording paths give identical codes with every
  non-ideality on.

## Zaan converter workbench (`zaan.html`)

A design and learning tool for the Zaan charge-sharing SAR ADC with merged beamformer. It follows the
architecture review as eight chapters; each is a question, a column of knobs and live figures.

1. Specs: what one conversion must deliver.
2. Beamforming: delays, memory cells, phase error, beam pattern for exact and rounded delays.
3. Charge sharing: one conversion decision by decision (level walk with reach, node capacitance,
   node voltage, offset against tolerance).
4. CDAC sizing: charge balance, what sets the unit capacitor, area to scale, the V REF trade-off.
5. Redundancy: weights, tolerance, one chip before and after calibration, Monte Carlo over many chips.
6. Reference and offset: reference charge per bit (charge redistribution against charge sharing),
   offset calibration, ping-pong against reservoir.
7. Budget: every noise source and every decision against 1 / fs.
8. Full chain: reflectors through beamformer, ADC, combiner and IQ demodulator to an image line.

Code: `src/zaan/model/` (physics and analysis, one function per job, no UI), `src/zaan/ui/` (pages),
`src/zaan/ui/chapters/` (one file per chapter). Tests: `test/zaan-model.test.mjs` checks the model
against the review (example array, 22 cells, 45° and 22.5°, 1.0 LSB per mV, 64 µV) and against ideal
behaviour (exact reconstruction, SQNR 61.96 dB, zero DNL, charge conservation, weight calibration).

Assumption (A) used throughout: one unit step delivers 2 · VREF · Cu of differential charge and adds
2 · Cu to the node, which reproduces review slides 11, 15 and 36.

Imported Cadence or PDK data goes in `local-data/`, which git ignores. Never commit it.

## Zaan workbench (`zaan_workbench.html`)

Pages, each filling the screen, from the beamformer onward (nothing before the beamformer):

* System: the chain from the beamformer to the IQ demodulator as cards with their key numbers and a
  status dot, a sample moving along the chain, and what feeds it (reference, clocks, calibration).
* Budget: the noise of the converter on the summing node, in fC or as the voltage at the input.
  What is left after calibration is simulated (4 chips) and split into its parts, or joined in one
  line: quantisation by the SAR levels (smallest step), rounding to the combiner output bits, and the
  LUT weight error of the chosen calibration (measured externally = exact, on-chip least squares,
  on-chip LMS). Plus comparator noise C node,last · vn, memory-cell kT/C √(N · 2kT CM), CDAC precharge
  √(4kT CDAC + n½ · 4kT Cu/2), jitter. Explanations of comparator noise (S-curve) and of offset and
  trimming; every check with why and fix; the 12 dB beamformer gain switch.
* Optimizer: runs the design search: for Cu from 10 to 150 fF and a smallest step of 1 or ½ LSB, the
  weights are built from what each step needs, simulated, and scored for 10, 11 and 12 output bits.
  It gives the smallest CM that meets the ENOB aim, with decisions and (illustrative) conversion time,
  and applies it in one click.
* Beamformer: the memory cells as they sit on the chip (write pointer, CLK 180° writes, read cells),
  the charge each cell holds, the 16 read charges added on the node, and the node charge with and
  without delays; delays, cells needed, beam pattern, write timing.
* SAR ADC: weight designer; a conversion step by step as the circuit, differential or single-ended; per
  decision what the tolerance must cover (DAC mismatch 3σ, comparator offset after calibration,
  comparator noise) against what it has; an optimizer that builds the weights from the smallest
  step up, giving every step the largest whole number of unit capacitors whose tolerance still
  covers its need, then spreads the range left over as margin; the search; a comparison.
* Mismatch and area: Monte Carlo, one chip in detail, DNL and INL from a dense noise-free ramp,
  why the DNL stays near 1 LSB when the smallest step is 1 LSB (and what one more halving step
  gives), LMS calibration as it would run on chip (test input, weight registers, error, update
  w i ← w i + μ e s i) with the weights converging, and the area to scale.
* Timing: for understanding; synchronous against self-timed, metastability, settling with
  redundancy, the write clocks. All values illustrative.
* SAR logic: the self-timed loop animated, with logic-analyzer waveforms.
* IQ demodulator: the digital hardware after the ADC step by step in the frequency domain (ADC
  output, mixing with the NCO, FIR low-pass, decimation), the SNR after every step and the gain
  1 / (2 Σ h²) of the filter. Filter and decimation values are illustrative.
* Values: every value editable, design versions (browser and JSON file), LaTeX and MATLAB export.

Charge balance (CDAC and reference values): half range (N CM VFS = 2^N Q step), total step charge
(N CM VFS = 2 Σw Q step, larger CM with redundancy) or the review slide formula (N CM VFS = 4 VREF CDAC).

Themes: soft (default), dark and light.

Every value with a dotted underline opens its formula: symbols, the same formula with the current
numbers, and the result.

Assumptions to check: the offset check counts only the part of the offset that differs from the
last decision (the common part shifts every code equally); a decision passes when mismatch (3σ)
plus offset stays within its tolerance plus ½ LSB; comparator noise is counted in the noise budget
at the last decision, not in the tolerance check; jitter is counted as if all channels jitter
together; the optimizer compares designs on the budget without the simulated residual; the comparator
noise formula is an upper estimate (the simulation gives less, see its formula).

The summary bar and the side panel can be shown or hidden. Code: `src/workbench/` (values, store,
design, budget, checks, formulas, optimizer, iq, weights, kit, pages, animations); the physics is in `src/zaan/model/`.

## Circuit level (ngspice)

`spice/` connects the behavioural model to ngspice, without extra packages:

- `spice/ngspice.mjs` runs a netlist in batch mode and reads the traces written with `wrdata`.
- `spice/chargeShare.mjs` builds the charge-sharing steps (sampling capacitors, precharged DAC
  capacitors, switches with an on-resistance) and gives Rabuske 2017, eq. 4.21 for comparison.
- `test/spice.test.mjs` checks that ngspice settles to eq. 4.21 after every step. It is skipped when
  ngspice is not installed.

Install: `apt-get install ngspice` (Ubuntu; ngspice 42 is used). The cloud environment installs it in
its setup script.

Transistor-level switches and the comparator need the SilTerra 180 nm BCD models. They are under NDA:
put them in `local-data/` (git-ignored) and include them from a netlist there. Nothing in this
repository contains PDK data.

## Claude Code skills in this repository

Installed with `npx skills add` into `.agents/skills`, linked from `.claude/skills`, pinned in
`skills-lock.json` at the repository root:

| Skill | Source | Use it for |
|---|---|---|
| playwright-skill | lackeyjb/playwright-skill | browser checks of the workbench pages; use the preinstalled Playwright, do not run its `npm run setup` |
| test-driven-development | obra/superpowers | new model features: write the hand-calculation test first |
| systematic-debugging | obra/superpowers | a result that disagrees with literature, ngspice or MATLAB |
| verification-before-completion | obra/superpowers | before claiming a model or page is correct |
