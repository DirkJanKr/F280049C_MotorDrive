%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%   STEP 7b: MONTE CARLO PROOF OF THE TOLERANCE RULE OF STEP 7 (PART A)   %
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
% QUESTION
% Step 7 part A adds the fixed errors of a decision linearly:
%     need_k = mismatch_k (3 sigma) + offset_k + settling_k  <=  t_k
% and claims: if this holds at every decision that has a tolerance, the
% converter read with the real (calibrated) weights is correct, and random
% noise needs no tolerance. Is that true, is the linear sum needed, and is the
% tolerance t_k the exact limit?
%
% ANSWER  (numbers are printed below and in docs/tolerance_proof.md)
% T1  Yes. At the largest eps_settle the rule allows (0.0046, decision 6 binds), 0 of
%     500 chips exceed their allowed error; the largest error is 0.261 LSB against
%     0.25 plus the tail errors. The stricter limit t - 0.5 w(end) is NOT needed.
% T2  Beyond t the error grows with the excess, first at the decision that breaks.
% T3  Linear adding of offset and settling is needed, not just careful: they are fixed
%     and align in sign, so root-sum-square lets chips fail. Only the 3 sigma
%     mismatch term is conservative (the median chip has 3.7 times more room).
% T4  Noise adds at most the noise of the last decision; binary is not better.
%
% Method: 500 chips with PDK mismatch, a fine ramp over the full range, every
% chip converted with cs_sar, read with its own real weights (Q_read = Q_real,
% perfect calibration, no rounding to 10 bit). Error = output - input in LSB,
% with the one constant shift removed that the offset of the LAST decision
% gives (v_os C_node(end) / Q_LSB). The last two decisions have no tolerance:
% their fixed errors go straight to the output, so the allowed error is
%     allow = 0.5 w(end) + offset and settling of those two decisions.
% "strict" counts errors above 0.5 w(end) alone (0.25 LSB), "allow" above allow.
%   T1  rule satisfied      T2  rule violated by 0.1, 0.5, 1 LSB
%   T3  linear sum against root-sum-square      T4  comparator noise only

clear; close all; clc;
zaan_constants;
rng(11, 'twister');           % 'twister' = the standard Mersenne generator, so a rerun gives the same numbers
t_start = tic;                % tic / toc = stopwatch

%% -----------------------------
% 1) Values to fill in
% -----------------------------
w       = [224 128 72 40 24 16 8 4 2 1 0.5 0.5];   % weight list [LSB]            A (step 7)
w_bin   = [256 128 64 32 16 8 4 2 1];              % binary list, 9 steps [LSB]   A (T4 only)
n_chip  = 500;          % chips in T1                                             A
n_chip2 = 200;          % chips in T2 and T3 (more cases, so fewer chips)         A
v_os0   = 0.15e-3;      % comparator offset left after calibration [V]            S (Malki 2014, p. 1174)
dx      = 0.03;         % ramp step [LSB]                                         A
guard   = 1;            % ramp stops this far inside the real full scale [LSB]    A
v_noise = [50e-6 200e-6 500e-6];   % comparator noise values of T4 [V rms]       A
n_noise = 200000;       % random inputs per T4 run                                A
tol     = 1e-9;         % numerical tolerance of the comparisons [LSB]

