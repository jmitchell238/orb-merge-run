'use strict';

// ---- Runtime state ----------------------------------------------------------
let state = 'menu'; // menu | play | pause | dead | win | over
let player = null;
let levelData = null;
let currentLevel = 1;
let mergeCount = 0;
let runTime = 0;
let deadTimer = 0;
let lastCoinsEarned = 0;
let lastBonusMult = 1;
let lastFinishValue = 2;
let overReason = '';
let showTutorial = false;
let celebration2048 = false;
let nowTime = 0;
let bonusMult = 1;
let crossedFinish = false;

function makePlayer() {
  return {
    x: 0,
    targetX: 0,
    z: 0,
    value: 2,
    radius: radiusForValue(2),
    invuln: 0,
    squash: 1,
    expandT: 0,
    rollAngle: 0,
    rollYaw: 0,
    mergeBoostT: 0,
    visible: true,
    falling: false,
    fallY: 0,
    vy: 0,
  };
}

function startLevel(L, seedOverride) {
  currentLevel = Math.max(1, L | 0);
  const seed = seedOverride != null ? (seedOverride | 0) : seedForLevel(currentLevel);
  levelData = buildLevel(currentLevel, seed);
  player = makePlayer();
  mergeCount = 0;
  runTime = 0;
  deadTimer = 0;
  lastCoinsEarned = 0;
  lastBonusMult = 1;
  lastFinishValue = 2;
  overReason = '';
  celebration2048 = false;
  bonusMult = 1;
  crossedFinish = false;
  clearParticles();
  cam.x = 0;
  cam.z = -CAM_Z_BACK;
  state = 'play';

  if (!save.seenTutorial) {
    showTutorial = true;
  }
}

function pauseGame() {
  if (state !== 'play') return;
  state = 'pause';
  if (typeof showPauseScreen === 'function') showPauseScreen();
}

function resumeGame() {
  if (state !== 'pause') return;
  state = 'play';
  if (typeof hidePauseScreen === 'function') hidePauseScreen();
}

function dismissTutorial() {
  showTutorial = false;
  save.seenTutorial = true;
  persist();
}

function beginDead(reason) {
  if (state !== 'play') return;
  state = 'dead';
  deadTimer = DEAD_ANIM_S;
  overReason = reason || 'You fell off the track!';
  if (player) {
    player.falling = true;
    player.vy = 0.8;
    player.fallY = player.radius;
  }
  sfxDeath();
  addShake(6, 0.35);
  recordDeath();
}

function deathReasonAt(x, z, trackHalf, pits) {
  if (isOffRail(x, trackHalf)) return 'You rolled off the edge!';
  if (pits && pits.length) {
    for (let i = 0; i < pits.length; i++) {
      const p = pits[i];
      if (z >= p.z0 && z <= p.z1 && x >= p.x0 && x <= p.x1) {
        return 'You fell into a gap!';
      }
    }
  }
  return 'You fell off the track!';
}

function completeLevel() {
  if (state !== 'play') return;
  lastFinishValue = player.value;
  lastBonusMult = bonusMult;
  lastCoinsEarned = coinsForFinish(
    currentLevel,
    player.value,
    mergeCount,
    bonusMult
  );
  recordWin(currentLevel, player.value, lastCoinsEarned);
  state = 'win';
  if (bonusMult > 1) {
    sfxBonus(player.value);
  } else {
    sfxWin();
  }
  if (player.value >= 2048) {
    celebration2048 = true;
    sfxRainbow();
    spawnBurst(player.x, player.radius, player.z, '#fff', 24);
  } else {
    spawnBurst(player.x, player.radius, player.z, colorForValue(player.value).glow, 14);
  }
  if (typeof showWinScreen === 'function') showWinScreen();
}

function collectSameValueHits(pHitR, value, z0, z1) {
  const hits = [];
  const orbs = levelData.orbs;
  for (let i = 0; i < orbs.length; i++) {
    const orb = orbs[i];
    if (orb.consumed || orb.falling || orb.ghostUntil > nowTime) continue;
    if (orb.value !== value) continue;
    if (orb.z < z0 - 4 || orb.z > z1 + 4) continue;
    const h = sweptCircleHit(
      player.x, z0, z1, pHitR,
      orb.x, orb.z, orb.radius + HIT_PAD
    );
    if (h.hit) hits.push({ orb: orb, t: h.t });
  }
  hits.sort(function (a, b) {
    if (a.t !== b.t) return a.t - b.t;
    return Math.abs(a.orb.x - player.x) - Math.abs(b.orb.x - player.x);
  });
  return hits;
}

