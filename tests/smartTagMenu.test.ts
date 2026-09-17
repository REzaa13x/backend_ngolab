import test from 'node:test';
import assert from 'node:assert/strict';
import { desiredSmartTagDisplayed, parseMenuMutationTarget, serializeSmartTagMenu, smartTagMenuPathId } from '../src/lib/smartTagMenu.js';

test('menu Smart Tag dinormalisasi untuk halaman Ngolab tanpa kehilangan sumber data', () => {
  const result = serializeSmartTagMenu({
    id: 27,
    name: 'Mie Goreng',
    category: 'Makanan',
    price: '12000',
    stock: 91,
    status: 'Tersedia',
    displayed: 1,
    image_url: '/uploads/menu.webp',
    description: 'Menu dari Smart Tag',
  }, 'https://smarttag.ngolab.online');

  assert.deepEqual(result, {
    id: '27',
    name: 'Mie Goreng',
    category: 'Makanan',
    price: 12000,
    inStock: true,
    displayed: 1,
    stock: 91,
    outlet: 'ngolab',
    image: 'https://smarttag.ngolab.online/uploads/menu.webp',
    description: 'Menu dari Smart Tag',
    deskripsi: 'Menu dari Smart Tag',
    isActive: true,
    inventoryAvailable: true,
    availabilityOverride: 'auto',
    availabilityReason: '',
    availabilityUpdatedBy: 'Smart Tag',
    availabilityUpdatedAt: null,
    unavailableReason: 'available',
    source: 'smart-tag',
  });
});

test('menu Smart Tag yang stoknya ada tetapi display mati ditandai nonaktif manual', () => {
  const result = serializeSmartTagMenu({
    id: 28, name: 'Bakso', price: 15000, stock: 10, displayed: 0, status: 'Tidak Tersedia',
  }, 'https://smarttag.ngolab.online');

  assert.equal(result.inStock, false);
  assert.equal(result.inventoryAvailable, true);
  assert.equal(result.availabilityOverride, 'force_off');
  assert.equal(result.unavailableReason, 'manual');
});

test('aksi ketersediaan Ngolab diterjemahkan menjadi nilai displayed Smart Tag', () => {
  assert.equal(desiredSmartTagDisplayed('auto'), 1);
  assert.equal(desiredSmartTagDisplayed('force_off'), 0);
});

test('ID menu Smart Tag wajib numerik sebelum dipakai sebagai segmen URL', () => {
  assert.equal(smartTagMenuPathId('27'), '27');
  assert.throws(() => smartTagMenuPathId('../admin?x=1'), /ID menu Smart Tag tidak valid/i);
});

test('target mutasi menu wajib menyebut sumber dan outlet yang valid secara eksplisit', () => {
  assert.deepEqual(parseMenuMutationTarget('smart-tag', 'ngolab'), { source: 'smart-tag', outlet: 'ngolab' });
  assert.deepEqual(parseMenuMutationTarget('local', 'coworking'), { source: 'local', outlet: 'coworking' });
  assert.throws(() => parseMenuMutationTarget(undefined, 'ngolab'), /sumber menu tidak valid/i);
  assert.throws(() => parseMenuMutationTarget('local', 'unknown'), /outlet tidak valid/i);
  assert.throws(() => parseMenuMutationTarget('smart-tag', 'coworking'), /Smart Tag hanya berlaku/i);
});
