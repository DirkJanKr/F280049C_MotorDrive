%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%       STEP 7b: DESIGN THE WEIGHTS FROM THE TOLERANCE EVERY DECISION     %
%                         NEEDS, FOR EVERY SETTLING TIME                  %
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
% THE STORY
% 1. Settling, in time constants. When a step is connected, its charge does
%    not arrive at once: it flows through the switch resistance R into the
%    capacitance C, like charging any RC. The part still missing after a time
%    t falls as an exponential:
%        eps = e^(-t / tau),   tau = R C   [s]
%    We count the waiting time in time constants: n_tau = t / tau, so
%        eps = e^(-n_tau)
%    n_tau = 1 leaves 37 %, 2.3 leaves 10 %, 4.6 leaves 1 %, 6.9 leaves 0.1 %.
%    Switches are scaled with their capacitor (larger step, wider switch), so
%    every step has the same tau and the same eps (A; checked in Cadence).
% 2. Why binary needs 7.6 tau. Binary has no tolerance, so whatever is still
%    missing ends up in the result. The usual rule: the missing part of a
%    full-scale step must stay below half an LSB, eps 2^B <= 1/2, so
%        eps <= 2^-(B+1)   ->   n_tau = ln(2^(B+1)) = 11 ln 2 = 7.6   (B = 10)
% 3. Why redundancy needs less. The missing part eps w_(k-1) is just one more
%    error at decision k (step 7a). With tolerance, it may be as large as the
%    room left. So eps can be about 1 % or more instead of 0.05 %.
% 4. 4.6 tau (1 % left) was only a START value (A), a round number between
%    the binary 7.6 and what redundancy might allow. This step replaces it by
%    a sweep: for every n_tau, build the cheapest list and count decisions.
% 5. Building one list (build_weights.m): t_k = S_k + w_last - w_k says that,
%    once the later steps S_k are known, step k may be at most
%        w_k = S_k + w_last - need_k
%    Larger steps mean fewer decisions, so each step is made as large as
%    allowed, building BACKWARDS from the halving tail 4 2 1 1 (A) in whole
%    units of 8 LSB. Each new step is checked exactly with fixed_errors.m; for
%    the step above it (not chosen yet) it keeps at least eps * w_k free.
%    It stops at full scale plus the spare reach the errors need, then shrinks
%    the top steps while every decision still copes.
%
% HAND CHECK
%   n_tau = 4.6: eps = e^-4.6 = 0.010. Decision 2 after a 184 LSB step misses
%   0.010 x 184 = 1.85 LSB (step 7a, settling column).
%   n_tau = 2.4: eps = 0.091. The 8 LSB step above another 8 leaves 0.73 LSB,
%   which fits in t = 1 LSB only with 0.23 LSB mismatch: 0.96 LSB. Just.
%   Total settling time: decisions with a step x n_tau, e.g. 11 x 3.7 = 40.7 tau.
%   Example, if a 70 fF step should settle in 0.5 ns at 3.7 tau:
%   tau = 0.5 ns / 3.7 = 0.135 ns, so R <= 0.135e-9 / 70e-15 = 1.9 kOhm (D).
%
% WHAT THE CODE DOES
%   1) values   2) one list at the chosen n_tau   3) the sweep over n_tau

clear; close all; clc;
zaan_constants;

%% -----------------------------
% 1) Values
% -----------------------------
n_tau = 4.6;                 % time constants waited after every step (as 7a)     A
v_os  = 0.15e-3;             % comparator offset left after calibration [V]        S (Malki 2014)
tail  = [4 2 1 1];           % halving tail [LSB]                                  A

%% -----------------------------
% 2) One list at the chosen settling time
% -----------------------------
w = build_weights(n_tau, v_os, tail);
[t, mis, off, setl, need] = fixed_errors(w, exp(-n_tau), v_os);
fprintf('settling %.1f tau (%.1f %% left); binary would need %.1f tau\n', n_tau, exp(-n_tau)*100, log(2^(N_bits+1)));
fprintf('weights: %s\n', num2str(w));
fprintf('decisions %d, reach beyond full scale %.1f LSB, smallest margin %.2f LSB\n\n', numel(w)+1, ...
        sum(w) + w(end) - 2^(N_bits-1), min(t(t > 0) - need(t > 0)));

%% -----------------------------
% 3) The sweep: fewer tau per step against more decisions
% -----------------------------
fprintf(' n_tau  left    decisions  total settling   weights\n');
for nt = [7.6 6 4.6 3.7 3 2.4 2]
    v = build_weights(nt, v_os, tail);
    if isempty(v), fprintf('%5.1f  %4.1f %%   no list: the tolerance cannot hold the unsettled part\n', nt, exp(-nt)*100); continue, end
    fprintf('%5.1f  %4.1f %%  %6d  %10.1f tau      %s\n', nt, exp(-nt)*100, numel(v)+1, nt*numel(v), num2str(v));
end
fprintf('\nput the chosen list in zaan_constants.m (w_design) to use it in the later steps\n');
