%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
%   STEP 7: THE ERRORS PER DECISION AGAINST THE TOLERANCE, AND WHAT       %
%                      REACHES THE OUTPUT                                 %
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
% QUESTION
% 1. Per decision: how large is each error, and which tolerance does that
%    decision therefore need? (Part A, a calculation, and a graph)
% 2. Which errors does the tolerance really repair, and what is left in the
%    output? (Part B, a simulation)
%
% Two kinds of error, treated differently:
%   FIXED errors at a decision (mismatch, offset, settling): they move the
%       charge the comparator sees by a set amount. They must fit inside the
%       tolerance, otherwise codes are lost. Required tolerance = their sum.
%   RANDOM errors (comparator and switch noise): a flip only happens when the
%       charge left is within the noise, so the error it leaves is about that
%       size, repaired or not. They need no tolerance; only the last decisions
%       (no tolerance) pass them on whole.
%   Errors BEFORE the search (memory cells, jitter) and the precharge kT/C of
%       the steps are in the charge itself: no tolerance can see them.
%
% NOT HERE YET: rounding to 10 bits (the second quantisation) and the
% calibration itself (weights are read perfectly). Both come in step 8. The
% quantisation in this step is therefore that of the last step (½ LSB), not of a
% 10-bit output, and the SNDR of part B is NOT the final SNDR.
%
% FILL IN the values of section 1. Status after every value.

clear; close all; clc;
zaan_constants;
rng(7, 'twister');

%% -----------------------------
% 1) Values to fill in (switch an error off with 0)
% -----------------------------
w          = [224 128 72 40 24 16 8 4 2 1 0.5 0.5];  % weight list [LSB]        A (candidate + 1 unit)
v_n        = 50e-6;     % comparator noise [V rms]                              A
v_os       = 0.15e-3;   % comparator offset left after calibration [V]          S (Malki 2014, p. 1174)
eps_settle = 0.01;      % part of a step not yet settled at the next decision   A (placeholder)
switch_on  = 1;         % switch noise sqrt(2 kB T C_node) per decision          D (placeholder, upper bound)
cdac_ktc   = 1;         % precharge kT/C of every step                           Rabuske eq. 4.100 (x2 for Q+ - Q-)
mem_ktc    = 1;         % kT/C of the memory cells                               step 2a
mem_gain   = 1;         % gain mismatch of the memory cells                      step 2b
sig_q_cell = 0.16e-15;  % extra charge per memory cell, spread [C]              A (spec from step 2c)
jitter     = 1e-12;     % clock jitter on the write [s rms]                     A (not studied)

%% -----------------------------
% 2) The converter: charge scale, steps, node per decision (steps 0, 3, 5, 6)
% -----------------------------
C_TH   = N_ch * C_M;
Q_LSB  = C_TH * V_FS / 2^N_bits;
V_REF  = alpha * V_FS / 2;
lsb_u  = 2 * C_u * V_REF / Q_LSB;                  % one unit = 8 LSB
sig_u  = A_C / sqrt(C_u * 1e15);
n      = numel(w);                                 % steps; decisions = n + 1
units  = w / lsb_u;
C_step = max(units, 1) * C_u;                      % physical capacitor of each step
C_node = C_TH + [0, cumsum(2 * C_step)];           % node at every decision
Q_nom  = w * Q_LSB;
sig_rel = sig_u ./ sqrt(max(units, 1));  sig_rel(units < 1) = sig_u;   % as step 5
t = zeros(1, n+1);
for k = 1:n, t(k) = sum(w(k+1:end)) + w(end) - w(k); end              % step 6

%% =========================================================================
% PART A: the errors per decision, in LSB, and the tolerance they need
% ==========================================================================
d = 1:n+1;
% mismatch: step k and all later steps can be off; 3 sigma together (step 7 rule)
mis = zeros(1, n+1);
sig_w = sig_rel .* w;
for k = 1:n, mis(k) = 3 * sqrt(sum(sig_w(k:end).^2)); end
% offset: the charge v_os C_node grows with the node; the part that equals the
% last decision is one plain shift of the result; only the difference uses tolerance
off = v_os * (C_node(end) - C_node) / Q_LSB;
% settling: decision k sees the part of step k-1 that has not arrived yet
setl = [0, eps_settle * w];  setl = setl(1:n+1);
% noise, 3 sigma, at every decision (needs no tolerance; shown for comparison)
noi = 3 * sqrt((v_n * C_node).^2 + switch_on * 2*kB*T*C_node) / Q_LSB;

need = mis + off + setl;                           % the tolerance each decision needs
set_max = t - mis - off;                           % what is left for settling of the step before
last_red = find(t > 0, 1, 'last');                 % the last decision that has tolerance
fprintf('PART A: per decision [LSB]\n');
fprintf(' dec  tolerance  mismatch  offset  settling  = needs   margin   settling may be   noise 3s\n');
for k = d
    flag = '';  if need(k) > t(k) && k <= last_red, flag = '  <- NOT COVERED'; end
    fprintf('%4d %10.2f %9.2f %7.2f %9.2f %8.2f %8.2f %12.2f %12.2f%s\n', k, t(k), mis(k), off(k), ...
            setl(k), need(k), t(k) - need(k), set_max(k), noi(k), flag);
end
fprintf('decisions after %d have no tolerance: their errors simply end up in the output\n', last_red);
fprintf('"settling may be": the largest unsettled part of the previous step this decision can absorb.\n');
fprintf('With %.0f %% left of every step, decision %d is not covered: the small steps must settle better.\n', ...
        eps_settle*100, find(need > t & d <= last_red, 1));

