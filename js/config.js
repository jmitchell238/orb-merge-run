'use strict';
// Orb Merge Run — tuning knobs (authoritative world constants)

// ---- Version (MAJOR.MINOR.PATCH) --------------------------------------------
// Keep CACHE in sw.js in sync: 'orb-merge-run-' + GAME_VERSION
const GAME_VERSION = '1.0.000';
const GAME_VERSION_LABEL = 'v' + GAME_VERSION;
const GAME_NAME = 'Orb Merge Run';

// ---- World / track ----------------------------------------------------------
const TRACK_W = 10;
const TRACK_HALF = TRACK_W / 2; // 5
const CURB_H = 0.45;
const CURB_INSET = 0.35;
const FALL_MARGIN = 0.25; // fixed — does NOT grow with ball radius
const WARN_FRAC = 0.85;

// Ball radius
const BASE_R = 0.50;
const GROW = 1.12;
const MAX_R = (TRACK_W * 0.70) / 2; // 3.5
const HIT_PAD = 0.12;

// Motion
const STEER_LERP = 12;
const STEER_SPEED = 9;
const WORLD_PER_PX = (cssW) => 14 / Math.min(cssW || 390, 900);
const MERGE_BOOST = 1.06;
const MERGE_BOOST_T = 0.35;

// Merge / ghost
const GHOST_S = 0.15;
const NUDGE_X = 0.55;
const MAX_CHAIN = 4;

// Thorns
const THORN_INVULN = 0.4;
const THORN_DEPTH = 1.2;

// Level length
const BASE_LEN = 160;
const LEN_STEP = 22;
const FINISH_PAD = 8;
const MAX_LEVEL = 12;

// Camera (adapted from crowd-runner — not identical)
const PITCH = 0.42;
const CAM_Y = 7.2;
const CAM_Z_BACK = 12;
const CAM_X_FOLLOW = 0.35;

// Timing
const DEAD_ANIM_S = 0.6;
const COIN_MULT = 1;

// Candy tier colors (aligned with drop-and-fuse neon palette)
// index 0 = value 2, 1 = value 4, … 10 = value 2048
const TIERS = [
  { value: 2,    color: '#7af0ff', glow: '#3de7ff' },
  { value: 4,    color: '#8bffb0', glow: '#58d68d' },
  { value: 8,    color: '#ffe66d', glow: '#ffd23e' },
  { value: 16,   color: '#ffb347', glow: '#ff9f1c' },
  { value: 32,   color: '#ff7a9a', glow: '#ff4f7a' },
  { value: 64,   color: '#ff6ad5', glow: '#ff4fd8' },
  { value: 128,  color: '#c77dff', glow: '#a855f7' },
  { value: 256,  color: '#7c9bff', glow: '#5b7cfa' },
  { value: 512,  color: '#5eead4', glow: '#2dd4bf' },
  { value: 1024, color: '#f0abfc', glow: '#e879f9' },
  { value: 2048, color: 'rainbow', glow: '#ffffff' },
];

function levelSpeed(L) {
  return Math.min(8.5 + (L - 1) * 0.45, 16);
}

function finishZForLevel(L) {
  return BASE_LEN + (L - 1) * LEN_STEP + FINISH_PAD;
}

function coinsForFinish(level, value, mergeCount) {
  const base = 20 + level * 8;
  const valueScore = Math.round(Math.log2(Math.max(2, value)) * 12);
  const mergeBonus = mergeCount * 2;
  return Math.round((base + valueScore + mergeBonus) * COIN_MULT);
}

function DRAW_R_OF(v) {
  return radiusForValue(v);
}
function HIT_R_OF(v) {
  return radiusForValue(v) + HIT_PAD;
}
