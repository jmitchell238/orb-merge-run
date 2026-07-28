'use strict';

// ---- Expected-value curve ---------------------------------------------------
// Sparse, progressive climb (Ball Run style): a few 2s → few 4s → few 8s…
// High end tiers so a clean L1 run can reach 256–512.

/** Soft end-tier for level L (0-based: 0=2, 1=4, …). */
function endTierForLevel(L) {
  // L1→8 (512), L5→9 (1024), L9+→10 (2048) — high climb like Ball Run
  return Math.min(10, 8 + Math.floor((L - 1) * 0.25));
}

/**
 * Expected player value at normalized progress u∈[0,1].
 * Step-like plateaus so each tier has a clear stretch of matches.
 */
function expectedValue(L, u) {
  const endTier = endTierForLevel(L);
  const startTier = 0;
  // Slow early climb, accelerate late
  const eased = Math.pow(smoothstep(u), 1.15);
  const t = startTier + (endTier - startTier) * eased;
  return valueForTier(Math.round(t));
}

/**
 * Pick a spawn value around the expected tier.
 * Prefer exact match and one-below — almost never +2 teases.
 */
function pickOrbValue(L, u, rng, tierDelta) {
  const expTier = tierForValue(expectedValue(L, u));
  const deltaReq = clamp(tierDelta || 0, -2, 1);
  const roll = rng();
  let d;
  if (roll < 0.55) d = 0;
  else if (roll < 0.85) d = -1;
  else if (roll < 0.95) d = 1;
  else d = -2;
  const tier = clamp(expTier + d + deltaReq, 0, endTierForLevel(L));
  return valueForTier(Math.max(0, tier));
}

/** Hard cap: orb value may not exceed expected(+1) at its z. */
function maxValueAt(L, z, finishZ) {
  const u = clamp(z / Math.max(1, finishZ), 0, 1);
  const expTier = tierForValue(expectedValue(L, u));
  return valueForTier(Math.min(10, expTier + 1));
}

// ---- Templates (exactly 20) — zigzag orbs + real hazards -----------------------

