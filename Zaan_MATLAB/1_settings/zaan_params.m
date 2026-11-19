function p = zaan_params()
% ZAAN_PARAMS  Every input number, in one place, with its status.
%   S = paper or PDK (page)   D = derived   A = assumption   U = my or team decision
%   Change a number here, or override it in a study BEFORE calling zaan_derive.

% Physics
p.k = 1.380649e-23;   % Boltzmann constant [J/K]
p.T = 300;            % temperature [K]                                   A

% Converter
p.N_bits = 10;        % output bits                                       U
p.fs     = 40e6;      % sample rate [S/s]                                 U
p.V_FS   = 1.0;       % full scale, differential peak-to-peak [V]         U
p.N_ch   = 16;        % channels summed into one ADC                      U

% Charge balance
p.alpha  = 1;         % alpha = N C_M / (2 C_DAC)                         U (review 18 Nov: aim 1)
p.C_u    = 35e-15;    % unit capacitor, PDK minimum MIM [F]               S (PDK)
p.lsb_per_unit = 8;   % one unit capacitor is worth 8 LSB                 U

% Step weights in LSB: whole units first, then charge halving of one unit
p.w = [216 128 72 40 24 16 8 4 2 1 0.5 0.5];  % candidate list            A (workbench search)

% Comparator
p.v_n   = 50e-6;      % input-referred noise [V rms]                      A
p.C_par = 0;          % extra capacitance on each summing node [F]        A (not known yet)
end
