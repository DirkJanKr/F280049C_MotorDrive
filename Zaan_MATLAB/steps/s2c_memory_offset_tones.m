%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%         STEP 2c: TONES FROM AN EXTRA CHARGE PER MEMORY CELL             %
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
% QUESTION
% Every cell adds its own small extra charge that does not depend on the
% input, for example from the charge injection of its switches. How large may
% its spread over the cells be before its tones matter?
%
% ANSWER (C_M = 280 fF, 25 % share)
% At most 0.16 fC standard deviation per cell. A specification for the cell
% switch, to be checked with a Cadence Monte Carlo.
%
% It is called an offset because it shifts the output by a fixed amount
% (Q = C_M V + q), unlike a gain error (Q = C_M V (1 + eps)). With V = 0 a
% gain error gives nothing, an offset gives q. These tones are there even
% with the input grounded (Chen 2018 measured them at fs/8, p. 3061).
%
% Hand formula: the sum of N cells has spread sigma_q sqrt(N); its average
% over the M cells is a constant (DC), the rest, (M-1)/M of the power, is tones.
% ASSUMPTION: the cells of different channels are independent.

clear; close all; clc;
zaan_constants;
rng(3, 'twister');        % fixed random numbers: the same chips every run

share = 0.25;              % share of the "other noise" power for these tones   A

% from step 0
Q_LSB = N_ch * C_M * V_FS / 2^N_bits;

%% -----------------------------
% 1) What may they take, and what spread per cell does that allow?
% -----------------------------
q_allowed = sqrt(share) * Q_LSB / sqrt(12);                  % rms [C]
sig_max   = q_allowed / sqrt(N_ch * (M_cells-1)/M_cells);    % per cell [C]
fprintf('allowed for these tones: %.3f fC rms (%.3f LSB)\n', q_allowed*1e15, q_allowed/Q_LSB);
fprintf('so the spread of the extra charge per cell may be at most %.3f fC\n\n', sig_max*1e15);

%% -----------------------------
% 2) Check by simulation, grounded input, a few spreads per cell
% -----------------------------
kdel  = round((0:N_ch-1) * pitch * sind(theta) / c_sound * fs);   % delays, as step 2b
n_fft = M_cells * 512;
m     = 0:n_fft-1;
sig_list = [0.05 0.1 0.2 0.5 1] * 1e-15;   % spread per cell to try [C]
n_chips  = 40;
hand = zeros(size(sig_list));  sim = hand;

fprintf(' spread per cell   tones, hand   tones, sim   largest tone (amplitude)\n');
for i = 1:numel(sig_list)
    P_tot = 0;  big = 0;
    for chip = 1:n_chips
        q = sig_list(i) * randn(N_ch, M_cells);      % extra charge of every cell [C]
        Q = zeros(1, n_fft);
        for j = 1:N_ch
            Q = Q + q(j, mod(m - kdel(j), M_cells) + 1);   % no signal: just add
        end
        Q = Q - mean(Q);                     % the DC part is a plain offset, not a tone
        P_tot = P_tot + mean(Q.^2)/n_chips;  % average power of the tones
        big = max(big, max(abs(fft(Q))) * 2/n_fft);   % FFT value -> tone amplitude
    end
    hand(i) = sig_list(i) * sqrt(N_ch * (M_cells-1)/M_cells);
    sim(i)  = sqrt(P_tot);
    fprintf('%12.2f fC %10.3f fC %10.3f fC %12.3f fC\n', sig_list(i)*1e15, hand(i)*1e15, sim(i)*1e15, big*1e15);
end
fprintf('\none LSB is %.2f fC\n', Q_LSB*1e15);

figure; loglog(sig_list*1e15, hand*1e15, 'b-', 'LineWidth', 1.5); hold on; grid on;
loglog(sig_list*1e15, sim*1e15, 'ko');
loglog(sig_list*1e15, q_allowed*1e15*ones(size(sig_list)), 'r--');
xlabel('spread of the extra charge per cell [fC]'); ylabel('all tones together [fC rms]');
legend('hand formula', 'simulation', 'allowed');
title('Extra charge per cell: tones against the allowed share');
