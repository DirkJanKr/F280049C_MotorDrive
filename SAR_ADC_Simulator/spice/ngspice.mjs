// Small bridge to ngspice in batch mode: write a netlist, run it, read the columns written
// with `wrdata`. No other dependencies. ngspice must be on the PATH (Ubuntu: apt-get install ngspice).

import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** The ngspice version string, or null when ngspice is not installed. */
export function ngspiceVersion() {
  const r = spawnSync('ngspice', ['-v'], { encoding: 'utf8' });
  if (r.error || r.status !== 0) return null;
  const m = /ngspice-(\S+)/.exec(r.stdout + r.stderr);
  return m ? m[1] : 'unknown';
}

/**
 * Run a transient netlist and return the traces of the given node expressions.
 * netlist: the circuit without .control; vectors: e.g. ['v(p)', 'v(n)'].
 * Returns { t: Float64Array, [vector]: Float64Array }.
 */
export function runTransient(netlist, tranLine, vectors) {
  const dir = mkdtempSync(join(tmpdir(), 'zaan-spice-'));
  try {
    const out = join(dir, 'out.txt');
    const cir = `${netlist.trim()}\n.control\nset wr_singlescale\nset wr_vecnames\noption numdgt=12\n${tranLine}\nwrdata ${out} ${vectors.join(' ')}\nquit\n.endc\n.end\n`;
    writeFileSync(join(dir, 'in.cir'), `* zaan\n${cir}`);
    const r = spawnSync('ngspice', ['-b', join(dir, 'in.cir')], { encoding: 'utf8' });
    if (r.error) throw r.error;
    const lines = readFileSync(out, 'utf8').trim().split('\n');
    const head = lines[0].trim().split(/\s+/);
    const rows = lines.slice(1).map((l) => l.trim().split(/\s+/).map(Number));
    const res = { t: Float64Array.from(rows, (q) => q[0]) };
    vectors.forEach((v, k) => { res[v] = Float64Array.from(rows, (q) => q[head.indexOf(v) >= 0 ? head.indexOf(v) : k + 1]); });
    return res;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