const TEMPLATES = [
  {
    id: 'merge_lane_intro',
    length: 32, minLevel: 1, weight: 8,
    orbs: [
      { dx: -2.2, dz: 10, valueMode: 'fixed', value: 2 },
      { dx: 2.4, dz: 20, valueMode: 'fixed', value: 2 },
    ],
    hazards: [],
  },
  {
    id: 'straight_orbs',
    length: 36, minLevel: 1, weight: 5,
    orbs: [
      { dx: -2.8, dz: 10, valueMode: 'expected', tierDelta: 0 },
      { dx: 2.6, dz: 22, valueMode: 'expected', tierDelta: 0 },
      { dx: -1.5, dz: 30, valueMode: 'expected', tierDelta: -1 },
    ],
    hazards: [
      { type: 'thorn', dz: 16, depth: 1.0, x0: 1.4, x1: 4.5 },
    ],
  },
  {
    id: 'safe_breather',
    length: 26, minLevel: 1, weight: 3,
    orbs: [
      { dx: 2.0, dz: 12, valueMode: 'expected', tierDelta: 0 },
    ],
    hazards: [],
  },
  {
    id: 'wide_safe',
    length: 24, minLevel: 1, weight: 2,
    orbs: [
      { dx: -2.5, dz: 12, valueMode: 'expected', tierDelta: 0 },
    ],
    hazards: [],
  },
  {
    id: 'thorn_strip_right',
    length: 32, minLevel: 1, weight: 8,
    orbs: [
      { dx: -2.6, dz: 14, valueMode: 'expected', tierDelta: 0 },
    ],
    hazards: [
      { type: 'thorn', dz: 12, depth: 1.1, x0: 0.9, x1: 4.5 },
    ],
  },
  {
    id: 'thorn_strip_left',
    length: 32, minLevel: 1, weight: 8,
    orbs: [
      { dx: 2.6, dz: 14, valueMode: 'expected', tierDelta: 0 },
    ],
    hazards: [
      { type: 'thorn', dz: 12, depth: 1.1, x0: -4.5, x1: -0.9 },
    ],
  },
  {
    id: 'offset_pair',
    length: 30, minLevel: 1, weight: 6,
    orbs: [
      { dx: -3.0, dz: 10, valueMode: 'expected', tierDelta: 0 },
      { dx: 3.0, dz: 18, valueMode: 'expected', tierDelta: 0 },
    ],
    hazards: [
      { type: 'thorn', dz: 14, depth: 0.9, x0: -1.0, x1: 1.0 },
    ],
  },
  {
    id: 'zigzag_orbs',
    length: 38, minLevel: 1, weight: 9,
    orbs: [
      { dx: -3.0, dz: 8, valueMode: 'expected', tierDelta: 0 },
      { dx: 3.0, dz: 18, valueMode: 'expected', tierDelta: 0 },
      { dx: -2.4, dz: 28, valueMode: 'expected', tierDelta: 0 },
    ],
    hazards: [
      { type: 'thorn', dz: 13, depth: 1.0, x0: 1.5, x1: 4.5 },
      { type: 'thorn', dz: 23, depth: 1.0, x0: -4.5, x1: -1.5 },
    ],
  },
  {
    id: 'merge_ladder',
    length: 34, minLevel: 1, weight: 6,
    orbs: [
      { dx: -2.5, dz: 8, valueMode: 'fixed', value: 2 },
      { dx: 2.8, dz: 18, valueMode: 'fixed', value: 2 },
      { dx: -2.2, dz: 28, valueMode: 'fixed', value: 4 },
    ],
    hazards: [],
  },
  {
    id: 's_curve_orbs',
    length: 40, minLevel: 2, weight: 7,
    orbs: [
      { dx: -3.0, dz: 8, valueMode: 'expected', tierDelta: 0 },
      { dx: 0.5, dz: 18, valueMode: 'expected', tierDelta: 0 },
      { dx: 3.0, dz: 28, valueMode: 'expected', tierDelta: 0 },
    ],
    hazards: [
      { type: 'thorn', dz: 13, depth: 1.0, x0: 1.8, x1: 4.5 },
      { type: 'thorn', dz: 24, depth: 1.0, x0: -4.5, x1: -1.8 },
    ],
  },
  {
    id: 'gap_left_bridge',
    length: 36, minLevel: 2, weight: 6,
    trackHalf: 5,
    orbs: [
      { dx: 2.4, dz: 16, valueMode: 'expected', tierDelta: 0 },
    ],
    hazards: [
      { type: 'pit', dz: 10, length: 7, x0: -5, x1: -0.3 },
    ],
  },
  {
    id: 'gap_right_bridge',
    length: 36, minLevel: 2, weight: 6,
    trackHalf: 5,
    orbs: [
      { dx: -2.4, dz: 16, valueMode: 'expected', tierDelta: 0 },
    ],
    hazards: [
      { type: 'pit', dz: 10, length: 7, x0: 0.3, x1: 5 },
    ],
  },
  {
    id: 'narrow_bridge',
    length: 30, minLevel: 3, weight: 6,
    trackHalf: 2.9,
    orbs: [
      { dx: 0.4, dz: 14, valueMode: 'expected', tierDelta: 0 },
    ],
    hazards: [],
  },
  {
    id: 'gap_center',
    length: 34, minLevel: 3, weight: 5,
    orbs: [
      { dx: -3.0, dz: 14, valueMode: 'expected', tierDelta: 0 },
      { dx: 3.0, dz: 24, valueMode: 'expected', tierDelta: 0 },
    ],
    hazards: [
      { type: 'pit', dz: 10, length: 6, x0: -1.5, x1: 1.5 },
    ],
  },
  {
    id: 'glass_walls_visual',
    length: 32, minLevel: 3, weight: 4,
    orbs: [
      { dx: -2.8, dz: 12, valueMode: 'expected', tierDelta: 0 },
      { dx: 2.8, dz: 22, valueMode: 'expected', tierDelta: 0 },
    ],
    hazards: [
      { type: 'thorn', dz: 16, depth: 1.0, x0: -1.2, x1: 1.2 },
    ],
  },
  {
    id: 'speed_lane',
    length: 40, minLevel: 4, weight: 4,
    orbs: [
      { dx: -3.0, dz: 10, valueMode: 'expected', tierDelta: 0 },
      { dx: 3.0, dz: 22, valueMode: 'expected', tierDelta: 0 },
      { dx: -2.0, dz: 34, valueMode: 'expected', tierDelta: 0 },
    ],
    hazards: [
      { type: 'thorn', dz: 16, depth: 1.0, x0: 1.2, x1: 4.5 },
      { type: 'thorn', dz: 28, depth: 1.0, x0: -4.5, x1: -1.2 },
    ],
  },
  {
    id: 'double_thorn_stagger',
    length: 36, minLevel: 2, weight: 7,
    orbs: [
      { dx: 2.5, dz: 10, valueMode: 'expected', tierDelta: 0 },
      { dx: -2.5, dz: 26, valueMode: 'expected', tierDelta: 0 },
    ],
    hazards: [
      { type: 'thorn', dz: 8, depth: 1.0, x0: -4.5, x1: -1.2 },
      { type: 'thorn', dz: 20, depth: 1.0, x0: 1.2, x1: 4.5 },
    ],
  },
  {
    id: 'dense_mix',
    length: 38, minLevel: 4, weight: 5,
    orbs: [
      { dx: -3.0, dz: 8, valueMode: 'expected', tierDelta: 0 },
      { dx: 2.8, dz: 16, valueMode: 'expected', tierDelta: 0 },
      { dx: -2.2, dz: 26, valueMode: 'expected', tierDelta: 0 },
    ],
    hazards: [
      { type: 'pit', dz: 12, length: 5, x0: 0.6, x1: 5 },
      { type: 'thorn', dz: 22, depth: 1.0, x0: -4.5, x1: -1.4 },
    ],
  },
  {
    id: 'thorn_gauntlet',
    length: 40, minLevel: 3, weight: 6,
    orbs: [
      { dx: 0.0, dz: 10, valueMode: 'expected', tierDelta: 0 },
      { dx: -2.8, dz: 22, valueMode: 'expected', tierDelta: 0 },
      { dx: 2.8, dz: 32, valueMode: 'expected', tierDelta: 0 },
    ],
    hazards: [
      { type: 'thorn', dz: 14, depth: 1.0, x0: 1.4, x1: 4.5 },
      { type: 'thorn', dz: 24, depth: 1.0, x0: -4.5, x1: -1.4 },
      { type: 'thorn', dz: 30, depth: 0.9, x0: -1.0, x1: 1.0 },
    ],
  },
  {
    id: 'finale_high_tease',
    length: 34, minLevel: 4, weight: 4,
    orbs: [
      { dx: -2.6, dz: 10, valueMode: 'expected', tierDelta: 0 },
      { dx: 2.8, dz: 22, valueMode: 'expected', tierDelta: 0 },
    ],
    hazards: [
      { type: 'pit', dz: 14, length: 5, x0: -5, x1: -0.8 },
    ],
  },
];

