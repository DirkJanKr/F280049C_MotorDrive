// The workbench must start from the same design as Zaan_MATLAB/steps/zaan_constants.m,
// so the two cannot drift apart again (they did until 23 Nov: alpha 0.4 against 1).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createValues } from '../src/workbench/values.js';
import { design, siOf } from '../src/workbench/design.js';
import { W_DESIGN } from '../src/workbench/weights.js';
import { store } from '../src/workbench/store.js';

const m = readFileSync(new URL('../../Zaan_MATLAB/steps/zaan_constants.m', import.meta.url), 'utf8');
const scalar = (name) => {
  const r = new RegExp(`^${name}\\s*=\\s*([-0-9.eE]+)`, 'm').exec(m);
  assert.ok(r, `${name} not found in zaan_constants.m`);
  return Number(r[1]);
};
const list = (name) => new RegExp(`^${name}\\s*=\\s*\\[([^\\]]+)\\]`, 'm').exec(m)[1].trim().split(/[\s,]+/).map(Number);
const close = (a, b) => Math.abs(a - b) <= 1e-9 * Math.max(Math.abs(a), Math.abs(b));

test('workbench defaults equal zaan_constants.m', () => {
  const v = createValues();
  const pairs = [['C_M', 'cm'], ['alpha', 'alpha'], ['N_ch', 'channels'], ['N_bits', 'bits'], ['V_FS', 'fullScale'], ['fs', 'fs'], ['M_cells', 'memCells'], ['ENOB_aim', 'enobAim']];
  for (const [mName, id] of pairs) assert.ok(close(siOf(v, id), scalar(mName)), `${mName} ${scalar(mName)} against ${id} ${siOf(v, id)}`);
  const c = design(v, { weightMode: 'custom', customWeights: W_DESIGN });
  assert.ok(close(c.P.cu, scalar('C_u')), 'C u');
  assert.ok(Math.abs(c.P.aC / 100 - scalar('A_C')) < 1e-4, 'A C');
});

test('the default weights are w_design of zaan_constants.m', () => {
  assert.deepEqual(W_DESIGN.split(/[\s,]+/).map(Number), list('w_design'));
  assert.equal(store.ui.weightMode, 'custom');
  assert.equal(store.ui.customWeights, W_DESIGN);
});
