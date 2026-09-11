export interface KdsSoundSettings {
  enabled: boolean;
  volume: number;
  newOrderUrl: string;
  readyUrl: string;
}

export function normalizeKdsSoundSettings(settings: Record<string, unknown>): KdsSoundSettings {
  const rawVolume = Number(settings.kds_sound_volume ?? 100);
  const volumePercent = Number.isFinite(rawVolume) ? Math.min(100, Math.max(0, rawVolume)) : 100;
  return {
    enabled: String(settings.kds_sound_enabled ?? '1') !== '0',
    volume: volumePercent / 100,
    newOrderUrl: typeof settings.kds_new_order_sound_url === 'string' ? settings.kds_new_order_sound_url : '',
    readyUrl: typeof settings.kds_ready_sound_url === 'string' ? settings.kds_ready_sound_url : ''
  };
}

function ascii(bytes: Uint8Array, start: number, length: number) {
  return Array.from(bytes.slice(start, start + length)).map(value => String.fromCharCode(value)).join('');
}

export function detectAudioExtension(input: Uint8Array): 'mp3' | 'wav' | 'ogg' | 'm4a' | 'webm' | null {
  const bytes = new Uint8Array(input);
  if (bytes.length >= 3 && ascii(bytes, 0, 3) === 'ID3') return 'mp3';
  if (bytes.length >= 2 && bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) return 'mp3';
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WAVE') return 'wav';
  if (bytes.length >= 4 && ascii(bytes, 0, 4) === 'OggS') return 'ogg';
  if (bytes.length >= 8 && ascii(bytes, 4, 4) === 'ftyp') return 'm4a';
  if (bytes.length >= 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) return 'webm';
  return null;
}