%% -----------------------------
% 2) The converter: charge scale, steps, node per decision (as step 7)
% -----------------------------
C_TH  = N_ch * C_M;
Q_LSB = C_TH * V_FS / 2^N_bits;
lsb_u = 2 * C_u * (alpha * V_FS / 2) / Q_LSB;      % one unit = 8 LSB
sig_u = A_C / sqrt(C_u * 1e15);
% '@(ww) ...' is an anonymous function: a one-line function stored in a variable.
% These three work for any weight list ww, so they serve the binary list too.
c_step = @(ww) max(ww / lsb_u, 1) * C_u;                  % physical capacitor of each step
c_node = @(ww) C_TH + [0, cumsum(2 * c_step(ww))];        % node at every decision
s_rel  = @(ww) sig_u ./ sqrt(max(ww / lsb_u, 1));         % sigma(Q)/Q of each step
n = numel(w);
C_node = c_node(w);
Q_nom  = w * Q_LSB;
sig_rel = s_rel(w);
zero = zeros(1, n+1);
t = zeros(1, n+1);
for k = 1:n, t(k) = sum(w(k+1:end)) + w(end) - w(k); end   % tolerance of step 6/7
last_red = find(t > 0, 1, 'last');                         % last decision with a tolerance
mis = zeros(1, n+1);  sig_w = sig_rel .* w;
for k = 1:n, mis(k) = 3 * sqrt(sum(sig_w(k:end).^2)); end  % 3 sigma, nominal
ofac = (C_node(end) - C_node) / Q_LSB;                     % offset per volt of v_os [LSB/V]
wprev = [0, w(1:n)];                                       % settling of decision k: eps * wprev(k)

% the chips: ONE row = one chip, its real weights
Qm = ones(n_chip,1) * Q_nom .* (1 + randn(n_chip, n) .* (ones(n_chip,1) * sig_rel));
Wr = Qm / Q_LSB;                                           % real weights [LSB]
tr = zeros(n_chip, n+1);                                   % real tolerance of every chip
for k = 1:n, tr(:,k) = sum(Wr(:,k+1:end), 2) + Wr(:,end) - Wr(:,k); end
R   = min(sum(Wr, 2)) - guard;                             % ramp half-width [LSB], same for all chips
x_c = (-R:dx:R) * Q_LSB;                                   % the ramp as input charge [C]

% mk_err(xc) gives the function "error of every point of the ramp xc [LSB] of ONE chip";
% (Qr, e, v) = real steps, eps_settle, v_os. mk_emax(f) gives "largest |error| of each chip in the
% rows of Qm_" (arrayfun runs the inner function for c = 1, 2, ...). A function that returns a
% function: used so that T2 can swap in a shorter ramp.
mk_err  = @(xc) @(Qr, e, v) (cs_sar(xc, Qr, Qr, C_node, zero, v*C_node, e, 0*Qr) - xc) / Q_LSB ...
                            - v * C_node(end) / Q_LSB;
