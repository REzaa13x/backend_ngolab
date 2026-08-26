import test from 'node:test';
import assert from 'node:assert/strict';
import { detectMediaFile } from '../src/lib/mediaFile.js';

test('mendeteksi gambar dari magic bytes, bukan nama file', () => {
  assert.deepEqual(detectMediaFile(Buffer.from([0xff, 0xd8, 0xff, 0x00])), { extension: '.jpg', mimeType: 'image/jpeg', fileType: 'image' });
  assert.deepEqual(detectMediaFile(Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP')])), { extension: '.webp', mimeType: 'image/webp', fileType: 'image' });
});

test('menolak konten aktif yang menyamar sebagai media', () => {
  assert.equal(detectMediaFile(Buffer.from('<html><script>alert(1)</script>')), null);
});
