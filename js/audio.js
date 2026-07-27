'use strict';

let audioCtx = null;

function ensureAudio() {
  if (save.muted) return null;
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    audioCtx = new AC();
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function beep(opts) {
  opts = opts || {};
  const freq = opts.freq != null ? opts.freq : 440;
  const dur = opts.dur != null ? opts.dur : 0.08;
  const type = opts.type || 'sine';
  const gain = opts.gain != null ? opts.gain : 0.04;
  const slide = opts.slide || 0;
  const ctx = ensureAudio();
  if (!ctx) return;
  const t0 = ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slide) osc.frequency.linearRampToValueAtTime(freq + slide, t0 + dur);
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  g.connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function sfxMerge(value) {
  const tier = tierForValue(value);
  const base = 280 + tier * 40;
  beep({ freq: base, dur: 0.1, type: 'sine', gain: 0.05, slide: 90 });
  setTimeout(() => beep({ freq: base * 1.45, dur: 0.08, type: 'sine', gain: 0.03 }), 40);
}

function sfxThorn() {
  beep({ freq: 180, dur: 0.12, type: 'sawtooth', gain: 0.03, slide: -80 });
}

function sfxDeath() {
  beep({ freq: 300, dur: 0.15, type: 'sawtooth', gain: 0.03, slide: -120 });
  setTimeout(() => beep({ freq: 160, dur: 0.22, type: 'triangle', gain: 0.035, slide: -50 }), 100);
}

function sfxWin() {
  beep({ freq: 440, dur: 0.1, type: 'sine', gain: 0.04, slide: 60 });
  setTimeout(() => beep({ freq: 554, dur: 0.1, type: 'sine', gain: 0.04 }), 90);
  setTimeout(() => beep({ freq: 659, dur: 0.16, type: 'sine', gain: 0.05 }), 180);
}

function sfxClick() {
  beep({ freq: 520, dur: 0.04, type: 'square', gain: 0.02 });
}

function sfxNudge() {
  beep({ freq: 260, dur: 0.04, type: 'triangle', gain: 0.02 });
}

function sfxRainbow() {
  for (let i = 0; i < 5; i++) {
    setTimeout(() => beep({
      freq: 400 + i * 80,
      dur: 0.1,
      type: 'sine',
      gain: 0.035,
      slide: 40,
    }), i * 60);
  }
}
