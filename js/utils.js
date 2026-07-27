'use strict';

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function smoothstep(u) {
  const x = clamp(u, 0, 1);
  return x * x * (3 - 2 * x);
}

/** Mulberry32 PRNG — returns fn in [0,1). Seeded, no Math.random. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Weighted random pick. Throws if list empty.
 * @param {{weight:number}[]} list
 * @param {() => number} rng
 */
function weightedPick(list, rng) {
  if (!list.length) throw new Error('weightedPick: empty list');
  let sum = 0;
  for (const t of list) sum += t.weight;
  let r = rng() * sum;
  for (const t of list) {
    r -= t.weight;
    if (r <= 0) return t;
  }
  return list[list.length - 1];
}

function deepEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}
