%% s2c_memory_offset_tones.m   STEP 2c: tones from an offset charge per memory cell
% QUESTION: every cell adds its own small charge, for example from the charge injection
% of its switches, even with no input. How large may the spread of that charge be
% before its tones matter?
% The size of that charge needs Cadence, so this step turns it around: it gives the
% largest spread per cell the design can accept. That is a specification for the switch.
%
% In charge: cell i of channel j adds q_ij (the difference between its P and N side).
% The read sums one cell per channel; the cell changes every sample and repeats every M
% samples, so the sum is a pattern of period M: tones at k fs/M, with or without signal
% (Chen 2018 measured these at fs/8 with grounded inputs, p. 3061).
% Hand estimate (D): the sum has spread sigma_q sqrt(N); its average over the cells is a
% constant (DC), the rest, a fraction (M-1)/M of the power, goes into the tones.

clear; clc;
here = fileparts(mfilename('fullpath')); if isempty(here), here = pwd; end
addpath(fullfile(fileparts(here), '1_settings'));
p = zaan_params();
d = zaan_derive(p);
N = p.N_ch;  M = p.M_cells;  fC = 1e15;
randn('seed', 3);
share = 0.25;   % share of the "other noise" power (step 0) given to these tones   A (as step 2a)

%% 1. What may they take: 25 % of the noise power that ENOB 9.5 leaves besides quantisation
q_allowed = sqrt(share) * d.Q_LSB / sqrt(12);
sigma_cell_max = q_allowed / sqrt(N * (M - 1) / M);
fprintf('allowed for the offset tones: %.3f fC rms (%.3f LSB)\n', q_allowed * fC, q_allowed / d.Q_LSB);
fprintf('so the spread of the offset charge per cell may be at most %.3f fC\n\n', sigma_cell_max * fC);

%% 2. CHECK by simulation, for a few spreads per cell, no signal (grounded input)
kdel = round((0:N-1) * p.pitch * sind(p.theta) / p.c * p.fs);   % delays [slots], as step 2b
n_fft = M * 512;  m = 0:n_fft-1;
fprintf('%14s %16s %16s %18s\n', 'sigma per cell', 'tones, hand', 'tones, sim', 'largest tone');
for sig_q = [0.05 0.1 0.2 0.5 1] * 1e-15
    tot = 0;  big = 0;  n_chips = 40;
    for chip = 1:n_chips
        q = sig_q * randn(N, M);                    % offset charge of every cell [C]
        Q = zeros(1, n_fft);
        for j = 1:N
            Q = Q + q(j, mod(m - kdel(j), M) + 1);  % the cell channel j reads this sample
        end
        Q = Q - mean(Q);                            % the DC part is a plain offset, not a tone
        tot = tot + mean(Q.^2) / n_chips;
        big = max(big, max(abs(fft(Q))) * 2 / n_fft);   % amplitude of the largest tone
    end
    hand = sig_q * sqrt(N * (M - 1) / M);
    fprintf('%11.2f fC %13.3f fC %13.3f fC %13.3f fC amp\n', sig_q * fC, hand * fC, sqrt(tot) * fC, big * fC);
end
fprintf('\n(tones: total rms charge; largest tone: its amplitude, worst of the chips)\n');
fprintf('one LSB is %.2f fC; the largest tone of a full-scale sine would be %.0f fC amplitude\n', ...
        d.Q_LSB * fC, d.Q_FS / 2 * fC);
