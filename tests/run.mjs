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
      stripHit, sweptStripHit, softNudge, stepOrbMotion, bonusWellAt,
      expectedValue, pickOrbValue, endTierForLevel, maxValueAt,
      TEMPLATES, TEMPLATES_BY_ID,
      buildLevel, instantiateTemplate, trackHalfAt, pitsOf, bonusesOf,
      sanitizeForLevel, buildTrackKeyframes, overlapsTooClose,
      injectMergeLadder, clampOrbValuesToCurve, injectBonusFinale,
      SAVE_KEY, defaultSave, loadSave, save,
      KNOCK_SPEED, GHOST_S, NUDGE_X, BASE_LEN, BONUS_ZONE_LEN,
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

// ---- Soft nudge / knock -----------------------------------------------------
section('soft nudge / knock');
{
  const player = { x: 0, targetX: 1 };
  const orb = { x: 0, ghostUntil: 0, vx: 0, vz: 0 };
  T.softNudge(player, orb, 1.0);
  assert(orb.x === 0.55, 'tie-break +1 when targetX>x');
  assert(orb.vx > 0, 'knock gives +vx');
  assert(orb.ghostUntil === 1.0 + T.GHOST_S, 'ghost set');
  const x2 = orb.x;
  const vx2 = orb.vx;
  T.softNudge(player, orb, 1.05); // still ghost
  assert(orb.x === x2, 'no re-nudge while ghost');
  assert(orb.vx === vx2, 'vx unchanged while ghost');
}
{
  const player = { x: 0, targetX: 0 };
  const orb = { x: 2, ghostUntil: 0, vx: 0, vz: 0 };
  T.softNudge(player, orb, 0);
  assert(orb.x === 2.55, 'push away from player');
  assert(orb.vx > 0, 'lateral knock velocity');
}
// orb rolls off edge after knock
{
  const orb = {
    x: 5.2, z: 10, radius: 0.5, vx: 4, vz: 0,
    consumed: false, falling: false, rollAngle: 0,
  };
  let fell = false;
  for (let i = 0; i < 30; i++) {
    const r = T.stepOrbMotion(orb, 0.05, 5, []);
    if (r === 'fell' || orb.falling) { fell = true; break; }
  }
  assert(fell, 'knocked orb falls off rail');
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
assertEq(T.finishZForLevel(1), T.BASE_LEN + T.FINISH_PAD + T.BONUS_ZONE_LEN, 'finishZ L1');
assertEq(
  T.finishZForLevel(5),
  T.BASE_LEN + 4 * T.LEN_STEP + T.FINISH_PAD + T.BONUS_ZONE_LEN,
  'finishZ L5'
);
assert(T.coinsForFinish(1, 64, 5, 50) > T.coinsForFinish(1, 64, 5, 0), 'bonus coins increase payout');

// ---- Level gen --------------------------------------------------------------
section('level generation');
assertEq(T.TEMPLATES.length, 20, 'exactly 20 templates');
const ids = new Set(T.TEMPLATES.map(t => t.id));
assertEq(ids.size, 20, '20 unique template ids');

const L1a = T.buildLevel(1, 10007);
const L1b = T.buildLevel(1, 10007);
assert(JSON.stringify(L1a) === JSON.stringify(L1b), 'determinism L1 seed');
assertEq(L1a.finishZ, T.finishZForLevel(1), 'finishZ match');
// L1: thorns ok (after intro), no pits; bonus wells OK
assert(L1a.hazards.filter(h => h.type === 'pit').length === 0, 'L1 no pits');
assert(L1a.hazards.some(h => h.type === 'thorn'), 'L1 has thorns (spice)');
assert(L1a.orbs.some(o => o.value === 2 && o.z < 40), 'L1 early value-2');
assert(L1a.orbs.length >= 3, 'L1 has orbs');
// early merge guarantee: at least 2 twos before z=60 (can be wide lanes)
{
  const early = L1a.orbs.filter(o => o.value === 2 && o.z < 60);
  assert(early.length >= 2, 'L1 ensureEarlyMerges (≥2 early twos)');
}
// orbs must zigzag — not all parked on center
{
  const avgAbsX = L1a.orbs.reduce((s, o) => s + Math.abs(o.x), 0) / L1a.orbs.length;
  assert(avgAbsX >= 1.2, 'L1 orbs spread laterally (avg|x|=' + avgAbsX.toFixed(2) + ')');
  const far = L1a.orbs.filter(o => Math.abs(o.x) >= 2.0).length;
  assert(far >= 4, 'L1 has several wide-lane orbs (got ' + far + ')');
}
// bonus wells present
{
  const bonuses = T.bonusesOf(L1a);
  assert(bonuses.length >= 2, 'L1 has bonus wells (got ' + bonuses.length + ')');
  assert(bonuses.every(b => b.minValue >= 8 && b.coins > 0), 'bonus wells valid');
}
// not a wall of orbs
{
  assert(L1a.orbs.length <= 55, 'L1 sparse-ish orb count (got ' + L1a.orbs.length + ')');
}
// thorn cap (higher now — still capped)
{
  const L9 = T.buildLevel(9, 9 * 10007);
  const thorns = L9.hazards.filter(h => h.type === 'thorn').length;
  assert(thorns <= 12, 'L9 thorn cap ≤12 (got ' + thorns + ')');
  assert(thorns >= 4, 'L9 has real thorn count (got ' + thorns + ')');
}

const L2 = T.buildLevel(2, 20014);
assert(L2.hazards.some(h => h.type === 'thorn'), 'L2 has thorns');
// pits allowed later on L2
assert(L2.hazards.filter(h => h.type === 'pit').every(h => h.z0 >= 55), 'L2 pits z0>=55');

const L3 = T.buildLevel(3, 30021);
assert(L3.hazards.some(h => h.type === 'pit' || h.type === 'thorn'), 'L3 has hazards');

for (let L = 1; L <= 12; L++) {
  const lv = T.buildLevel(L, L * 10007);
  assert(Number.isFinite(lv.finishZ), `L${L} finishZ finite`);
  assert(lv.orbs.length > 0, `L${L} has orbs`);
  assert(T.bonusesOf(lv).length >= 1, `L${L} has bonus wells`);
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

// expected value end tiers — high enough for 512 on L1
assertEq(T.expectedValue(1, 1), 512, 'L1 end ≈512');
assertEq(T.expectedValue(12, 1), 2048, 'L12 end ≈2048');
// progressive climb: few 2s then 4s then 8s (not a dense flood)
{
  const L5 = T.buildLevel(5, 5 * 10007);
  const c2 = L5.orbs.filter(o => o.value === 2).length;
  const c4 = L5.orbs.filter(o => o.value === 4).length;
  const c8 = L5.orbs.filter(o => o.value === 8).length;
  const c16 = L5.orbs.filter(o => o.value === 16).length;
  assert(c2 >= 3, 'L5 has climb 2s (got ' + c2 + ')');
  assert(c4 >= 2, 'L5 has climb 4s (got ' + c4 + ')');
  assert(c8 >= 1, 'L5 has climb 8s (got ' + c8 + ')');
  assert(c16 >= 1, 'L5 has climb 16s (got ' + c16 + ')');
  // sparse total
  assert(L5.orbs.length <= 70, 'L5 not orb-dense (got ' + L5.orbs.length + ')');
  // no extreme teases early
  const earlyHigh = L5.orbs.filter(o => o.z < L5.finishZ * 0.2 && o.value >= 64).length;
  assert(earlyHigh <= 1, 'L5 early track not stacked with 64+ (got ' + earlyHigh + ')');
}
// L1 full ladder through 256+ so 512 is reachable
{
  const L1 = T.buildLevel(1, 10007);
  for (const v of [2, 4, 8, 16, 32, 64, 128, 256, 512]) {
    const n = L1.orbs.filter(o => o.value === v).length;
    assert(n >= 1, 'L1 ladder has ' + v + ' (got ' + n + ')');
  }
  assert(L1.orbs.length <= 45, 'L1 still sparse (got ' + L1.orbs.length + ')');
}

// bonus well support + claim rule helpers
{
  const well = { type: 'bonus', x0: -1, x1: 1, z0: 10, z1: 14, minValue: 32, coins: 40, claimed: false };
  assert(T.hasSupport(0, 12, 5, [well]) === false, 'bonus well removes support');
  assert(T.bonusWellAt(0, 12, [well]) === well, 'bonusWellAt finds well');
  assert(T.bonusWellAt(3, 12, [well]) === null, 'bonusWellAt miss side');
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
