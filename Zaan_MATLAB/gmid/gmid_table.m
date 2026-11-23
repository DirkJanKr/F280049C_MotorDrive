function gmid_table(f)
% GMID_TABLE  gm/ID, current density, fT, intrinsic gain and gm/ID x fT of one
% lookup table (Murmann format: struct with ID, GM, GDS, CGG over L, VGS, VDS, VSB).
%   f  path to the .mat file, e.g. 180nch.mat (generic, public) or your PDK table
%      (keep PDK tables in SAR_ADC_Simulator/local-data, never commit them)
% Prints rows at gm/ID = 25, 20, 15, 10 and 5 1/V for L = 0.18, 0.36 and 0.7 um
% at VDS = 0.9 V, VSB = 0.
s = load(f); nm = fieldnames(s); d = s.(nm{1});
[~, iv] = min(abs(d.VDS - 0.9));  is = 1;
fprintf('%s (VDS = %.2f V, VSB = 0, W = %g um)\n', nm{1}, d.VDS(iv), d.W);
fprintf('   L[um]  gm/ID[1/V]  ID/W[uA/um]  fT[GHz]  gm/gds  gm/ID*fT[GHz/V]\n');
for Lw = [0.18 0.36 0.7]
  [~, il] = min(abs(d.L - Lw));
  id = abs(squeeze(d.ID(il,:,iv,is))); gm = squeeze(d.GM(il,:,iv,is));
  gds = squeeze(d.GDS(il,:,iv,is)); cgg = squeeze(d.CGG(il,:,iv,is));
  g = gm./id; ft = gm./cgg/2/pi; jd = id/d.W*1e6; av = gm./gds; fom = g.*ft;
  [~, ip] = max(fom);
  for t = [25 20 15 10 5]
    ok = find(id > 1e-10); [~, k] = min(abs(g(ok) - t)); i = ok(k);
    fprintf('  %5.2f   %6.1f     %9.3f   %7.2f  %6.1f   %8.1f\n', d.L(il), g(i), jd(i), ft(i)/1e9, av(i), fom(i)/1e9);
  end
  fprintf('  %5.2f   peak of gm/ID*fT at gm/ID = %.1f 1/V\n', d.L(il), g(ip));
end
end
