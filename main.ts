// SOLMAR — Vice Harbor: entry program for make.fun gta6-01 (Node 22, stdlib only).
// It hands the game in: copies game/ and screenshots/ from beside this file to
// /output (or MAKEFUN_OUTPUT_DIR outside the grader) and writes dossier.json
// with the vendored make.fun library, exactly as the kit's starter does.
// The game itself is plain static files under game/ with no build step.
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Fail loudly instead of handing in an empty game if the build is broken.
if (!existsSync(join(here, 'game', 'index.html'))) {
  throw new Error('game/index.html missing — refusing to hand in an empty game');
}
if (!existsSync(join(here, 'screenshots'))) {
  throw new Error('screenshots/ missing — the judge needs screenshots of the game');
}

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The scorer's own caps (from the kit's gate): only text_max_bytes shapes the
// dossier bytes; the others refuse an entry the scorer would refuse — more than
// 4 screenshots or one over 256 KiB, more than 993 files in game/ or 48 MiB of
// game files in all, or a path under game/ over 1000 bytes. game/ counts beside
// /output's own 1000-entry cap, its screenshots/ and dossier.json.
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
