import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/components/ManualOrder.tsx', import.meta.url), 'utf8');

test('checkout is reachable on narrow screens and total stays with confirmation', () => {
  assert.match(source, /href="#manual-order-checkout"/);
  assert.match(source, /id="manual-order-checkout"/);
  assert.match(source, /max-h-\[40vh\] xl:max-h-none/);
  const total = source.indexOf('Total pembayaran');
  const button = source.indexOf('Konfirmasi Pesanan', total);
  assert.ok(total >= 0 && button > total, 'summary precedes confirmation');
  assert.match(source.slice(total, button), /onClick=\{submitManualOrder\}/);
});
