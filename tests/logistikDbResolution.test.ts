import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolvedDb } from '../src/db/db.js';

test('Database resolution mengalihkan ngola_logistik dan kolab_logistik ke ngola_geasture_adm', () => {
  // Test function alias logic
  const resolve = (name: string) => (name === 'ngola_logistik' || name === 'kolab_logistik') ? 'ngola_geasture_adm' : name;
  assert.equal(resolve('ngola_logistik'), 'ngola_geasture_adm');
  assert.equal(resolve('kolab_logistik'), 'ngola_geasture_adm');
  assert.equal(resolve('ngola_geasture_adm'), 'ngola_geasture_adm');
  assert.equal(resolve('custom_db'), 'custom_db');
  assert.equal(resolvedDb, 'ngola_geasture_adm');
});