const TEMPLATES_BY_ID = {};
for (let i = 0; i < TEMPLATES.length; i++) {
  TEMPLATES_BY_ID[TEMPLATES[i].id] = TEMPLATES[i];
}

// ---- Instantiate / pack -----------------------------------------------------

function makeOrb(id, x, z, value) {
  return {
    id: id,
    x: x,
    z: z,
    value: value,
    radius: radiusForValue(value),
    consumed: false,
    ghostUntil: 0,
    vx: 0,
    vz: 0,
    vy: 0,
    y: null,
    rollAngle: 0,
    rolling: false,
    falling: false,
    visible: true,
  };
}

function instantiateTemplate(t, z0, L, rng) {
  const finishZ = finishZForLevel(L);
  const orbs = t.orbs.map(function (o, i) {
    let value;
    if (o.valueMode === 'fixed') {
      value = o.value;
    } else {
      const u = (z0 + o.dz) / finishZ;
      value = pickOrbValue(L, u, rng, o.tierDelta || 0);
    }
    return makeOrb('o_' + z0 + '_' + i, o.dx, z0 + o.dz, value);
  });
  const hazards = t.hazards.map(function (h, i) {
    if (h.type === 'thorn') {
      return {
        id: 'h_' + z0 + '_' + i,
        type: 'thorn',
        x0: h.x0, x1: h.x1,
        z: z0 + h.dz,
        depth: h.depth != null ? h.depth : THORN_DEPTH,
        consumed: false,
      };
    }
    return {
      id: 'h_' + z0 + '_' + i,
      type: 'pit',
      x0: h.x0, x1: h.x1,
      z0: z0 + h.dz,
      z1: z0 + h.dz + (h.length != null ? h.length : 5),
    };
  });
  return {
    length: t.length,
    trackHalf: t.trackHalf != null ? t.trackHalf : TRACK_HALF,
    orbs: orbs,
    hazards: hazards,
    id: t.id,
    z0: z0,
  };
}

