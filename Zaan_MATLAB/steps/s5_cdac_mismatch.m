%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%          STEP 5: THE CDAC FROM REAL CAPACITORS, AND ITS MISMATCH        %
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
% QUESTION
% Built from PDK unit capacitors, how large is the charge error of each CDAC
% step, and what does that do to a plain binary converter?
%
% ANSWER (alpha = 1, C_M = 280 fF, 35 fF units)
% 64 units; one unit = 35 fC = 8 LSB. The largest step (32 units, 1120 fC)
% has a spread of 1.67 fC = 0.38 LSB. At mid-scale all steps change over and
% the DNL there has a spread of about 0.54 LSB: 3 sigma is about 1.6 LSB, over
% ½ LSB, and about 2 % of the chips lose a code. Binary does not work here.
% NOTE: this is half of the formula on my backup slide (2^B A_C / sqrt(C_DAC));
% see section 4: the first decision needs no capacitor, so the errors count once.
%
% Still binary weights on purpose: this shows the PROBLEM. Redundancy is step 6+.
% Steps below one unit are made by charge halving of one unit (no capacitor
% smaller than 35 fF).

clear; close all; clc;
zaan_constants;
rng(4, 'twister');         % fixed random numbers: the same chips every run

% from steps 0 and 3
C_TH  = N_ch * C_M;
Q_FS  = C_TH * V_FS;
Q_LSB = Q_FS / 2^N_bits;
V_REF = alpha * V_FS / 2;
C_DAC = Q_FS / (4 * V_REF);

%% -----------------------------
% 1) The unit capacitor and what one unit is worth
% -----------------------------
Q_unit  = 2 * C_u * V_REF;                 % one unit moves Q by 2 C_u V_REF [C]
lsb_u   = Q_unit / Q_LSB;                  % ... which is this many LSB
n_units = C_DAC / C_u;                     % units the charge balance asks for
sig_u   = A_C / sqrt(C_u * 1e15);          % relative spread of one unit (Pelgrom)
fprintf('one unit: %.0f fF, moves Q by %.1f fC = %.0f LSB; spread %.2f %%\n', ...
        C_u*1e15, Q_unit*1e15, lsb_u, sig_u*100);
fprintf('the CDAC of %.2f pF is %.0f units\n\n', C_DAC*1e12, n_units);

%% -----------------------------
% 2) Binary steps, in units: whole units down to 1 unit, then halving
% -----------------------------
w     = 2.^(N_bits-2 : -1 : 0);            % step weights in LSB: 256 ... 1
units = w / lsb_u;                         % in units: 32 16 8 4 2 1 0.5 0.25 0.125
whole = units >= 1;                        % true for steps made of whole units
% A step of n whole units is n capacitors in parallel: their errors add in
% power, so its relative error is sig_u / sqrt(n).
% A halved step is part of the charge of ONE unit; I give it the relative error
% of one unit, sig_u. That is an ASSUMPTION: the halving itself also depends on
% how well the sharing capacitors match. It gets its own look later.
sig_rel = sig_u ./ sqrt(max(units, 1));    % relative spread per step
sig_rel(~whole) = sig_u;                   % halved steps: the assumption above
Q_step  = w * Q_LSB;                       % nominal charge per step [C]
sig_Q   = sig_rel .* Q_step;               % spread of each step's charge [C]

fprintf(' step   weight [LSB]   units   charge [fC]   spread [fC]   spread [LSB]\n');
for k = 1:numel(w)
    fprintf('%5d %12.0f %9.3f %12.2f %13.3f %13.3f\n', k, w(k), units(k), ...
            Q_step(k)*1e15, sig_Q(k)*1e15, sig_Q(k)/Q_LSB);
end

%% -----------------------------
% 3) Many chips: the DNL of the code just above mid-scale
% -----------------------------
% At mid-scale the first decision flips and every later step changes over,
% so the errors of all steps land in one code transition.
% A slow ramp from -4 to +4 LSB around mid-scale; count how often code 0 comes
% out: that count times the ramp step is the width of code 0 (histogram method).
dx    = 0.005;                             % ramp step [LSB]
x     = -4 : dx : 4;                       % input charge [LSB]
n_chips = 2000;
DNL = zeros(1, n_chips);
for chip = 1:n_chips
    Q_real = Q_step .* (1 + sig_rel .* randn(size(w)));   % this chip's steps [C]
    r     = x * Q_LSB;
    Q_out = zeros(size(x));
    for k = 1:numel(w)
        s = 2*(r >= 0) - 1;
        r = r - s * Q_real(k);             % the real charge goes onto the nodes
        Q_out = Q_out + s * Q_step(k);     % the converter adds the nominal weight
    end
    s = 2*(r >= 0) - 1;
    Q_out = Q_out + s * Q_step(end)/2;
    code = round(Q_out/Q_LSB - 0.5);       % ... -1, 0, 1, ... around mid-scale
    DNL(chip) = sum(code == 0) * dx - 1;   % width of code 0 minus 1 LSB
end

%% -----------------------------
% 4) Check against the hand formula
% -----------------------------
% Code 0 starts exactly at 0: the first decision compares the input with zero
% and needs no capacitor, so it has no error. Code 0 ends where the real first
% step minus all the later real steps lands. So its width is
%     1 LSB + (error of step 1 - errors of all later steps)
% and the errors of all steps count ONCE, added in power:
%     sigma_DNL = sqrt( sum of sig_Q^2 ) / Q_LSB  ~  2^(B-1) A_C / sqrt(C_DAC in fF)
% My backup slide used 2^B A_C / sqrt(C_DAC): twice as much. That counted every
% reversal twice; the simulation and this reasoning say once.
hand     = sqrt(sum(sig_Q.^2)) / Q_LSB;
hand_old = 2^N_bits * A_C / sqrt(C_DAC*1e15);
fprintf('\nDNL at mid-scale over %d chips: spread %.2f LSB, 3 sigma %.1f LSB\n', n_chips, std(DNL), 3*std(DNL));
fprintf('hand: sqrt(sum of step spreads^2) = %.2f LSB;  old slide formula: %.2f LSB\n', hand, hand_old);
fprintf('chips that lose code 0 (DNL = -1): %.1f %%\n', 100*mean(DNL <= -1 + 1e-9));
fprintf('3 sigma < 0.5 LSB with binary steps would need C_DAC = (3 x 2^(B-1) x A_C / 0.5)^2 = %.1f pF\n', ...
        (3 * 2^(N_bits-1) * A_C / 0.5)^2 / 1000);
if abs(std(DNL)/hand - 1) < 0.1, disp('CHECK OK'), else, disp('CHECK FAILED'), end

figure; hist(DNL, 40); grid on;
xlabel('DNL of the code above mid-scale [LSB]'); ylabel('number of chips');
title('Binary CDAC from 35 fF units: DNL at mid-scale');
