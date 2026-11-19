function d = zaan_derive(p)
% ZAAN_DERIVE  The charge scale that follows from zaan_params.
%   Charge convention: Q = Q+ - Q-, the difference of the charges on the two
%   summing nodes. Rabuske 2017 counts (Q+ - Q-) / 2; every charge here is twice
%   his, and so is one LSB, so anything expressed in LSB is the same.

d.C_TH  = p.N_ch * p.C_M;                  % [F] memory cells on one node during a read
d.Q_FS  = d.C_TH * p.V_FS;                 % [C] full scale of Q, peak to peak
d.Q_LSB = d.Q_FS / 2^p.N_bits;             % [C] one LSB
end
