'use strict';

const $ = (id) => document.getElementById(id);

let last = performance.now();

function setScreen(name) {
  document.querySelectorAll('.screen').forEach(function (el) {
    el.classList.toggle('hidden', el.dataset.screen !== name);
  });
  document.querySelectorAll('.play-chrome').forEach(function (el) {
    el.classList.toggle('hidden', name !== 'play');
  });
}

function updateMenuStats() {
  $('statCoins').textContent = String(save.coins);
  $('statBest').textContent = String(save.bestValue);
  $('statLevel').textContent = String(save.maxUnlocked);
  $('muteBtn').textContent = save.muted ? '🔇 Sound off' : '🔊 Sound on';
  const sel = $('levelSelect');
  if (sel) {
    sel.innerHTML = '';
    for (let i = 1; i <= MAX_LEVEL; i++) {
      const opt = document.createElement('option');
      opt.value = String(i);
      opt.textContent = i <= save.maxUnlocked
        ? ('Level ' + i)
        : ('Level ' + i + ' 🔒');
      opt.disabled = i > save.maxUnlocked;
      if (i === Math.min(save.maxUnlocked, MAX_LEVEL)) opt.selected = true;
      sel.appendChild(opt);
    }
  }
}

function showMenu() {
  state = 'menu';
  player = null;
  levelData = null;
  updateMenuStats();
  setScreen('menu');
  if (window.__pendingReload) {
    window.__pendingReload = false;
    window.__reloaded = true;
    location.reload();
  }
}

function showPlayUI() {
  setScreen('play');
  updateHud();
  if (showTutorial) {
    $('tutorial').classList.remove('hidden');
  } else {
    $('tutorial').classList.add('hidden');
  }
}

function showPauseScreen() {
  $('pauseOverlay').classList.remove('hidden');
}

function hidePauseScreen() {
  $('pauseOverlay').classList.add('hidden');
}

function showWinScreen() {
  setScreen('win');
  $('winValue').textContent = String(lastFinishValue);
  $('winCoins').textContent = '+' + lastCoinsEarned;
  $('winMerges').textContent = String(mergeCount);
  $('winLevel').textContent = String(currentLevel);
  const next = currentLevel < MAX_LEVEL ? currentLevel + 1 : currentLevel;
  $('btnNext').textContent = currentLevel < MAX_LEVEL ? ('▶  Level ' + next) : '▶  Replay L' + MAX_LEVEL;
  $('winRainbow').classList.toggle('hidden', !celebration2048 && lastFinishValue < 2048);
  if (window.__pendingReload) {
    window.__pendingReload = false;
    window.__reloaded = true;
    location.reload();
  }
}

function showOverScreen() {
  setScreen('over');
  $('overReason').textContent = overReason || 'You fell off the track!';
  $('overValue').textContent = player ? String(player.value) : '—';
  $('overMerges').textContent = String(mergeCount);
  $('overBest').textContent = String(save.bestValue);
  if (window.__pendingReload) {
    window.__pendingReload = false;
    window.__reloaded = true;
    location.reload();
  }
}

function updateHud() {
  if (!player) return;
  $('hudValue').textContent = String(player.value);
  $('hudLevel').textContent = 'L' + currentLevel;
  $('hudCoins').textContent = String(previewCoins());
  $('hudMerges').textContent = String(mergeCount);
  const bar = $('progressBar');
  if (bar) bar.style.width = (progress01() * 100).toFixed(1) + '%';

  // color accent on value pill
  const col = colorForValue(player.value);
  const pill = $('hudValuePill');
  if (pill) {
    if (col.color === 'rainbow') {
      pill.style.background = 'linear-gradient(90deg,#ff6ad5,#7af0ff,#ffe66d,#8bffb0)';
    } else {
      pill.style.background = col.color;
    }
  }
}

function frame(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;

  if (!ctx) resizeCanvas();

  if (state === 'play' || state === 'dead' || state === 'pause') {
    if (state === 'play' || state === 'dead') updatePlay(dt);
    else updateParticles(dt);
  }

  // Always draw world under menus when we have level context mid-run
  if (state === 'play' || state === 'dead' || state === 'pause' || state === 'over' || state === 'win') {
    drawWorld(player, levelData, dt);
  } else if (state === 'menu') {
    // idle demo camera
    if (!ctx) resizeCanvas();
    cam.x = Math.sin(now * 0.0004) * 0.8;
    cam.z = -CAM_Z_BACK + Math.sin(now * 0.0003) * 2;
    cam.y = CAM_Y;
    // fake empty track for menu backdrop
    if (!levelData) {
      levelData = {
        finishZ: 80,
        trackKeys: [{ z0: 0, z1: Infinity, trackHalf: TRACK_HALF }],
        orbs: [
          { x: -1.5, z: 18, value: 2, radius: radiusForValue(2), consumed: false, ghostUntil: 0 },
          { x: 1.2, z: 28, value: 4, radius: radiusForValue(4), consumed: false, ghostUntil: 0 },
          { x: 0, z: 40, value: 8, radius: radiusForValue(8), consumed: false, ghostUntil: 0 },
          { x: -2, z: 52, value: 16, radius: radiusForValue(16), consumed: false, ghostUntil: 0 },
        ],
        hazards: [],
      };
      player = {
        x: 0, targetX: 0, z: 8, value: 2, radius: radiusForValue(2),
        squash: 1, visible: true,
      };
    }
    player.z = 8 + (now * 0.004) % 30;
    player.x = Math.sin(now * 0.001) * 1.5;
    drawWorld(player, levelData, dt);
  }

  if (state === 'play') updateHud();

  requestAnimationFrame(frame);
}

