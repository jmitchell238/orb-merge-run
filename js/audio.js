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
  if (slide) osc.frequency.linearRampToValueAtTime(Math.max(20, freq + slide), t0 + dur);
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  g.connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

/** Soft noise burst (thump / whoosh body). */
function noiseBurst(opts) {
  opts = opts || {};
  const ctx = ensureAudio();
  if (!ctx) return;
  const dur = opts.dur != null ? opts.dur : 0.12;
  const gain = opts.gain != null ? opts.gain : 0.04;
  const t0 = ctx.currentTime;
  const n = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < n; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / n);
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = opts.filter || 'lowpass';
  filter.frequency.setValueAtTime(opts.freq != null ? opts.freq : 400, t0);
  if (opts.freqSlide) {
    filter.frequency.linearRampToValueAtTime(
      Math.max(40, (opts.freq || 400) + opts.freqSlide),
      t0 + dur
    );
  }
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filter);
  filter.connect(g);
  g.connect(ctx.destination);
  src.start(t0);
  src.stop(t0 + dur + 0.02);
}

function sfxMerge(value) {
  const tier = tierForValue(value);
  const base = 320 + tier * 36;
  // soft body thump + rising chime pair
  noiseBurst({ dur: 0.08, gain: 0.045, freq: 220 + tier * 20, filter: 'lowpass' });
  beep({ freq: base, dur: 0.09, type: 'triangle', gain: 0.05, slide: 70 });
  setTimeout(function () {
    beep({ freq: base * 1.5, dur: 0.1, type: 'sine', gain: 0.04, slide: 40 });
  }, 35);
  setTimeout(function () {
    beep({ freq: base * 2.0, dur: 0.07, type: 'sine', gain: 0.025 });
  }, 80);
}

function sfxThorn() {
  noiseBurst({ dur: 0.1, gain: 0.04, freq: 500, freqSlide: -300, filter: 'bandpass' });
  beep({ freq: 160, dur: 0.14, type: 'sawtooth', gain: 0.028, slide: -90 });
}

function sfxDeath() {
  noiseBurst({ dur: 0.22, gain: 0.05, freq: 280, freqSlide: -180, filter: 'lowpass' });
  beep({ freq: 280, dur: 0.16, type: 'sawtooth', gain: 0.03, slide: -140 });
  setTimeout(function () {
    beep({ freq: 140, dur: 0.28, type: 'triangle', gain: 0.04, slide: -40 });
  }, 90);
}

function sfxWin() {
  beep({ freq: 440, dur: 0.1, type: 'sine', gain: 0.045, slide: 40 });
  setTimeout(function () { beep({ freq: 554, dur: 0.1, type: 'sine', gain: 0.04 }); }, 90);
  setTimeout(function () { beep({ freq: 659, dur: 0.12, type: 'sine', gain: 0.045 }); }, 180);
  setTimeout(function () { beep({ freq: 880, dur: 0.18, type: 'triangle', gain: 0.04 }); }, 280);
}

function sfxClick() {
  beep({ freq: 520, dur: 0.04, type: 'square', gain: 0.02 });
}

/** Wrong-value hit — rubbery bounce. */
function sfxNudge() {
  noiseBurst({ dur: 0.06, gain: 0.035, freq: 180, filter: 'lowpass' });
  beep({ freq: 210, dur: 0.06, type: 'triangle', gain: 0.028, slide: -60 });
  setTimeout(function () {
    beep({ freq: 140, dur: 0.05, type: 'sine', gain: 0.018 });
  }, 40);
}

/** Orb tumbles off the edge. */
function sfxFall() {
  noiseBurst({ dur: 0.18, gain: 0.04, freq: 320, freqSlide: -250, filter: 'lowpass' });
  beep({ freq: 240, dur: 0.2, type: 'sine', gain: 0.025, slide: -160 });
}

/** Bonus well claim. */
function sfxBonus(value) {
  const tier = tierForValue(value || 16);
  noiseBurst({ dur: 0.1, gain: 0.04, freq: 500, filter: 'highpass' });
  for (let i = 0; i < 4; i++) {
    (function (k) {
      setTimeout(function () {
        beep({
          freq: 480 + k * 90 + tier * 10,
          dur: 0.1,
          type: 'sine',
          gain: 0.04,
          slide: 30,
        });
      }, k * 55);
    })(i);
  }
}

function sfxRainbow() {
  for (let i = 0; i < 6; i++) {
    (function (k) {
      setTimeout(function () {
        beep({
          freq: 380 + k * 90,
          dur: 0.12,
          type: 'sine',
          gain: 0.035,
          slide: 50,
        });
      }, k * 55);
    })(i);
  }
}
