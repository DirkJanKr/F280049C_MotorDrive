%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%       STEP 7: WEIGHTS WHOSE TOLERANCE COVERS THE MISMATCH, AND THE      %
%                         ROOM THAT IS LEFT                               %
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
% QUESTION
% We chose redundancy plus calibration against capacitor mismatch. For a few
% weight lists: does every decision's tolerance cover the mismatch, how much
% room is left for the other errors (offset, settling), and what does each
% list cost in decisions, capacitance and alpha?
%
% ANSWER: see the summary of section 4. Choosing the list is my decision (U).
%
% Why mismatch uses tolerance even with calibration: calibration reads the
% real weights, but the input must still be REACHABLE with the real steps.
% The real tolerance of decision k is t_k plus the errors of step k and all
% later steps, so those errors (3 sigma) must fit inside t_k:
%     need_k = 3 * sqrt( sum over j >= k of sigma_j^2 )      (errors from step 5)
%     room_k = t_k + ½ - need_k     what is left for offset and settling
% The + ½: step 6 showed that an error beyond t_k by e makes the result off by
% ½ + e. Allowing e up to ½ keeps every code edge within ½ LSB: the same
% criterion as 3 sigma DNL < ½ LSB (Pelgrom, step 5). It is a choice (U).
% A step that has not settled is a fixed error too, so the room is also the
% settling budget of the step before. Noise needs no tolerance (it only flips
% a decision when the input is within the noise).
% Offset after calibration is not studied yet, so it is not subtracted here.

clear; close all; clc;
zaan_constants;

% from steps 0, 3 and 5
C_TH  = N_ch * C_M;
Q_LSB = C_TH * V_FS / 2^N_bits;
V_REF = alpha * V_FS / 2;
lsb_u = 2 * C_u * V_REF / Q_LSB;           % one unit = 8 LSB
sig_u = A_C / sqrt(C_u * 1e15);            % spread of one unit

%% -----------------------------
% 1) The lists to compare [LSB]
% -----------------------------
lists = { [256 128 64 32 16 8 4 2 1], ...                   % binary (step 5)
          [256 136 72 40 24 16 8 4 2 1 1], ...              % earlier default, sum 560
          [216 128 72 40 24 16 8 4 2 1 0.5 0.5], ...        % search candidate, sum 512
          [224 128 72 40 24 16 8 4 2 1 0.5 0.5] };          % candidate + one unit, sum 520
names = {'binary', 'earlier default', 'search candidate', 'candidate + 1 unit'};

for L = 1:numel(lists)
    w = lists{L};  n = numel(w);

    %% -----------------------------
    % 2) Tolerance, mismatch need and room per decision
    % -----------------------------
    t = zeros(1, n+1);
    for k = 1:n, t(k) = sum(w(k+1:end)) + w(end) - w(k); end
    units   = w / lsb_u;                               % size of each step in units
    sig_rel = sig_u ./ sqrt(max(units, 1));            % whole units: errors add in power
    sig_rel(units < 1) = sig_u;                        % halved steps: one unit's error (A, step 5)
    sig_w   = sig_rel .* w;                            % spread of each step [LSB]
    need = zeros(1, n+1);
    for k = 1:n, need(k) = 3 * sqrt(sum(sig_w(k:end).^2)); end
    room = t + 0.5 - need;

    %% -----------------------------
    % 3) Cost: decisions, units, capacitance, alpha, overrange
    % -----------------------------
    n_units = sum(units(units >= 1));                  % whole units
    nh = sum(units < 1);                               % steps made by halving
    % halving chain: one source unit plus one unit per halving; when the last
    % two steps are equal, the last one is the charge left on the source
    if nh >= 2 && w(end) == w(end-1), nh = nh - 1; end
    if any(units < 1), n_units = n_units + nh + 1; end
    C_DAC_q = sum(w) * Q_LSB / (2 * V_REF);           % capacitance that carries charge [F]
    alpha_w = C_TH / (2 * C_DAC_q);                    % alpha with these weights
    spare   = sum(w) + w(end) - 2^(N_bits-1);          % reach beyond full scale [LSB]

    fprintf('\n%s:  %s\n', names{L}, num2str(w));
    fprintf(' decision  tolerance  mismatch 3s   room left (t + ½ - mismatch)\n');
    for k = 1:n+1
        flag = '';  if room(k) < 0, flag = '  NOT COVERED'; end
        fprintf('%9d %10.1f %12.2f %11.2f%s\n', k, t(k), need(k), room(k), flag);
    end
    fprintf('decisions %d, units %d (%.2f pF), alpha %.2f, spare reach %.1f LSB (needs about %.1f: 3 sigma of the sum)\n', ...
            n+1, n_units, n_units*C_u*1e12, alpha_w, spare, need(1));
end

%% -----------------------------
% 4) Summary
% -----------------------------
% Read the four tables:
% - binary: tolerance 0, the first four decisions are not covered (lost codes, step 5)
% - the redundant lists cover the mismatch at every decision; in the halved
%   tail the tolerance is small, but so is the mismatch
% - the room left in the first decisions is large: that is the settling budget
%   of the large steps, and the room for offset
% - the search candidate reaches only ½ LSB beyond full scale, less than the
%   3 sigma of its summed errors; one unit more in the first step fixes that
%   for 8 LSB of extra weight (1.6 %)