function beginPlay(level, seedOverride) {
  ensureAudio();
  // clear menu demo state
  startLevel(level, seedOverride);
  showPlayUI();
}

// ---- Wire UI ----------------------------------------------------------------
function init() {
  $('versionTag').textContent = GAME_NAME + ' ' + GAME_VERSION_LABEL;
  document.querySelectorAll('.ver').forEach(function (el) {
    el.textContent = GAME_NAME + ' ' + GAME_VERSION_LABEL;
  });

  $('btnPlay').addEventListener('click', function () {
    sfxClick();
    const sel = $('levelSelect');
    const L = sel ? parseInt(sel.value, 10) || 1 : 1;
    beginPlay(L);
  });

  $('btnHow').addEventListener('click', function () {
    sfxClick();
    $('howPanel').classList.toggle('hidden');
  });

  $('muteBtn').addEventListener('click', function () {
    save.muted = !save.muted;
    persist();
    updateMenuStats();
    sfxClick();
  });

  $('btnPauseMenu').addEventListener('click', function () {
    sfxClick();
    pauseGame();
  });

  $('btnResume').addEventListener('click', function () {
    sfxClick();
    resumeGame();
  });

  $('btnPauseQuit').addEventListener('click', function () {
    sfxClick();
    hidePauseScreen();
    showMenu();
  });

  $('btnRetry').addEventListener('click', function () {
    sfxClick();
    beginPlay(currentLevel);
  });

  $('btnMenu').addEventListener('click', function () {
    sfxClick();
    showMenu();
  });

  $('btnNext').addEventListener('click', function () {
    sfxClick();
    const next = currentLevel < MAX_LEVEL ? currentLevel + 1 : currentLevel;
    beginPlay(next);
  });

  $('btnWinMenu').addEventListener('click', function () {
    sfxClick();
    showMenu();
  });

  $('btnTutorialOk').addEventListener('click', function () {
    sfxClick();
    dismissTutorial();
    $('tutorial').classList.add('hidden');
  });

  $('gfxBtn').addEventListener('click', function () {
    sfxClick();
    save.gfx = save.gfx === 'low' ? 'high' : 'low';
    persist();
    $('gfxBtn').textContent = save.gfx === 'low' ? '⚙️ GFX: Low' : '⚙️ GFX: High';
    resizeCanvas();
  });

  bindInput(function () { ensureAudio(); });

  // query params for QA: ?level=N&seed=S&unlock=1&debug=1
  const params = new URLSearchParams(location.search);
  if (params.has('level')) {
    const L = clamp(parseInt(params.get('level'), 10) || 1, 1, MAX_LEVEL);
    if (params.has('seed') || params.get('unlock') === '1') {
      save.maxUnlocked = Math.max(save.maxUnlocked, L);
    }
    const seed = params.has('seed') ? parseInt(params.get('seed'), 10) : undefined;
    beginPlay(L, Number.isFinite(seed) ? seed : undefined);
  } else {
    showMenu();
  }

  $('gfxBtn').textContent = save.gfx === 'low' ? '⚙️ GFX: Low' : '⚙️ GFX: High';
  resizeCanvas();
  requestAnimationFrame(frame);

  // Service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(function () { /* */ });
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (state === 'play' || state === 'dead') {
        window.__pendingReload = true;
      } else if (!window.__reloaded) {
        window.__reloaded = true;
        location.reload();
      }
    });
  }

  // Version check against remote config
  try {
    fetch('./js/config.js', { cache: 'no-store' })
      .then(function (r) { return r.text(); })
      .then(function (txt) {
        const m = txt.match(/GAME_VERSION\s*=\s*['"]([^'"]+)['"]/);
        if (m && m[1] && m[1] !== GAME_VERSION) {
          if (state === 'play') window.__pendingReload = true;
          else location.reload();
        }
      })
      .catch(function () { /* offline */ });
  } catch (e) { /* */ }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
