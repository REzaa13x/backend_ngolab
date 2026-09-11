import test from 'node:test';
import assert from 'node:assert/strict';
import { detectAudioExtension, normalizeKdsSoundSettings } from '../src/lib/kdsSound.js';

test('volume suara KDS dinormalisasi pada rentang 0 sampai 1', () => {
  assert.equal(normalizeKdsSoundSettings({ kds_sound_volume: '75' }).volume, 0.75);
  assert.equal(normalizeKdsSoundSettings({ kds_sound_volume: '200' }).volume, 1);
  assert.equal(normalizeKdsSoundSettings({ kds_sound_volume: '-10' }).volume, 0);
});

test('pengaturan suara memilih URL sesuai jenis bell dan status aktif', () => {
  const settings = normalizeKdsSoundSettings({
    kds_sound_enabled: '1',
    kds_new_order_sound_url: '/uploads/sounds/order.mp3',
    kds_ready_sound_url: '/uploads/sounds/ready.wav'
  });
  assert.equal(settings.enabled, true);
  assert.equal(settings.newOrderUrl, '/uploads/sounds/order.mp3');
  assert.equal(settings.readyUrl, '/uploads/sounds/ready.wav');
  assert.equal(normalizeKdsSoundSettings({ kds_sound_enabled: '0' }).enabled, false);
});

test('format audio dikenali dari isi file dan bukan hanya ekstensi nama', () => {
  assert.equal(detectAudioExtension(Buffer.from('ID3test')), 'mp3');
  assert.equal(detectAudioExtension(Buffer.from('OggSdata')), 'ogg');
  assert.equal(detectAudioExtension(Buffer.from('RIFF1234WAVEdata')), 'wav');
  assert.equal(detectAudioExtension(Buffer.from('<script>alert(1)</script>')), null);
});
