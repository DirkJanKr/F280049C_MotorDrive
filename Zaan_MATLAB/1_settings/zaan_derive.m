function d = zaan_derive(p)
% ZAAN_DERIVE  Everything that follows from zaan_params.
%   Charge convention: Q = Q+ - Q-, the difference of the charges on the two
%   summing nodes. One LSB of input is Q_LSB.

d.V_REF = p.alpha * p.V_FS / 2;                   % [V]   charge balance with alpha
d.Q_LSB = 2 * d.V_REF * p.C_u / p.lsb_per_unit;   % [C]   one unit changes Q by 2 V_REF C_u
d.C_M   = d.Q_LSB * 2^p.N_bits / (p.N_ch * p.V_FS); % [F] from Q_FS = N C_M V_FS
d.C_TH  = p.N_ch * d.C_M;                         % [F]   sampling capacitance per node

% Steps: weight in LSB, the charge it adds to Q, and the capacitor it really is
n = numel(p.w);
d.dQ     = p.w * d.Q_LSB;                          % [C] nominal change of Q per step
d.C_step = zeros(1, n);                            % [F] physical capacitor of each step
for k = 1:n
    if p.w(k) >= p.lsb_per_unit
        d.C_step(k) = (p.w(k) / p.lsb_per_unit) * p.C_u;  % whole units
    else
        d.C_step(k) = p.C_u;                               % a halved unit: full size, part of the charge
    end
end
d.C_DAC = sum(d.C_step);                           % [F] all capacitors that join the node

% Node capacitance seen by the comparator at each decision (n steps, n + 1 decisions).
% A capacitor C across the two nodes adds 2 C (Rabuske 2017, eq. 4.21).
d.C_node = d.C_TH + p.C_par + [0, cumsum(2 * d.C_step)];
end
