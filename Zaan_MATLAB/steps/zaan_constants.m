%% zaan_constants.m   All given values of the Zaan converter, in one place
% This is a script, not a function: every step runs it at the top with
%     zaan_constants;
% and then has all these variables in its workspace.
% Status after each value:  S = paper or PDK   D = derived   A = assumption   U = my or team decision
% Change a value here and every step that runs afterwards uses the new value.

%% -----------------------------
% Physics
% -----------------------------
kB = 1.380649e-23;   % Boltzmann constant [J/K]                                   S
T  = 300;            % temperature [K]                                            A

%% -----------------------------
% Specification
% -----------------------------
N_bits   = 10;       % output bits                                                U
fs       = 40e6;     % sample rate [S/s]                                          U
V_FS     = 1.0;      % full scale, differential peak-to-peak [V]                  U
N_ch     = 16;       % channels summed into one converter (one tile)              U
ENOB_aim = 9.5;      % effective number of bits we aim for                        U
f_max    = 13e6;     % highest signal frequency, band edge [Hz]                   U

%% -----------------------------
% Beamformer and memory cells
% -----------------------------
C_M     = 280e-15;   % one memory capacitor [F]                                   A (start value)
M_cells = 22;        % memory cells per channel                                   D (±15 deg, 25 ns slots)
pitch   = 200e-6;    % element pitch [m]                                          U
c_sound = 1540;      % speed of sound in tissue [m/s]                             S
theta   = 15;        % steering angle used in the studies [deg]                   U

%% -----------------------------
% Capacitor matching (PDK, MIM 2 fF/um^2)
% -----------------------------
A_C = 0.0499;        % sigma(C)/C of one capacitor = A_C / sqrt(C in fF)          S (PDK Fig. 16)

%% -----------------------------
% Charge balance
% -----------------------------
alpha = 1;           % alpha = N C_M / (2 C_DAC), fixed at 1 for now              U (review 18 Nov)
