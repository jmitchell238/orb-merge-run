#!/usr/bin/env node
/**
 * Orb Merge Run — automated tests (no browser / no deps).
 * Run: node tests/run.mjs
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

let passed = 0;
let failed = 0;
const failures = [];

function assert(cond, msg) {
  if (cond) {
    passed++;
    process.stdout.write('.');
    return;
  }
  failed++;
  failures.push(msg);
  console.error('\n  ✗', msg);
}

function assertEq(a, b, msg) {
  assert(Object.is(a, b), `${msg} (got ${JSON.stringify(a)}, expected ${JSON.stringify(b)})`);
}

function section(name) {
  process.stdout.write('\n• ' + name + ' ');
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

function loadGame() {
  const files = [
    'js/config.js',
    'js/utils.js',
    'js/merge.js',
    'js/collision.js',
    'js/save.js',
    'js/level.js',
    'js/track.js',
  ];
  const code = files
    .map(rel => `// ---- ${rel} ----\n` + read(rel))
    .join('\n;\n');

  const exportFooter = `
    globalThis.__TEST__ = {
      GAME_VERSION, GAME_NAME, TRACK_W, TRACK_HALF, FALL_MARGIN, HIT_PAD,
      BASE_R, MAX_R, MAX_CHAIN, MAX_LEVEL, COIN_MULT, THORN_DEPTH,
      TIERS, BASE_LEN, LEN_STEP, FINISH_PAD,
      levelSpeed, finishZForLevel, coinsForFinish,
      clamp, lerp, smoothstep, mulberry32, weightedPick,
      isPowerOfTwo, nextValue, demoteValue, tierForValue, valueForTier,
      colorForValue, radiusForValue,
      dist2PointSegment, sweptCircleHit, circleHit, isOffRail, hasSupport,
      stripHit, sweptStripHit, softNudge,
      expectedValue, pickOrbValue, endTierForLevel, maxValueAt,
      TEMPLATES, TEMPLATES_BY_ID,
      buildLevel, instantiateTemplate, trackHalfAt, pitsOf,
      sanitizeForLevel, buildTrackKeyframes, overlapsTooClose,
      injectMergeLadder, clampOrbValuesToCurve,
      SAVE_KEY, defaultSave, loadSave, save,
    };
  `;

  const sandbox = {
    console,
    Math,
    Number,
    Object,
    Array,
    JSON,
    Infinity,
    parseInt,
    performance: { now: () => Date.now() },
    localStorage: {
      _data: {},
      getItem(k) { return this._data[k] ?? null; },
      setItem(k, v) { this._data[k] = String(v); },
      removeItem(k) { delete this._data[k]; },
      clear() { this._data = {}; },
    },
    globalThis: null,
  };
  sandbox.globalThis = sandbox;

  vm.runInNewContext(code + '\n' + exportFooter, sandbox, { timeout: 5000 });
  return sandbox.__TEST__;
}

// ---- Shell files ------------------------------------------------------------
section('shell files');
for (const f of [
  'index.html', 'css/style.css', 'js/config.js', 'js/main.js', 'js/game.js',
  'js/merge.js', 'js/collision.js', 'js/level.js', 'sw.js', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'apple-touch-icon.png',
]) {
  assert(exists(f), `missing ${f}`);
}

// ---- Version / SW sync ------------------------------------------------------
section('version ↔ SW cache');
const configSrc = read('js/config.js');
const swSrc = read('sw.js');
const verMatch = configSrc.match(/GAME_VERSION\s*=\s*['"]([^'"]+)['"]/);
assert(verMatch, 'GAME_VERSION present in config.js');
const ver = verMatch[1];
assert(swSrc.includes(`orb-merge-run-${ver}`), `sw CACHE includes version ${ver}`);
assert(/^\d+\.\d+\.\d{3}$/.test(ver), `version format MAJOR.MINOR.PPP (${ver})`);

// ---- Load pure logic --------------------------------------------------------
section('load pure modules');
let T;
try {
  T = loadGame();
  assert(true, 'vm load ok');
} catch (e) {
  assert(false, 'vm load failed: ' + e.message);
  console.error(e);
  process.exit(1);
}

// ---- Merge math -------------------------------------------------------------
section('merge math');
assertEq(T.nextValue(2, 2), 4, '2+2=4');
assertEq(T.nextValue(4, 4), 8, '4+4=8');
assertEq(T.nextValue(1024, 1024), 2048, '1024+1024=2048');
assertEq(T.nextValue(2048, 2048), 4096, '2048+2048=4096 allowed');
assertEq(T.nextValue(2, 4), null, 'mismatch null');
assertEq(T.nextValue(3, 3), null, 'non-power null');
assertEq(T.demoteValue(8), 4, 'demote 8→4');
assertEq(T.demoteValue(2), 2, 'demote floor 2');
assertEq(T.demoteValue(3), 2, 'demote never below 2');

assertEq(T.tierForValue(2), 0, 'tier 2→0');
assertEq(T.tierForValue(2048), 10, 'tier 2048→10');
assertEq(T.valueForTier(0), 2, 'valueForTier 0→2');
assertEq(T.valueForTier(10), 2048, 'valueForTier 10→2048');
assert(T.radiusForValue(2) === T.BASE_R, 'radius 2 = BASE_R');
assert(T.radiusForValue(2048) <= T.MAX_R, 'radius capped');
assert(T.colorForValue(2048).color === 'rainbow', '2048 rainbow');
assert(T.colorForValue(4096).color === 'rainbow', '4096 rainbow');

// ---- Swept collision --------------------------------------------------------
section('swept collision');
// High speed tunnel: player z=0→0.533, orb at z=0.15, radii ~0.62 each
{
  const pR = T.radiusForValue(2) + T.HIT_PAD;
  const oR = T.radiusForValue(2) + T.HIT_PAD;
  const hit = T.sweptCircleHit(0, 0, 0.533, pR, 0, 0.15, oR);
  assert(hit.hit === true, 'high-speed centerline merge hits');
}
// Far side miss
{
  const pR = 0.62, oR = 0.62;
  const hit = T.sweptCircleHit(0, 0, 1, pR, 4, 0.5, oR);
  assert(hit.hit === false, 'far lateral miss');
}
// Grazing
{
  const pR = 0.5, oR = 0.5;
  // orb at x = 1.0 exactly sumR from path x=0
  const hit = T.sweptCircleHit(0, 0, 2, pR, 1.0, 1, oR);
  assert(hit.hit === true, 'grazing dist==sumR hits');
}
// dt=1/20 worst hitch at speed 16: step 0.8
{
  const pR = T.radiusForValue(2) + T.HIT_PAD;
  const oR = pR;
  const hit = T.sweptCircleHit(0, 0, 0.8, pR, 0, 0.4, oR);
  assert(hit.hit === true, '1/20 hitch still hits');
}

// ---- Support / rail / pits --------------------------------------------------
section('support geometry');
assert(T.isOffRail(0, 5) === false, 'center on rail');
// FALL_MARGIN is 0.45 → die when |x| > 5.45
assert(T.isOffRail(5.4, 5) === false, 'inside wider margin still on');
assert(T.isOffRail(5.46, 5) === true, 'just past FALL_MARGIN off');

const pit = { type: 'pit', x0: -1.5, x1: 1.5, z0: 10, z1: 15 };
assert(T.hasSupport(0, 12, 5, [pit]) === false, 'mid pit no support');
assert(T.hasSupport(0, 9.5, 5, [pit]) === true, 'before pit ok');
assert(T.hasSupport(3, 12, 5, [pit]) === true, 'ledge beside pit ok');
assert(T.hasSupport(6, 12, 5, [pit]) === false, 'off rail no support');

// ---- Soft nudge -------------------------------------------------------------
section('soft nudge');
{
  const player = { x: 0, targetX: 1 };
  const orb = { x: 0, ghostUntil: 0 };
  T.softNudge(player, orb, 1.0);
  assert(orb.x === 0.55, 'tie-break +1 when targetX>x');
  assert(orb.ghostUntil === 1.0 + 0.15, 'ghost set');
  const x2 = orb.x;
  T.softNudge(player, orb, 1.05); // still ghost
  assert(orb.x === x2, 'no re-nudge while ghost');
}
{
  const player = { x: 0, targetX: 0 };
  const orb = { x: 2, ghostUntil: 0 };
  T.softNudge(player, orb, 0);
  assert(orb.x === 2.55, 'push away from player');
}

// ---- Thorns -----------------------------------------------------------------
section('thorn strip');
{
  const thorn = { x0: 0.5, x1: 4.5, z: 10, depth: 1.2 };
  assert(T.sweptStripHit(2, 9, 11, 0.6, thorn) === true, 'strip hit');
  assert(T.sweptStripHit(-2, 9, 11, 0.6, thorn) === false, 'strip miss left');
}

// ---- Scoring ----------------------------------------------------------------
section('scoring');
assertEq(T.COIN_MULT, 1, 'COIN_MULT=1');
assert(T.coinsForFinish(1, 2, 0) > 0, 'coins positive');
assert(T.coinsForFinish(1, 2048, 10) > T.coinsForFinish(1, 2, 0), 'bigger value more coins');
assertEq(T.finishZForLevel(1), 160 + 8, 'finishZ L1');
assertEq(T.finishZForLevel(5), 160 + 4 * 22 + 8, 'finishZ L5');

// ---- Level gen --------------------------------------------------------------
section('level generation');
assertEq(T.TEMPLATES.length, 20, 'exactly 20 templates');
const ids = new Set(T.TEMPLATES.map(t => t.id));
assertEq(ids.size, 20, '20 unique template ids');

const L1a = T.buildLevel(1, 10007);
const L1b = T.buildLevel(1, 10007);
assert(JSON.stringify(L1a) === JSON.stringify(L1b), 'determinism L1 seed');
assertEq(L1a.finishZ, T.finishZForLevel(1), 'finishZ match');
assert(L1a.hazards.every(h => h.type !== 'thorn' && h.type !== 'pit'), 'L1 no hazards');
assert(L1a.orbs.some(o => o.value === 2 && o.z < 40), 'L1 early value-2');
assert(L1a.orbs.length >= 3, 'L1 has orbs');
// early merge guarantee: at least 2 center-ish twos before z=55
{
  const early = L1a.orbs.filter(o => o.value === 2 && o.z < 55 && Math.abs(o.x) < 1.5);
  assert(early.length >= 2, 'L1 ensureEarlyMerges (≥2 early twos)');
}
// thorn cap
{
  const L9 = T.buildLevel(9, 9 * 10007);
  const thorns = L9.hazards.filter(h => h.type === 'thorn').length;
  assert(thorns <= 4, 'L9 thorn cap ≤4 (got ' + thorns + ')');
}

const L2 = T.buildLevel(2, 20014);
assert(L2.hazards.every(h => h.type !== 'pit'), 'L2 no pits');
assert(L2.hazards.filter(h => h.type === 'thorn').every(h => h.z >= 40), 'L2 thorns z>=40');

const L3 = T.buildLevel(3, 30021);
assert(L3.hazards.every(h => h.type !== 'pit'), 'L3 no pits');

for (let L = 1; L <= 12; L++) {
  const lv = T.buildLevel(L, L * 10007);
  assert(Number.isFinite(lv.finishZ), `L${L} finishZ finite`);
  assert(lv.orbs.length > 0, `L${L} has orbs`);
  // pits ledge
  for (const h of lv.hazards) {
    if (h.type === 'pit') {
      const ledge = (h.x0 - (-T.TRACK_HALF)) + (T.TRACK_HALF - h.x1);
      assert(ledge >= 2.5 - 1e-6, `L${L} pit ledge >=2.5 (${ledge})`);
    }
  }
}

// empty eligible break — short remaining shouldn't hang
{
  const t0 = Date.now();
  T.buildLevel(1, 42);
  assert(Date.now() - t0 < 2000, 'buildLevel finishes quickly');
}

// expected value end tiers (gentler climb curve)
assertEq(T.expectedValue(1, 1), 4, 'L1 end ≈4');
assertEq(T.expectedValue(12, 1), 256, 'L12 end ≈256');
// climb ladder: plenty of 2s and 4s on early/mid track
{
  const L5 = T.buildLevel(5, 5 * 10007);
  const c2 = L5.orbs.filter(o => o.value === 2).length;
  const c4 = L5.orbs.filter(o => o.value === 4).length;
  const c8 = L5.orbs.filter(o => o.value === 8).length;
  assert(c2 >= 6, 'L5 has many 2s for climb (got ' + c2 + ')');
  assert(c4 >= 4, 'L5 has many 4s for climb (got ' + c4 + ')');
  assert(c8 >= 2, 'L5 has some 8s for climb (got ' + c8 + ')');
  // no extreme teases: early track (z< finish*0.25) should not be full of 64+
  const earlyHigh = L5.orbs.filter(o => o.z < L5.finishZ * 0.25 && o.value >= 32).length;
  assert(earlyHigh <= 1, 'L5 early track not stacked with 32+ (got ' + earlyHigh + ')');
}

// trackHalfAt half-open
{
  const keys = [
    { z0: 0, z1: 10, trackHalf: 5 },
    { z0: 10, z1: 20, trackHalf: 3.2 },
  ];
  assertEq(T.trackHalfAt(9.9, keys), 5, 'before boundary');
  assertEq(T.trackHalfAt(10, keys), 3.2, 'at boundary next wins');
}

// weightedPick empty throws
{
  let threw = false;
  try { T.weightedPick([], () => 0.5); } catch { threw = true; }
  assert(threw, 'weightedPick([]) throws');
}

// ---- Summary ----------------------------------------------------------------
console.log('\n');
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
if (failures.length) {
  console.log('Failures:');
  failures.forEach(f => console.log(' -', f));
  process.exit(1);
}
console.log('All tests passed.');
process.exit(0);
