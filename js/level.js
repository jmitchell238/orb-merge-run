'use strict';

// ---- Expected-value curve ---------------------------------------------------
// Designed so the player can climb 2→4→8… with *many* same-value pairs.
// High teases (you're a 4, track is full of 16s) were the main fun-killer.

/** Soft end-tier for level L (0-based: 0=2, 1=4, …). Kept modest so climb is real. */
function endTierForLevel(L) {
  // L1→2 (value 8), L4→3 (16), L8→5 (64), L12→7 (256)
  return Math.min(8, 1 + Math.floor(L * 0.5));
}

/**
 * Expected player value at normalized progress u∈[0,1].
 * Grows in steps with long plateaus so there is time to find matches.
 */
function expectedValue(L, u) {
  const endTier = endTierForLevel(L);
  const startTier = 0;
  // Stay low longer: ease-in curve (u^1.35) so first third is mostly 2s/4s
  const eased = Math.pow(smoothstep(u), 1.35);
  const t = startTier + (endTier - startTier) * eased;
  return valueForTier(Math.round(t));
}

/**
 * Pick a spawn value around the expected tier.
 * Heavy weight on exact match and one-below (building blocks).
 * Almost never more than +1 above expected — no unreachable 16s when you're a 4.
 */
function pickOrbValue(L, u, rng, tierDelta) {
  const expTier = tierForValue(expectedValue(L, u));
  // Template tierDelta is soft-clamped: max +1 above expected
  const deltaReq = clamp(tierDelta || 0, -2, 1);
  const roll = rng();
  let d;
  if (roll < 0.48) d = 0;         // same as expected — merge now
  else if (roll < 0.78) d = -1;    // one below — still useful earlier / after demote
  else if (roll < 0.92) d = 1;     // one above — next goal, not a wall
  else d = -2;                     // two below — easy pickup
  const tier = clamp(expTier + d + deltaReq, 0, endTierForLevel(L) + 1);
  return valueForTier(Math.max(0, tier));
}

/** Hard cap: orb value may not exceed expected(+1) at its z. */
function maxValueAt(L, z, finishZ) {
  const u = clamp(z / Math.max(1, finishZ), 0, 1);
  const expTier = tierForValue(expectedValue(L, u));
  return valueForTier(Math.min(10, expTier + 1));
}

// ---- Templates (exactly 20) -------------------------------------------------

