%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%   STEP 7e: PROOF 3: MUST THE FIXED ERRORS BE ADDED, OR IS ROOT-SUM-     %
%                            SQUARE ENOUGH?                               %
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
% THE STORY
% Random, independent errors add in power: sqrt(a^2 + b^2). Fixed errors that
% can push the same way add as numbers: a + b. Offset and settling are fixed for
% a given chip and input, and both can push the same way, so step 7a adds them.
% If that were too strict, a rule with root-sum-square would accept larger
% errors and still no chip would fail. We test it: make offset and settling
% grow together by a factor s, find the largest s each rule accepts, and let 200
% chips convert at that s.
%
% WHAT THE CODE DOES
%   1) the starting point: the settling at the rule's limit, offset 0.15 mV
%   2) per rule, the largest factor s it accepts
%   3) 200 chips at each of those factors: how many fail?

clear; close all; clc;
zaan_constants;
w = w_design;  n_chips = 200;

%% -----------------------------
% 1) Starting point
% -----------------------------
v0 = 0.15e-3;  e0 = 0;
for e = 0 : 0.0005 : 0.2
    [t, ~, ~, ~, need] = fixed_errors(w, e, v0);
    if all(need(t > 0) <= t(t > 0)), e0 = e; else, break, end
end

%% -----------------------------
% 2) The largest factor s each rule accepts
% -----------------------------
s_lin = 0;  s_rss = 0;
for s = 1 : 0.01 : 4
    [t, mis, off, setl, need] = fixed_errors(w, s*e0, s*v0);
    k = t > 0;
    if all(need(k) <= t(k)), s_lin = s; end                                   % added
    if all(sqrt(mis(k).^2 + off(k).^2 + setl(k).^2) <= t(k)), s_rss = s; end  % root-sum-square
end
[t, ~, ~, ~, need] = fixed_errors(w, e0, v0);
allow = w(end)/2 + max(need(t == 0));

%% -----------------------------
% 3) Chips at each accepted factor
% -----------------------------
fprintf('rule              accepts s   chips failing at that s\n');
for r = 1:2
    s = s_lin;  name = 'added (step 7a)';
    if r == 2, s = s_rss;  name = 'root-sum-square'; end
    err = chip_errors(w, s*e0, s*v0, n_chips, 3);
    fprintf('%-18s %8.2f %14.1f %%\n', name, s, 100*mean(err > allow*s^0 + 1e-6));
end
disp('If root-sum-square lets chips fail, the errors must be added, as in step 7a.')
