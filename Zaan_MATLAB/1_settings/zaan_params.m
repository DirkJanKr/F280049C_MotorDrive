function p = zaan_params()
% ZAAN_PARAMS  Every input number, in one place, with its status.
%   S = paper or PDK (page)   D = derived   A = assumption   U = my or team decision
%   Only what is decided or needed so far. Later steps add their own results here.

% Physics
p.k = 1.380649e-23;   % Boltzmann constant [J/K]
p.T = 300;            % temperature [K]                                   A

% Specification
p.N_bits = 10;        % output bits                                       U
p.fs     = 40e6;      % sample rate [S/s]                                 U
p.V_FS   = 1.0;       % full scale, differential peak-to-peak [V]         U
p.N_ch   = 16;        % channels summed into one ADC                      U
p.ENOB   = 9.5;       % aim                                               U

% Memory cell: a starting value, set properly in step 2
p.C_M    = 280e-15;   % one memory capacitor [F]                          A (start value)

% Memory cells and capacitors
p.M_cells = 22;       % memory cells per channel                         D (±15°, 25 ns slots)
p.A_C     = 0.0499;   % matching of one MIM capacitor: sigma(C)/C = A_C / sqrt(C in fF)   S (PDK Fig. 16)
p.pitch   = 200e-6;   % element pitch [m]                                 U
p.c       = 1540;     % speed of sound [m/s]                              S
p.theta   = 15;       % steering angle used in the studies [deg]          U

% Charge balance
p.alpha  = 1;         % alpha = N C_M / (2 C_DAC), fixed at 1 for now     U (review 18 Nov)
end