const TEMPLATES = [
  {
    id: 'merge_lane_intro',
    length: 28, minLevel: 1, weight: 10,
    orbs: [
      { dx: 0, dz: 8, valueMode: 'fixed', value: 2 },
      { dx: 0.3, dz: 16, valueMode: 'fixed', value: 2 },
      { dx: -0.2, dz: 22, valueMode: 'fixed', value: 2 },
    ],
    hazards: [],
  },
  {
    id: 'straight_orbs',
    length: 32, minLevel: 1, weight: 10,
    orbs: [
      // denser, mostly on-curve (no +2 teases)
      { dx: -1.2, dz: 6, valueMode: 'expected', tierDelta: 0 },
      { dx: 1.0, dz: 10, valueMode: 'expected', tierDelta: 0 },
      { dx: 0.0, dz: 14, valueMode: 'expected', tierDelta: -1 },
      { dx: -0.8, dz: 18, valueMode: 'expected', tierDelta: 0 },
      { dx: 1.2, dz: 22, valueMode: 'expected', tierDelta: 0 },
      { dx: 0.3, dz: 27, valueMode: 'expected', tierDelta: 0 },
    ],
    hazards: [],
  },
  {
    id: 'safe_breather',
    length: 24, minLevel: 1, weight: 7,
    orbs: [
      { dx: 0.4, dz: 8, valueMode: 'expected', tierDelta: 0 },
      { dx: -0.6, dz: 14, valueMode: 'expected', tierDelta: 0 },
      { dx: 0.2, dz: 20, valueMode: 'expected', tierDelta: -1 },
    ],
    hazards: [],
  },
  {
    id: 'wide_safe',
    length: 20, minLevel: 1, weight: 6,
    orbs: [
      { dx: 0, dz: 8, valueMode: 'expected', tierDelta: 0 },
      { dx: 0.5, dz: 15, valueMode: 'expected', tierDelta: 0 },
    ],
    hazards: [],
  },
  {
    id: 'thorn_strip_right',
    length: 30, minLevel: 2, weight: 5,
    orbs: [
      { dx: -2.0, dz: 10, valueMode: 'expected', tierDelta: 0 },
      { dx: -1.5, dz: 20, valueMode: 'expected', tierDelta: 0 },
    ],
    hazards: [
      { type: 'thorn', dz: 14, depth: 1.2, x0: 0.5, x1: 4.5 },
    ],
  },
  {
    id: 'thorn_strip_left',
    length: 30, minLevel: 2, weight: 5,
    orbs: [
      { dx: 2.0, dz: 10, valueMode: 'expected', tierDelta: 0 },
      { dx: 1.5, dz: 20, valueMode: 'expected', tierDelta: 0 },
    ],
    hazards: [
      { type: 'thorn', dz: 14, depth: 1.2, x0: -4.5, x1: -0.5 },
    ],
  },
  {
    id: 'offset_pair',
    length: 28, minLevel: 2, weight: 4,
    orbs: [
      { dx: -2.0, dz: 12, valueMode: 'expected', tierDelta: 0 },
      { dx: 2.0, dz: 12, valueMode: 'expected', tierDelta: 0 },
      { dx: 0, dz: 22, valueMode: 'expected', tierDelta: 1 },
    ],
    hazards: [],
  },
  {
    id: 'zigzag_orbs',
    length: 32, minLevel: 3, weight: 5,
    orbs: [
      { dx: -2, dz: 6, valueMode: 'expected', tierDelta: 0 },
      { dx: 2, dz: 12, valueMode: 'expected', tierDelta: 0 },
      { dx: -2, dz: 18, valueMode: 'expected', tierDelta: 0 },
      { dx: 2, dz: 24, valueMode: 'expected', tierDelta: 1 },
    ],
    hazards: [],
  },
  {
    id: 'merge_ladder',
    length: 30, minLevel: 2, weight: 7,
    orbs: [
      { dx: 0, dz: 8, valueMode: 'fixed', value: 2 },
      { dx: 0.2, dz: 14, valueMode: 'fixed', value: 2 },
      { dx: 0, dz: 20, valueMode: 'fixed', value: 4 },
      { dx: -0.2, dz: 26, valueMode: 'fixed', value: 4 },
    ],
    hazards: [],
  },
  {
    id: 's_curve_orbs',
    length: 34, minLevel: 3, weight: 5,
    orbs: [
      { dx: -2, dz: 6, valueMode: 'expected', tierDelta: 0 },
      { dx: 0, dz: 12, valueMode: 'expected', tierDelta: 0 },
      { dx: 2, dz: 18, valueMode: 'expected', tierDelta: 0 },
      { dx: 0, dz: 24, valueMode: 'expected', tierDelta: 1 },
      { dx: -2, dz: 30, valueMode: 'expected', tierDelta: 0 },
    ],
    hazards: [],
  },
  {
    id: 'gap_left_bridge',
    length: 36, minLevel: 4, weight: 4,
    trackHalf: 5,
    orbs: [
      { dx: 1.5, dz: 12, valueMode: 'expected', tierDelta: 0 },
      { dx: 2.0, dz: 24, valueMode: 'expected', tierDelta: 1 },
    ],
    hazards: [
      { type: 'pit', dz: 10, length: 6, x0: -5, x1: -0.4 },
    ],
  },
  {
    id: 'gap_right_bridge',
    length: 36, minLevel: 4, weight: 4,
    trackHalf: 5,
    orbs: [
      { dx: -1.5, dz: 12, valueMode: 'expected', tierDelta: 0 },
      { dx: -2.0, dz: 24, valueMode: 'expected', tierDelta: 1 },
    ],
    hazards: [
      { type: 'pit', dz: 10, length: 6, x0: 0.4, x1: 5 },
    ],
  },
  {
    id: 'narrow_bridge',
    length: 28, minLevel: 5, weight: 4,
    trackHalf: 3.2,
    orbs: [
      { dx: 0, dz: 10, valueMode: 'expected', tierDelta: 0 },
      { dx: 0.3, dz: 18, valueMode: 'expected', tierDelta: 0 },
    ],
    hazards: [],
  },
  {
    id: 'gap_center',
    length: 32, minLevel: 5, weight: 3,
    orbs: [
      { dx: -2.8, dz: 14, valueMode: 'expected', tierDelta: 0 },
      { dx: 2.8, dz: 22, valueMode: 'expected', tierDelta: 0 },
    ],
    hazards: [
      { type: 'pit', dz: 10, length: 5, x0: -1.5, x1: 1.5 },
    ],
  },
  {
    id: 'glass_walls_visual',
    length: 30, minLevel: 6, weight: 3,
    orbs: [
      { dx: -1.0, dz: 10, valueMode: 'expected', tierDelta: 0 },
      { dx: 1.2, dz: 18, valueMode: 'expected', tierDelta: 1 },
      { dx: 0, dz: 24, valueMode: 'expected', tierDelta: 0 },
    ],
    hazards: [],
  },
  {
    id: 'speed_lane',
    length: 40, minLevel: 6, weight: 3,
    orbs: [
      { dx: -1.5, dz: 8, valueMode: 'expected', tierDelta: 0 },
      { dx: 1.5, dz: 16, valueMode: 'expected', tierDelta: 0 },
      { dx: 0, dz: 24, valueMode: 'expected', tierDelta: 1 },
      { dx: -2, dz: 32, valueMode: 'expected', tierDelta: 0 },
    ],
    hazards: [],
  },
  {
    id: 'double_thorn_stagger',
    length: 34, minLevel: 7, weight: 2,
    orbs: [
      { dx: 1.5, dz: 8, valueMode: 'expected', tierDelta: 0 },
      { dx: -1.5, dz: 18, valueMode: 'expected', tierDelta: 0 },
      { dx: 0, dz: 28, valueMode: 'expected', tierDelta: 1 },
    ],
    hazards: [
      // Narrower strips — more dodge room in the middle
      { type: 'thorn', dz: 10, depth: 1.0, x0: -4.5, x1: -1.2 },
      { type: 'thorn', dz: 20, depth: 1.0, x0: 1.2, x1: 4.5 },
    ],
  },
  {
    id: 'dense_mix',
    length: 34, minLevel: 8, weight: 4,
    orbs: [
      { dx: -2, dz: 5, valueMode: 'expected', tierDelta: 0 },
      { dx: 1, dz: 9, valueMode: 'expected', tierDelta: -1 },
      { dx: -1, dz: 13, valueMode: 'expected', tierDelta: 0 },
      { dx: 2, dz: 17, valueMode: 'expected', tierDelta: 1 },
      { dx: 0, dz: 21, valueMode: 'expected', tierDelta: 0 },
      { dx: -1.5, dz: 25, valueMode: 'expected', tierDelta: 1 },
      { dx: 1.5, dz: 29, valueMode: 'expected', tierDelta: 0 },
    ],
    hazards: [],
  },
  {
    id: 'thorn_gauntlet',
    length: 36, minLevel: 9, weight: 2,
    orbs: [
      { dx: 0, dz: 8, valueMode: 'expected', tierDelta: 0 },
      { dx: -2, dz: 18, valueMode: 'expected', tierDelta: 0 },
      { dx: 2, dz: 28, valueMode: 'expected', tierDelta: 1 },
    ],
    // Only two side strips — leave center lane open (was 3 including center)
    hazards: [
      { type: 'thorn', dz: 12, depth: 1.0, x0: 1.8, x1: 4.5 },
      { type: 'thorn', dz: 22, depth: 1.0, x0: -4.5, x1: -1.8 },
    ],
  },
  {
    id: 'finale_high_tease',
    length: 32, minLevel: 10, weight: 3,
    // +1 only (was +2 — unreachable teases)
    orbs: [
      { dx: 0, dz: 8, valueMode: 'expected', tierDelta: 0 },
      { dx: -1.2, dz: 14, valueMode: 'expected', tierDelta: 0 },
      { dx: 1.2, dz: 20, valueMode: 'expected', tierDelta: 1 },
      { dx: 0, dz: 26, valueMode: 'expected', tierDelta: 0 },
    ],
    hazards: [],
  },
];

