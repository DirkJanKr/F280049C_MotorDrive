function [err, W_real] = chip_errors(w, eps_settle, v_os, n_chips, seed)
% CHIP_ERRORS  Largest conversion error of many random chips, in LSB (steps 7c to 7e).
% Every chip gets its own capacitor errors (PDK, as step 5), converts a slow
% ramp over the whole range with cs_sar.m, and is read with its own real
% weights (perfect calibration). Returns the largest |output - input| per chip,
% and every chip's real step weights in LSB (one row per chip).
zaan_constants;
rng(seed, 'twister');
n     = numel(w);
Q_LSB = N_ch * C_M * V_FS / 2^N_bits;
V_REF = alpha * V_FS / 2;
lsb_u = 2 * C_u * V_REF / Q_LSB;
sig_u = A_C / sqrt(C_u * 1e15);
units = w / lsb_u;
sig_r = sig_u ./ sqrt(max(units, 1));  sig_r(units < 1) = sig_u;   % relative spread per step
C_node = N_ch*C_M + [0, cumsum(2 * max(units, 1) * C_u)];
x = (-(2^(N_bits-1)) + 0.5 : 0.03 : 2^(N_bits-1) - 0.5) * Q_LSB;   % ramp over the range [C]
zero = zeros(1, n+1);
err = zeros(1, n_chips);  W_real = zeros(n_chips, n);
for c = 1:n_chips
    Q_real = w * Q_LSB .* (1 + sig_r .* randn(1, n));               % this chip's steps
    W_real(c, :) = Q_real / Q_LSB;
    y = cs_sar(x, Q_real, Q_real, C_node, zero, v_os*C_node, eps_settle, zeros(1, n));
    e = (y - x) / Q_LSB;
    err(c) = max(abs(e - mean(e)));          % mean(e): the offset shifts the whole result; remove it
end
end
