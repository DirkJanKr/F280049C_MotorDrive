function w = build_weights(n_tau, v_os, tail, verbose)
% BUILD_WEIGHTS  Weight list designed backwards from what every decision needs (step 7b).
%   n_tau  time constants waited after every step (settling eps = e^(-n_tau))
%   v_os   comparator offset left after calibration [V]
%   tail   the halving tail [LSB], e.g. [4 2 1 1]
%   verbose  (optional) true prints every try, as in the step 7b walk-through
%   w      the step weights [LSB], largest first; [] if no list exists
% A function file because step 7b calls it once per settling time.
alpha = [];      % MATLAB has a built-in function alpha(); naming it here first tells MATLAB
                 % it is a variable in this function, so the script below can fill it
zaan_constants;
if nargin < 4, verbose = false; end
eps_s = exp(-n_tau);
Q_LSB = N_ch * C_M * V_FS / 2^N_bits;
lsb_u = 2 * C_u * (alpha*V_FS/2) / Q_LSB;          % one unit = 8 LSB

% spare(v): how far the steps v reach beyond full scale, minus what the errors
% need there (3 sigma of all step errors + the offset as a shift of the result)
spare = @(v, mis1, Cend) sum(v) + v(end) - 2^(N_bits-1) - mis1 - v_os*Cend/Q_LSB;

%% Build backwards: every new step as large as the decisions allow
% A new step w_k is checked EXACTLY with fixed_errors: its own decision
% (mismatch + offset) and the decision after it, whose settling error is
% eps * w_k (now known). The settling of its own decision comes from the step
% above it, not chosen yet. That step is at least as large as w_k, so we keep
% at least eps * w_k free for it (look ahead); the next round checks it exactly.
w = tail;
done = false;
while ~done
    best = 0;
    if verbose, fprintf('list so far: %s\n', num2str(w)); end
    for units = 1:200                              % try larger and larger steps
        wk = units * lsb_u;
        if wk < w(1), continue, end                % keep the list falling
        [t, ~, ~, ~, need] = fixed_errors([wk w], eps_s, v_os);
        ok_all  = all(need(t > 0) <= t(t > 0));    % every decision so far copes
        ok_next = t(1) - need(1) >= eps_s * wk;    % room for the step above
        [~, mis, ~, ~, ~, Cn] = fixed_errors([wk w], eps_s, v_os);
        sp = spare([wk w], mis(1), Cn(end));
        if verbose
            fprintf('  try %3d: own t %6.2f need %5.2f | decision below t %5.2f need %5.2f | room %6.2f, keep %4.2f | reach spare %7.1f', ...
                    wk, t(1), need(1), t(2), need(2), t(1) - need(1), eps_s*wk, sp);
            if ok_all && ok_next, fprintf('  ok\n'), else, fprintf('  NO\n'), end
        end
        if ~(ok_all && ok_next), break, end
        best = wk;
        if sp >= 0, break, end                     % reaches full scale: big enough
    end
    if best == 0, w = []; return, end              % no step fits: no list at this settling
    w = [best w];
    [~, mis, ~, ~, ~, Cn] = fixed_errors(w, eps_s, v_os);
    done = spare(w, mis(1), Cn(end)) >= 0;
end

%% Shrink the top steps one unit at a time while every decision still copes
changed = true;
while changed
    changed = false;
    for i = 1:sum(w >= lsb_u)
        v = w;  v(i) = v(i) - lsb_u;
        if v(i) < lsb_u || v(i) < v(i+1), continue, end
        [t, mis, ~, ~, need, Cn] = fixed_errors(v, eps_s, v_os);
        if spare(v, mis(1), Cn(end)) >= 0 && all(need(t > 0) <= t(t > 0))
            if verbose, fprintf('shrink %d -> %d\n', w(i), v(i)); end
            w = v;  changed = true;
        end
    end
end
end
