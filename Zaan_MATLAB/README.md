# Zaan MATLAB

Behavioural model of the Zaan charge-sharing SAR ADC, built step by step, all in charge
(Q = Q+ - Q-). Runs in MATLAB and Octave, no toolboxes.

- `steps/zaan_constants.m`: every given value with its status (S, D, A, U). Each step runs it at the top.
- `steps/sN_....m`: one script per design step, run with F5 or section by section (Ctrl+Enter).
  Each starts with its question and answer, works the idea out in numbered sections,
  and ends with a check against a hand calculation.
- `DESIGN_FLOW.md`: the order of the steps and their status.

Rule: a noise or error source enters the model only in its own step, where it is
explained and checked. Before that it can only appear as a placeholder, with its
assumption and what is needed to check it.