mk_emax = @(f) @(Qm_, e, v) arrayfun(@(c) max(abs(f(Qm_(c,:), e, v))), (1:size(Qm_,1))');
chip_err = mk_err(x_c);   emax = mk_emax(chip_err);
x_in = x_c(abs(x_c) / Q_LSB <= R - 25);                    % shorter ramp: room for offset shifts of up to 25 LSB
chip_err_in = mk_err(x_in);   emax_in = mk_emax(chip_err_in);
% allowed error per chip (Wl = its real weights [LSB]): half ITS last step + fixed errors of the two decisions without tolerance
allow = @(e, v, Wl) Wl(:,n)/2 + v * (C_node(end) - C_node(n)) / Q_LSB + e * (w(n-1) + w(n));
% excess of the fixed errors over the REAL tolerance, per chip: max over decisions with tolerance
excess = @(Tm, e, v) max(v * ofac(1:last_red) + e * wprev(1:last_red) - Tm(:,1:last_red), [], 2);

fprintf('Q_LSB = %.3f fC, ramp +-%.1f LSB in steps of %.3f, %d points, last decision with tolerance: %d\n\n', ...
        Q_LSB*1e15, R, dx, numel(x_c), last_red);

%% =========================================================================
% T1: the rule satisfied. Find the largest eps_settle for which need <= t
% ==========================================================================
% Also checked: a stricter tolerance t2 = t - half the last step. The output only
% has to be within half a last step, so the residual may reach only
% sum(later steps) + half the last step, which is t2. If t2 were the true limit,
% the chips at the t limit would fail here.
t2 = t;  t2(1:last_red) = t(1:last_red) - w(end)/2;
eps_grid = 0:0.0001:0.5;
eps_ok = NaN(1, 2);  tv = {t, t2};
for v = 1:2
    ok = false(size(eps_grid));
    for i = 1:numel(eps_grid)
        need = mis + v_os0 * ofac + eps_grid(i) * wprev;
        ok(i) = all(need(1:last_red) <= tv{v}(1:last_red));     % tv{v} picks list number v
    end
    if ok(1), eps_ok(v) = eps_grid(sum(cumprod(ok))); end       % cumprod stays 1 until the first failure
end
margin1 = (t - mis - v_os0*ofac) ./ max(wprev, eps);  margin1(1) = Inf;   % eps each decision can take
[~, k_bind] = min(margin1(1:last_red));              % [~, k] = min(..) keeps only the position
fprintf('T1  scan: largest eps_settle with need <= t: %.4f (decision %d binds)\n', eps_ok(1), k_bind);
fprintf('    with t2 = t - 0.5 w(end): no eps_settle fits (need > t2 at decision %d even at eps = 0: %.3f > %.3f)\n', ...
        find(mis + v_os0*ofac > t2 & (1:n+1) <= last_red, 1), mis(find(mis + v_os0*ofac > t2 & (1:n+1) <= last_red, 1)) + ...
        v_os0*ofac(find(mis + v_os0*ofac > t2 & (1:n+1) <= last_red, 1)), t2(find(mis + v_os0*ofac > t2 & (1:n+1) <= last_red, 1)));

e1 = eps_ok(1);
em1 = emax(Qm, e1, v_os0);
xs1 = excess(tr, e1, v_os0);                         % real excess, mismatch of this chip included
tr_b = tr;  tr_b(:,1:last_red) = tr(:,1:last_red) - w(end)/2;
xs2 = excess(tr_b, e1, v_os0);                       % same against the stricter t2
fprintf('T1  %d chips at eps = %.4f, v_os = %.2f mV, rule met for 3 sigma mismatch\n', n_chip, e1, v_os0*1e3);
fprintf('    max|err| over all chips and inputs: %.3f LSB (half last step %.2f, largest allow of any chip %.3f)\n', ...
        max(em1), w(n)/2, max(allow(e1, v_os0, Wr)));
fprintf('    chips with err > half last step (strict): %.1f %%,  err > allow: %.1f %%\n', ...
        100*mean(em1 > Wr(:,n)/2 + tol), 100*mean(em1 > allow(e1, v_os0, Wr) + tol));
fprintf('    chips whose own real tolerance is exceeded (mismatch beyond 3 sigma at the binding decision): %.1f %%\n', ...
        100*mean(xs1 > tol));
fprintf('    chips with err > allow but real excess <= 0 (rule says fine, converter fails): %d\n', ...
        sum(em1 > allow(e1, v_os0, Wr) + tol & xs1 <= tol));
fprintf('    chips with real excess over t2 > 0: %.1f %%  (they would fail if t2 were the limit); failing: %.1f %%\n\n', ...
        100*mean(xs2 > tol), 100*mean(em1 > allow(e1, v_os0, Wr) + tol));

%% =========================================================================
% T2: the rule violated, by 0.1, 0.5 and 1 LSB at the first decision to break
% ==========================================================================
Qm2 = Qm(1:n_chip2, :);  tr2 = tr(1:n_chip2, :);  Wr2 = Wr(1:n_chip2, :);
delta = [0.1 0.5 1];
e_b = eps_ok(1);                                     % eps just inside the rule
% settling: raise eps until decision k_bind is over by delta
% offset: keep eps at the rule value and raise v_os; the decision that breaks first
slack = (t - mis - e_b*wprev);  v_lim = slack(1:last_red) ./ max(ofac(1:last_red), eps);
v_lim(ofac(1:last_red) <= 0) = Inf;
[v_first, k_off] = min(v_lim);
fprintf('T2  rule violated. Excess = fixed errors minus tolerance at the first decision to break\n');
fprintf('    what          delta  value        decisions with need > t   max|err|  err-allow  strict fail  allow fail  pred. fail  agree\n');
for kind = 1:2
    for dd = 1:3
        if kind == 1, e2 = e_b + delta(dd)/wprev(k_bind);  v2 = v_os0;  lab = 'eps_settle';  val = e2;
        else,         e2 = e_b;  v2 = v_first + delta(dd)/ofac(k_off);  lab = 'v_os [mV]';  val = v2*1e3; end
        need = mis + v2*ofac + e2*wprev;
        bad  = find(need(1:last_red) > t(1:last_red));
        if kind == 1, em = emax(Qm2, e2, v2); ce = chip_err; else, em = emax_in(Qm2, e2, v2); ce = chip_err_in; end
        xs   = excess(tr2, e2, v2);
        a    = allow(e2, v2, Wr2);
        pred = xs > 0.02;  act = em > a + tol;      % 0.02 LSB: smaller excess is lost in the ramp step and the allow margin
        fprintf('    %-11s %6.1f %9.4f  %-24s %9.3f %10.3f %10.1f %% %10.1f %% %10.1f %% %6.1f %%\n', lab, delta(dd), val, ...
                num2str(bad), max(em), max(em - a), 100*mean(em > Wr2(:,n)/2 + tol), 100*mean(act), 100*mean(pred), 100*mean(pred == act));
        d_ex(kind, dd) = mean((em(pred) - a(pred)) - xs(pred));   % predicted excess against measured, failing-by-rule chips
        if dd == 3                                  % where does coverage go, for the worst chip and input?
            xr_ = {x_c, x_in}{kind};   % the ramp used
            [~, cw] = max(em);  ee = ce(Qm2(cw,:), e2, v2);  [~, iw] = max(abs(ee));
            r = xr_(iw);  sp = 0;  lost = 0;  Wc = Qm2(cw,:) / Q_LSB;
            for k = 1:n                              % the same loop as in cs_sar, for ONE input
                seen = r + v2*C_node(k) + (k>1)*e2*sp*Qm2(cw,max(k-1,1));   % max(..,1) only keeps the index legal at k = 1
                sg = 2*(seen >= 0) - 1;  r = r - sg*Qm2(cw,k);  sp = sg;
                cover = sum(Wc(k+1:end)) + Wc(end)/2;
                if lost == 0 && abs(r + v2*C_node(end))/Q_LSB > cover + 1e-9, lost = k; end
            end
            fprintf('      worst input of the worst chip (x = %.2f LSB): coverage first lost at decision %d, max error %.3f\n', ...
                    xr_(iw)/Q_LSB, lost, abs(ee(iw)));
        end
    end
end
fprintf('    measured minus predicted excess, mean over chips predicted to fail [LSB]: %s\n', num2str(d_ex(:)', '%7.3f'));
fprintf('\n');

%% =========================================================================
% T3: linear sum against root-sum-square, scaling v_os and eps_settle together
% ==========================================================================
% s multiplies v_os and eps_settle of T1. Rules (all at every decision with tolerance):
%   linear :  mis + s (off + setl)                      <= t   (step 7)
%   mixed  :  sqrt(mis^2 + (s (off + setl))^2)          <= t   (mismatch random, off and settling aligned)
%   rss    :  sqrt(mis^2 + (s off)^2 + (s setl)^2)      <= t   (all three independent)
off0 = v_os0 * ofac;  set0 = eps_ok(1) * wprev;
s_grid = 0.5:0.01:8;  s_ok = zeros(1, 3);
for rule = 1:3
    pass = false(size(s_grid));
    for i = 1:numel(s_grid)
        s = s_grid(i);
        switch rule                                  % switch picks the branch that matches 'rule'
            case 1, nd = mis + s*(off0 + set0);
            case 2, nd = sqrt(mis.^2 + (s*(off0 + set0)).^2);
            case 3, nd = sqrt(mis.^2 + (s*off0).^2 + (s*set0).^2);
        end
        pass(i) = all(nd(1:last_red) <= t(1:last_red));
    end
    s_ok(rule) = s_grid(sum(cumprod(pass)));
end
fprintf('T3  largest scale s (1 = T1 values) that each rule accepts: linear %.2f, mixed %.2f, rss %.2f\n', s_ok);
fprintf('    rule     s      eps_settle  v_os [mV]   max|err|  strict fail  allow fail  chips with real excess\n');
names3 = {'linear', 'mixed', 'rss'};
for rule = 1:3
    s = s_ok(rule);  e3 = s*eps_ok(1);  v3 = s*v_os0;
    em = emax(Qm2, e3, v3);  xs = excess(tr2, e3, v3);
    fprintf('    %-7s %5.2f %10.4f %10.3f %10.3f %10.1f %% %10.1f %% %12.1f %%\n', names3{rule}, s, e3, v3*1e3, ...
            max(em), 100*mean(em > Wr2(:,n)/2 + tol), 100*mean(em > allow(e3, v3, Wr2) + tol), 100*mean(xs > tol));
end
% which scale does each real chip stand? A chip fails when s (off + setl) > its own real tolerance
s_chip = min(tr2(:,1:last_red) ./ (ones(n_chip2,1) * (off0(1:last_red) + set0(1:last_red))), [], 2);
ss = sort(s_chip);
fprintf('    scale at which a chip really breaks (own tolerance, linear): lowest %.2f, 1 %% %.2f, median %.2f, highest %.2f\n', ...
        ss(1), ss(max(1, round(0.01*n_chip2))), ss(round(end/2)), ss(end));
fprintf('    simulated failures against scale (100 chips): s, eps_settle, v_os [mV], allow fail, predicted\n');
for s = [1.0 1.25 1.5 2.0 2.59 3.0]
    em = emax(Qm2(1:100,:), s*eps_ok(1), s*v_os0);
    fprintf('      %5.2f %9.4f %9.3f %10.1f %% %10.1f %%\n', s, s*eps_ok(1), s*v_os0*1e3, ...
            100*mean(em > allow(s*eps_ok(1), s*v_os0, Wr2(1:100,:)) + tol), 100*mean(s_chip(1:100) < s));
end
fprintf('\n');

%% =========================================================================
% T4: comparator noise only, no fixed errors, no mismatch
% ==========================================================================
% Output error = quantisation of the last step plus what the noise adds. The
% quantisation floor is measured with the noise off. Excess = sqrt(rms^2 - floor^2).
lists = {w, w_bin};  lname = {'redundant', 'binary'};
fprintf('T4  noise only. noise of the last decision = v_n C_node(end) / Q_LSB\n');
fprintf('    list        v_n [uV]  last decision [LSB]  floor rms  total rms  excess rms  excess / last-decision noise\n');
for li = 1:2
    ww = lists{li};  nn = numel(ww);  Cn = c_node(ww);  Qn_ = ww * Q_LSB;
    xr = (rand(1, n_noise)*2 - 1) * (sum(ww) - guard) * Q_LSB;
    yq = cs_sar(xr, Qn_, Qn_, Cn, zeros(1,nn+1), zeros(1,nn+1), 0, 0*Qn_);
    fl = sqrt(mean(((yq - xr)/Q_LSB).^2));
    for vn = v_noise
        yn = cs_sar(xr, Qn_, Qn_, Cn, vn*Cn, zeros(1,nn+1), 0, 0*Qn_);
        tot = sqrt(mean(((yn - xr)/Q_LSB).^2));
        ln  = vn * Cn(end) / Q_LSB;
        ex  = sqrt(max(tot^2 - fl^2, 0));
        fprintf('    %-10s %8.0f %14.3f %16.3f %10.3f %11.3f %14.2f\n', lname{li}, vn*1e6, ln, fl, tot, ex, ex/ln);
    end
end
fprintf('    (quantisation floor: redundant %.3f = 0.5 w(end)/sqrt(3), binary %.3f = 0.5 w(end)/sqrt(3) with w(end) = 1)\n', ...
        w(end)/2/sqrt(3), 1/2/sqrt(3));

fprintf('\nrun time %.0f s\n', toc(t_start));
