/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { normalizeKdsSoundSettings } from './kdsSound.js';

let persistentAudioCtx: AudioContext | null = null;

function getOrCreateAudioCtx(): AudioContext | null {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return null;
    if (!persistentAudioCtx || persistentAudioCtx.state === 'closed') {
      persistentAudioCtx = new AudioCtx();
    }
    return persistentAudioCtx;
  } catch {
    return null;
  }
}

export async function playBellWithResume(type: 'new_order' | 'ready', volume = 1) {
  try {
    const ctx = getOrCreateAudioCtx();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    const now = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.setValueAtTime(Math.min(1, Math.max(0, volume)), now);
    master.connect(ctx.destination);

    if (type === 'new_order') {
      // 🔔🔔🔔 Triple DING kencang metalik — Pesanan Masuk!
      const schedule = [
        { time: 0,    freq: 1318.5,  vol: 1.0 },  // E6
        { time: 0.22, freq: 1318.5,  vol: 0.9 },  // E6
        { time: 0.44, freq: 1567.98, vol: 1.0 },  // G6
      ];
      schedule.forEach(({ time, freq, vol }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const distort = ctx.createWaveShaper();
        const curve = new Float32Array(256);
        for (let i = 0; i < 256; i++) {
          const x = (i * 2) / 256 - 1;
          curve[i] = (Math.PI + 200) * x / (Math.PI + 200 * Math.abs(x));
        }
        distort.curve = curve;
        osc.connect(distort); distort.connect(gain); gain.connect(master);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + time);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.5, now + time + 0.6);
        gain.gain.setValueAtTime(0, now + time);
        gain.gain.linearRampToValueAtTime(vol, now + time + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, now + time + 0.7);
        osc.start(now + time);
        osc.stop(now + time + 0.75);
      });
      // Harmonic overtone metalik
      const oscH = ctx.createOscillator();
      const gainH = ctx.createGain();
      oscH.connect(gainH); gainH.connect(master);
      oscH.type = 'sine';
      oscH.frequency.setValueAtTime(2637, now);
      gainH.gain.setValueAtTime(0, now);
      gainH.gain.linearRampToValueAtTime(0.35, now + 0.01);
      gainH.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      oscH.start(now); oscH.stop(now + 0.45);

    } else {
      // 🎵 Chime melodik Do-Mi-Sol — Pesanan Siap Diambil
      const notes = [
        { time: 0,    freq: 523.25, vol: 0.7 },  // C5
        { time: 0.28, freq: 659.25, vol: 0.65 }, // E5
        { time: 0.56, freq: 783.99, vol: 0.8 },  // G5
      ];
      notes.forEach(({ time, freq, vol }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(master);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + time);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.98, now + time + 1.2);
        gain.gain.setValueAtTime(0, now + time);
        gain.gain.linearRampToValueAtTime(vol, now + time + 0.02);
        gain.gain.setValueAtTime(vol, now + time + 0.3);
        gain.gain.exponentialRampToValueAtTime(0.001, now + time + 1.4);
        osc.start(now + time); osc.stop(now + time + 1.5);
        // Overtone
        const oscOv = ctx.createOscillator();
        const gainOv = ctx.createGain();
        oscOv.connect(gainOv); gainOv.connect(master);
        oscOv.type = 'sine';
        oscOv.frequency.setValueAtTime(freq * 2, now + time);
        gainOv.gain.setValueAtTime(0, now + time);
        gainOv.gain.linearRampToValueAtTime(vol * 0.15, now + time + 0.02);
        gainOv.gain.exponentialRampToValueAtTime(0.001, now + time + 0.8);
        oscOv.start(now + time); oscOv.stop(now + time + 0.85);
      });
    }
  } catch (e) {
    console.warn('Bell playback failed:', e);
  }
}

export async function playConfiguredKdsSound(
  type: 'new_order' | 'ready',
  rawSettings: Record<string, unknown>
) {
  const settings = normalizeKdsSoundSettings(rawSettings);
  if (!settings.enabled) return false;
  const customUrl = type === 'new_order' ? settings.newOrderUrl : settings.readyUrl;
  if (customUrl) {
    try {
      const ctx = getOrCreateAudioCtx();
      if (!ctx) throw new Error('AudioContext tidak tersedia');
      if (ctx.state === 'suspended') await ctx.resume();
      const response = await fetch(customUrl, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Audio HTTP ${response.status}`);
      const buffer = await ctx.decodeAudioData(await response.arrayBuffer());
      const source = ctx.createBufferSource();
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(settings.volume, ctx.currentTime);
      source.buffer = buffer;
      source.connect(gain);
      gain.connect(ctx.destination);
      source.start();
      return true;
    } catch (error) {
      console.warn('Custom KDS sound failed, using built-in bell:', error);
    }
  }
  await playBellWithResume(type, settings.volume);
  return true;
}

export async function unlockAudioContext() {
  try {
    const ctx = getOrCreateAudioCtx();
    if (!ctx) return false;
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    // Play a tiny silent sound to unlock/wake up
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.001);
    return true;
  } catch (e) {
    console.warn('Audio unlock failed:', e);
    return false;
  }
}
