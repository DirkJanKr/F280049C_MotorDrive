// Where the design stands: what was done, what is being done now and why, what comes next.
// Kept by hand together with WHERE_WE_ARE.md at the repo root (same content, this one with links).
// status: done, now, next, later. links: [label, href]; '#id' is a workbench page.

export const UPDATED = '27 Nov 2026';

const GH = 'https://github.com/DirkJanKr/F280049C_MotorDrive/blob/claude/sar-adc-charge-simulator-tb6qdh/';
const m = (file) => GH + 'Zaan_MATLAB/steps/' + file;

export const NOW = {
  title: 'Comparator in Cadence (gm/ID sizing first)',
  why: 'MATLAB has given the comparator its specification (smallest input, noise, offset, kickback, time per decision). The open choices that remain (12 or 13 decisions, switch size, noise target) all wait for real comparator numbers, so the comparator is the bottleneck of the design now.',
  links: [['Weight design method (supervisor meeting)', 'https://claude.ai/artifact/6Gu4HmfiHjnYApi2Lp8x7b'], ['Comparator specification', '#comparator'], ['Timing table', '#timing'], ['gm/ID tables', GH + 'Zaan_MATLAB/gmid/README.md']],
};

export const PHASES = [
  {
    title: 'System and charge balance',
    status: 'done',
    why: 'Everything else follows from the memory cell and alpha: at alpha = 1, V REF, C DAC and the node the comparator sees are fixed.',
    steps: [
      ['Specification in charge: Q FS 4480 fC, Q LSB 4.375 fC', 'done', [['Charge balance', '#balance'], ['MATLAB s0', m('s0_charge_scale.m')]]],
      ['Memory cell: kT/C, gain tones, extra charge per cell', 'done', [['Noise budget', '#budget'], ['MATLAB s2a to s2c', m('s2b_memory_mismatch_tones.m')]]],
      ['Charge balance at alpha = 1: V REF 0.5 V, C DAC 2.24 pF (decided 18 Nov)', 'done', [['Charge balance', '#balance'], ['MATLAB s3', m('s3_charge_balance.m')]]],
      ['Noise budget: what is left for the comparator', 'done', [['Noise budget', '#budget'], ['MATLAB s4', m('s4_noise_budget.m')]]],
    ],
  },
  {
    title: 'CDAC weights and redundancy',
    status: 'done',
    why: 'Mismatch, comparator offset and incomplete settling are fixed errors; redundancy must absorb them decision by decision, so the weights are designed from those needs.',
    steps: [
      ['Mismatch of a binary CDAC: DNL 2^(B−1) A C / √C DAC; with MIM binary needs 23.5 pF, with MOM 1.0 pF', 'done', [['CDAC matching', '#matching'], ['MATLAB s5', m('s5_cdac_mismatch.m')]]],
      ['PDK Monte Carlo of MOM and MIM: MOM matches far better and follows Pelgrom (27 Nov)', 'done', [['CDAC matching', '#matching']]],
      ['Reasons for redundancy with MOM: speed, absorbing comparator offset', 'done', [['Why redundancy', '#why']]],
      ['Tolerance rule t k = later steps + w last − w k, proven', 'done', [['Conversion', '#sar'], ['MATLAB s6', m('s6_tolerance_rule.m')]]],
      ['Fixed errors per decision, added linearly (root-sum-square lets 19 % of chips fail)', 'done', [['Conversion', '#sar'], ['MATLAB s7a', m('s7a_errors_per_decision.m')], ['s7e', m('s7e_linear_vs_rss.m')]]],
      ['Weights from the needs: w design = 200 160 80 40 16 16 8 4 2 1 1 at 3.7 τ', 'done', [['Weights', '#redundancy'], ['Timing table', '#timing'], ['MATLAB s7b', m('s7b_design_weights.m')]]],
      ['A wait per step instead of one wait for all: settling 26.4 τ instead of 40.7 τ, 200 chips convert right', 'done', [['Timing: wait per step', '#timing'], ['MATLAB s7b2', m('s7b2_wait_per_step.m')]]],
      ['Offset limit: 4.2 mV at 4.6 τ without margin, only 0.39 mV with w design at 3.7 τ and 0.2 LSB margin; parasitics (gain only); noise sources simulated', 'done', [['Offset', '#offset'], ['MATLAB s7f', m('s7f_offset.m')], ['s7g', m('s7g_parasitics.m')], ['s7h', m('s7h_noise_sources.m')]]],
      ['Calibration and rounding: ENOB 9.38 (12 decisions) or 9.58 (13), with memory tones of a differential cell', 'done', [['Noise budget', '#budget'], ['Levels and rounding', '#levels'], ['MATLAB s8', m('s8_calibration.m')]]],
    ],
  },
  {
    title: 'Comparator (Cadence)',
    status: 'now',
    why: 'The comparator sets the time per decision and the noise floor at the last decisions; its delay ratio r decides between 12 and 13 decisions.',
    steps: [
      ['gm/ID slides (ET4252) read', 'done', [['gm/ID notes', GH + 'Zaan_MATLAB/gmid/README.md']]],
      ['gm/ID lookup tables: generic 180 nm now, PDK tables at the office', 'now', [['gm/ID README', GH + 'Zaan_MATLAB/gmid/README.md']]],
      ['Choose double-tail (as Chen 2018, Schinkel 2007) or StrongArm; read Razavi 2015 and Schinkel', 'next', [['Comparator', '#comparator']]],
      ['C1 hand model of the double-tail (Schinkel 2007, Razavi 2015): about 0.4 ns at 1 LSB, generic values', 'done', [['Comparator flow', GH + 'Zaan_MATLAB/comparator/README.md']]],
      ['First schematic, sized from the tables', 'next', [['Comparator', '#comparator']]],
      ['Delay against input: τ reg and r for the time table', 'next', [['Timing table', '#timing'], ['Comparator', '#comparator']]],
      ['Noise (probability of a 1, or PSS and PNOISE), offset Monte Carlo, kickback', 'next', [['Comparator', '#comparator'], ['Noise budget', '#budget']]],
    ],
  },
  {
    title: 'Switches, timing and the SAR logic',
    status: 'next',
    why: 'With the comparator delay known, the settling window per step follows, and from it the unit switch; the logic loop may dominate (1.2 ns per bit in a 180 nm thesis).',
    steps: [
      ['Unit switch R on from the settling window, width from the gm/ID table', 'next', [['Timing: unit switch', '#timing']]],
      ['Choose 12 or 13 decisions from the time table', 'next', [['Timing table', '#timing']]],
      ['SAR logic loop delay (flip-flop to switch driver, asynchronous trigger)', 'later', [['Self-timed logic', '#logic']]],
      ['Count hard decisions per conversion in MATLAB (step 9)', 'later', [['Timing', '#timing']]],
    ],
  },
  {
    title: 'MATLAB teach-back (one step per day, next to Cadence)',
    status: 'now',
    why: 'You need to be able to explain every step yourself for the thesis.',
    steps: [
      ['Steps 5, 6, 7a, 7b explained together', 'done', [['MATLAB steps', GH + 'Zaan_MATLAB/DESIGN_FLOW.md']]],
      ['7c rule met', 'next', [['MATLAB s7c', m('s7c_rule_met.m')]]],
      ['7d rule broken', 'later', [['MATLAB s7d', m('s7d_rule_broken.m')]]],
      ['7e added against root-sum-square', 'later', [['MATLAB s7e', m('s7e_linear_vs_rss.m')]]],
      ['7f offset, 7g parasitics, 7h noise sources', 'later', [['MATLAB s7f', m('s7f_offset.m')], ['s7g', m('s7g_parasitics.m')], ['s7h', m('s7h_noise_sources.m')]]],
      ['8 calibration and rounding', 'later', [['MATLAB s8', m('s8_calibration.m')]]],
    ],
  },
  {
    title: 'Beamformer, reference and IQ (kept for understanding and the thesis)',
    status: 'later',
    why: 'Part of the thesis; not on the critical path this week.',
    steps: [
      ['Memory cells per channel: 22 for ±15°', 'done', [['Beamformer', '#beamformer']]],
      ['Mismatch tones with charge injection; injection per cell still a placeholder', 'now', [['Mismatch tones', '#tones'], ['Study', GH + 'Zaan_MATLAB/notes/abf_tones_study.md']]],
      ['Receive focus and cells needed (formula change needs approval)', 'later', [['Beamformer', '#beamformer']]],
      ['Reference: Guo reservoir, V REF external (decided 18 Nov)', 'done', [['Reference', '#reference']]],
      ['IQ demodulator after the converter', 'later', [['IQ', '#iq']]],
    ],
  },
];

