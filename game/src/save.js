// Save / load through localStorage. The save holds progression, not the
// moment-to-moment world: traffic and police are always re-simulated fresh.
import { SAVE_KEY } from './config.js';

export function saveGame(G) {
  try {
    const data = {
      version: 1,
      cash: G.cash,
      missionIndex: G.missionIndex,
      missionsDone: G.missionsDone,
      packages: G.packages,
      stats: G.stats,
      player: { x: G.player.x, y: G.player.y },
      playSeconds: G.playSeconds,
      savedAt: Date.now(),
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    return false;
  }
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return null;
    return data;
  } catch (e) {
    return null;
  }
}

export function hasSave() {
  return loadSave() !== null;
}

export function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* storage unavailable */ }
}
