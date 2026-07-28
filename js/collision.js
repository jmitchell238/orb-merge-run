'use strict';

/**
 * Distance from point C to segment AB.
 * Returns { dist2, t } where t in [0,1] is param along AB.
 */
function dist2PointSegment(cx, cz, ax, az, bx, bz) {
  const abx = bx - ax, abz = bz - az;
  const acx = cx - ax, acz = cz - az;
  const ab2 = abx * abx + abz * abz;
  let t = ab2 < 1e-12 ? 0 : (acx * abx + acz * abz) / ab2;
  t = Math.max(0, Math.min(1, t));
  const px = ax + abx * t, pz = az + abz * t;
  const dx = cx - px, dz = cz - pz;
  return { dist2: dx * dx + dz * dz, t, px, pz };
}

/**
 * Swept player circle along (x,z0)→(x,z1) vs static orb circle.
 */
function sweptCircleHit(px, z0, z1, pHitR, ox, oz, oHitR) {
  const sumR = pHitR + oHitR;
  const { dist2, t } = dist2PointSegment(ox, oz, px, z0, px, z1);
  return dist2 <= sumR * sumR ? { hit: true, t, dist2 } : { hit: false, t, dist2 };
}

function circleHit(ax, az, ar, bx, bz, br) {
  const dx = ax - bx, dz = az - bz;
  const r = ar + br;
  return dx * dx + dz * dz <= r * r;
}

function isOffRail(x, trackHalf) {
  const H = trackHalf == null ? TRACK_HALF : trackHalf;
  return Math.abs(x) > H + FALL_MARGIN;
}

/**
 * Support rule: on rail and not over a pit or bonus-well opening.
 */
function hasSupport(x, z, trackHalf, pits) {
  if (isOffRail(x, trackHalf)) return false;
  if (!pits) return true;
  for (let i = 0; i < pits.length; i++) {
    const p = pits[i];
    if (z < p.z0 || z > p.z1) continue;
    if (x >= p.x0 && x <= p.x1) return false;
  }
  return true;
}

/** Find bonus well under (x,z), or null. */
function bonusWellAt(x, z, bonuses) {
  if (!bonuses) return null;
  for (let i = 0; i < bonuses.length; i++) {
    const b = bonuses[i];
    if (b.claimed) continue;
    if (z < b.z0 || z > b.z1) continue;
    if (x >= b.x0 && x <= b.x1) return b;
  }
  return null;
}

function stripHit(px, pz, pHitR, x0, x1, z0, depth) {
  const z1 = z0 + depth;
  const inZ = pz >= (z0 - pHitR) && pz <= (z1 + pHitR);
  const inX = px >= (x0 - pHitR) && px <= (x1 + pHitR);
  return inX && inZ;
}

function sweptStripHit(px, zA, zB, pHitR, thorn) {
  const lo = Math.min(zA, zB), hi = Math.max(zA, zB);
  const t0 = thorn.z - pHitR;
  const t1 = thorn.z + thorn.depth + pHitR;
  if (hi < t0 || lo > t1) return false;
  return px >= (thorn.x0 - pHitR) && px <= (thorn.x1 + pHitR);
}

/**
 * Knock a mismatched orb away with real velocity so it rolls and can fall off.
 * Deterministic when opts.tieDir is provided (no Math.random).
 */
function softNudge(player, orb, now, opts) {
  opts = opts || {};
  if (orb.ghostUntil > now) return false;
  if (orb.falling) return false;

  let dir = Math.sign(orb.x - player.x);
  if (dir === 0) {
    dir = opts.tieDir || Math.sign(player.targetX - player.x) || 1;
  }

  // Instant lateral shove + roll velocity
  const kick = (opts.speed != null ? opts.speed : KNOCK_SPEED);
  orb.x += dir * NUDGE_X;
  orb.vx = dir * kick;
  orb.vz = (opts.vz != null ? opts.vz : KNOCK_Z * 0.35 * dir);
  orb.ghostUntil = now + GHOST_S;
  orb.rolling = true;
  return true;
}

/**
 * Integrate a knocked orb for one frame. Returns 'fell' | 'ok' | 'still'.
 */
function stepOrbMotion(orb, dt, trackHalf, pits) {
  if (orb.consumed) return 'still';
  if (orb.falling) {
    orb.vy = (orb.vy || 0) - 14 * dt;
    orb.y = (orb.y != null ? orb.y : orb.radius) + orb.vy * dt;
    orb.x += (orb.vx || 0) * dt;
    orb.z += (orb.vz || 0) * dt;
    orb.rollAngle = (orb.rollAngle || 0) + Math.abs(orb.vx || 0) * ORB_ROLL_SCALE * dt;
    if (orb.y < -6) {
      orb.consumed = true;
      orb.visible = false;
      return 'fell';
    }
    return 'ok';
  }

  const vx = orb.vx || 0;
  const vz = orb.vz || 0;
  if (Math.abs(vx) < 0.05 && Math.abs(vz) < 0.05) {
    orb.vx = 0;
    orb.vz = 0;
    return 'still';
  }

  orb.x += vx * dt;
  orb.z += vz * dt;
  // Friction
  const damp = Math.exp(-ORB_FRICTION * dt);
  orb.vx = vx * damp;
  orb.vz = vz * damp;

  const speed = Math.sqrt(orb.vx * orb.vx + orb.vz * orb.vz);
  orb.rollAngle = (orb.rollAngle || 0) + speed * ORB_ROLL_SCALE * 2.2 * dt;
  orb.rollYaw = (orb.rollYaw || 0) + (orb.vx || 0) * 1.6 * dt;

  // Fall off edge or into pit
  if (!hasSupport(orb.x, orb.z, trackHalf, pits)) {
    orb.falling = true;
    orb.vy = 0.5;
    orb.y = orb.radius;
    return 'fell';
  }
  return 'ok';
}
