// Save / load through localStorage. Nothing leaves the browser.
export const SAVE_KEY = 'solmar-vice-harbor-save-v1';

export function writeSave(state) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    return true;
  } catch (e) { return false; }
}
export function readSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return null;
    return data;
  } catch (e) { return null; }
}
export function hasSave() { return readSave() !== null; }
export function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
}
