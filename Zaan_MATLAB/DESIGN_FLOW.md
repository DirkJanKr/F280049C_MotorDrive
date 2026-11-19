# Zaan MATLAB design flow

One step at a time. Each step answers one question, works in charge (Q = Q+ - Q-),
prints the hand calculation next to the simulation, and hands one result to the next
step. A step is done when its check passes and I can explain every line.
alpha = 1 throughout.

| Step | Question | Needs | Gives | Status |
|---|---|---|---|---|
| 0 | How big is one LSB, the full scale, each step and each memory cell, in charge? | params | Q_LSB, Q_FS, C_M, step charges | done |
| 1 | Does one ideal conversion, followed decision by decision, end within ½ LSB of the input? | 0 | the conversion function, checked | |
| 2 | Is a wrong decision repaired exactly when its error is within the tolerance? | 1 | proof of the tolerance formula by simulation | |
| 3 | What noise charge does each source give, and what is left for the comparator? | 1 | comparator noise spec for Cadence | |
| 4 | How large must the memory cells be so their mismatch gives low enough tones? | 0 | C_M (may change step 0) | |
| 5 | How large is the error charge per step, and what tolerance does each decision need? | 2, 4 | the weight list, incl. overrange | |
| 6 | What do calibration and rounding to 10 bit leave? | 5 | ENOB, DNL, INL | |
| 7 | How long must each step settle, given what the errors leave? | 5, Cadence switch | switch size, timing | |

Why this order:
- 1 and 2 build the model and prove the redundancy idea before it is used for design.
- 3 comes early because Cadence needs a comparator noise target now.
- 4 comes before 5: a larger memory cell at alpha = 1 means a larger CDAC, which
  changes the mismatch of every step.
- 7 comes last because settling needs a real switch resistance from the PDK.
