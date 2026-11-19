# Zaan MATLAB

Behavioural model of the Zaan charge-sharing SAR ADC, one question per study.
Runs in MATLAB and in Octave, no toolboxes.

| Folder | What |
|---|---|
| `1_settings` | `zaan_params.m`: every input with its status (S, D, A, U). `zaan_derive.m`: what follows from it. |
| `2_circuit` | `cs_sar_convert.m`: one conversion, charge in, charge out, with noise switches. |
| `4_studies` | One script per question. The question is at the top, hand calculation next to simulation. |

## Studies

| Study | Question | Status |
|---|---|---|
| A | Does the simulated noise match the hand calculation, per source, at alpha 0.4 and 1? | done: within 1 % |
| B | How large must the memory capacitors be so that their mismatch gives low enough tones? | next |
| C | What do read-side parasitics and the reset do to alpha and to memory between samples? | |
| D | Mismatch, redundancy and calibration: weights from the errors, overrange, rounding. | |

Run a study: open it and press F5 (MATLAB), or `octave --eval "run('study_A_noise.m')"`.
