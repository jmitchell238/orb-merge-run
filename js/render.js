'use strict';

const cv = document.getElementById('cv');
const stage = document.getElementById('stage');
let ctx = null;
let W = 0, H = 0, CX = 0, CY = 0, F = 0;
let dpr = 1;

const cosP = Math.cos(PITCH), sinP = Math.sin(PITCH);
const cam = { x: 0, y: CAM_Y, z: -CAM_Z_BACK };

let shakeT = 0, shakeMag = 0;
let rainbowHue = 0;

function resizeCanvas() {
  const ar = innerWidth >= innerHeight ? 16 / 9 : 9 / 16;
  let w = innerWidth, h = Math.round(w / ar);
  if (h > innerHeight) { h = innerHeight; w = Math.round(h * ar); }
  stage.style.width = w + 'px';
  stage.style.height = h + 'px';
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  const low = save && save.gfx === 'low';
  const pix = low ? 1.25 : 1;
  cv.width = Math.floor(w * dpr / pix);
  cv.height = Math.floor(h * dpr / pix);
  cv.style.width = w + 'px';
  cv.style.height = h + 'px';
  ctx = cv.getContext('2d');
  ctx.setTransform(dpr / pix, 0, 0, dpr / pix, 0, 0);
  W = w;
  H = h;
  CX = W / 2;
  CY = H * 0.44;
  F = Math.max(H * 1.05, W * 0.6);
  return { ctx: ctx };
}

addEventListener('resize', function () { resizeCanvas(); });

function project(wx, wy, wz) {
  const dx = wx - cam.x, dy = wy - cam.y, dz = wz - cam.z;
  const zc = -dy * sinP + dz * cosP;
  if (zc < 0.5) return null;
  const yc = dy * cosP + dz * sinP;
  const s = F / zc;
  return [CX + dx * s, CY - yc * s, s];
}

function addShake(mag, dur) {
  if (save && save.gfx === 'low') return;
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  shakeMag = Math.max(shakeMag, mag);
  shakeT = Math.max(shakeT, dur);
}

function updateShake(dt) {
  if (shakeT > 0) {
    shakeT -= dt;
    if (shakeT <= 0) { shakeT = 0; shakeMag = 0; }
  }
}

function rainbowColor(t) {
  const h = ((t * 360) + rainbowHue) % 360;
  return 'hsl(' + h + ', 90%, 60%)';
}

function drawSky() {
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#1a3a6e');
  sky.addColorStop(0.45, '#3d7ec9');
  sky.addColorStop(0.72, '#7ec8e8');
  sky.addColorStop(1, '#c8e8f5');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // soft horizon haze
  const haze = ctx.createLinearGradient(0, H * 0.55, 0, H * 0.78);
  haze.addColorStop(0, 'rgba(255,200,230,0)');
  haze.addColorStop(1, 'rgba(255,180,220,0.25)');
  ctx.fillStyle = haze;
  ctx.fillRect(0, H * 0.55, W, H * 0.25);
}

function drawTrackStrip(levelData, zn, zf) {
  // sample track half along z for keyframes — draw as series of quads
  const steps = 24;
  for (let i = 0; i < steps; i++) {
    const t0 = i / steps, t1 = (i + 1) / steps;
    const z0 = lerp(zn, zf, t0);
    const z1 = lerp(zn, zf, t1);
    const h0 = sampleTrackHalf(z0, levelData);
    const h1 = sampleTrackHalf(z1, levelData);

    const nl = project(-h0, 0, z0), nr = project(h0, 0, z0);
    const fl = project(-h1, 0, z1), fr = project(h1, 0, z1);
    if (!nl || !nr || !fl || !fr) continue;

    // track body — candy slate
    const g = ctx.createLinearGradient(nl[0], nl[1], nr[0], nr[1]);
    g.addColorStop(0, '#5a6270');
    g.addColorStop(0.5, '#6e7685');
    g.addColorStop(1, '#5a6270');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(nl[0], nl[1]);
    ctx.lineTo(nr[0], nr[1]);
    ctx.lineTo(fr[0], fr[1]);
    ctx.lineTo(fl[0], fl[1]);
    ctx.closePath();
    ctx.fill();

    // edge stripes
    for (const side of [-1, 1]) {
      const a = project(side * h0, 0, z0);
      const b = project(side * h1, 0, z1);
      const a2 = project(side * (h0 - CURB_INSET), 0, z0);
      const b2 = project(side * (h1 - CURB_INSET), 0, z1);
      if (!a || !b || !a2 || !b2) continue;
      ctx.fillStyle = '#f4f6fa';
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.lineTo(b2[0], b2[1]);
      ctx.lineTo(a2[0], a2[1]);
      ctx.closePath();
      ctx.fill();
    }
  }

  // center dashes
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  const start = Math.floor(zn / 6) * 6;
  for (let z = start; z < zf; z += 6) {
    const a = project(-0.18, 0.01, z);
    const b = project(0.18, 0.01, z);
    const c = project(0.18, 0.01, z + 2.2);
    const d = project(-0.18, 0.01, z + 2.2);
    if (!a || !b || !c || !d) continue;
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.lineTo(c[0], c[1]);
    ctx.lineTo(d[0], d[1]);
    ctx.closePath();
    ctx.fill();
  }
}

