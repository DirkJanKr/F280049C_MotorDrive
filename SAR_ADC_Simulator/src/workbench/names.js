// One name for each version of alpha, C DAC and the node capacitance, so that every page says
// which one it shows. With the default values (theory audit, contradictions 1, 2 and 4):
//   alpha, input 0.400; binary array 0.4008; present weights 0.3657; present weights incl. C par = 0.3657 while C par = 0
//   C DAC: charge balance 2.240 pF; binary array 2.2356 pF charge carrying, 2.345 pF incl. halving capacitors;
//          present weights 2.450 pF charge carrying, 2.555 pF incl. halving capacitors
//   C node at the last decision: present weights 6.902 pF; binary array 6.412 pF; ideal binary C TH (1 + 1 / alpha) 6.272 pF
// No calculation changes with these names; they are labels only.

export const NAME = {
  alphaIn: 'alpha, input',
  alphaBin: 'alpha of the binary array',
  alphaW: 'alpha with the present weights',
  alphaEff: 'alpha with the present weights incl. C par',
  cdacBalance: 'C DAC, binary balance',
  cdacPre: 'C DAC charged from V REF',
  cdacBinEff: 'C DAC of the binary array, charge carrying',
  cdacBin: 'C DAC of the binary array incl. halving capacitors',
  cdacEff: 'C DAC with the present weights, charge carrying',
  cdac: 'C DAC with the present weights incl. halving capacitors',
  cnodeW: 'C node at the last decision, present weights',
  cnodeBin: 'C node at the last decision, binary array',
  cnodeIdeal: 'C node at the last decision, ideal binary C TH (1 + 1 / alpha)',
};