const TEMPLATES_BY_ID = {};
for (let i = 0; i < TEMPLATES.length; i++) {
  TEMPLATES_BY_ID[TEMPLATES[i].id] = TEMPLATES[i];
}

// ---- Instantiate / pack -----------------------------------------------------

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
    return {
      id: 'o_' + z0 + '_' + i,
      x: o.dx,
      z: z0 + o.dz,
      value: value,
      radius: radiusForValue(value),
      consumed: false,
      ghostUntil: 0,
    };
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
  minSep = minSep == null ? 2.0 : minSep;
  for (let i = 0; i < inst.orbs.length; i++) {
    const o = inst.orbs[i];
    for (let j = 0; j < orbs.length; j++) {
      const e = orbs[j];
      if (Math.abs(o.z - e.z) < minSep && Math.abs(o.x - e.x) < 1.2) return true;
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
    if (L <= 1 && (h.type === 'thorn' || h.type === 'pit')) {
      hazards.splice(i, 1);
      continue;
    }
    if (L === 2 && h.type === 'pit') { hazards.splice(i, 1); continue; }
    if (L === 2 && h.type === 'thorn' && h.z < 40) { hazards.splice(i, 1); continue; }
    if (L === 3 && h.type === 'pit') { hazards.splice(i, 1); continue; }
  }

  // Cap thorns per level (keep earliest, drop extras)
  const maxThorns = MAX_THORNS_BY_LEVEL[L] != null
    ? MAX_THORNS_BY_LEVEL[L]
    : MAX_THORNS_BY_LEVEL[MAX_THORNS_BY_LEVEL.length - 1];
  const thornIdx = [];
  for (let i = 0; i < hazards.length; i++) {
    if (hazards[i].type === 'thorn') thornIdx.push(i);
  }
  if (thornIdx.length > maxThorns) {
    // sort by z ascending, keep first maxThorns
    thornIdx.sort(function (a, b) { return hazards[a].z - hazards[b].z; });
    const drop = thornIdx.slice(maxThorns).sort(function (a, b) { return b - a; });
    for (let i = 0; i < drop.length; i++) hazards.splice(drop[i], 1);
  }

  // Climb path: clamp teases, inject merge ladder, early 2s
  // finishZ needed for curve — caller passes via orbs' level context on buildLevel
}

