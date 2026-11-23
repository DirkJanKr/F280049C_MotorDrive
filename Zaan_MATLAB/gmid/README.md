# gm/ID lookup tables

`gmid_table.m` (our own) prints gm/ID, ID/W, fT, gm/gds and gm/ID x fT from a lookup table
in the format of Jespers and Murmann (2017).

Tables and the `look_up.m` function: https://github.com/bmurmann/Book-on-gm-ID-design
(AGPL), folder `starter_files_closed_source_tools`:
- `180nch.mat`, `180pch.mat`: generic 180 nm BSIM3 (the course tables, ET4252 slide 8), about 90 MB each.
  Download them yourself; too large for this repo. Status of their numbers: A (not our PDK).
- `look_up.m`: the lookup function, e.g. `look_up(nch, 'GM_ID', 'VDS', 0.9, 'L', 0.18)`.
- `techsweep_spectre_run.m`, `techsweep.scs` and a `techsweep_config_*_spectre.m`: to make the
  same tables from the real PDK in Cadence Spectre. Those tables go in `SAR_ADC_Simulator/local-data/`.

Open-source 180 nm alternative with ready tables: folder `starter_files_open_source_tools/gf180mcuD`.
