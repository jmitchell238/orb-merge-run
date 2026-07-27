'use strict';

function isPowerOfTwo(v) {
  return Number.isInteger(v) && v >= 2 && (v & (v - 1)) === 0;
}

/** @returns {number|null} next value or null if no merge */
function nextValue(a, b) {
  if (a !== b) return null;
  if (!isPowerOfTwo(a) || !isPowerOfTwo(b)) return null;
  return a + b;
}

function demoteValue(v) {
  if (v <= 2) return 2;
  return Math.max(2, Math.floor(v / 2));
}

/** 0-based index: 2→0, 4→1, 2048→10 */
function tierForValue(v) {
  if (!isPowerOfTwo(v) || v < 2) return 0;
  const i = Math.round(Math.log2(v)) - 1;
  return Math.max(0, i);
}

function valueForTier(i) {
  return Math.pow(2, i + 1);
}

function colorForValue(v) {
  if (v >= 2048) return { color: 'rainbow', glow: '#ffffff' };
  const idx = Math.min(tierForValue(v), TIERS.length - 1);
  return TIERS[idx];
}

function radiusForValue(v) {
  const i = Math.max(0, Math.log2(Math.max(2, v)) - 1);
  return Math.min(MAX_R, BASE_R * Math.pow(GROW, i));
}

function formatValueLabel(v) {
  if (v >= 10000) return String(Math.round(v / 1000)) + 'k';
  return String(v);
}
