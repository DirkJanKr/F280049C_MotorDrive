%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%       STEP 7c: DESIGN THE WEIGHTS FROM THE TOLERANCE EACH DECISION      %
%                               NEEDS                                     %
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
% QUESTION
% Given how much settling error we allow, which weight list gives every
% decision the tolerance its fixed errors need, with the fewest decisions?
%
% ANSWER: see the printed table (it depends on the settling allowed).
%
% THE RULE (from step 6, rewritten for the step itself)
%     t_k = S_k + w_last - w_k     so the largest step k may be is
%     w_k = S_k + w_last - (tolerance decision k needs)
% S_k is the sum of the steps after k. So we build the list BACKWARDS: from the
% smallest step up, each step as large as the tolerance it must leave allows.
%
% The condition for every new step k (step 7, part A, fixed errors): its own
% decision must cover mismatch (3 sigma, step k and later) + offset + the part of
% the step BEFORE it that has not settled. That earlier step is chosen later, so
% we take it as at most twice step k (a binary step):
%       S_k + w_last - w_k  >=  mismatch_k + offset + eps_settle * 2 * w_k
% We stop as soon as the steps reach full scale plus the spare reach needed
% (3 sigma of the summed mismatch + the offset shift), and the last step added is
% only as large as that needs. Section 4 then checks every decision exactly.
% The tail below one unit is charge halving of one unit: 4, 2, 1, and the
% charge left on the source, 1 (A: the halving sequence). That tail has 1 LSB of
% tolerance; without the repeated 1 it would have none, and then the step just
% above it would have to settle completely.
% Not here: rounding to 10 bits and calibration (step 8).

clear; close all; clc;
zaan_constants;

%% -----------------------------
% 1) Values to fill in
% -----------------------------
eps_list = [0 0.002 0.005 0.01 0.02 0.05 0.1];   % settling allowed: part of a step not yet settled   A
v_os     = 0.15e-3;     % comparator offset left after calibration [V]          S (Malki 2014, p. 1174)
tail     = [4 2 1 1];   % halving tail [LSB]                                    A (halving sequence)

%% -----------------------------
% 2) The converter (steps 0, 3, 5)
% -----------------------------
C_TH  = N_ch * C_M;
Q_LSB = C_TH * V_FS / 2^N_bits;
V_REF = alpha * V_FS / 2;
C_DAC = C_TH / (2 * alpha);
lsb_u = 2 * C_u * V_REF / Q_LSB;                   % one unit = 8 LSB
sig_u = A_C / sqrt(C_u * 1e15);
sigw  = @(w) (w >= lsb_u) .* sig_u ./ sqrt(max(w/lsb_u, 1)) .* w + (w < lsb_u) .* sig_u .* w;
% spread of a step [LSB]: whole units add in power; a halved step gets one unit's error (step 5)
% @(w) makes a small function of w, written in one line
off_max = v_os * 2 * C_DAC / Q_LSB;                % largest offset difference over the decisions [LSB]
shift   = v_os * (C_TH + 2*C_DAC) / Q_LSB;         % the offset as a shift of the whole result [LSB]

%% -----------------------------
% 3) Build the list backwards, for every settling allowance
% -----------------------------
fprintf('offset uses at most %.2f LSB of every tolerance (upper bound)\n\n', off_max);
fprintf('%9s %10s %7s %8s %8s %8s   %s\n', 'settling', 'decisions', 'units', 'C [pF]', 'spare', 'margin', 'weights [LSB]');
% spare: reach beyond full scale [LSB]; margin: smallest tolerance minus need over the decisions [LSB]
n_dec = zeros(size(eps_list));
for e = 1:numel(eps_list)
    eps_s = eps_list(e);
    w = tail;                                      % start from the smallest steps
    ok = true;
    while true
        w_last = w(end);
        S      = sum(w);
        target = 2^(N_bits-1) - w_last + 3*sqrt(sum(sigw(w).^2)) + shift;   % sum the steps must reach
        best = 0;
        for units = 1:200                          % try larger and larger whole-unit steps
            wk  = units * lsb_u;
            if wk < w(1), continue, end            % keep the list falling
            mis = 3 * sqrt(sigw(wk)^2 + sum(sigw(w).^2));
            if S + w_last - wk < mis + off_max + eps_s*2*wk, break, end   % its own decision
            best = wk;
            if S + wk >= target, break, end        % large enough to reach full scale: stop growing
        end
        if best == 0, ok = false; break, end       % no step fits
        w = [best, w];                             % put the new step in front
        if sum(w) >= target, break, end
        if numel(w) > 30, ok = false; break, end
    end
    % trim from the top: the last steps added overshoot full scale. Make the
    % largest steps smaller, one unit at a time, as long as the list stays falling,
    % still reaches full scale, and every decision still has its tolerance.
    changed = true;
    while ok && changed
        changed = false;
        for i = 1:sum(w >= lsb_u)
            v = w;  v(i) = v(i) - lsb_u;
            if v(i) < lsb_u || (i < numel(v) && v(i) < v(i+1)), continue, end
            reach = sum(v) >= 2^(N_bits-1) - v(end) + 3*sqrt(sum(sigw(v).^2)) + shift;
            good = true;
            for k = 1:numel(v)                     % exact check of every decision
                tk = sum(v(k+1:end)) + v(end) - v(k);
                nk = 3*sqrt(sum(sigw(v(k:end)).^2)) + off_max + (k > 1)*eps_s*v(max(k-1,1));
                if tk > 0 && tk < nk, good = false; end
            end
            if reach && good, w = v;  changed = true; end
        end
    end
    spare = sum(w) + w(end) - 2^(N_bits-1);
    if ~ok
        fprintf('%8.1f %% %10s   no list: a step cannot leave enough tolerance\n', eps_s*100, '-');
        n_dec(e) = NaN;  continue
    end
    % exact check: every decision with tolerance, with the real step before it
    n = numel(w);  t = zeros(1, n+1);  need = zeros(1, n+1);
    for k = 1:n
        t(k) = sum(w(k+1:end)) + w(end) - w(k);
        need(k) = 3*sqrt(sum(sigw(w(k:end)).^2)) + off_max + (k > 1) * eps_s * w(max(k-1,1));
    end
    margin = min(t(t > 0) - need(t > 0));
    n_whole = sum(w(w >= lsb_u)) / lsb_u;
    n_units = n_whole + 4;                         % + the halving chain: source and 3 units
    n_dec(e) = numel(w) + 1;
    fprintf('%8.1f %% %10d %7d %8.2f %8.1f %8.2f   %s\n', eps_s*100, n_dec(e), n_units, n_units*C_u*1e12, ...
            spare, margin, num2str(w));
end

%% -----------------------------
% 4) Summary
% -----------------------------
% The more settling error a step may leave, the more tolerance the decision
% after it needs, so the steps must shrink faster than binary: more decisions.
% With no settling error the rule only has to cover mismatch and offset, which
% is about the same at every decision: then a few repeated steps are enough.
% Each list is a candidate: check it with step 7 (part A and B) and step 7b,
% and count its decisions against the 25 ns.
figure; plot(eps_list*100, n_dec, 'o-', 'LineWidth', 1.5); grid on;
xlabel('settling error allowed per step [%]'); ylabel('decisions');
title('More settling error allowed costs more decisions');
