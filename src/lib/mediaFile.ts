export interface DetectedMediaFile {
  extension: string;
  mimeType: string;
  fileType: 'image' | 'video';
}

export function detectMediaFile(header: Buffer): DetectedMediaFile | null {
  if (header.length >= 3 && header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) {
    return { extension: '.jpg', mimeType: 'image/jpeg', fileType: 'image' };
  }
  if (header.length >= 8 && header.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { extension: '.png', mimeType: 'image/png', fileType: 'image' };
  }
  const ascii = header.toString('ascii');
  if (ascii.startsWith('GIF87a') || ascii.startsWith('GIF89a')) {
    return { extension: '.gif', mimeType: 'image/gif', fileType: 'image' };
  }
  if (ascii.startsWith('RIFF') && ascii.slice(8, 12) === 'WEBP') {
    return { extension: '.webp', mimeType: 'image/webp', fileType: 'image' };
  }
  if (header.length >= 4 && header.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) {
    return { extension: '.webm', mimeType: 'video/webm', fileType: 'video' };
  }
  if (header.length >= 12 && ascii.slice(4, 8) === 'ftyp') {
    const brand = ascii.slice(8, 12).toLowerCase();
    return brand.startsWith('qt')
      ? { extension: '.mov', mimeType: 'video/quicktime', fileType: 'video' }
      : { extension: '.mp4', mimeType: 'video/mp4', fileType: 'video' };
  }
  return null;
}
