# Proof of the tolerance rule (step 7b)

Script: `steps/s7b_tolerance_proof.m`, about 75 s in Octave. Weights w = [224 128 72 40 24 16 8 4 2 1 0.5 0.5] LSB, 500 chips with PDK mismatch, v_os = 0.15 mV, ramp over +-517 LSB in steps of 0.03 LSB, real weights read (perfect calibration), no rounding. Error is output minus input, with the offset shift of the last decision removed. The last two decisions have no tolerance, so their fixed errors go straight to the output: allowed error = half last step (0.25 LSB) + those errors (about 0.013 LSB). Every chip exceeds 0.25 LSB by that tail, so the strict count is 100 % and is not the test.

## T1 Rule satisfied
Largest eps_settle with need <= t at every decision: 0.0046 (decision 6 binds: t = 0.5, mismatch 0.37, offset 0.02, settling 24 eps). Result: max error 0.261 LSB, largest allowed 0.263 LSB, 0 of 500 chips above allowed, 0 chips with an own-tolerance excess. The stricter tolerance t - 0.5 w(end) is not needed: 20 % of chips exceed it and none fail. So t is the right limit. Codes are not lost.

## T2 Rule violated (200 chips)
| excess at first decision | eps_settle | chips failing | max error minus allowed |
|---|---|---|---|
| 0.1 LSB | 0.0088 | 1.5 % | 0.045 |
| 0.5 LSB | 0.0254 | 83.5 % | 0.43 |
| 1.0 LSB | 0.0463 | 100 % | 0.91 |
The same with v_os (0.94, 4.06, 7.97 mV, large because decision 6 sees little offset): 1.5 %, 73 %, 100 %; max error 0.04, 0.39, 0.82 over allowed. The decisions with need > t are 6 (and 7, 8, 9 at 1 LSB). A replay of the worst input shows the residual first leaves the range the later steps can cover at decision 6. The chip-by-chip prediction (own real excess > 0.02 LSB) agrees with the simulated failure in 86 to 100 % of chips; measured error is up to 0.14 LSB below the predicted excess.

## T3 Linear sum against root-sum-square
Scale s multiplies both v_os and eps_settle of T1. Largest s accepted: linear 1.00, mismatch random but offset and settling added 2.59, full root-sum-square 3.00. Chips failing at that s: 0 %, 5.5 %, 13.5 %. So root-sum-square is unsafe: offset and settling are fixed and align in sign (settling follows the previous decision, offset has one sign). Linear adding of those two is needed. The only conservative part is the 3 sigma mismatch: a chip breaks at s = 1.33 at the earliest, 1.41 at 1 %, 3.74 at the median. Real failures start at s = 1.5 (1 %).

## T4 Noise only (nominal weights, 200000 random inputs)
Excess rms = sqrt(total rms^2 - quantisation floor^2), against v_n C_node(end) / Q_LSB.
| v_n | last decision | redundant excess | binary excess |
|---|---|---|---|
| 50 uV | 0.106 LSB | 0.106 | 0.103 |
| 200 uV | 0.426 LSB | 0.326 | 0.400 |
| 500 uV | 1.064 LSB | 0.692 | 0.876 |
Noise adds at most the noise of the last decision, so it needs no tolerance, and redundancy is not worse than binary.

## Verdict
The rule is correct as stated (sufficient, and t is exact). Linear adding of offset and settling is necessary. Open point: decision 6 allows only 0.46 % unsettled charge on the 24 LSB step, because 3 sigma mismatch uses 0.37 of the 0.5 LSB tolerance there.
