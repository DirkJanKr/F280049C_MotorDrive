%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%   STEP 7g: PLATE PARASITICS OF THE CDAC: HOW LARGE, HOW UNBALANCED?     %
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
% QUESTION
% Every CDAC capacitor has a parasitic capacitance to ground on each plate.
% How large may they be, and how unequal, before the conversion suffers,
% with nominal weights and after calibration? (Rabuske 4.5)
%
% ANSWER (ideal capacitors, w_design, V_CM = 0.6 V A; D, from this simulation)
% The parasitics cause NO nonlinearity worth mentioning here, even fully
% unbalanced (ENOB lost < 0.1 bit, nominal and calibrated, p up to 0.5).
% What they do is change the GAIN: every step moves a bit more or less charge.
%   - large parasitic on the plate precharged to V_REF: less input per code,
%     the ends saturate (up to about 7 % of the range at p = 0.2, u = 2, 0.9 V)
%   - large parasitic on the other plate: more input per code, codes stay
%     unused at the ends (0.28 bit lost at p = 0.2, u = -2, 0.6 V)
% The gain depends on V_CM as well. Both are fixed by setting the gain:
% V_REF (external, so it can be trimmed) or C_TH (Rabuske eq. 4.43), or by
% keeping the parasitic small (p < 0.1) and the plates balanced.
% Where unbalance is large, the per-decision error stays inside the
% redundancy tolerance; for plain binary Rabuske finds < 0.2 bit if p < 0.2.

% THE STORY
% A step capacitor floats: after precharge, plate a holds +C V_REF and plate
% b holds -C V_REF. The SAR connects it straight (a to N, b to P) or crossed.
% Each plate drags its own parasitic C_pa or C_pb along, and that parasitic
% holds charge to ground, not between the nodes.
%   - If C_pa = C_pb (balanced), both nodes get the same extra capacitance
%     whichever way the step is connected. The differential charge is not
%     disturbed; only the node grows a bit more, so the gain changes slightly
%     (Rabuske: balanced parasitics give no linearity error, eq. 4.17).
%   - If C_pa differs from C_pb, the node that gets the larger parasitic
%     depends on the decision. Then the P and N nodes are no longer equal, the
%     common-mode charge leaks into the difference, and the error depends on
%     the code: nonlinearity.
% A MIM capacitor is unbalanced by nature: its bottom plate sits close to the
% substrate and has a much larger parasitic than the top plate. That is why
% layouts split every step into two halves mounted opposite ways (half the
% units with the bottom plate on side a, half on side b): each terminal then
% sees the same parasitic, unbalance near 0. Steps of one unit or less (8 LSB
% and the halving steps) cannot be split that way.
% Symbols (as Rabuske Fig. 4.10):
%   p = average plate parasitic / C of that step       (C_p / C_0)
%   u = (C_pa - C_pb) / average                         (Delta C_p / C_p, 0 .. 2)
% Rabuske's result for binary up to 10 bit: less than 0.2 bit ENOB lost
% whenever p < 0.2, at any unbalance. His C_TH is resized for the gain (4.43).
%
% HAND CHECK
% Balanced, p = 0.1: the last node gets 0.1 x C_DAC = 0.22 pF extra on each
% side. Only the gain changes: about C_TH / (C_TH + ...) style, a few percent.
% Fully unbalanced (u = 2): plate a carries 2 p C, plate b none. The decision
% pattern decides which node gets it, so the nodes differ by up to p C_DAC.
%
% WHAT THE CODE DOES
%   1) a single-ended model: P and N nodes, every plate with its parasitic,
%      solved by charge conservation on each node (2 equations, 2 unknowns)
%   2) a ramp over the range for a grid of p and u
%   3) output read with the nominal weights and after least-squares
%      calibration of the weights; the ENOB lost against the ideal rounding error

