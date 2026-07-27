'use strict';

const particles = [];
const floatTexts = [];
const MAX_PARTICLES_HIGH = 80;
const MAX_PARTICLES_LOW = 40;

function particleBudget() {
  return (save && save.gfx === 'low') ? MAX_PARTICLES_LOW : MAX_PARTICLES_HIGH;
}

function spawnBurst(wx, wy, wz, color, n) {
  n = n || 10;
  const budget = particleBudget();
  for (let i = 0; i < n; i++) {
    if (particles.length >= budget) particles.shift();
    const a = Math.random() * Math.PI * 2;
    const sp = 1.5 + Math.random() * 3;
    particles.push({
      x: wx, y: wy, z: wz,
      vx: Math.cos(a) * sp * 0.4,
      vy: 2 + Math.random() * 3,
      vz: Math.sin(a) * sp * 0.3,
      life: 0.35 + Math.random() * 0.25,
      maxLife: 0.6,
      color: color || '#fff',
      size: 0.08 + Math.random() * 0.1,
    });
  }
}

function spawnFloatText(wx, wy, wz, text, color) {
  floatTexts.push({
    x: wx, y: wy + 0.5, z: wz,
    text: text,
    color: color || '#fff',
    life: 0.9,
    maxLife: 0.9,
  });
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) { particles.splice(i, 1); continue; }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.z += p.vz * dt;
    p.vy -= 8 * dt;
  }
  for (let i = floatTexts.length - 1; i >= 0; i--) {
    const f = floatTexts[i];
    f.life -= dt;
    if (f.life <= 0) { floatTexts.splice(i, 1); continue; }
    f.y += 1.2 * dt;
  }
}

function clearParticles() {
  particles.length = 0;
  floatTexts.length = 0;
}
