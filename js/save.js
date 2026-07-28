'use strict';

const SAVE_KEY = 'orb-merge-run-v1';

function defaultSave() {
  return {
    coins: 0,
    maxUnlocked: 1,
    bestValue: 2,
    bestValueByLevel: {},
    muted: false,
    seenTutorial: false,
    gfx: 'high', // 'high' | 'low'
    games: 0,
    wins: 0,
  };
}

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return defaultSave();
    return Object.assign(defaultSave(), JSON.parse(raw));
  } catch (e) {
    return defaultSave();
  }
}

function writeSave(data) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); }
  catch (e) { /* ignore */ }
}

let save = loadSave();

function persist() { writeSave(save); }

function recordWin(level, value, coinsEarned) {
  save.games += 1;
  save.wins += 1;
  save.coins += coinsEarned;
  if (value > save.bestValue) save.bestValue = value;
  const prev = save.bestValueByLevel[level] || 0;
  if (value > prev) save.bestValueByLevel[level] = value;
  // Endless: always unlock the next level after a win
  if (level >= save.maxUnlocked) {
    save.maxUnlocked = level + 1;
  }
  persist();
}

function recordDeath() {
  save.games += 1;
  persist();
}
