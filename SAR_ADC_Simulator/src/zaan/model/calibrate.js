// Foreground calibration: least-squares weights from raw decisions and a known input.
// Unknowns: offset c and one weight per decision; model x - 0.5 = c + sum s_i w_i.

/** Solve A x = b (square) by Gaussian elimination with partial pivoting. */
export function solve(A, b) {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let k = 0; k < n; k++) {
    let p = k;
    for (let i = k + 1; i < n; i++) if (Math.abs(M[i][k]) > Math.abs(M[p][k])) p = i;
    [M[k], M[p]] = [M[p], M[k]];
    if (Math.abs(M[k][k]) < 1e-12) continue;
    for (let i = k + 1; i < n; i++) {
      const f = M[i][k] / M[k][k];
      for (let j = k; j <= n; j++) M[i][j] -= f * M[k][j];
    }
  }
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let s = M[i][n];
    for (let j = i + 1; j < n; j++) s -= M[i][j] * x[j];
    x[i] = Math.abs(M[i][i]) < 1e-12 ? 0 : s / M[i][i];
  }
  return x;
}

/**
 * decisions: array of Uint8Array (one per sample), xCode: known input in codes (x + 2^N/2).
 * Returns { c, w } usable by combine().
 */
export function leastSquaresWeights(decisions, xCode) {
  const n = decisions[0].length;
  const m = n + 1;
  const A = Array.from({ length: m }, () => new Array(m).fill(0));
  const b = new Array(m).fill(0);
  const row = new Array(m);
  for (let k = 0; k < decisions.length; k++) {
    const d = decisions[k];
    row[0] = 1;
    for (let i = 0; i < n; i++) row[i + 1] = d[i] ? 1 : -1;
    const y = xCode[k] - 0.5;
    for (let i = 0; i < m; i++) {
      b[i] += row[i] * y;
      for (let j = 0; j < m; j++) A[i][j] += row[i] * row[j];
    }
  }
  const sol = solve(A, b);
  return { c: sol[0], w: sol.slice(1) };
}
