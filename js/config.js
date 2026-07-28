'use strict';
// Orb Merge Run — tuning knobs (authoritative world constants)

// ---- Version (MAJOR.MINOR.PATCH) --------------------------------------------
// Keep CACHE in sw.js in sync: 'orb-merge-run-' + GAME_VERSION
const GAME_VERSION = '1.2.003';
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
const ORB_ROLL_SCALE = 1.15;
const MAX_CHAIN = 4;

// Thorns
const THORN_INVULN = 0.55;
const THORN_DEPTH = 1.0;
// Cap thorns per level — keep the run spicy (was too empty)
// index = level, value = max thorn strips
const MAX_THORNS_BY_LEVEL = [0, 4, 5, 6, 7, 8, 9, 10, 11, 12, 12, 13, 14];

// Level length — longer road, sparser content (Ball Run feel)
const BASE_LEN = 200;
const LEN_STEP = 28;
const FINISH_PAD = 10;
// Crowd-runner style: multiplier walls AFTER the checkered finish
const BONUS_WALL_START = 12;   // first wall after finishZ
const BONUS_WALL_SPACING = 14;
const BONUS_WALL_MULTS = [2, 3, 4, 6, 10];
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
  // Slightly gentler ramp — more time to aim merges
  return Math.min(7.2 + (L - 1) * 0.38, 13.5);
}

function finishZForLevel(L) {
  // Checkered goal only — bonus walls sit after this
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
