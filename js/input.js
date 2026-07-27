'use strict';

const keys = {};
let dragging = false;
let lastPX = 0;
let dragPointerId = null;

function bindInput(onPointerStart) {
  cv.addEventListener('pointerdown', function (e) {
    if (typeof onPointerStart === 'function') onPointerStart();
    if (state !== 'play') return;
    dragging = true;
    lastPX = e.clientX;
    dragPointerId = e.pointerId;
    cv.classList.add('dragging');
    try { cv.setPointerCapture(e.pointerId); } catch (err) { /* */ }
  });

  cv.addEventListener('pointermove', function (e) {
    if (!dragging || !player || state !== 'play') return;
    if (dragPointerId != null && e.pointerId !== dragPointerId) return;
    const cssW = cv.clientWidth || W;
    const worldPerPx = WORLD_PER_PX(cssW);
    player.targetX += (e.clientX - lastPX) * worldPerPx;
    lastPX = e.clientX;
  });

  function endDrag(e) {
    if (dragPointerId != null && e && e.pointerId !== dragPointerId) return;
    dragging = false;
    dragPointerId = null;
    cv.classList.remove('dragging');
  }

  addEventListener('pointerup', endDrag);
  addEventListener('pointercancel', endDrag);

  addEventListener('keydown', function (e) {
    keys[e.key] = true;
    keys[e.code] = true;
    if (e.key === 'Escape' && state === 'play') {
      pauseGame();
    }
  });
  addEventListener('keyup', function (e) {
    keys[e.key] = false;
    keys[e.code] = false;
  });
}

function applyKeyboardSteer(dt) {
  if (!player || state !== 'play') return;
  let dir = 0;
  if (keys['ArrowLeft'] || keys['a'] || keys['A'] || keys['KeyA']) dir -= 1;
  if (keys['ArrowRight'] || keys['d'] || keys['D'] || keys['KeyD']) dir += 1;
  if (dir !== 0) {
    player.targetX += dir * STEER_SPEED * dt;
  }
}