function overlapsTooClose(inst, orbs, hazards, minSep) {
  minSep = minSep == null ? 3.5 : minSep;
  for (let i = 0; i < inst.orbs.length; i++) {
    const o = inst.orbs[i];
    for (let j = 0; j < orbs.length; j++) {
      const e = orbs[j];
      if (Math.abs(o.z - e.z) < minSep && Math.abs(o.x - e.x) < 1.4) return true;
    }
  }
  for (let i = 0; i < inst.hazards.length; i++) {
    const h = inst.hazards[i];
    const hz = h.type === 'pit' ? (h.z0 + h.z1) / 2 : h.z;
    for (let j = 0; j < hazards.length; j++) {
      const e = hazards[j];
      const ez = e.type === 'pit' ? (e.z0 + e.z1) / 2 : e.z;
      if (Math.abs(hz - ez) < minSep) return true;
    }
    if (h.type === 'pit') {
      const ledge = (h.x0 - (-TRACK_HALF)) + (TRACK_HALF - h.x1);
      if (ledge < 2.5) return true;
    }
  }
  return false;
}

function sanitizeForLevel(L, orbs, hazards) {
  for (let i = hazards.length - 1; i >= 0; i--) {
    const h = hazards[i];
    // L1: thorns ok after intro, no pits yet
    if (L <= 1 && h.type === 'pit') { hazards.splice(i, 1); continue; }
    if (L <= 1 && h.type === 'thorn' && h.z < 28) { hazards.splice(i, 1); continue; }
    // L2: pits only after mid
    if (L === 2 && h.type === 'pit' && h.z0 < 55) { hazards.splice(i, 1); continue; }
  }

  const maxThorns = MAX_THORNS_BY_LEVEL[L] != null
    ? MAX_THORNS_BY_LEVEL[L]
    : MAX_THORNS_BY_LEVEL[MAX_THORNS_BY_LEVEL.length - 1];
  const thornIdx = [];
  for (let i = 0; i < hazards.length; i++) {
    if (hazards[i].type === 'thorn') thornIdx.push(i);
  }
  if (thornIdx.length > maxThorns) {
    thornIdx.sort(function (a, b) { return hazards[a].z - hazards[b].z; });
    const drop = thornIdx.slice(maxThorns).sort(function (a, b) { return b - a; });
    for (let i = 0; i < drop.length; i++) hazards.splice(drop[i], 1);
  }
}

/**
 * Demote any orb whose value is more than 1 tier above the curve at its z.
 */
function clampOrbValuesToCurve(L, orbs, finishZ) {
  for (let i = 0; i < orbs.length; i++) {
    const o = orbs[i];
    const cap = maxValueAt(L, o.z, finishZ);
    if (o.value > cap) {
      const u = clamp(o.z / Math.max(1, finishZ), 0, 1);
      o.value = expectedValue(L, u);
      o.radius = radiusForValue(o.value);
    }
  }
}

