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

// ---- Templates (exactly 20) — sparse: 1–3 orbs each, lots of open road -------

const TEMPLATES = [
  {
    id: 'merge_lane_intro',
    length: 30, minLevel: 1, weight: 10,
    orbs: [
      { dx: 0, dz: 10, valueMode: 'fixed', value: 2 },
      { dx: 0.25, dz: 20, valueMode: 'fixed', value: 2 },
    ],
    hazards: [],
  },
  {
    id: 'straight_orbs',
    length: 36, minLevel: 1, weight: 8,
    orbs: [
      { dx: -0.8, dz: 10, valueMode: 'expected', tierDelta: 0 },
      { dx: 0.9, dz: 22, valueMode: 'expected', tierDelta: 0 },
      { dx: 0.0, dz: 30, valueMode: 'expected', tierDelta: -1 },
    ],
    hazards: [],
  },
  {
    id: 'safe_breather',
    length: 28, minLevel: 1, weight: 9,
    orbs: [
      { dx: 0.3, dz: 14, valueMode: 'expected', tierDelta: 0 },
    ],
    hazards: [],
  },
  {
    id: 'wide_safe',
    length: 24, minLevel: 1, weight: 8,
    orbs: [
      { dx: 0, dz: 12, valueMode: 'expected', tierDelta: 0 },
    ],
    hazards: [],
  },
  {
    id: 'thorn_strip_right',
    length: 32, minLevel: 2, weight: 5,
    orbs: [
      { dx: -1.8, dz: 14, valueMode: 'expected', tierDelta: 0 },
    ],
    hazards: [
      { type: 'thorn', dz: 16, depth: 1.0, x0: 0.8, x1: 4.5 },
    ],
  },
  {
    id: 'thorn_strip_left',
    length: 32, minLevel: 2, weight: 5,
    orbs: [
      { dx: 1.8, dz: 14, valueMode: 'expected', tierDelta: 0 },
    ],
    hazards: [
      { type: 'thorn', dz: 16, depth: 1.0, x0: -4.5, x1: -0.8 },
    ],
  },
  {
    id: 'offset_pair',
    length: 30, minLevel: 2, weight: 5,
    orbs: [
      { dx: -1.8, dz: 12, valueMode: 'expected', tierDelta: 0 },
      { dx: 1.8, dz: 12, valueMode: 'expected', tierDelta: 0 },
    ],
    hazards: [],
  },
  {
    id: 'zigzag_orbs',
    length: 36, minLevel: 3, weight: 5,
    orbs: [
      { dx: -1.8, dz: 8, valueMode: 'expected', tierDelta: 0 },
      { dx: 1.8, dz: 20, valueMode: 'expected', tierDelta: 0 },
      { dx: 0, dz: 30, valueMode: 'expected', tierDelta: 0 },
    ],
    hazards: [],
  },
  {
    id: 'merge_ladder',
    length: 34, minLevel: 1, weight: 8,
    orbs: [
      { dx: 0, dz: 8, valueMode: 'fixed', value: 2 },
      { dx: 0.2, dz: 18, valueMode: 'fixed', value: 2 },
      { dx: 0, dz: 28, valueMode: 'fixed', value: 4 },
    ],
    hazards: [],
  },
  {
    id: 's_curve_orbs',
    length: 38, minLevel: 3, weight: 4,
    orbs: [
      { dx: -1.6, dz: 8, valueMode: 'expected', tierDelta: 0 },
      { dx: 1.6, dz: 20, valueMode: 'expected', tierDelta: 0 },
      { dx: 0, dz: 32, valueMode: 'expected', tierDelta: 0 },
    ],
    hazards: [],
  },
  {
    id: 'gap_left_bridge',
    length: 38, minLevel: 4, weight: 4,
    trackHalf: 5,
    orbs: [
      { dx: 1.6, dz: 16, valueMode: 'expected', tierDelta: 0 },
    ],
    hazards: [
      { type: 'pit', dz: 12, length: 6, x0: -5, x1: -0.5 },
    ],
  },
  {
    id: 'gap_right_bridge',
    length: 38, minLevel: 4, weight: 4,
    trackHalf: 5,
    orbs: [
      { dx: -1.6, dz: 16, valueMode: 'expected', tierDelta: 0 },
    ],
    hazards: [
      { type: 'pit', dz: 12, length: 6, x0: 0.5, x1: 5 },
    ],
  },
  {
    id: 'narrow_bridge',
    length: 30, minLevel: 5, weight: 4,
    trackHalf: 3.2,
    orbs: [
      { dx: 0, dz: 14, valueMode: 'expected', tierDelta: 0 },
    ],
    hazards: [],
  },
  {
    id: 'gap_center',
    length: 34, minLevel: 5, weight: 3,
    orbs: [
      { dx: -2.6, dz: 16, valueMode: 'expected', tierDelta: 0 },
      { dx: 2.6, dz: 24, valueMode: 'expected', tierDelta: 0 },
    ],
    hazards: [
      { type: 'pit', dz: 12, length: 5, x0: -1.4, x1: 1.4 },
    ],
  },
  {
    id: 'glass_walls_visual',
    length: 32, minLevel: 6, weight: 3,
    orbs: [
      { dx: 0, dz: 16, valueMode: 'expected', tierDelta: 0 },
    ],
    hazards: [],
  },
  {
    id: 'speed_lane',
    length: 42, minLevel: 6, weight: 3,
    orbs: [
      { dx: -1.2, dz: 12, valueMode: 'expected', tierDelta: 0 },
      { dx: 1.2, dz: 28, valueMode: 'expected', tierDelta: 0 },
    ],
    hazards: [],
  },
  {
    id: 'double_thorn_stagger',
    length: 36, minLevel: 7, weight: 2,
    orbs: [
      { dx: 0, dz: 10, valueMode: 'expected', tierDelta: 0 },
      { dx: 0, dz: 26, valueMode: 'expected', tierDelta: 0 },
    ],
    hazards: [
      { type: 'thorn', dz: 14, depth: 1.0, x0: -4.5, x1: -1.4 },
      { type: 'thorn', dz: 22, depth: 1.0, x0: 1.4, x1: 4.5 },
    ],
  },
  {
    id: 'dense_mix',
    // still sparse — name kept for template count / ids
    length: 36, minLevel: 8, weight: 3,
    orbs: [
      { dx: -1.2, dz: 8, valueMode: 'expected', tierDelta: 0 },
      { dx: 1.2, dz: 18, valueMode: 'expected', tierDelta: 0 },
      { dx: 0, dz: 28, valueMode: 'expected', tierDelta: 0 },
    ],
    hazards: [],
  },
  {
    id: 'thorn_gauntlet',
    length: 38, minLevel: 9, weight: 2,
    orbs: [
      { dx: 0, dz: 12, valueMode: 'expected', tierDelta: 0 },
      { dx: 0, dz: 28, valueMode: 'expected', tierDelta: 0 },
    ],
    hazards: [
      { type: 'thorn', dz: 16, depth: 1.0, x0: 1.6, x1: 4.5 },
      { type: 'thorn', dz: 24, depth: 1.0, x0: -4.5, x1: -1.6 },
    ],
  },
  {
    id: 'finale_high_tease',
    length: 34, minLevel: 8, weight: 3,
    orbs: [
      { dx: 0, dz: 10, valueMode: 'expected', tierDelta: 0 },
      { dx: 0.8, dz: 22, valueMode: 'expected', tierDelta: 0 },
    ],
    hazards: [],
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
    const hz = h.type === 'pit' || h.type === 'bonus'
      ? (h.z0 + h.z1) / 2
      : h.z;
    for (let j = 0; j < hazards.length; j++) {
      const e = hazards[j];
      const ez = e.type === 'pit' || e.type === 'bonus'
        ? (e.z0 + e.z1) / 2
        : e.z;
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
    if (h.type === 'bonus') continue;
    if (L <= 1 && (h.type === 'thorn' || h.type === 'pit')) {
      hazards.splice(i, 1);
      continue;
    }
    if (L === 2 && h.type === 'pit') { hazards.splice(i, 1); continue; }
    if (L === 2 && h.type === 'thorn' && h.z < 50) { hazards.splice(i, 1); continue; }
    if (L === 3 && h.type === 'pit') { hazards.splice(i, 1); continue; }
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
 * Progressive climb spine — Ball Run style.
 * For each tier place a *small* number of center-lane matches in sequence:
 *   a few 2s → a few 4s → a few 8s → …
 * This is the real path to 256/512, not a dense field of teases.
 * Every tier 0..endTier is guaranteed at least once.
 */
function injectMergeLadder(L, orbs, finishZ, rng) {
  const endTier = endTierForLevel(L);
  let injectId = 0;

  // Climb zone ends before the bonus wells
  const climbEnd = finishZ - FINISH_PAD - BONUS_ZONE_LEN - 4;
  const climbStart = 12;
  const span = Math.max(40, climbEnd - climbStart);

  function tooClose(x, z, minZ, minX) {
    minZ = minZ == null ? 2.6 : minZ;
    minX = minX == null ? 1.0 : minX;
    for (let i = 0; i < orbs.length; i++) {
      if (Math.abs(orbs[i].z - z) < minZ && Math.abs(orbs[i].x - x) < minX) return true;
    }
    return false;
  }

  function forcePlace(x, z, value) {
    // Try preferred spot, then nudge around until it fits
    const attempts = [
      [x, z],
      [x + 0.7, z],
      [x - 0.7, z],
      [0, z],
      [x, z + 1.5],
      [x, z - 1.5],
      [0.4, z + 2.2],
      [-0.4, z + 2.2],
    ];
    for (let a = 0; a < attempts.length; a++) {
      let px = clamp(attempts[a][0], -2.4, 2.4);
      let pz = clamp(attempts[a][1], climbStart, climbEnd);
      if (!tooClose(px, pz, 2.2, 0.9)) {
        orbs.push(makeOrb('o_ladder_' + (injectId++), px, pz, value));
        return true;
      }
    }
    // Last resort: place anyway slightly off center (may be tight)
    orbs.push(makeOrb('o_ladder_' + (injectId++), clamp(x, -2, 2), clamp(z, climbStart, climbEnd), value));
    return true;
  }

  for (let tier = 0; tier <= endTier; tier++) {
    const value = valueForTier(tier);
    // Band for this tier
    const u0 = tier / (endTier + 1.05);
    const u1 = (tier + 0.9) / (endTier + 1.05);
    const z0 = climbStart + u0 * span;
    const z1 = climbStart + u1 * span;

    // Sparse: early tiers a few matches; late tiers 1–2
    let count;
    if (tier <= 1) count = 3;
    else if (tier <= 4) count = 2;
    else count = 2; // always ≥2 so one miss doesn't soft-lock the climb

    for (let p = 0; p < count; p++) {
      const t = (p + 0.4) / Math.max(1, count);
      const z = lerp(z0, z1, t);
      const side = (p % 2 === 0 ? 1 : -1) * (0.2 + 0.25 * (p % 3));
      forcePlace(side, z, value);
    }
  }
}

/**
 * A few guaranteed early 2s near center — just enough to start the climb.
 */
function ensureEarlyMerges(L, orbs) {
  function countEarlyTwos() {
    let n = 0;
    for (let i = 0; i < orbs.length; i++) {
      const o = orbs[i];
      if (o.value === 2 && o.z < 55 && Math.abs(o.x) < 1.6) n++;
    }
    return n;
  }
  const need = 3;
  const slots = [
    { x: 0, z: 12 },
    { x: 0.25, z: 22 },
    { x: -0.2, z: 34 },
    { x: 0.15, z: 46 },
  ];
  for (let s = 0; s < slots.length && countEarlyTwos() < need; s++) {
    const slot = slots[s];
    let blocked = false;
    for (let i = 0; i < orbs.length; i++) {
      if (Math.abs(orbs[i].z - slot.z) < 2.5 && Math.abs(orbs[i].x - slot.x) < 1.1) {
        blocked = true;
        break;
      }
    }
    if (blocked) continue;
    orbs.push(makeOrb('o_early_' + s, slot.x, slot.z, 2));
  }
}

/**
 * End-of-run bonus wells — fall in with big enough value for coins + win.
 * Smaller balls that fall in die (hole too deep for them).
 * Solid track remains between wells so you can also finish normally.
 */
function injectBonusFinale(L, hazards, finishZ) {
  const endTier = endTierForLevel(L);
  // Wells from mid climb target up to end tier
  const minTier = Math.max(2, endTier - 4); // start at 8+
  const wellDefs = [];
  for (let t = minTier; t <= endTier; t++) {
    const value = valueForTier(t);
    // coins scale with target
    const coins = 12 + t * 18;
    wellDefs.push({ minValue: value, coins: coins });
  }
  // Cap wells to keep readable (max 5)
  while (wellDefs.length > 5) wellDefs.shift();

  const zoneStart = finishZ - FINISH_PAD - BONUS_ZONE_LEN;
  const wellDepth = 3.2;
  const gap = 0.55;
  const n = wellDefs.length;
  if (n === 0) return;

  // Lay wells as side-by-side lanes across the track (Ball Run style)
  // Leave thin solid strips between them so you can choose / skip.
  const usable = TRACK_W - 1.2; // keep outer ledges
  const laneW = usable / n;
  const xLeft = -TRACK_HALF + 0.6;

  for (let i = 0; i < n; i++) {
    const def = wellDefs[i];
    const x0 = xLeft + i * laneW + gap * 0.5;
    const x1 = xLeft + (i + 1) * laneW - gap * 0.5;
    const z0 = zoneStart + 4;
    const z1 = z0 + wellDepth;
    hazards.push({
      id: 'bonus_' + i,
      type: 'bonus',
      x0: x0,
      x1: x1,
      z0: z0,
      z1: z1,
      minValue: def.minValue,
      coins: def.coins,
      claimed: false,
    });
  }
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
  let z = 8;
  const segmentsUsed = [];

  // Pack templates only up to the pre-bonus zone — leave room for climb spine + wells
  const packEnd = finishZ - FINISH_PAD - BONUS_ZONE_LEN - 8;

  if (L <= 2) {
    const intro = instantiateTemplate(TEMPLATES_BY_ID.merge_lane_intro, z, L, rng);
    appendInst(intro, orbs, hazards, segmentsUsed);
    z += intro.length + 6;
  }

  let stallGuard = 0;
  while (z < packEnd) {
    const remaining = packEnd - z;
    const eligible = TEMPLATES.filter(function (t) {
      // Prefer breathers / sparse templates; skip dense_mix early
      if (t.id === 'merge_lane_intro') return false;
      return t.minLevel <= L && t.length <= remaining;
    });
    if (eligible.length === 0) break;

    const t = weightedPick(eligible, rng);
    const inst = instantiateTemplate(t, z, L, rng);
    if (overlapsTooClose(inst, orbs, hazards, 3.5)) {
      z += 4;
      stallGuard++;
      if (stallGuard > 40) break;
      continue;
    }
    stallGuard = 0;
    appendInst(inst, orbs, hazards, segmentsUsed);
    // Wider gaps between segments — open road feel
    z += t.length + lerp(5, 10, rng());
  }

  sanitizeForLevel(L, orbs, hazards);

  // Growth path:
  // 1) progressive ladder spine (authoritative climb)
  // 2) clamp teases
  // 3) early 2s top-up
  // 4) bonus wells at the end
  injectMergeLadder(L, orbs, finishZ, rng);
  clampOrbValuesToCurve(L, orbs, finishZ);
  ensureEarlyMerges(L, orbs);
  injectBonusFinale(L, hazards, finishZ);

  orbs.sort(function (a, b) { return a.z - b.z || a.x - b.x; });

  return {
    level: L,
    seed: seed,
    finishZ: finishZ,
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
    const h = levelData.hazards[i];
    // Bonus wells also remove support (you can fall in)
    if (h.type === 'pit' || h.type === 'bonus') out.push(h);
  }
  return out;
}

function bonusesOf(levelData) {
  const out = [];
  for (let i = 0; i < levelData.hazards.length; i++) {
    if (levelData.hazards[i].type === 'bonus') out.push(levelData.hazards[i]);
  }
  return out;
}
