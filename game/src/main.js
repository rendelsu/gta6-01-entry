// Entry point for SOLMAR — Vice Harbor: boots the game on the page canvas.
import { boot } from './game.js';

const state = boot();
window.__SOLMAR_STATE__ = state;
