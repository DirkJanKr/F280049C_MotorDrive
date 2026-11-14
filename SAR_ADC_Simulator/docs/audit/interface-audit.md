# Interface audit of the Zaan workbench

Date: 14 Nov 2026. Scope: display only. No formula, default value or computed result was changed.

## Method

A Playwright script opened all 18 pages (`#system` to `#sources`) at 1440, 1280 and 390 px wide, took a full-height
screenshot of each and checked the page by script for:

- horizontal overflow of the document
- elements wider than their card
- tables wider than their wrapper (clipped columns), split into silent (nothing tells the reader) and signalled
- text overlapping inside an SVG, or text running outside its SVG
- captions cut off
- empty cards
- cards in a two-column grid whose content heights differ by more than 2x and 150 px
- console errors and page errors
- text rules: charge in aC, en or em dashes in the page text

I also read the screenshots of the six longest pages (budget, values, mismatch, SAR, timing, charge balance).

## Counts, before and after

| Issue type | 1440 before | 1440 after | 1280 before | 1280 after | 390 before | 390 after |
|---|---|---|---|---|---|---|
| Document overflows sideways | 0 | 0 | 0 | 0 | 0 | 0 |
| Element wider than its card | 1 | 0 | 1 | 0 | 5 | 0 |
| Table wider than its wrapper | 3 | 0 | 10 | 1 | 24 | 23 |
| of these silent (no hint, no sticky column) | 3 | 0 | 10 | 0 | 24 | 0 |
| Text overlap or outside its SVG | 9 | 0 | 10 | 0 | 61 | 51 |
| Caption cut off | 0 | 0 | 0 | 0 | 0 | 0 |
| Empty card | 1 | 1 | 1 | 1 | 1 | 1 |
| Two-column grid with a large blank area | 3 | 0 | 1 | 0 | 0 | 0 |
| Console or page errors | 0 | 0 | 0 | 0 | 0 | 0 |
| Text rules (aC, dashes) | not run | 0 | not run | 0 | not run | 0 |

The one table that still scrolls at 1280 (Weights, "Candidate weight lists", 786 px in 764 px) now says that it
scrolls and keeps its first column in view.

## First screen of the long pages

- Timing budget: the lead answers the question (2.08 ns); the verdict table follows right below the bars. Before,
  the reference name was repeated on all eight rows; it is now a group row, and the numbers are right aligned in mono.
- Noise budget: the verdict box and the budget table answer the question on the first screen. The first column was
  centred (the formula buttons centre their text); it is now left aligned.
- Values: the four-of-48 answer is on the first screen. The value tables were clipped at 1280 and the status
  selector took 110 px for one letter. The groups now flow in two columns without the tall blank areas.
- Mismatch, SAR, charge balance: the answer is in the lead. The two-column rows with one short and one tall card
  are now stacked.

## Fixed

1. Timing budget (`#timing`)
   - Verdict table: the reference scheme is a group row ("two CDACs", "reservoir") instead of a repeated column;
     every time column is right aligned in mono. Seven columns instead of eight.
   - "Time left per decision against switch resistance" and "What Chen and Guo measured in 180 nm" are stacked at
     full width instead of side by side; the plot gets the full width and the blank area next to it is gone.
   - Settling table (nine columns): headers wrap, numbers are right aligned, so it fits at 1280 without scrolling.
   - Caption of the bars said "Amber: CDAC settling"; the settling bars are teal. Now "Teal".
2. Tables on every page (`kit.js`, `workbench.css`)
   - `fill()` now marks columns that hold numbers: header and cells right aligned, mono, tabular figures. Cells a
     page already styled or that hold inputs are left alone.
   - Long headers may wrap; headers of 14 characters or less stay on one line.
   - A table that is still wider than its card gets the line "Wide table: scroll sideways for all columns" and a
     sticky first column; this is checked again after a window resize.
   - Weights list in the Weights table may wrap instead of stretching the table to 1228 px.
3. Budget page formula pop ups: the pop up equation now uses the style of the Matching page: symbols upright in the
   math font at 18 px in ink (as `.eq`), the line with numbers in the math font at 14.5 px (as `.fx`), the result in
   mono in ink instead of bright blue. CSS only, since `formulas.js` is outside my files.
4. Values page: groups in a two-column flow (`.vcols`) instead of a grid that stretched short cards to the height of
   the tall ones; status selector as wide as its letter; number fields 80 px. Nothing clips at 1280.
5. SAR page: "The search" and "Charges per decision" stacked at full width (the table was clipped at 1440). The
   tolerance chart legend is HTML now, so it wraps on a phone instead of running 278 px out of the card. Caption
   said "White tick" for a tick drawn in the ink colour; now "Short tick".
6. Mismatch page: "Why the DNL does not go below about 1 LSB" and "Area on the chip" stacked. Captions said cyan and
   amber for blue and teal, and "the density set on the left" for a value in the side panel; corrected.
7. Charge balance, "What alpha means": headers on two lines and bar labels as name over value, so nothing overlaps at
   1280; the caption said "orange" for the teal CDAC bar.
8. IQ demodulator, hardware diagram: block text on short lines so it stays inside the blocks; the three notes under
   the drawing are an HTML caption, so the last line is no longer cut off at the right edge.
9. Self-timed logic: the one-hot pointer cell 12 was hidden under the DONE box; the registers now end before it and
   the DONE box text is on two lines.
10. Clock sequence after Chen: the last time label ("100 ns") ran out of the drawing; it is right anchored now.
11. Plots (`plot.js`): when the first x label sits in the lower left corner next to the lowest y label, it starts
    at the axis instead of being centred on it. This removed the label collisions on the balance and IQ plots.
12. Checks grid on the budget page: cards keep their own height instead of stretching to the tallest in the row.
13. White text on coloured boxes (matching, mismatch, balance) uses the panel colour token instead of `#fff`.

## Not fixed, and why

- Phone width (390 px): 23 tables still scroll (now all with the hint and a sticky first column), and 51 text
  overlaps remain in fixed-layout drawings (timing bars, conversion steps, beamformer timing, budget power bar,
  comparator decision ticks). The brief asks only that the phone is not broken; nothing overflows the page.
  Fixing these needs a separate phone layout per drawing.
- Weights table at 1280 is 22 px too wide; it now scrolls with the hint and a sticky first column. Shortening its
  headers would change the labels the owner chose.
- "Monte Carlo: many chips" is empty until the reader presses run; its caption says so. This is intentional.
- The noise power bar on the budget page uses the same colour for two pairs of lines (magenta, orange); changing
  the palette of that chart was left out to keep the colour tokens as they are.
- Formula pop ups on other pages share the same markup, so they also changed style; `formulas.js` itself was not
  edited (outside my files).
- The sweep plot of the timing page crowds its four line labels at the lower right because all lines end near zero
  at 2000 ohm. Moving them would need a legend option in the plotter that the other plots do not use.

## Files changed

`css/workbench.css`, `src/workbench/kit.js`, `src/ui/plot.js`, `src/workbench/pages/timing.js`, `sar.js`,
`mismatch.js`, `values.js`, `redundancy.js`, `iq.js`, `logic.js`, `chen.js`, `balance.js`, `matching.js`.

`npm test`: 101 tests, 94 pass, 0 fail, 7 todo.