/**
 * Ball Run layout: modest packs full-width — NOT a carpet of 100 balls.
 * Reference screenshot: ~15–25 visible ahead, scattered L/R with gaps.
 * Target L1 ≈ 35–50 total orbs.
 */
function injectMergeLadder(L, orbs, finishZ, rng) {
  const endTier = endTierForLevel(L);
  let injectId = 0;

  const climbEnd = finishZ - FINISH_PAD - 4;
  const climbStart = 12;
  const LANES = [-3.2, -2.0, -0.8, 0.8, 2.0, 3.2];

  function tooClose(x, z, minZ, minX) {
    minZ = minZ == null ? 2.8 : minZ;
    minX = minX == null ? 1.0 : minX;
    for (let i = 0; i < orbs.length; i++) {
      if (Math.abs(orbs[i].z - z) < minZ && Math.abs(orbs[i].x - x) < minX) return true;
    }
    return false;
  }

  function place(x, z, value) {
    x = clamp(x, -3.5, 3.5);
    z = clamp(z, climbStart, climbEnd);
    if (tooClose(x, z, 2.6, 0.95)) {
      x = clamp(x + (rng() < 0.5 ? 1.1 : -1.1), -3.5, 3.5);
      if (tooClose(x, z, 2.4, 0.9)) return false;
    }
    orbs.push(makeOrb('o_field_' + (injectId++), x, z, value));
    return true;
  }

  function pickLanes(n) {
    const pool = LANES.slice();
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp;
    }
    return pool.slice(0, Math.min(n, pool.length));
  }

  // Packs every ~14–20 units: 2–3 balls (readable field, not a carpet)
  let z = climbStart;
  while (z < climbEnd - 6) {
    const u = clamp((z - climbStart) / Math.max(1, climbEnd - climbStart), 0, 1);
    const expTier = tierForValue(expectedValue(L, u));
    const clusterN = 2 + (rng() < 0.45 ? 1 : 0); // 2–3
    const lanes = pickLanes(clusterN);

    for (let i = 0; i < clusterN; i++) {
      let tier;
      const roll = rng();
      if (i === 0) tier = expTier;
      else if (roll < 0.4) tier = Math.max(0, expTier - 1);
      else if (roll < 0.65) tier = Math.min(endTier, expTier + 1);
      else tier = expTier;

      const oz = z + (rng() - 0.5) * 2.0;
      const ox = lanes[i] + (rng() - 0.5) * 0.3;
      place(ox, oz, valueForTier(tier));
    }

    z += 14 + rng() * 6;
  }

  // Climb guarantee — few copies, spread wide
  const span = climbEnd - climbStart;
  for (let tier = 0; tier <= endTier; tier++) {
    const value = valueForTier(tier);
    const u0 = tier / (endTier + 1.1);
    const u1 = (tier + 0.85) / (endTier + 1.1);
    const z0 = climbStart + u0 * span;
    const z1 = climbStart + u1 * span;
    const copies = tier <= 1 ? 2 : 1;
    for (let c = 0; c < copies; c++) {
      const t = (c + 0.4) / Math.max(1, copies);
      const zz = lerp(z0, z1, t);
      const laneIdx = (tier * 2 + c * 3) % LANES.length;
      place(LANES[laneIdx], zz, value);
    }
  }
}

/**
 * A few early 2s so the run always starts cleanly.
 */
function ensureEarlyMerges(L, orbs) {
  function countEarlyTwos() {
    let n = 0;
    for (let i = 0; i < orbs.length; i++) {
      if (orbs[i].value === 2 && orbs[i].z < 45) n++;
    }
    return n;
  }
  const need = 3;
  const slots = [
    { x: -2.4, z: 12 },
    { x: 2.5, z: 20 },
    { x: -1.6, z: 30 },
    { x: 2.0, z: 40 },
  ];
  for (let s = 0; s < slots.length && countEarlyTwos() < need; s++) {
    const slot = slots[s];
    let blocked = false;
    for (let i = 0; i < orbs.length; i++) {
      if (Math.abs(orbs[i].z - slot.z) < 2.2 && Math.abs(orbs[i].x - slot.x) < 1.0) {
        blocked = true;
        break;
      }
    }
    if (blocked) continue;
    orbs.push(makeOrb('o_early_' + s, slot.x, slot.z, 2));
  }
}