export const DECIDED = [
  'alpha = 1, V REF 0.5 V (18 Nov)', 'C M 280 fF, start value (18 Nov)', 'Guo reservoir reference, V REF external (18 Nov)', 'no MOS capacitors in the CDAC; external calibration with a LUT (18 Nov)',
  'comparator offset: background calibration as Chen 2018 (23 Nov)', 'ENOB below 9.5 accepted; new target not set (23 Nov)', 'w design = 200 160 80 40 16 16 8 4 2 1 1, 3.7 τ (23 Nov)', 'CDAC in MOM, memory cells in MIM (27 Nov)',
];

export const OPEN = [
  ['12 or 13 decisions', 'with a wait per step they are about equally fast (86 τ at r = 5); waits for r from Cadence', '#timing'],
  ['Delay per decision in the self-timed logic', 'a wait per step saves about 35 % of the settling; needs a delay per decision, or at least two (short for the big steps, long for the bottom)', '#timing'],
  ['Comparator noise target', '45 µV needs about 5 times the energy of 100 µV; 100 µV costs about 0.1 bit', '#comparator'],
  ['Offset room of w design', 'only 0.39 mV after calibration at 3.7 τ with the 0.2 LSB margin; Chen leaves about 0.2 mV (D). More room: more tolerance in the small steps or more settling time', '#comparator'],
  ['Double-tail or StrongArm', 'Chen uses double-tail; fits the offset calibration pair', '#comparator'],
  ['Drop the comparator offset calibration?', 'redundancy absorbs about 5 mV raw offset at 12 or 13 decisions; needs a Monte Carlo of the comparator', '#why'],
  ['Charge injection per memory cell', 'sets the injection tones and the limit for smaller cells; Cadence Monte Carlo of the cell switch', '#tones'],
  ['Read-slot gain calibration', 'the memory gain tones are the largest noise line after quantisation', '#budget'],
  ['New ENOB target', 'set after the comparator noise is known', '#system'],
  ['Receive focus and cells needed', 'formula change needs approval', '#beamformer'],
];

export const ASK = [
  'Company MATLAB licence or in-house scripts (PDK data stays on company systems)',
  'PDK model include path and device names for the Spectre gm/ID sweep (ADE: Setup > Model Libraries; Simulation > Netlist > Display)',
];
