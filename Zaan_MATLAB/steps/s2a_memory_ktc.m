%% s2a_memory_ktc.m   STEP 2a: how small may a memory cell be for its kT/C noise?
% QUESTION: what is the smallest memory capacitor C_M whose kT/C noise stays within
% the share of the noise budget we give it?
% (Step 2b then asks the same for mismatch tones; the larger of the two sets C_M.)
%
% In charge (Q = Q+ - Q-):
%   Writing a cell freezes a random charge with variance k T C_M on it (kT/C).
%   A read connects N cells to each node: N independent charges, variance N k T C_M per node.
%   Q+ - Q-: the two nodes are independent, so the variances add: 2 N k T C_M.
%   The signal also grows with C_M (Q_LSB = N C_M V_FS / 2^B), and faster than the noise.

clear; clc;
here = fileparts(mfilename('fullpath')); if isempty(here), here = pwd; end
addpath(fullfile(fileparts(here), '1_settings'));
p = zaan_params();
d = zaan_derive(p);
fC = 1e15;  kT = p.k * p.T;
share = 0.1;     % share of the "other noise" power we give the memory cells   A (my choice)

%% 1. The noise charge at the start value of C_M
q_mem = sqrt(2 * p.N_ch * kT * p.C_M);
fprintf('C_M = %.0f fF: kT/C noise of the read = %.3f fC rms = %.3f LSB\n', ...
        p.C_M * 1e15, q_mem * fC, q_mem / d.Q_LSB);

%% 2. The budget (step 0): at ENOB 9.5 all other noise may add as much as the
% quantisation, Q_LSB^2 / 12. The memory cells get a share of that power.
q_allowed = sqrt(share) * d.Q_LSB / sqrt(12);
fprintf('allowed for the memory cells (%.0f %% of the other noise power): %.3f fC rms\n', ...
        share * 100, q_allowed * fC);

%% 3. Smallest C_M: set 2 N k T C_M = share (N C_M V_FS / 2^B)^2 / 12 and solve for C_M
C_M_min = 24 * kT * 4^p.N_bits / (share * p.N_ch * p.V_FS^2);
fprintf('smallest C_M for that share: %.1f fF\n', C_M_min * 1e15);

%% 4. CHECK by simulation: N cells per node, each with its own kT/C charge
n = 100000;
Qp = sqrt(kT * p.C_M) * sum(randn(p.N_ch, n), 1);   % node +, sum of N cells
Qn = sqrt(kT * p.C_M) * sum(randn(p.N_ch, n), 1);   % node -
q_sim = std(Qp - Qn);
fprintf('\nsimulated: %.3f fC rms, formula %.3f fC rms, ratio %.3f\n', q_sim * fC, q_mem * fC, q_sim / q_mem);
if abs(q_sim / q_mem - 1) < 0.02, disp('CHECK OK'), else, disp('CHECK FAILED'), end
