'use strict';
// Orb Merge Run — tuning knobs (authoritative world constants)

// ---- Version (MAJOR.MINOR.PATCH) --------------------------------------------
// Keep CACHE in sw.js in sync: 'orb-merge-run-' + GAME_VERSION
const GAME_VERSION = '1.3.000';
const GAME_VERSION_LABEL = 'v' + GAME_VERSION;
const GAME_NAME = 'Orb Merge Run';

// ---- World / track ----------------------------------------------------------
const TRACK_W = 10;
const TRACK_HALF = TRACK_W / 2; // 5
const CURB_H = 0.45;
const CURB_INSET = 0.35;
// Kid-friendly: wider death band so light overswipe doesn't kill (was 0.25)
const FALL_MARGIN = 0.45;
const WARN_FRAC = 0.82;

// Ball radius
const BASE_R = 0.50;
const GROW = 1.12;
const MAX_R = (TRACK_W * 0.70) / 2; // 3.5
// Slightly fatter hitboxes so merges feel fair at speed
const HIT_PAD = 0.18;

// Motion
const STEER_LERP = 14;
const STEER_SPEED = 10;
const WORLD_PER_PX = (cssW) => 14 / Math.min(cssW || 390, 900);
const MERGE_BOOST = 1.06;
const MERGE_BOOST_T = 0.35;
// Soft center magnet when near the edge (helps little hands without hard clamp)
const EDGE_ASSIST_FRAC = 0.88;
const EDGE_ASSIST = 2.8;

// Merge / ghost / knock
const GHOST_S = 0.35;
const NUDGE_X = 0.55;
const KNOCK_SPEED = 5.2;
const KNOCK_Z = 1.4;
const ORB_FRICTION = 2.8;
// Knocked orbs — gentle spin (was way too fast)
const ORB_ROLL_SCALE = 0.35;
// Player forward roll: fraction of physical ω = v/r (lower = slower)
const ROLL_RATE = 0.38;
// Flipbook frames baked per orb value (sprite swap)
const ROLL_FRAMES = 20;
const ROLL_SPRITE_RES = 160;
// +1 = number rises bottom → top as the ball rolls forward (correct roll sense)
const ROLL_DIR = 1;
const MAX_CHAIN = 4;

// Thorns
const THORN_INVULN = 0.55;
const THORN_DEPTH = 1.0;
// Cap thorns per level — keep the run spicy (was too empty)
// index = level, value = max thorn strips
// Keep thorns sparse — open road between challenges
// Index = level (1-based used via MAX_THORNS_BY_LEVEL[L]); beyond array → formula
const MAX_THORNS_BY_LEVEL = [0, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8];

// Level length — grows forever for endless levels
const BASE_LEN = 200;
const LEN_STEP = 24;
const FINISH_PAD = 10;
// Crowd-runner style: multiplier walls AFTER the checkered finish
const BONUS_WALL_START = 12;   // first wall after finishZ
const BONUS_WALL_SPACING = 14;
const BONUS_WALL_MULTS = [2, 3, 4, 6, 10];
// Campaign hint only — levels continue forever (seeded procedural)
const CAMPAIGN_LEVELS = 12;
// Soft UI cap for dropdown length (still can play any unlocked level)
const LEVEL_SELECT_WINDOW = 40;
// Legacy alias: no hard end — use Infinity-safe large number for clamps that need one
const MAX_LEVEL = 9999;

function maxThornsForLevel(L) {
  if (L < MAX_THORNS_BY_LEVEL.length && MAX_THORNS_BY_LEVEL[L] != null) {
    return MAX_THORNS_BY_LEVEL[L];
  }
  return Math.min(10, 4 + Math.floor(L / 4));
}

/** Stable unique seed per level (endless stays deterministic per L). */
function seedForLevel(L) {
  let s = (L * 10007) ^ (L * 7919) ^ 0x9e3779b9;
  s = Math.imul(s ^ (s >>> 16), 0x7feb352d);
  s = Math.imul(s ^ (s >>> 15), 0x846ca68b);
  return (s ^ (s >>> 16)) >>> 0;
}

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
  // Slow ramp — endless can get spicy later without early rush
  return Math.min(6.8 + (L - 1) * 0.22, 12.5);
}

function finishZForLevel(L) {
  // Checkered goal only — bonus walls sit after this
  // Slight length growth forever
  return BASE_LEN + (L - 1) * LEN_STEP + FINISH_PAD;
}

function bonusEndZForLevel(finishZ) {
  return finishZ + BONUS_WALL_START + BONUS_WALL_MULTS.length * BONUS_WALL_SPACING + 4;
}

/**
 * Base coins × bonusMult (from post-finish walls, like Crowd Clash Runner).
 * @param {number} bonusMult coin multiplier (1 if no walls smashed)
 */
function coinsForFinish(level, value, mergeCount, bonusMult) {
  const base = 20 + level * 8;
  const valueScore = Math.round(Math.log2(Math.max(2, value)) * 12);
  const mergeBonus = mergeCount * 2;
  const mult = Math.max(1, bonusMult || 1);
  return Math.round((base + valueScore + mergeBonus) * mult * COIN_MULT);
}

function DRAW_R_OF(v) {
  return radiusForValue(v);
}
function HIT_R_OF(v) {
  return radiusForValue(v) + HIT_PAD;
}
