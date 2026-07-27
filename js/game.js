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
let lastFinishValue = 2;
let overReason = '';
let showTutorial = false;
let celebration2048 = false;
let nowTime = 0;

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
    mergeBoostT: 0,
    visible: true,
  };
}

function startLevel(L) {
  currentLevel = clamp(L | 0, 1, MAX_LEVEL);
  const seed = currentLevel * 10007;
  levelData = buildLevel(currentLevel, seed);
  player = makePlayer();
  mergeCount = 0;
  runTime = 0;
  deadTimer = 0;
  lastCoinsEarned = 0;
  lastFinishValue = 2;
  overReason = '';
  celebration2048 = false;
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

function beginDead() {
  if (state !== 'play') return;
  state = 'dead';
  deadTimer = DEAD_ANIM_S;
  overReason = 'You fell off the track!';
  sfxDeath();
  addShake(6, 0.35);
  recordDeath();
}

function completeLevel() {
  if (state !== 'play') return;
  lastFinishValue = player.value;
  lastCoinsEarned = coinsForFinish(currentLevel, player.value, mergeCount);
  recordWin(currentLevel, player.value, lastCoinsEarned);
  state = 'win';
  sfxWin();
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
    if (orb.consumed || orb.ghostUntil > nowTime) continue;
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

function resolveFrame(dt) {
  if (!player || !levelData) return;

  player.invuln = Math.max(0, player.invuln - dt);
  player.mergeBoostT = Math.max(0, player.mergeBoostT - dt);
  if (player.expandT > 0) {
    player.expandT -= dt;
    player.squash = 1 + 0.25 * (player.expandT / 0.2);
    if (player.expandT <= 0) player.squash = 1;
  }

  player.x = lerp(player.x, player.targetX, Math.min(1, dt * STEER_LERP));

  const z0 = player.z;
  const spd = levelSpeed(currentLevel) * (player.mergeBoostT > 0 ? MERGE_BOOST : 1);
  const z1 = z0 + spd * dt;
  const trackHalf = trackHalfAt(z1, levelData.trackKeys);
  const pits = pitsOf(levelData);

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

  // --- Wrong-value nudges ---
  for (let i = 0; i < levelData.orbs.length; i++) {
    const orb = levelData.orbs[i];
    if (orb.consumed || orb.ghostUntil > nowTime) continue;
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

  // --- Commit z, then death before finish ---
  player.z = z1;
  player.rollAngle += spd * dt * 2.5;

  if (!hasSupport(player.x, player.z, trackHalf, pits)) {
    beginDead();
    return;
  }

  if (player.z >= levelData.finishZ) {
    completeLevel();
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
      player.x += (Math.random() - 0.5) * 0.05;
      // sink visually by moving cam a bit / hide after anim
      if (deadTimer < DEAD_ANIM_S * 0.3) player.visible = false;
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
  return coinsForFinish(currentLevel, player.value, mergeCount);
}

function progress01() {
  if (!levelData || !player) return 0;
  return clamp(player.z / levelData.finishZ, 0, 1);
}
