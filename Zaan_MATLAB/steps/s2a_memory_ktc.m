%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%         STEP 2a: HOW SMALL MAY A MEMORY CELL BE FOR ITS kT/C NOISE?     %
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
% QUESTION
% What is the smallest memory capacitor whose kT/C noise stays within the
% share of the noise budget we give it?
%
% ANSWER
% 26 fF for a 25 % share; at 280 fF the noise is only 0.193 fC (0.044 LSB).
% kT/C does not size the memory cell; mismatch (2b, 2c) does.
%
% Writing a cell freezes a random charge with variance kB T C_M on it.
% A read connects N_ch cells to each node: variance N_ch kB T C_M per node.
% Q+ - Q-: the two nodes are independent, so the variances add: 2 N_ch kB T C_M.
% The signal grows with C_M too (Q_LSB = N C_M V_FS / 2^B), and faster.

clear; close all; clc;
zaan_constants;
rng(1);

share = 0.25;              % share of the "other noise" power we give these cells   A

% from step 0
C_TH  = N_ch * C_M;
Q_LSB = C_TH * V_FS / 2^N_bits;

%% -----------------------------
% 1) The noise charge at the start value of C_M
% -----------------------------
q_mem = sqrt(2 * N_ch * kB * T * C_M);              % rms [C]
fprintf('C_M = %.0f fF: kT/C noise of a read = %.3f fC rms = %.3f LSB\n', ...
        C_M*1e15, q_mem*1e15, q_mem/Q_LSB);

%% -----------------------------
% 2) What these cells may take: a share of the other noise (step 0)
% -----------------------------
q_allowed = sqrt(share) * Q_LSB / sqrt(12);         % rms [C]
fprintf('allowed (%.0f %% of the other noise power): %.3f fC rms\n', share*100, q_allowed*1e15);

%% -----------------------------
% 3) Smallest C_M: set 2 N kB T C_M = share (N C_M V_FS / 2^B)^2 / 12, solve for C_M
% -----------------------------
C_M_min = 24 * kB * T * 4^N_bits / (share * N_ch * V_FS^2);
fprintf('smallest C_M for that share: %.1f fF\n', C_M_min*1e15);

% Plot: noise and allowed noise, both in LSB, against C_M
C_list   = logspace(log10(10e-15), log10(1e-12), 50);  % 50 sizes from 10 fF to 1 pF
q_list   = sqrt(2 * N_ch * kB * T * C_list);
LSB_list = N_ch * C_list * V_FS / 2^N_bits;            % one LSB grows with C_M
figure; loglog(C_list*1e15, q_list./LSB_list, 'LineWidth', 1.5); hold on; grid on;
loglog(C_list*1e15, sqrt(share)/sqrt(12) * ones(size(C_list)), 'r--');
xlabel('C_M [fF]'); ylabel('noise [LSB rms]');
legend('kT/C of the memory cells', 'allowed share');
title('Memory cell kT/C against its share of the budget');

%% -----------------------------
% 4) Check by simulation: N cells per node, each with its own kT/C charge
% -----------------------------
n  = 100000;
Qp = sqrt(kB * T * C_M) * sum(randn(N_ch, n), 1);   % node +: sum of N_ch cells
Qn = sqrt(kB * T * C_M) * sum(randn(N_ch, n), 1);   % node -
% randn(a, b) = a table of a x b random numbers with spread 1;
% sum(x, 1) adds the rows, so one total per column (per sample)
q_sim = std(Qp - Qn);
fprintf('\nsimulated %.3f fC rms, formula %.3f fC rms, ratio %.3f\n', q_sim*1e15, q_mem*1e15, q_sim/q_mem);
if abs(q_sim/q_mem - 1) < 0.02, disp('CHECK OK'), else, disp('CHECK FAILED'), end