/**
 * Spike strips — dual sides with center open, between packs (not every meter).
 */
function injectObstacleCourse(L, hazards, finishZ, rng) {
  const start = 28;
  const end = finishZ - FINISH_PAD - 8;
  if (end <= start + 10) return;

  let z = start + rng() * 6;
  let hid = 0;
  const spacing = L <= 2 ? 22 : (L <= 5 ? 18 : 15);

  while (z < end) {
    const pattern = rng();

    if (pattern < 0.45) {
      // Dual side spikes (center open) — classic Ball Run look
      hazards.push({
        id: 'obs_t_' + (hid++),
        type: 'thorn',
        x0: -4.5, x1: -1.5,
        z: z, depth: 1.0, consumed: false,
      });
      hazards.push({
        id: 'obs_t_' + (hid++),
        type: 'thorn',
        x0: 1.5, x1: 4.5,
        z: z, depth: 1.0, consumed: false,
      });
    } else if (pattern < 0.7) {
      // One side only
      const left = rng() < 0.5;
      hazards.push({
        id: 'obs_t_' + (hid++),
        type: 'thorn',
        x0: left ? -4.5 : 0.9,
        x1: left ? -0.9 : 4.5,
        z: z, depth: 1.05, consumed: false,
      });
    } else if (pattern < 0.88) {
      // Staggered pair at two z depths
      hazards.push({
        id: 'obs_t_' + (hid++),
        type: 'thorn',
        x0: -4.5, x1: -1.3,
        z: z, depth: 1.0, consumed: false,
      });
      hazards.push({
        id: 'obs_t_' + (hid++),
        type: 'thorn',
        x0: 1.3, x1: 4.5,
        z: z + 5, depth: 1.0, consumed: false,
      });
    } else {
      // Thin center spikes — dodge left or right
      hazards.push({
        id: 'obs_t_' + (hid++),
        type: 'thorn',
        x0: -1.15, x1: 1.15,
        z: z, depth: 0.95, consumed: false,
      });
    }

    // Pits start L2, more common later
    if (L >= 2 && rng() < (L <= 3 ? 0.28 : 0.42)) {
      const pitZ = z + 3 + rng() * 3;
      if (pitZ < end) {
        const left = rng() < 0.5;
        hazards.push({
          id: 'obs_p_' + (hid++),
          type: 'pit',
          x0: left ? -5 : 0.45,
          x1: left ? -0.45 : 5,
          z0: pitZ,
          z1: pitZ + 4.5 + rng() * 2.5,
        });
      }
    }

    z += spacing + rng() * 5;
  }
}

/**
 * Post-finish bonus walls (Crowd Clash Runner style).
 * Smash through if ball value ≥ need → raise coin multiplier.
 * Stop when you hit a wall too big for you (or clear all of them).
 */
function buildBonusWalls(L, finishZ) {
  const endTier = endTierForLevel(L);
  // First wall is a few tiers below the level's end value; last ≈ end value
  const startTier = Math.max(2, endTier - (BONUS_WALL_MULTS.length - 1));
  const walls = [];
  for (let i = 0; i < BONUS_WALL_MULTS.length; i++) {
    const tier = Math.min(10, startTier + i);
    walls.push({
      id: 'bw_' + i,
      z: finishZ + BONUS_WALL_START + i * BONUS_WALL_SPACING,
      need: valueForTier(tier),
      mult: BONUS_WALL_MULTS[i],
      broken: false,
    });
  }
  return walls;
}

