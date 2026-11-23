%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%       STEP 7b: DESIGN THE WEIGHTS FROM THE TOLERANCE EVERY DECISION     %
%                                NEEDS                                    %
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
% THE STORY
% Step 7a gives what every decision needs. Now we turn it around and choose
% the steps. Step 6's formula t_k = S_k + w_last - w_k (S_k: sum of the later
% steps) says: once the later steps are known, step k may be at most
%       w_k = S_k + w_last - need_k
% Larger steps mean fewer decisions, so each step is made as large as that
% allows. That is why we build the list BACKWARDS, from the small steps up.
% The settling part of need_k depends on the step BEFORE k, which is not chosen
% yet; we take it as at most twice step k (as in binary).
% The list starts from the halving tail 4 2 1 1 (charge halving of one unit;
% the last 1 is the charge left on the source). Steps above it are whole units
% of 8 LSB. We stop when the steps reach full scale plus the spare reach the
% errors need, then shrink the top steps as far as the tolerances allow, and
% check every decision with fixed_errors.m.
% Settling is given as n_tau time constants waited after every step (switches
% scaled with the capacitors, one tau): eps = e^(-n_tau). Binary needs 7.6 tau.
%
% WHAT THE CODE DOES
%   1) values   2) build backwards   3) shrink the top   4) check and print
% @(...) makes a small one-line function, used here for the spare reach

clear; close all; clc;
zaan_constants;

%% -----------------------------
% 1) Values
% -----------------------------
n_tau = 3.7;                 % time constants waited after every step             A
eps_s = exp(-n_tau);
v_os  = 0.15e-3;             % comparator offset left after calibration [V]        S (Malki 2014)
tail  = [4 2 1 1];           % halving tail [LSB]                                  A
Q_LSB = N_ch * C_M * V_FS / 2^N_bits;
lsb_u = 2 * C_u * (alpha*V_FS/2) / Q_LSB;          % one unit = 8 LSB

%% -----------------------------
% 2) Build backwards: every new step as large as its decision allows
% -----------------------------
% spare(v): how far the steps v reach beyond full scale, minus what the errors
% need there (3 sigma of all step errors + the offset as a shift of the result)
spare = @(v, mis1, Cend) sum(v) + v(end) - 2^(N_bits-1) - mis1 - v_os*Cend/Q_LSB;
w = tail;
done = false;
while ~done
    best = 0;
    for units = 1:200                              % try larger and larger steps
        wk = units * lsb_u;
        if wk < w(1), continue, end                % keep the list falling
        [t, mis, off, ~, ~, Cn] = fixed_errors([wk w], eps_s, v_os);
        if t(1) < mis(1) + off(1) + eps_s*2*wk, break, end   % its own decision would not cope
        best = wk;
        if spare([wk w], mis(1), Cn(end)) >= 0, break, end   % reaches full scale: big enough
    end
    if best == 0, error('no list: the decision after a step cannot absorb its unsettled part'); end
    w = [best w];
    [~, mis, ~, ~, ~, Cn] = fixed_errors(w, eps_s, v_os);
    done = spare(w, mis(1), Cn(end)) >= 0;
end

%% -----------------------------
% 3) Shrink the top steps one unit at a time while every decision still copes
% -----------------------------
changed = true;
while changed
    changed = false;
    for i = 1:sum(w >= lsb_u)
        v = w;  v(i) = v(i) - lsb_u;
        if v(i) < lsb_u || v(i) < v(i+1), continue, end
        [t, mis, ~, ~, need, Cn] = fixed_errors(v, eps_s, v_os);
        if spare(v, mis(1), Cn(end)) >= 0 && all(need(t > 0) <= t(t > 0)), w = v;  changed = true; end
    end
end

%% -----------------------------
% 4) Check every decision and print
% -----------------------------
[t, mis, off, setl, need] = fixed_errors(w, eps_s, v_os);
fprintf('settling %.1f tau (%.1f %% left), binary would need %.1f tau\n', n_tau, eps_s*100, log(2^(N_bits+1)));
fprintf('weights: %s\n', num2str(w));
fprintf('decisions %d, reach beyond full scale %.1f LSB, smallest margin %.2f LSB\n', numel(w)+1, ...
        sum(w) + w(end) - 2^(N_bits-1), min(t(t > 0) - need(t > 0)));
fprintf('put this list in zaan_constants.m (w_design) to use it in steps 7a and 7c to 7e\n');