function drawCurbs(levelData, zn, zf) {
  const steps = 16;
  for (let i = 0; i < steps; i++) {
    const t0 = i / steps, t1 = (i + 1) / steps;
    const z0 = lerp(zn, zf, t0);
    const z1 = lerp(zn, zf, t1);
    const h0 = sampleTrackHalf(z0, levelData);
    const h1 = sampleTrackHalf(z1, levelData);
    for (const side of [-1, 1]) {
      const baseL = project(side * h0, 0, z0);
      const baseR = project(side * (h0 + 0.35), 0, z0);
      const topL = project(side * h0, CURB_H, z0);
      const topR = project(side * (h0 + 0.35), CURB_H, z0);
      const baseL2 = project(side * h1, 0, z1);
      const topL2 = project(side * h1, CURB_H, z1);
      if (!baseL || !topL || !baseL2 || !topL2) continue;
      ctx.fillStyle = side < 0 ? '#ff8fab' : '#7af0ff';
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.moveTo(baseL[0], baseL[1]);
      ctx.lineTo(topL[0], topL[1]);
      ctx.lineTo(topL2[0], topL2[1]);
      ctx.lineTo(baseL2[0], baseL2[1]);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
}

function drawPits(levelData, zn, zf) {
  if (!levelData) return;
  for (let i = 0; i < levelData.hazards.length; i++) {
    const p = levelData.hazards[i];
    if (p.type !== 'pit') continue;
    if (p.z1 < zn || p.z0 > zf) continue;
    const a = project(p.x0, -0.05, p.z0);
    const b = project(p.x1, -0.05, p.z0);
    const c = project(p.x1, -0.05, p.z1);
    const d = project(p.x0, -0.05, p.z1);
    if (!a || !b || !c || !d) continue;
    ctx.fillStyle = '#0a1628';
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.lineTo(c[0], c[1]);
    ctx.lineTo(d[0], d[1]);
    ctx.closePath();
    ctx.fill();
    // void glow
    ctx.strokeStyle = 'rgba(80,140,255,0.35)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

function drawThorns(levelData, zn, zf) {
  if (!levelData) return;
  for (let i = 0; i < levelData.hazards.length; i++) {
    const h = levelData.hazards[i];
    if (h.type !== 'thorn') continue;
    if (h.z + h.depth < zn || h.z > zf) continue;
    if (h.consumed) continue;
    const midZ = h.z + h.depth * 0.5;
    const count = 5;
    for (let k = 0; k < count; k++) {
      const t = k / (count - 1);
      const x = lerp(h.x0, h.x1, t);
      const base = project(x, 0, midZ);
      const tip = project(x, 0.9, midZ);
      if (!base || !tip) continue;
      const s = base[2];
      ctx.fillStyle = '#ff4f7a';
      ctx.beginPath();
      ctx.moveTo(base[0] - 6 * s * 0.08, base[1]);
      ctx.lineTo(tip[0], tip[1]);
      ctx.lineTo(base[0] + 6 * s * 0.08, base[1]);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#ffb3c6';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
}

function drawFinish(finishZ, zn, zf) {
  if (finishZ == null || finishZ < zn || finishZ > zf) return;
  const cols = 8;
  const hw = TRACK_HALF;
  const cw = (hw * 2) / cols;
  for (let r = 0; r < 2; r++) {
    for (let i = 0; i < cols; i++) {
      const x0 = -hw + i * cw;
      const z0 = finishZ + r * 1.1;
      const a = project(x0, 0.02, z0);
      const b = project(x0 + cw, 0.02, z0);
      const c = project(x0 + cw, 0.02, z0 + 1.1);
      const d = project(x0, 0.02, z0 + 1.1);
      if (!a || !b || !c || !d) continue;
      ctx.fillStyle = ((i + r) % 2 === 0) ? '#111' : '#f5f5f5';
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.lineTo(c[0], c[1]);
      ctx.lineTo(d[0], d[1]);
      ctx.closePath();
      ctx.fill();
    }
  }
}

function drawOrbAt(x, y, z, value, radius, opts) {
  opts = opts || {};
  const p = project(x, y, z);
  if (!p) return;
  const sx = p[0], sy = p[1], s = p[2];
  const r = radius * s;
  if (r < 1.5) return;

  // ground shadow
  const sh = project(x, 0.02, z);
  if (sh) {
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.ellipse(sh[0], sh[1], r * 0.95, r * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  const col = colorForValue(value);
  let fill = col.color;
  if (fill === 'rainbow') {
    fill = rainbowColor(value * 0.01 + z * 0.02);
  }

  // body
  const grd = ctx.createRadialGradient(
    sx - r * 0.35, sy - r * 0.4, r * 0.1,
    sx, sy, r
  );
  grd.addColorStop(0, '#ffffff');
  grd.addColorStop(0.22, fill);
  grd.addColorStop(0.75, fill);
  grd.addColorStop(1, shadeColor(fill, -35));
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.arc(sx, sy, r, 0, Math.PI * 2);
  ctx.fill();

  // rim glow
  ctx.strokeStyle = col.glow || fill;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = Math.max(1.5, r * 0.08);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // number
  const label = formatValueLabel(value);
  const fontSize = Math.max(10, r * (label.length > 3 ? 0.7 : 0.95));
  ctx.font = '900 ' + fontSize + 'px system-ui,Segoe UI,sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = Math.max(2, fontSize * 0.18);
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.strokeText(label, sx, sy + 1);
  ctx.fillStyle = '#fff';
  ctx.fillText(label, sx, sy + 1);

  if (opts.debugHit) {
    ctx.strokeStyle = 'rgba(255,80,80,0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(sx, sy, (radius + HIT_PAD) * s, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function shadeColor(hex, amt) {
  if (!hex || hex[0] !== '#' || hex.length < 7) return hex || '#888';
  let r = parseInt(hex.slice(1, 3), 16);
  let g = parseInt(hex.slice(3, 5), 16);
  let b = parseInt(hex.slice(5, 7), 16);
  r = clamp(r + amt, 0, 255);
  g = clamp(g + amt, 0, 255);
  b = clamp(b + amt, 0, 255);
  return '#' + [r, g, b].map(function (v) {
    return v.toString(16).padStart(2, '0');
  }).join('');
}

function drawParticles() {
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    const pr = project(p.x, p.y, p.z);
    if (!pr) continue;
    const a = clamp(p.life / p.maxLife, 0, 1);
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color;
    const r = p.size * pr[2] * 8;
    ctx.beginPath();
    ctx.arc(pr[0], pr[1], Math.max(1, r), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  for (let i = 0; i < floatTexts.length; i++) {
    const f = floatTexts[i];
    const pr = project(f.x, f.y, f.z);
    if (!pr) continue;
    const a = clamp(f.life / f.maxLife, 0, 1);
    ctx.globalAlpha = a;
    ctx.font = '900 ' + Math.max(12, 14 * pr[2] * 0.15) + 'px system-ui,sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = f.color;
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 3;
    ctx.strokeText(f.text, pr[0], pr[1]);
    ctx.fillText(f.text, pr[0], pr[1]);
  }
  ctx.globalAlpha = 1;
}

function drawDebug(player, levelData) {
  if (!player) return;
  const th = sampleTrackHalf(player.z, levelData);
  // rail edges
  for (const side of [-1, 1]) {
    const a = project(side * (th + FALL_MARGIN), 0.05, player.z - 2);
    const b = project(side * (th + FALL_MARGIN), 0.05, player.z + 20);
    if (!a || !b) continue;
    ctx.strokeStyle = 'rgba(255,80,80,0.7)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = '12px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(
    'x=' + player.x.toFixed(2) + ' z=' + player.z.toFixed(1) +
    ' v=' + player.value + ' th=' + th.toFixed(2),
    10, 20
  );
}

function drawWorld(player, levelData, dt) {
  if (!ctx) resizeCanvas();
  rainbowHue = (rainbowHue + (dt || 0) * 80) % 360;

  let ox = 0, oy = 0;
  if (shakeT > 0) {
    ox = (Math.random() - 0.5) * shakeMag * 2;
    oy = (Math.random() - 0.5) * shakeMag * 2;
  }
  ctx.save();
  ctx.translate(ox, oy);

  // camera follow
  if (player) {
    cam.x = lerp(cam.x, player.x * CAM_X_FOLLOW, 0.12);
    cam.z = player.z - CAM_Z_BACK;
    cam.y = CAM_Y;
  }

  const zn = cam.z + 4;
  const zf = cam.z + 140;

  drawSky();
  drawTrackStrip(levelData, zn, zf);
  drawPits(levelData, zn, zf);
  drawCurbs(levelData, zn, zf);
  drawFinish(levelData ? levelData.finishZ : null, zn, zf);
  drawThorns(levelData, zn, zf);

  // orbs sorted by z for painter's algorithm (far first)
  if (levelData) {
    const list = levelData.orbs
      .filter(function (o) {
        return !o.consumed && o.z > zn - 2 && o.z < zf;
      })
      .sort(function (a, b) { return a.z - b.z; });
    for (let i = 0; i < list.length; i++) {
      const o = list[i];
      drawOrbAt(o.x, o.radius, o.z, o.value, o.radius, { debugHit: DEBUG });
    }
  }

  if (player && player.visible !== false) {
    const y = player.radius * (player.squash || 1);
    drawOrbAt(player.x, player.radius, player.z, player.value, player.radius * (player.squash || 1), {
      debugHit: DEBUG,
    });
  }

  drawParticles();

  if (DEBUG) drawDebug(player, levelData);

  // edge warning
  if (player && levelData) {
    const th = sampleTrackHalf(player.z, levelData);
    if (Math.abs(player.x) > th * WARN_FRAC) {
      ctx.fillStyle = 'rgba(255,80,80,0.12)';
      ctx.fillRect(0, 0, W, H);
    }
  }

  ctx.restore();
}

const DEBUG = /[?&]debug=1/.test(location.search);
