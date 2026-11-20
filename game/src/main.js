// SOLMAR — Vice Harbor (r6): bootstrap. Builds the Game, exposes it for
// playtesting, and applies the deterministic ?shot= scene presets the
// screenshots are taken from.
import { Game } from './game.js';

const canvas = document.getElementById('game');
const game = new Game(canvas);

// Playtesting hook: window.SOLMAR is the live game (state, player, cars).
window.SOLMAR = game;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
if (shot) {
  // Give the first frame a chance to render, then stage the scene.
  requestAnimationFrame(() => {
    game.applyShot(shot);
    window.__shotReady = true;
  });
}