/**
 * Demote any orb whose value is more than 1 tier above the curve at its z.
 * Fixes "I'm a 4 and the whole track is 16s."
 */
function clampOrbValuesToCurve(L, orbs, finishZ) {
  for (let i = 0; i < orbs.length; i++) {
    const o = orbs[i];
    const cap = maxValueAt(L, o.z, finishZ);
    if (o.value > cap) {
      // Drop to expected at this z (mergeable), not just the cap tease
      const u = clamp(o.z / Math.max(1, finishZ), 0, 1);
      o.value = expectedValue(L, u);
      o.radius = radiusForValue(o.value);
    }
  }
}

/**
 * Inject a real climb ladder: for each tier 2,4,8… place several center-lane
 * matches in the z-band where the player should be that size.
 * This is what makes "get myself to a 16" possible.
 */
function injectMergeLadder(L, orbs, finishZ, rng) {
  const endTier = endTierForLevel(L);
  let injectId = 0;

  function tooClose(x, z) {
    for (let i = 0; i < orbs.length; i++) {
      if (Math.abs(orbs[i].z - z) < 2.2 && Math.abs(orbs[i].x - x) < 1.1) return true;
    }
    return false;
  }

  function tryPlace(x, z, value) {
    if (z < 8 || z > finishZ - FINISH_PAD - 6) return false;
    if (tooClose(x, z)) {
      // nudge sideways
      x = clamp(x + (rng() < 0.5 ? 0.7 : -0.7), -2.5, 2.5);
      if (tooClose(x, z)) return false;
    }
    orbs.push({
      id: 'o_ladder_' + (injectId++),
      x: x,
      z: z,
      value: value,
      radius: radiusForValue(value),
      consumed: false,
      ghostUntil: 0,
    });
    return true;
  }

  for (let tier = 0; tier <= endTier; tier++) {
    const value = valueForTier(tier);
    // Band where player is expected to collect this value
    const u0 = tier / (endTier + 1.15);
    const u1 = (tier + 0.95) / (endTier + 1.15);
    const z0 = 10 + u0 * (finishZ - 30);
    const z1 = 10 + u1 * (finishZ - 30);
    // More pairs early (need several 2+2 and 4+4 to climb)
    const pairs = tier === 0 ? 5 : (tier === 1 ? 4 : (tier <= 3 ? 3 : 2));
    for (let p = 0; p < pairs; p++) {
      const t = (p + 0.5) / pairs;
      const z = lerp(z0, z1, t);
      // two matches near center — easy to hit
      tryPlace(0.15 * (p % 2 === 0 ? 1 : -1), z, value);
      tryPlace(0.9 * (p % 2 === 0 ? -1 : 1), z + 1.6, value);
    }
  }
}