function updateDynamicOrbs(dt) {
  if (!levelData || !player) return;
  const trackHalf = trackHalfAt(player.z, levelData.trackKeys);
  const pits = pitsOf(levelData);
  for (let i = 0; i < levelData.orbs.length; i++) {
    const orb = levelData.orbs[i];
    if (orb.consumed) continue;
    // Only integrate orbs near the camera/player for perf
    if (orb.z < player.z - 8 || orb.z > player.z + 50) {
      if (!orb.falling && Math.abs(orb.vx || 0) < 0.05) continue;
    }
    const res = stepOrbMotion(orb, dt, trackHalfAt(orb.z, levelData.trackKeys), pits);
    if (res === 'fell' && orb.falling && !orb._fallSfx) {
      orb._fallSfx = true;
      sfxFall();
      spawnBurst(orb.x, 0.2, orb.z, colorForValue(orb.value).glow || '#fff', 6);
    }
  }
}

function resolveFrame(dt) {
  if (!player || !levelData) return;

  player.invuln = Math.max(0, player.invuln - dt);
  player.mergeBoostT = Math.max(0, player.mergeBoostT - dt);
  if (player.expandT > 0) {
    player.expandT -= dt;
    player.squash = 1 + 0.25 * (player.expandT / 0.2);
    if (player.expandT <= 0) player.squash = 1;
  }

  // Soft edge assist — nudge target back when near the curb (kid-friendly)
  const thAssist = trackHalfAt(player.z, levelData.trackKeys);
  if (Math.abs(player.x) > thAssist * EDGE_ASSIST_FRAC) {
    const pull = -Math.sign(player.x) * EDGE_ASSIST * dt;
    player.targetX += pull;
  }

  const prevX = player.x;
  player.x = lerp(player.x, player.targetX, Math.min(1, dt * STEER_LERP));

  const z0 = player.z;
  const spd = levelSpeed(currentLevel) * (player.mergeBoostT > 0 ? MERGE_BOOST : 1);
  const z1 = z0 + spd * dt;
  const trackHalf = trackHalfAt(z1, levelData.trackKeys);
  const pits = pitsOf(levelData);

  // Past the checkered line: no more merges/thorns — just bonus walls
  const pastFinish = z1 >= levelData.finishZ;

  if (!pastFinish) {
    // --- Merges + chains (full re-scan) ---
    let merges = 0;
    while (merges < MAX_CHAIN) {
      const hits = collectSameValueHits(HIT_R_OF(player.value), player.value, z0, z1);
      if (!hits.length) break;
      const o = hits[0].orb;
      const nv = nextValue(player.value, o.value);
      if (nv == null) break;
      const prev = player.value;
      player.value = nv;
      player.radius = radiusForValue(nv);
      o.consumed = true;
      merges++;
      mergeCount++;
      player.mergeBoostT = MERGE_BOOST_T;
      player.expandT = 0.2;
      player.squash = 0.7;

      const col = colorForValue(nv);
      spawnBurst(player.x, player.radius, o.z, col.glow || col.color, 12);
      spawnFloatText(player.x, player.radius, o.z, String(nv), '#fff');
      sfxMerge(nv);
      addShake(2.5, 0.12);

      if (prev < 2048 && nv >= 2048) {
        celebration2048 = true;
        sfxRainbow();
      }
    }

    // --- Wrong-value knocks (roll away / can fall off) ---
    for (let i = 0; i < levelData.orbs.length; i++) {
      const orb = levelData.orbs[i];
      if (orb.consumed || orb.falling || orb.ghostUntil > nowTime) continue;
      if (orb.value === player.value) continue;
      if (orb.z < z0 - 4 || orb.z > z1 + 4) continue;
      const hit = sweptCircleHit(
        player.x, z0, z1, HIT_R_OF(player.value),
        orb.x, orb.z, orb.radius + HIT_PAD
      );
      if (hit.hit) {
        if (softNudge(player, orb, nowTime)) sfxNudge();
      }
    }

    // --- Thorns ---
    for (let i = 0; i < levelData.hazards.length; i++) {
      const h = levelData.hazards[i];
      if (h.type !== 'thorn' || h.consumed) continue;
      if (sweptStripHit(player.x, z0, z1, HIT_R_OF(player.value), h) && player.invuln <= 0) {
        const before = player.value;
        player.value = demoteValue(player.value);
        player.radius = radiusForValue(player.value);
        player.invuln = THORN_INVULN;
        h.consumed = true;
        sfxThorn();
        addShake(5, 0.2);
        spawnFloatText(player.x, player.radius, player.z, before > 2 ? '÷2' : '!', '#ff7a9a');
        spawnBurst(player.x, player.radius, player.z, '#ff4f7a', 8);
      }
    }
  }

  // --- Commit z + roll ---
  player.z = z1;
  // Slow, readable roll — drives flipbook frame index (not live gore spin)
  const rSafe = Math.max(0.25, player.radius);
  player.rollAngle += (spd * dt) / rSafe * ROLL_RATE;
  // Gentle yaw from steer (knocked orbs use collision roll more)
  player.rollYaw = (player.rollYaw || 0) + ((player.x - prevX) / rSafe) * 0.35;

  // Dynamic world orbs (knock / fall)
  updateDynamicOrbs(dt);

  // --- Support / death (still can fall during bonus run) ---
  if (!hasSupport(player.x, player.z, trackHalf, pits)) {
    beginDead(deathReasonAt(player.x, player.z, trackHalf, pits));
    return;
  }

  // --- Finish line → bonus wall zone (Crowd Runner style) ---
  if (player.z >= levelData.finishZ) {
    if (!crossedFinish) {
      crossedFinish = true;
      spawnFloatText(player.x, player.radius + 0.4, player.z, 'BONUS!', '#ffd23e');
    }

    const walls = levelData.bonusWalls || [];
    for (let i = 0; i < walls.length; i++) {
      const w = walls[i];
      if (w.broken) continue;
      if (player.z < w.z - 0.8) continue;

      if (player.value >= w.need) {
        w.broken = true;
        bonusMult = w.mult;
        spawnFloatText(player.x, player.radius + 0.6, w.z, 'x' + w.mult + ' BONUS!', '#ffd23e');
        spawnBurst(player.x, player.radius, w.z, '#ffce4d', 16);
        sfxBonus(w.need);
        addShake(4, 0.22);
      } else {
        spawnFloatText(player.x, player.radius + 0.5, w.z, 'NEED ' + w.need + '!', '#ff9d6e');
        completeLevel();
        return;
      }
    }

    if (player.z > levelData.bonusEndZ) {
      completeLevel();
    }
  }
}

