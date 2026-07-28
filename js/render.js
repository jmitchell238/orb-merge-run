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
let fpsFrames = 0, fpsT = 0, fpsVal = 0;

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

/**
 * Post-finish bonus walls — Crowd Clash Runner style.
 * Gold wall across the track: "xN" mult + "need V" value threshold.
 */
function drawBonusWalls(levelData, zn, zf, playerVal) {
  if (!levelData || !levelData.bonusWalls) return;
  const hw = TRACK_HALF - 0.25;
  const hWall = 3.4;

  for (let i = 0; i < levelData.bonusWalls.length; i++) {
    const w = levelData.bonusWalls[i];
    if (w.broken) continue;
    if (w.z < zn - 2 || w.z > zf + 2) continue;

    const a = project(-hw, 0, w.z);
    const b = project(hw, 0, w.z);
    const c = project(hw, hWall, w.z);
    const d = project(-hw, hWall, w.z);
    if (!a || !b || !c || !d) continue;

    const canSmash = playerVal != null && playerVal >= w.need;
    ctx.fillStyle = canSmash ? 'rgba(255,185,35,0.62)' : 'rgba(255,120,70,0.55)';
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.lineTo(c[0], c[1]);
    ctx.lineTo(d[0], d[1]);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.88)';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // brick joints
    ctx.strokeStyle = 'rgba(180,110,10,0.5)';
    ctx.lineWidth = 1.5;
    for (const fy of [0.25, 0.5, 0.75]) {
      const l = project(-hw, hWall * fy, w.z);
      const r = project(hw, hWall * fy, w.z);
      if (!l || !r) continue;
      ctx.beginPath();
      ctx.moveTo(l[0], l[1]);
      ctx.lineTo(r[0], r[1]);
      ctx.stroke();
    }

    const mid = project(0, hWall * 0.62, w.z);
    const sub = project(0, hWall * 0.28, w.z);
    if (!mid || !sub) continue;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const big = Math.max(14, mid[2] * 1.45);
    ctx.font = '800 ' + big + 'px system-ui,Segoe UI,sans-serif';
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 4;
    ctx.strokeText('x' + w.mult, mid[0], mid[1]);
    ctx.fillStyle = '#fff';
    ctx.fillText('x' + w.mult, mid[0], mid[1]);

    const small = Math.max(10, sub[2] * 0.7);
    ctx.font = '700 ' + small + 'px system-ui,Segoe UI,sans-serif';
    ctx.lineWidth = 3;
    const needStr = 'need ' + w.need;
    ctx.strokeText(needStr, sub[0], sub[1]);
    ctx.fillStyle = canSmash ? '#b9ffb9' : '#ffb4a0';
    ctx.fillText(needStr, sub[0], sub[1]);
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

// ---- Orb roll flipbook (pre-baked sprites) -----------------------------------
// Number is mapped onto the sphere in horizontal slices so it reads as wrapped
// paint (not a flat sticker). Frames flip as the ball rolls under.

const orbFrameCache = Object.create(null);

/**
 * Draw value as a decal wrapped on the sphere surface.
 * `roll` radians: 0 = front center; increasing (with ROLL_DIR) rolls UNDER.
 * Screen Y down: bottom of ball = positive screen Y.
 */
function paintStampedNumberOn(g, cx, cy, R, value, roll) {
  const label = formatValueLabel(value);
  const fontSize = Math.max(18, R * (label.length > 3 ? 0.78 : 1.02));

  // Rasterize flat label once
  const pad = 4;
  const tw = Math.ceil(fontSize * Math.max(1.2, label.length * 0.72) + pad * 2);
  const th = Math.ceil(fontSize * 1.35 + pad * 2);
  const tc = document.createElement('canvas');
  tc.width = Math.max(8, tw);
  tc.height = Math.max(8, th);
  const tg = tc.getContext('2d');
  tg.font = '900 ' + fontSize + 'px system-ui,Segoe UI,sans-serif';
  tg.textAlign = 'center';
  tg.textBaseline = 'middle';
  tg.lineWidth = Math.max(2.5, fontSize * 0.2);
  tg.strokeStyle = 'rgba(0,0,0,0.6)';
  tg.strokeText(label, tc.width * 0.5, tc.height * 0.5);
  tg.fillStyle = '#ffffff';
  tg.fillText(label, tc.width * 0.5, tc.height * 0.5);

  // Angular size of the decal on the sphere
  const halfLat = 0.52; // vertical span (radians)
  const slices = 28;

  g.save();
  g.beginPath();
  g.arc(cx, cy, R * 0.985, 0, Math.PI * 2);
  g.clip();

  for (let i = 0; i < slices; i++) {
    const v0 = i / slices;
    const v1 = (i + 1) / slices;
    // Texture v → latitude on sphere, then roll so paint moves under the ball
    // lat=0 front equator; +lat = top of ball; -lat = bottom
    const lat0 = -halfLat + v0 * (2 * halfLat) + roll;
    const lat1 = -halfLat + v1 * (2 * halfLat) + roll;
    const latM = (lat0 + lat1) * 0.5;

    // Only front hemisphere (facing camera)
    const face = Math.cos(latM);
    if (face <= 0.05) continue;

    // Sphere: y_up = sin(lat); screen y increases downward
    const y0 = cy - Math.sin(lat0) * R;
    const y1 = cy - Math.sin(lat1) * R;
    const yTop = Math.min(y0, y1);
    const h = Math.max(0.65, Math.abs(y1 - y0));

    // Horizontal foreshortening + limb pinch (wrap cue)
    const widthScale = Math.max(0.12, face);
    // Extra squeeze near poles so it hugs the curve
    const wrapPinch = 0.75 + 0.25 * face;
    const decalW = R * 1.55 * widthScale * wrapPinch;

    const srcY = v0 * tc.height;
    const srcH = Math.max(1, (v1 - v0) * tc.height);

    g.globalAlpha = clamp(0.25 + face * 0.75, 0, 1);
    g.drawImage(
      tc,
      0, srcY, tc.width, srcH,
      cx - decalW * 0.5, yTop,
      decalW, h
    );
  }
  g.globalAlpha = 1;
  g.restore();
}

/**
 * Bake one flipbook frame: solid glossy ball + stamped number at `roll`.
 * No seams, gores, or scanlines — a single painted sphere image.
 */
function bakeOrbFrame(value, fill, glow, roll) {
  const res = ROLL_SPRITE_RES;
  const c = document.createElement('canvas');
  c.width = res;
  c.height = res;
  const g = c.getContext('2d');
  const cx = res * 0.5;
  const cy = res * 0.5;
  const R = res * 0.46;

  // Soft ground contact (inside sprite, slight)
  g.fillStyle = 'rgba(0,0,0,0.12)';
  g.beginPath();
  g.ellipse(cx, cy + R * 0.72, R * 0.75, R * 0.22, 0, 0, Math.PI * 2);
  g.fill();

  // Body
  const body = g.createRadialGradient(
    cx - R * 0.32, cy - R * 0.38, R * 0.06,
    cx, cy, R
  );
  body.addColorStop(0, '#ffffff');
  body.addColorStop(0.18, fill);
  body.addColorStop(0.72, fill);
  body.addColorStop(1, shadeColor(fill, -40));
  g.fillStyle = body;
  g.beginPath();
  g.arc(cx, cy, R, 0, Math.PI * 2);
  g.fill();

  // Soft “form” shadow (fixed lighting — not animated lines)
  const form = g.createRadialGradient(
    cx + R * 0.15, cy + R * 0.2, R * 0.1,
    cx, cy, R
  );
  form.addColorStop(0, 'rgba(0,0,0,0)');
  form.addColorStop(0.55, 'rgba(0,0,0,0)');
  form.addColorStop(1, 'rgba(0,0,0,0.28)');
  g.fillStyle = form;
  g.beginPath();
  g.arc(cx, cy, R, 0, Math.PI * 2);
  g.fill();

  // Number under specular so it reads as surface paint
  paintStampedNumberOn(g, cx, cy, R, value, roll);

  // Specular hot-spot (fixed camera light)
  const spec = g.createRadialGradient(
    cx - R * 0.28, cy - R * 0.32, 0,
    cx - R * 0.28, cy - R * 0.32, R * 0.32
  );
  spec.addColorStop(0, 'rgba(255,255,255,0.85)');
  spec.addColorStop(0.4, 'rgba(255,255,255,0.2)');
  spec.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = spec;
  g.beginPath();
  g.arc(cx, cy, R, 0, Math.PI * 2);
  g.fill();

  // Rim
  g.strokeStyle = glow || fill;
  g.globalAlpha = 0.5;
  g.lineWidth = Math.max(2, R * 0.06);
  g.beginPath();
  g.arc(cx, cy, R, 0, Math.PI * 2);
  g.stroke();
  g.globalAlpha = 1;

  return c;
}

function orbCacheKey(value) {
  if (value >= 2048) return '2048+';
  return String(value);
}

function getOrbFrames(value) {
  // Include bake version in key so wrap/dir fixes always rebuild
  const key = orbCacheKey(value) + '_w2';
  if (orbFrameCache[key]) return orbFrameCache[key];

  const col = colorForValue(value);
  let fill = col.color;
  if (fill === 'rainbow') fill = '#ff6ad5';
  const glow = col.glow || fill;
  const n = ROLL_FRAMES;
  const frames = new Array(n);
  for (let i = 0; i < n; i++) {
    // Frame i: stamp latitude shifts under the ball (ROLL_DIR=-1)
    const roll = (i / n) * Math.PI * 2 * (typeof ROLL_DIR === 'number' ? ROLL_DIR : -1);
    let f = fill;
    if (value >= 2048) {
      f = 'hsl(' + ((i * (360 / n)) % 360) + ', 90%, 58%)';
    }
    frames[i] = bakeOrbFrame(value, f, glow, roll);
  }
  orbFrameCache[key] = frames;
  return frames;
}

/** Warm the flipbook cache for common tiers (call once after DOM ready). */
function prebakeOrbSprites() {
  for (let t = 0; t <= 10; t++) {
    getOrbFrames(valueForTier(t));
  }
  getOrbFrames(4096);
}

/**
 * Draw orb by blitting the flipbook frame for this roll angle.
 * Looks like swapping animation frames — not procedural spinning lines.
 */
function drawOrbAt(x, y, z, value, radius, opts) {
  opts = opts || {};
  const centerY = y != null ? y : radius;
  const p = project(x, centerY, z);
  if (!p) return;
  const sx = p[0], sy = p[1], s = p[2];
  const r = radius * s;
  if (r < 1.5) return;

  // ground shadow in world
  const falling = opts.falling || centerY < radius * 0.85;
  const sh = project(x, 0.02, z);
  if (sh && centerY > -1) {
    const shadowScale = falling ? clamp(centerY / Math.max(0.2, radius), 0.15, 1) : 1;
    ctx.fillStyle = 'rgba(0,0,0,' + (0.28 * shadowScale) + ')';
    ctx.beginPath();
    ctx.ellipse(sh[0], sh[1], r * 0.95 * shadowScale, r * 0.35 * shadowScale, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  const frames = getOrbFrames(value);
  const n = frames.length;
  // rollAngle only increases with forward motion → walk flipbook 0..n-1
  // (frames already baked so stamp rolls under, not over the top)
  let phase = (opts.rollAngle || 0) / (Math.PI * 2);
  phase = phase - Math.floor(phase);
  if (phase < 0) phase += 1;
  const fi = Math.floor(phase * n) % n;
  const sprite = frames[fi];

  // drawImage scales the baked ball to screen radius
  const size = r * 2.12; // slight oversize so rim isn’t clipped by canvas edge padding
  ctx.drawImage(sprite, sx - size * 0.5, sy - size * 0.5, size, size);

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

function tickFps(dt) {
  if (!DEBUG) return;
  fpsFrames++;
  fpsT += dt || 0;
  if (fpsT >= 0.5) {
    fpsVal = Math.round(fpsFrames / fpsT);
    fpsFrames = 0;
    fpsT = 0;
  }
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
  // pit volumes
  if (levelData) {
    for (let i = 0; i < levelData.hazards.length; i++) {
      const p = levelData.hazards[i];
      if (p.type !== 'pit') continue;
      const a = project(p.x0, 0.08, p.z0);
      const b = project(p.x1, 0.08, p.z0);
      const c = project(p.x1, 0.08, p.z1);
      const d = project(p.x0, 0.08, p.z1);
      if (!a || !b || !c || !d) continue;
      ctx.fillStyle = 'rgba(80,160,255,0.2)';
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.lineTo(c[0], c[1]);
      ctx.lineTo(d[0], d[1]);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = '12px monospace';
  ctx.textAlign = 'left';
  const seed = levelData ? levelData.seed : '—';
  ctx.fillText(
    fpsVal + ' fps  x=' + player.x.toFixed(2) + ' z=' + player.z.toFixed(1) +
    ' v=' + player.value + ' th=' + th.toFixed(2) + ' seed=' + seed,
    10, 18
  );
  if (levelData) {
    ctx.fillText(
      'orbs=' + levelData.orbs.filter(function (o) { return !o.consumed; }).length +
      '  finish=' + levelData.finishZ,
      10, 34
    );
  }
}

function drawWorld(player, levelData, dt) {
  if (!ctx) resizeCanvas();
  tickFps(dt);
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
  drawBonusWalls(levelData, zn, zf, player ? player.value : null);

  // orbs sorted by z for painter's algorithm (far first)
  if (levelData) {
    const list = levelData.orbs
      .filter(function (o) {
        return !o.consumed && o.visible !== false && o.z > zn - 2 && o.z < zf;
      })
      .sort(function (a, b) { return a.z - b.z; });
    for (let i = 0; i < list.length; i++) {
      const o = list[i];
      const oy = o.falling && o.y != null ? o.y : o.radius;
      drawOrbAt(o.x, oy, o.z, o.value, o.radius, {
        debugHit: DEBUG,
        rollAngle: o.rollAngle || 0,
        rollYaw: o.rollYaw || 0,
        falling: !!o.falling,
      });
    }
  }

  if (player && player.visible !== false) {
    const drawR = player.radius * (player.squash || 1);
    const py = player.falling && player.fallY != null
      ? player.fallY
      : player.radius;
    drawOrbAt(player.x, py, player.z, player.value, drawR, {
      debugHit: DEBUG,
      rollAngle: player.rollAngle || 0,
      rollYaw: player.rollYaw || 0,
      falling: !!player.falling,
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