function buildTrackKeyframes(segmentsUsed) {
  if (!segmentsUsed.length) {
    return [{ z0: 0, z1: Infinity, trackHalf: TRACK_HALF }];
  }
  const keys = [];
  let cursor = 0;
  const sorted = segmentsUsed.slice().sort(function (a, b) { return a.z0 - b.z0; });
  for (let i = 0; i < sorted.length; i++) {
    const s = sorted[i];
    if (cursor < s.z0) {
      keys.push({ z0: cursor, z1: s.z0, trackHalf: TRACK_HALF });
    }
    keys.push({
      z0: s.z0,
      z1: s.z0 + s.length,
      trackHalf: s.trackHalf != null ? s.trackHalf : TRACK_HALF,
    });
    cursor = s.z0 + s.length;
  }
  keys.push({ z0: cursor, z1: Infinity, trackHalf: TRACK_HALF });
  return keys;
}

function trackHalfAt(z, keys) {
  if (!keys || !keys.length) return TRACK_HALF;
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    if (z >= k.z0 && z < k.z1) return k.trackHalf;
  }
  return TRACK_HALF;
}

function appendInst(inst, orbs, hazards, segmentsUsed) {
  for (let i = 0; i < inst.orbs.length; i++) orbs.push(inst.orbs[i]);
  for (let i = 0; i < inst.hazards.length; i++) hazards.push(inst.hazards[i]);
  segmentsUsed.push({
    id: inst.id,
    z0: inst.z0,
    length: inst.length,
    trackHalf: inst.trackHalf,
  });
}

function buildLevel(L, seed) {
  const rng = mulberry32(seed);
  const finishZ = finishZForLevel(L);
  const orbs = [];
  const hazards = [];
  const segmentsUsed = [];

  // Light template seasoning for track-width changes / set pieces,
  // but the MAIN density comes from injectMergeLadder (Ball Run field).
  let z = 40;
  const packEnd = finishZ - FINISH_PAD - 20;
  let stallGuard = 0;
  let placed = 0;
  while (z < packEnd && placed < 6) {
    const remaining = packEnd - z;
    const eligible = TEMPLATES.filter(function (t) {
      if (t.id === 'merge_lane_intro' || t.id === 'safe_breather' || t.id === 'wide_safe') {
        return false;
      }
      // Prefer hazard / shape templates — orbs come from the field injector
      return t.minLevel <= L && t.length <= remaining && t.hazards && t.hazards.length > 0;
    });
    if (eligible.length === 0) break;

    const t = weightedPick(eligible, rng);
    // Instantiate but strip template orbs — field injector owns density/layout
    const inst = instantiateTemplate(t, z, L, rng);
    inst.orbs = [];
    if (overlapsTooClose(inst, orbs, hazards, 2.5)) {
      z += 5;
      stallGuard++;
      if (stallGuard > 30) break;
      continue;
    }
    stallGuard = 0;
    appendInst(inst, orbs, hazards, segmentsUsed);
    z += t.length + lerp(8, 16, rng());
    placed++;
  }

  // Primary content: dense full-width Ball Run field + spikes + climb guarantee
  injectMergeLadder(L, orbs, finishZ, rng);
  injectObstacleCourse(L, hazards, finishZ, rng);
  clampOrbValuesToCurve(L, orbs, finishZ);
  ensureEarlyMerges(L, orbs);
  sanitizeForLevel(L, orbs, hazards);

  const bonusWalls = buildBonusWalls(L, finishZ);
  const bonusEndZ = bonusEndZForLevel(finishZ);

  orbs.sort(function (a, b) { return a.z - b.z || a.x - b.x; });

  return {
    level: L,
    seed: seed,
    finishZ: finishZ,
    bonusWalls: bonusWalls,
    bonusEndZ: bonusEndZ,
    trackHalfDefault: TRACK_HALF,
    trackKeys: buildTrackKeyframes(segmentsUsed),
    orbs: orbs,
    hazards: hazards,
    segmentsUsed: segmentsUsed,
  };
}

function pitsOf(levelData) {
  const out = [];
  for (let i = 0; i < levelData.hazards.length; i++) {
    if (levelData.hazards[i].type === 'pit') out.push(levelData.hazards[i]);
  }
  return out;
}