function updatePlay(dt) {
  nowTime += dt;
  runTime += dt;
  applyKeyboardSteer(dt);

  if (showTutorial) {
    // freeze motion until dismissed — still allow steer preview
    player.x = lerp(player.x, player.targetX, Math.min(1, dt * STEER_LERP));
    return;
  }

  if (state === 'play') {
    resolveFrame(dt);
  } else if (state === 'dead') {
    deadTimer -= dt;
    if (player) {
      // tumble + sink
      player.x += (player.x > 0 ? 1 : -1) * 1.2 * dt;
      player.rollAngle += 1.6 * dt;
      if (player.falling) {
        player.vy -= 14 * dt;
        player.fallY = (player.fallY || player.radius) + player.vy * dt;
      }
      if (deadTimer < DEAD_ANIM_S * 0.25) player.visible = false;
    }
    if (deadTimer <= 0) {
      state = 'over';
      if (typeof showOverScreen === 'function') showOverScreen();
    }
  }

  updateParticles(dt);
  updateShake(dt);
}

function previewCoins() {
  if (!player) return 0;
  return coinsForFinish(currentLevel, player.value, mergeCount, bonusMult);
}

function progress01() {
  if (!levelData || !player) return 0;
  // Progress bar fills through bonus walls so the end stretch feels intentional
  const endZ = levelData.bonusEndZ || levelData.finishZ;
  return clamp(player.z / endZ, 0, 1);
}
