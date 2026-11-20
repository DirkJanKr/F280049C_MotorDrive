%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%     STEP 7c: PROOF 1: IF THE RULE IS MET, DOES EVERY CHIP CONVERT RIGHT?  %
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
% THE STORY
% Step 7a's rule says: if every decision's fixed errors fit inside its
% tolerance, no code is lost. A rule is only worth something if real chips obey
% it. So we build many chips, each with its own capacitor errors, set the
% settling error as large as the rule still allows, and let every chip convert
% a slow ramp over the whole range, read with its own real weights.
% If the rule is right, no chip may be off by more than half the last step
% (the size of its last interval), plus the small fixed errors of the last
% decisions, which have no tolerance and so pass straight to the output.
% Two checks:
%   a) the design rule (3 sigma mismatch): almost every chip converts right;
%      3 sigma means about 1 chip in 700 may have more mismatch than assumed.
%   b) the exact check: for every chip, its OWN tolerance from its real steps.
%      Every chip whose offset and settling fit its own tolerance must convert
%      right. That one has no statistics in it.
%
% WHAT THE CODE DOES
%   1) find the largest settling error the rule allows for this list
%   2) 200 chips convert the ramp (chip_errors.m, cs_sar.m)
%   3) compare their largest error with what is allowed

clear; close all; clc;
zaan_constants;
w = w_design;  v_os = 0.15e-3;  n_chips = 200;

%% -----------------------------
% 1) The largest settling error the rule allows
% -----------------------------
eps_ok = 0;
for e = 0 : 0.0005 : 0.2
    [t, ~, ~, ~, need] = fixed_errors(w, e, v_os);
    if all(need(t > 0) <= t(t > 0)), eps_ok = e; else, break, end
end
[t, ~, ~, ~, need] = fixed_errors(w, eps_ok, v_os);
allow = w(end)/2 + max(need(t == 0));     % last interval + errors of decisions without tolerance
fprintf('weights %s\nthe rule allows up to %.2f %% unsettled (%.1f tau)\n', num2str(w), eps_ok*100, -log(eps_ok));

%% -----------------------------
% 2) Many chips at that limit
% -----------------------------
[err, Wr] = chip_errors(w, eps_ok, v_os, n_chips, 1);

%% -----------------------------
% 3) Result
% -----------------------------
[~, ~, off, setl] = fixed_errors(w, eps_ok, v_os);   % offset and settling per decision
fprintf('a) design rule: largest error %.3f LSB, allowed %.3f LSB, chips beyond: %d of %d\n', ...
        max(err), allow, sum(err > allow + 1e-6), n_chips);
own_ok = false(1, n_chips);  allow_own = zeros(1, n_chips);
for c = 1:n_chips
    W = Wr(c, :);  n = numel(W);  t_own = zeros(1, n+1);
    for k = 1:n, t_own(k) = sum(W(k+1:end)) + W(end) - W(k); end   % this chip's own tolerance
    has = t > 0;                                                     % decisions with tolerance
    own_ok(c) = all(off(has) + setl(has) <= t_own(has));
    allow_own(c) = W(end)/2 + max(off(~has) + setl(~has)) + 0.03;   % + ramp step
end
bad = own_ok & (err > allow_own);
fprintf('b) exact check: %d chips meet their own rule; of those, %d convert wrong\n', sum(own_ok), sum(bad));
if sum(bad) == 0, disp('PROOF OK: every chip that meets the rule converts right'), else, disp('PROOF FAILED'), end
figure; hist(err, 30); grid on; hold on; plot([allow allow], ylim, 'r--');
xlabel('largest error of a chip [LSB]'); ylabel('chips'); title('Rule met: every chip stays within the allowed error');