clear; close all; clc;
zaan_constants;
C_TH  = N_ch * C_M;                       % memory capacitance per side [F]
Q_LSB = C_TH * V_FS / 2^N_bits;
V_REF = alpha * V_FS / 2;
V_CM  = 0.6;                              % input common mode [V]                 A
w     = w_design;  n = numel(w);
C_k   = w * Q_LSB / (2 * V_REF);          % ideal step capacitors [F]
xd    = (-511 : 0.05 : 511) * Q_LSB;      % differential input charge [C]
e_id  = 1/sqrt(12) * w(end);              % rms error of the ideal conversion [LSB]

p_list = [0.02 0.05 0.1 0.2 0.5];
u_list = [0 1 1.5 2 -2];           % u < 0: the large parasitic on plate b instead
fprintf('    p      u   max err nominal  ENOB lost  max err calibrated  ENOB lost  input per code  range lost  bits lost to unused codes\n');
for p = p_list
  for u = u_list
    %% 1) single-ended conversion, every plate with its parasitic
    C_pa = p * C_k * (1 + u/2);           % plate a: precharged to V_REF   (A: the bottom plate)
    C_pb = p * C_k * (1 - u/2);           % plate b: precharged to 0
    QP = C_TH * (V_CM + xd/(2*C_TH));     % node charges after sampling [C]
    QN = C_TH * (V_CM - xd/(2*C_TH));
    CpP = zeros(size(xd));  CpN = CpP;  Cc = 0;      % parasitics on P, on N; coupling
    S = zeros(n+1, numel(xd));
    for k = 1:n+1
        det = (C_TH + CpP + Cc) .* (C_TH + CpN + Cc) - Cc^2;   % solve the 2 x 2 system
        VP  = ((C_TH + CpN + Cc) .* QP + Cc * QN) ./ det;
        VN  = ((C_TH + CpP + Cc) .* QN + Cc * QP) ./ det;
        s   = 2*(VP >= VN) - 1;  S(k, :) = s;
        if k > n, break, end
        qa  = (C_k(k) + C_pa(k)) * V_REF;  qb = -C_k(k) * V_REF;   % plate charges
        up  = s > 0;                      % P too high: plate b (-) to P, plate a (+) to N
        QP  = QP + up .* qb + ~up .* qa;
        QN  = QN + up .* qa + ~up .* qb;
        CpP = CpP + up .* C_pb(k) + ~up .* C_pa(k);
        CpN = CpN + up .* C_pa(k) + ~up .* C_pb(k);
        Cc  = Cc + C_k(k);
    end
    %% 2) read the decisions: nominal weights, and calibrated weights
    x  = xd / Q_LSB;                                % input [LSB]
    yn = [w, w(end)/2] * S;                         % nominal output [LSB]
    % Inputs beyond the reach of the steps saturate (overrange used up):
    % count them apart, measure errors only where the converter still reaches.
    ok = abs(yn) < sum(w) - 2;
    reach = 100 * mean(ok);                         % share of the input range converted [%]
    x = x(ok);  yn = yn(ok);  S = S(:, ok);
    A  = [S', ones(numel(x), 1)];
    Wc = A \ x';                                    % least-squares weights (calibration)
    yc = (A * Wc)';
    g  = polyfit(x, yn, 1);  en = yn - polyval(g, x);   % remove gain and offset
    ec = yc - x;
    % The parasitics make every step a bit larger (plate a brings C_pa V_REF
    % along), so one code covers more input: a gain change, not an error.
    % Errors are therefore measured in the converter's OWN code size, 1/g(1).
    ec = ec * g(1);
    fprintf('%5.2f  %5.1f  %10.2f LSB  %7.2f bit  %12.2f LSB  %7.2f bit  %10.3f  %9.1f %%  %10.2f bit\n', p, u, ...
            max(abs(en)), log2(std(en)/e_id), max(abs(ec)), log2(std(ec)/e_id), 1/g(1), 100 - reach, max(0, log2(1/g(1))));
  end
end
