%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%   STEP 7d: PROOF 2: IF THE RULE IS BROKEN, DO CHIPS FAIL WHERE AND AS    %
%                          MUCH AS PREDICTED?                             %
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
% THE STORY
% Proof 1 showed the rule is enough. A good rule must also be close: when it
% is broken, chips should start to fail, and by about the amount the rule
% predicts. Step 6 says an error beyond the tolerance by an excess X makes the
% result off by about ½ (last interval) + X. We push the settling error beyond
% what the rule allows by X = 0.25, 0.5 and 1 LSB at the decision that limits it
% and look at how many chips fail and by how much.
% The mismatch term is 3 sigma: most chips have less, so fewer chips fail than
% the rule predicts. That is the only slack in the rule.
%
% WHAT THE CODE DOES
%   1) find the limiting decision and the settling error at the limit
%   2) for every excess: the settling error that gives it, and 200 chips
%   3) compare the failures and their size with the prediction

clear; close all; clc;
zaan_constants;
w = w_design;  v_os = 0.15e-3;  n_chips = 200;

%% -----------------------------
% 1) The limit and the decision that sets it
% -----------------------------
eps_ok = 0;
for e = 0 : 0.0005 : 0.2
    [t, ~, ~, ~, need] = fixed_errors(w, e, v_os);
    if all(need(t > 0) <= t(t > 0)), eps_ok = e; else, break, end
end
[t, ~, ~, ~, need] = fixed_errors(w, eps_ok, v_os);
[~, k_lim] = min(t(t > 0) - need(t > 0));           % the decision with the least margin
allow = w(end)/2 + max(need(t == 0));
fprintf('weights %s\nlimit %.2f %% unsettled; decision %d sets it (its step before: %g LSB)\n\n', ...
        num2str(w), eps_ok*100, k_lim, w(k_lim-1));

%% -----------------------------
% 2) and 3) Push beyond the limit
% -----------------------------
fprintf('excess [LSB]   unsettled   chips failing   largest error   predicted largest\n');
for X = [0.25 0.5 1]
    e_x = eps_ok + X / w(k_lim-1);                   % settling at decision k_lim grows by X
    err = chip_errors(w, e_x, v_os, n_chips, 2);
    fprintf('%10.2f %10.2f %% %12.1f %% %13.3f %17.3f\n', X, e_x*100, 100*mean(err > allow + 1e-6), max(err), allow + X);
end
disp('The largest error should follow allow + excess; fewer chips fail than 100 % because')
disp('most chips have less mismatch than the 3 sigma the rule assumes.')
