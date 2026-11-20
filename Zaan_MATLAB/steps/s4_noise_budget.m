%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%       STEP 4: THE NOISE BUDGET SO FAR, AND WHAT IS LEFT FOR THE         %
%                            COMPARATOR                                   %
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
% QUESTION
% Adding up only what the earlier steps have shown, how much of the ENOB 9.5
% budget is left for the comparator?
%
% ANSWER
% Studied sources: 1.740 fC rms (ENOB 9.54), leaving 0.404 fC rms, so the
% comparator may have at most 45 uV rms. The placeholders together would
% bring the ENOB to 9.42 before the comparator.
%
% Every source is first a CHARGE (rms, fC). To compare and add them:
%   divide by one LSB of charge  ->  the same noise in LSB rms
%   square it                    ->  its power in LSB^2
% Noise sources add in POWER: 3 fC and 4 fC rms together are 5 fC, not 7.
%
% Two lists, kept apart on purpose:
%   STUDIED      worked out and checked in an earlier step
%   PLACEHOLDER  known to exist, not worked out yet: shown with its assumption
%                and what is needed to check it, but NOT used for the target.
% Rounding with calibrated weights comes only with steps 7 and 8.

clear; close all; clc;
zaan_constants;

% from steps 0 and 3
C_TH  = N_ch * C_M;
Q_FS  = C_TH * V_FS;
Q_LSB = Q_FS / 2^N_bits;
V_REF = alpha * V_FS / 2;
C_DAC = Q_FS / (4 * V_REF);
C_end = C_TH + 2 * C_DAC;          % node at the last decision [F]

%% -----------------------------
% 1) STUDIED: rms charge of every source [C]
% -----------------------------
sig_cell = A_C / sqrt(C_M*1e15);           % gain spread of one cell (step 2b)
Q_sig    = Q_FS / (2*sqrt(2));             % rms charge of a full-scale sine [C]

st_name = {'quantisation, ideal 10 bit', 'kT/C of the memory cells', 'memory gain tones, full scale'};
st_q    = [Q_LSB/sqrt(12), sqrt(2*N_ch*kB*T*C_M), sig_cell/sqrt(N_ch)*Q_sig];
st_from = {'step 0', 'step 2a (simulated)', 'step 2b (simulated)'};

%% -----------------------------
% 2) PLACEHOLDERS: rms charge, assumption, what is needed to check [C]
% -----------------------------
jitter = 1e-12;                            % clock jitter [s rms]                     A
ph_name = {'kT/C of the CDAC', 'extra charge per memory cell', ...
           'switch noise during conversion', 'clock jitter on the write'};
ph_q    = [sqrt(4*kB*T*C_DAC), 0.5*Q_LSB/sqrt(12), sqrt(2*kB*T*C_end), ...
           C_TH*2*pi*f_max*jitter*V_FS/(2*sqrt(2))];
ph_why  = {'Rabuske eq. 4.100 (x2 for Q+ - Q-), not simulated yet', ...
           'the 25 % share allowed in step 2c, not a measured value', ...
           'my estimate, upper bound; Rabuske p. 99 names it, no formula', ...
           '1 ps rms assumed; formula not worked out together yet'};
ph_check = {'own step once the CDAC is designed', ...
            'Cadence Monte Carlo of the cell switch', ...
            'Cadence noise simulation of comparator with switched CDAC', ...
            'own step; jitter spec of the system clock'};

%% -----------------------------
% 3) Print: charge first, then in LSB, then as power
% -----------------------------
q_allowed = Q_LSB/sqrt(12) * 2^(N_bits - ENOB_aim);   % total rms for the aim [C]
P_allowed = (q_allowed/Q_LSB)^2;                      % the same as power [LSB^2]
P_sig     = (2^N_bits/2)^2 / 2;                       % full-scale sine [LSB^2]

fprintf('one LSB = %.3f fC; ENOB %.1f allows %.3f fC rms = %.3f LSB = %.4f LSB^2\n\n', ...
        Q_LSB*1e15, ENOB_aim, q_allowed*1e15, q_allowed/Q_LSB, P_allowed);

fprintf('STUDIED                            fC rms   LSB rms     LSB^2   share\n');
for i = 1:numel(st_q)
    x = st_q(i)/Q_LSB;
    fprintf('%-32s %8.3f %9.3f %9.4f %6.0f %%   %s\n', st_name{i}, st_q(i)*1e15, x, x^2, 100*x^2/P_allowed, st_from{i});
end
P_st = sum((st_q/Q_LSB).^2);                          % add in power
fprintf('%-32s %8.3f %9.3f %9.4f %6.0f %%   ENOB %.2f\n\n', 'sum (in power)', sqrt(P_st)*Q_LSB*1e15, ...
        sqrt(P_st), P_st, 100*P_st/P_allowed, (10*log10(P_sig/P_st) - 1.76)/6.02);

fprintf('PLACEHOLDERS                       fC rms   LSB rms     LSB^2   share\n');
for i = 1:numel(ph_q)
    x = ph_q(i)/Q_LSB;
    fprintf('%-32s %8.3f %9.3f %9.4f %6.0f %%\n', ph_name{i}, ph_q(i)*1e15, x, x^2, 100*x^2/P_allowed);
    fprintf('     assumption: %s\n     to check:   %s\n', ph_why{i}, ph_check{i});
end
P_ph = sum((ph_q/Q_LSB).^2);
fprintf('%-32s %8.3f %9.3f %9.4f %6.0f %%   ENOB with them %.2f\n\n', 'sum (in power)', sqrt(P_ph)*Q_LSB*1e15, ...
        sqrt(P_ph), P_ph, 100*P_ph/P_allowed, (10*log10(P_sig/(P_st + P_ph)) - 1.76)/6.02);

%% -----------------------------
% 4) The comparator: its noise v_n is a charge v_n * C_node at the last decision
% -----------------------------
left = P_allowed - P_st;                              % what the studied sources leave [LSB^2]
fprintf('the studied sources leave %.4f LSB^2 = %.3f fC rms\n', left, sqrt(max(left, 0))*Q_LSB*1e15);
if left > 0
    q_comp = sqrt(left) * Q_LSB;
    fprintf('the comparator may add %.3f fC; the node is %.2f pF at the last decision,\n', q_comp*1e15, C_end*1e12);
    fprintf('so v_n = q / C_node = %.0f uV rms at most (before the placeholders)\n', q_comp/C_end*1e6);
else
    fprintf('nothing is left for the comparator\n');
end

figure; bar([st_q ph_q]*1e15); grid on;
xlabel('source: 1-3 studied, 4-7 placeholders'); ylabel('rms charge [fC]');
title('Noise budget so far, as charge');