/**
 * Inject fixed value-2 orbs near center early. Deterministic slots.
 */
function ensureEarlyMerges(L, orbs) {
  function countEarlyTwos() {
    let n = 0;
    for (let i = 0; i < orbs.length; i++) {
      const o = orbs[i];
      if (o.value === 2 && o.z < 60 && Math.abs(o.x) < 1.8) n++;
    }
    return n;
  }
  const need = L <= 6 ? 5 : 3;
  const slots = [
    { x: 0, z: 10 },
    { x: 0.3, z: 16 },
    { x: -0.25, z: 24 },
    { x: 0.15, z: 32 },
    { x: -0.1, z: 40 },
    { x: 0.4, z: 48 },
    { x: -0.35, z: 56 },
  ];
  for (let s = 0; s < slots.length && countEarlyTwos() < need; s++) {
    const slot = slots[s];
    let blocked = false;
    for (let i = 0; i < orbs.length; i++) {
      if (Math.abs(orbs[i].z - slot.z) < 2.0 && Math.abs(orbs[i].x - slot.x) < 1.0) {
        blocked = true;
        break;
      }
    }
    if (blocked) continue;
    orbs.push({
      id: 'o_early_' + s,
      x: slot.x,
      z: slot.z,
      value: 2,
      radius: radiusForValue(2),
      consumed: false,
      ghostUntil: 0,
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
  let z = 6;
  const segmentsUsed = [];

  if (L <= 2) {
    const intro = instantiateTemplate(TEMPLATES_BY_ID.merge_lane_intro, z, L, rng);
    appendInst(intro, orbs, hazards, segmentsUsed);
    z += intro.length + 4;
  }

  const packEnd = finishZ - FINISH_PAD - 10;
  let stallGuard = 0;
  while (z < packEnd) {
    const remaining = packEnd - z;
    const eligible = TEMPLATES.filter(function (t) {
      return t.minLevel <= L && t.length <= remaining;
    });
    if (eligible.length === 0) break;

    const t = weightedPick(eligible, rng);
    const inst = instantiateTemplate(t, z, L, rng);
    if (overlapsTooClose(inst, orbs, hazards, 2.0)) {
      z += 3;
      stallGuard++;
      if (stallGuard > 40) break;
      continue;
    }
    stallGuard = 0;
    appendInst(inst, orbs, hazards, segmentsUsed);
    z += t.length + lerp(2, 5, rng());
  }

  sanitizeForLevel(L, orbs, hazards);

  // Growth path (order matters):
  // 1) inject ladder pairs along the track
  // 2) clamp any leftover teases down to the curve
  // 3) top up early 2s if still thin
  injectMergeLadder(L, orbs, finishZ, rng);
  clampOrbValuesToCurve(L, orbs, finishZ);
  ensureEarlyMerges(L, orbs);
  // Sort for stable draw / tests
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
    if (levelData.hazards[i].type === 'pit') out.push(levelData.hazards[i]);
  }
  return out;
}
