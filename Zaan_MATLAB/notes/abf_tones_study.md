# Beamformer (ABF) tones: where they come from, and where to break the chain

Study of 25 Nov 2026. Status per claim: S (paper and page), D (derived), A (assumption or own idea).
No PDK values in this file.

## 1. The story, following the charge

1. **Sampling.** The AFE of channel j drives its memory cell k through a switch. The cell capacitor
   C jk fills until the switch opens. The charge left on it is

   Q jk = C jk · v j · s jk + q inj,jk(v j) + noise

   - C jk: the real capacitance of that cell (mismatch: σ = A C / √C M per capacitor).
   - s jk = 1 − e^(−t / τ jk): how far it settled (1 if fully settled; at 95 % it depends on τ jk, so on the cell's own switch and capacitor).
   - q inj,jk: charge the switch dumps when it opens (channel charge and clock feedthrough). Part of it is fixed (an offset), part depends on v j because V GS of a non-bootstrapped switch depends on v j.
2. **Hold.** The charge waits d j samples (the steering delay of channel j). Leakage is small at under 550 ns (A).
3. **Read and sum.** At read slot n, one cell of every channel is connected to the CDAC node. Charges add:

   Q sum[n] = Σ j ( C j,c j(n) · s j,c j(n) · v j + q inj,j,c j(n) )

   with c j(n) = mod(n − d j, 22): the cell index walks through 22 cells.
4. **Why tones appear.** For a steered echo every channel carries the same signal x after its delay, so

   Q sum[n] = 16 · C M · ( G[n] · x[n] + O[n] )

   - **G[n]** = mean over the 16 cells read at slot n of (C · s / C M): a **gain ripple**.
   - **O[n]** = sum of their injection charges: an **offset ripple**.
   - For a fixed steering angle the set of 16 cells read at slot n repeats every 22 samples. So G and O are 22-periodic.
   - Gain ripple times the signal: tones at f sig ± k · fs / 22 (multiplicative).
   - Offset ripple: tones at k · fs / 22 = k · 1.82 MHz, whatever the signal (additive). Inside 7 to 13 MHz: k = 4 to 7 (7.27, 9.09, 10.91, 12.73 MHz).
5. **Size of the gain ripple (D, s2b).** σ G = σ cell / √16, with σ cell = σ cap / √2 (P and N averaged).
   At 280 fF and A C 0.0499: σ G ≈ 0.05 %, total tones about −65.6 dBc.

## 2. What the tones look like in the image (the reframing)

- 22 samples = 550 ns. Two-way depth: Δz = c · T / 2 = 1540 m/s · 550 ns / 2 = **0.42 mm** (D).
  So the ripple is a **depth pattern repeating every 0.42 mm**, the same on every line (fixed angle): horizontal stripes.
- **Gain ripple is multiplicative:** it is about 66 dB below each echo, wherever the echo is.
  The array's own sidelobes are far higher (rectangular 16-element aperture: −13 dB first sidelobe; with apodization typically −30 to −40 dB, A).
  So in the image the gain tones hide under the echo and under the sidelobes (D).
- **Offset ripple is additive:** it does not scale with the echo. In dark regions (cysts, vessels) it is all that is left,
  so there it is visible as stripes. Chen saw exactly this: "the ripple pattern introduced by delay-line mismatches appears as in-band interference tones at fS/8 (3.75 MHz) and its harmonics" (S, Chen 2018 p. 3059).
- **Consequence (D):** the sine-wave ENOB counts gain tones as noise, but for the image the offset ripple matters more.
  This affects the C M 280 or 560 fF and MIM or MOM memory decisions: they reduce gain tones, which the image barely sees.

## 3. Where the chain can be broken

| # | Link in the chain | Trick | From | Cost | Status |
|---|---|---|---|---|---|
| 1 | Sampling: injection depends on v j | **Bottom-plate sampling** (open the switch on the fixed-potential side slightly earlier): the injection becomes independent of the signal, so it turns into a pure offset | switched-capacitor filters | one extra clock phase | A (standard technique) |
| 2 | Sampling: injection P versus N | Differential cell with matched switches, or dummy half switches: the common part cancels | SC circuits | small | A |
| 3 | Sampling: s jk depends on τ jk | Settle fully (7 τ or more), so gain no longer depends on the switch of each cell | (thought experiment, 95 %) | sampling time | D |
| 4 | Offset ripple O[n] | **Subtract a pre-recorded pattern**: 22 values per steering angle, measured with grounded inputs | Chen 2018 p. 3059 (100 iterations) | digital memory and a subtractor | S |
| 5 | Fixed 22-periodic order | **Random start cell per transmit line**: add a pseudo-random value to the cell counter at the start of each cycle. The stripes move every line, so they no longer line up in the image | patents US 11740208, US 11067544 (switched-capacitor delay line); TI-ADC channel randomization | an adder in the counter; no extra cells | S (patent) |
| 6 | Gain ripple G[n] | **Read-slot gain calibration**: divide each output by G θ[n mod 22]. Store the 352 cell gains once; compute the 22 slot gains for any angle | TI-ADC gain correction (Seo, Rodwell: divide each sub-converter output by its gain estimate) | 22 numbers per angle, one multiply per sample | A |
| 7 | Measuring G without a test signal | **Blind background estimation**: echoes are statistically alike in every slot, so equalize the mean power per slot over many lines. Needs trick 5, otherwise slot and depth are tied | TI-ADC blind calibration (Seo, Rodwell, Madhow; Divi, Wornell) | accumulators, slow | A |
| 8 | Gain ripple G[n], analog | **Mismatch-aware cell order (sort and combine)**: measure the cell gains once, then choose the cell order of each channel so that every read slot combines high and low cells and all slot sums come out equal. No multiply per sample | element sorting in DACs and flash ADCs (own transfer, A) | programmable cell addressing, one measurement | A (idea) |
| 9 | Fully random cell choice | 1 or 2 spare cells per channel, so the next cell can be chosen at random: tones become a noise floor (same power, no spurs) | TI-ADC randomization (needs a redundant channel) | 5 to 9 % more cells | S (patents), A for here |

## 4. My ranking (A, to discuss)

1. **Make injection signal-independent and balanced** (tricks 1, 2). This is the root: it turns a signal-dependent error into a fixed one, which tricks 4 and 5 then handle.
2. **Random start cell per line** (trick 5). Almost free, breaks the stripes, proven in patents.
3. **Pattern subtraction** (trick 4). Proven by Chen on the same kind of chip.
4. **Read-slot gain calibration** (tricks 6, 7) only if the sine-wave ENOB stays the specification. This is the open decision "read-slot gain calibration".
5. **Sort and combine** (trick 8): a possible thesis contribution. It removes the gain ripple in the analog domain with one foreground measurement and no per-sample multiply. Not found in the ultrasound literature (search of 25 Nov, abstracts only).

## 5. To check in MATLAB (step 2b, locally)

- Add an offset ripple (injection) next to the gain ripple, and show both as an image of depth against line.
- Trick 5: random start cell per line; does the stripe pattern disappear after averaging lines?
- Trick 8: with 16 × 22 random cell gains, how far does a greedy sort reduce σ G?
- Off-axis echoes: does trick 6 still help when the channels do not carry the same signal?

## Sources

- Chen 2018, JSSC 53(11), p. 3055 (memory cells), p. 3059 (ripple subtraction).
- Switched-capacitor delay line, access-order randomization: https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/11740208 and https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/11067544
- TU Delft ultrasound ASIC with mismatch scrambling: https://repository.tudelft.nl/file/File_25502656-9283-4a79-a3a1-424e562b8176
- TI-ADC gain correction and blind calibration: https://koreascience.kr/article/JAKO201444164660314.pdf ; https://web.ece.ucsb.edu/Faculty/rodwell/publications_and_presentations/publications/seo_ICASSP_2007_digest.pdf ; https://sia.mit.edu/dev_site/wp-content/uploads/2015/04/2009-divi-wornell-stsp.pdf
- TI-ADC channel randomization: https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/12542561 ; https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/8890729
