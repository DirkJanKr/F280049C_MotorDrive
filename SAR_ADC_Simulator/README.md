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

A separate page for the Zaan charge-sharing SAR ADC with merged beamformer. It is built in
phases; see the module strip in the page for what exists. Code lives in `src/zaan/`
(model: one function per job) and `src/zaan/ui/` (views). Tests: `test/zaan-*.test.mjs`.

* Phase 1: parameter registry with status codes (S, S*, U, D, A, ?), conflicts panel,
  noise and timing budget allocator with margins against ENOB 9.5 and 9, spec sheet per block,
  source level per block, LaTeX (IEEEtran) and MATLAB struct export.
* Imported Cadence or PDK data goes in `local-data/`, which git ignores. Never commit it.