% errors that no tolerance sees, 3 sigma [LSB]
before = 3 * [ (A_C/sqrt(C_M*1e15))/sqrt(N_ch) * 2^(N_bits-1)/sqrt(2), ...  % memory gain tones, full scale
               sig_q_cell * sqrt(N_ch*(M_cells-1)/M_cells) / Q_LSB, ...    % memory extra charge
               mem_ktc * sqrt(2*N_ch*kB*T*C_M) / Q_LSB, ...                % memory kT/C
               jitter * 2*pi*f_max * 2^(N_bits-1)/sqrt(2), ...             % jitter, full scale at f_max
               cdac_ktc * sqrt(4*kB*T*sum(C_step)) / Q_LSB ];              % precharge kT/C of all steps
before_names = {'memory gain tones', 'memory extra charge', 'memory kT/C', 'jitter', 'precharge kT/C'};

% The graph: one row per decision, like the workbench. Fixed errors stacked,
% the tolerance as a green tick, the noise as a thin grey bar. Rows at the top:
% errors no tolerance sees. Tolerances beyond the axis are written as numbers.
xmax = 3;
figure; hold on; grid on;
hb = barh(d, [mis; off; setl]', 0.6, 'stacked');
barh(d + 0.38, noi, 0.15, 'FaceColor', [0.7 0.7 0.7]);
for k = d
    if t(k) <= xmax, plot([t(k) t(k)], [k-0.4 k+0.4], 'g-', 'LineWidth', 3);
    else, text(xmax*0.97, k, sprintf('%.1f ->', t(k)), 'HorizontalAlignment', 'right'); end
end
barh(n + 1 + (1:numel(before)), before, 0.6, 'FaceColor', [0.85 0.4 0.4]);
set(gca, 'YTick', [d, n+1+(1:numel(before))], ...
    'YTickLabel', [arrayfun(@(k) sprintf('d%d', k), d, 'UniformOutput', false), before_names], 'YDir', 'reverse');
xlim([0 xmax]);  xlabel('error [LSB], 3 sigma for random errors');
legend('mismatch', 'offset', 'settling', 'noise (no tolerance needed)', 'Location', 'southeast');
title('Fixed errors against the tolerance (green); red: not seen by any tolerance');

%% =========================================================================
% PART B: simulation of what really reaches the output
% ==========================================================================
Q_real = Q_nom .* (1 + sig_rel .* randn(1, n));    % ONE chip: its real steps
n_s = 4096;  cyc = 751;  m = 0:n_s-1;              % sine of 751 periods: about 7.3 MHz
A   = 10^(-0.5/20) * 2^(N_bits-1);                 % amplitude [LSB]
x_id = A * sin(2*pi*cyc*m/n_s) * Q_LSB;            % ideal input charge [C]

kdel = round((0:N_ch-1) * pitch * sind(theta) / c_sound * fs);
g = 1 + (A_C/sqrt(C_M*1e15)) * randn(N_ch, M_cells);
q = sig_q_cell * randn(N_ch, M_cells);
gain_pat = zeros(1, n_s);  off_pat = zeros(1, n_s);
for j = 1:N_ch
    cell = mod(m - kdel(j), M_cells) + 1;
    gain_pat = gain_pat + (g(j, cell) - 1) / N_ch;
    off_pat  = off_pat + q(j, cell);
end
in_err = mem_gain * gain_pat .* x_id + (off_pat - mean(off_pat)) ...
       + mem_ktc * sqrt(2*N_ch*kB*T*C_M) * randn(1, n_s) ...
       + jitter * 2*pi*cyc/n_s*fs * A*Q_LSB * cos(2*pi*cyc*m/n_s) .* randn(1, n_s);

zero = zeros(1, n+1);
q_dec = sqrt((v_n*C_node).^2 + switch_on*2*kB*T*C_node);
q_pre = cdac_ktc * sqrt(4*kB*T*C_step);
rms_out = @(y) sqrt(mean(((y - x_id) - mean(y - x_id)).^2)) / Q_LSB;   % error after removing the offset

r0 = rms_out(cs_sar(x_id, Q_nom, Q_nom, C_node, zero, zero, 0, 0*Q_nom));                     % SAR quantisation only
r1 = rms_out(cs_sar(x_id, Q_real, Q_real, C_node, zero, v_os*C_node, eps_settle, 0*Q_nom));   % fixed errors only
r2 = rms_out(cs_sar(x_id + in_err, Q_real, Q_real, C_node, q_dec, v_os*C_node, eps_settle, q_pre));   % everything

fprintf('\nPART B: rms error in the output, one chip, before rounding to 10 bit [LSB]\n');
fprintf('  SAR quantisation of the ½ LSB last step:   %.3f   (a 10-bit output would have %.3f)\n', r0, 1/sqrt(12));
fprintf('  + fixed errors (mismatch, offset, settling): %.3f   (the tolerance removes almost all)\n', r1);
fprintf('  + everything:                               %.3f\n', r2);
fprintf('  what the errors add on top of the quantisation: %.3f LSB rms\n', sqrt(r2^2 - r0^2));
fprintf('The SNDR before rounding (%.1f dB) is not comparable with ENOB 9.5:\n', 10*log10(A^2/2/r2^2));
fprintf('its quantisation is the ½ LSB grid; step 8 adds the rounding to 10 bit.\n');
