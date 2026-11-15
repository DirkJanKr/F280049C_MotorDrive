# Zaan workbench: map for a new session

Project: MSc thesis of Dirk-Jan. Charge-sharing SAR ADC with merged delay-and-sum beamformer, 180 nm BCD, tape-out 31 March 2027. App in `SAR_ADC_Simulator/`. Develop on branch `claude/sar-adc-charge-simulator-tb6qdh`; no pull request unless asked.

## Rules that always hold

- Plain answers. Formulas in full, with symbols and units. Never present a derived value as established.
- Every value has a status: S (paper and page), D (derived), A (assumption), U (owner decision). Defaults are the owner's values. Unknown stays unset.
- Flag contradictions, do not resolve them silently; say what each option costs.
- Text in the interface and docs: sentence case, no em or en dashes, no underscores in labels, charge in fC.
- PDK data is under NDA. Imported data lives in `SAR_ADC_Simulator/local-data/` (git ignored) and is never committed or copied into prompts or examples.
- Do not propose quadrature sampling at fs = 4 f0. Do not add an LPF, input driver, FPGA or TGC block to the ADC model. No dynamic receive focusing or multi-line receive. Chen 2018 and MIT values are not the owner's specification.
- Ground truth for formulas: Rabuske 2017 (book). Then Chen 2018, Guo 2024, Malki 2014.
- Output is 10 bits.
- Keep usage low: few tool calls, short reports.

## Where things are (all under `SAR_ADC_Simulator/`)

| What | Where |
|---|---|
| Workbench entry | `zaan_workbench.html`, `css/workbench.css` |
| Shell, menu, summary bar | `src/workbench/app.js` |
| Every user value, with status | `src/workbench/values.js` |
| Values to model parameters, the context every page reads | `src/workbench/design.js` (`design(values, ui)`) |
| Side panel groups per page | `src/workbench/designSide.js` |
| Question and answer at the top of each page | `src/workbench/leads.js` |
| One set of names for alpha, C DAC, C node | `src/workbench/names.js` |
| Noise budget lines | `src/workbench/budget.js` |
| Checks (pass, warn, fail) | `src/workbench/checks.js` |
| Formula pop-ups | `src/workbench/formulas.js` |
| Weights and presets | `src/workbench/weights.js` |
| One page per file | `src/workbench/pages/*.js` (`optimizer.js` and `sarOptimizer.js` are not in the menu) |
| Helpers for pages | `src/workbench/kit.js`, plotter `src/ui/plot.js` |
| Charge model, CDAC, steps | `src/zaan/model/cdac.js`, `steps.js`, `chargeSar.js` |
| Matching and Monte Carlo | `src/zaan/model/matching.js`, `montecarlo.js` |
| Timing budget (RC settling, time left per decision) | `src/zaan/model/timingBudget.js`; page `pages/timing.js` |
| Reference charge | `src/zaan/model/reference.js` |
| ngspice bridge and runs | `spice/*.mjs`; results in `src/workbench/data/*.json` |
| MATLAB | `matlab/*.m` (not run yet) |
| Tests | `test/*.test.mjs`, run `npm test` in `SAR_ADC_Simulator/` |
| Audit reports | `docs/audit/` (theory, coupling, interface, fixes applied) |

## Page ids (URL hash)

system, balance, budget, power, redundancy, sar, levels, matching, mismatch, offset, beamformer, chen, logic, timing, reference, iq, values, sources.

## How to work

- Start the server: `(node tools/serve.mjs >/dev/null 2>&1 &)`, then http://localhost:8080/zaan_workbench.html#timing. It can die between calls; restart it before a browser run.
- Run tests quietly: `npm test 2>&1 | grep -E "^# (pass|fail|todo)"`.
- Test first for model code. Existing tests must keep passing; `test/fixtures/coupling-baseline.json` guards the default numbers.
- Source texts: extracts in the scratchpad `papers/`; PDFs in the uploads folder. Read only the pages a question needs.

## Looking at the page (screenshots)

- Crop to one card or section, not the whole page: use an element screenshot (`page.locator('#tbBars').screenshot()`), width 1440, scale 1.
- Full-page screenshots only once per round, and only to judge layout.
- Check numbers with a script that reads the page text, not with a picture.

## Publishing

- Published copy: https://claude.ai/artifact/YAcP1X72rA5CthqjLP7jK8 (republish with the Artifact tool, same URL; list its files first if refused). Frozen copy, never touch: https://claude.ai/artifact/RuUJNq4TD6BAGHhbX5SA2p.
- The publish folder and its steps live in the session scratchpad and may be gone; rebuild from `zaan_workbench.html`, inlining `css/workbench.css`.

## Open decisions (owner's, not decided)

alpha 0.4 or 1; 12 or 13 decisions; offset comparison or not; two CDACs (Chen) or reservoir (Guo); read-slot gain calibration; receive focus and cells needed (known link not wired, formula change needs approval); switch resistance and sizing (needs the PDK); comparator architecture (timing leaves about 1.8 to 2.1 ns per decision on average; comparator and logic delay not set).
