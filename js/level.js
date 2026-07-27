'use strict';

// ---- Expected-value curve ---------------------------------------------------

function expectedValue(L, u) {
  const endTier = Math.min(10, 2 + Math.floor(L * 0.55));
  const startTier = 0;
  const t = startTier + (endTier - startTier) * smoothstep(u);
  return valueForTier(Math.round(t));
}

function pickOrbValue(L, u, rng, tierDelta) {
  const expTier = tierForValue(expectedValue(L, u));
  const roll = rng();
  let d = 0;
  if (roll < 0.25) d = -1;
  else if (roll < 0.70) d = 0;
  else if (roll < 0.90) d = 1;
  else d = 2;
  return valueForTier(clamp(expTier + d + (tierDelta || 0), 0, 10));
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
    length: 32, minLevel: 1, weight: 8,
    orbs: [
      { dx: -1.5, dz: 8, valueMode: 'expected', tierDelta: 0 },
      { dx: 1.2, dz: 14, valueMode: 'expected', tierDelta: -1 },
      { dx: 0.0, dz: 20, valueMode: 'expected', tierDelta: 0 },
      { dx: 2.0, dz: 26, valueMode: 'expected', tierDelta: 1 },
    ],
    hazards: [],
  },
  {
    id: 'safe_breather',
    length: 24, minLevel: 1, weight: 6,
    orbs: [
      { dx: 0.5, dz: 10, valueMode: 'expected', tierDelta: -1 },
      { dx: -0.8, dz: 18, valueMode: 'expected', tierDelta: 0 },
    ],
    hazards: [],
  },
  {
    id: 'wide_safe',
    length: 20, minLevel: 1, weight: 5,
    orbs: [
      { dx: 0, dz: 12, valueMode: 'expected', tierDelta: 0 },
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
    orbs: [
      { dx: 0, dz: 8, valueMode: 'expected', tierDelta: 1 },
      { dx: -1.5, dz: 16, valueMode: 'expected', tierDelta: 2 },
      { dx: 1.5, dz: 24, valueMode: 'expected', tierDelta: 2 },
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

  // Guarantee a few center-lane value-2 orbs early so kids can always merge
  ensureEarlyMerges(L, orbs);
}

/**
 * Inject fixed value-2 orbs near center in z∈[10,55] if not enough exist.
 * Mutates orbs array. Deterministic slots (no Math.random).
 */
function ensureEarlyMerges(L, orbs) {
  function countEarlyTwos() {
    let n = 0;
    for (let i = 0; i < orbs.length; i++) {
      const o = orbs[i];
      if (o.value === 2 && o.z < 55 && Math.abs(o.x) < 1.5) n++;
    }
    return n;
  }
  const need = L <= 4 ? 3 : 2;
  const slots = [
    { x: 0, z: 12 },
    { x: 0.25, z: 22 },
    { x: -0.2, z: 34 },
    { x: 0.1, z: 46 },
  ];
  for (let s = 0; s < slots.length && countEarlyTwos() < need; s++) {
    const slot = slots[s];
    let blocked = false;
    for (let i = 0; i < orbs.length; i++) {
      if (Math.abs(orbs[i].z - slot.z) < 2.5 && Math.abs(orbs[i].x - slot.x) < 1.0) {
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
