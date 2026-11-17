// SOLMAR — Vice Harbor: entry program for make.fun's gta6-01 bounty.
// The game itself is plain static files under game/ (game/index.html plus
// its ES modules), with 3-4 screenshots under screenshots/. This program
// hands the entry in: it copies both folders to the output directory the
// platform provides and writes /output/dossier.json with the vendored
// make.fun library, exactly as the kit's starter did. Run it locally with:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// (Node 22, standard library only; nothing is installed or downloaded.)

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes
// the bytes; the others refuse an entry the scorer would refuse (more than
// 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB
// of game files, in all, or a path under game/ over 1000 bytes: game/ counts
// beside /output's own 1000-entry cap, its screenshots/ and dossier.json).
const dossier = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(out, 'dossier.json'), dossier);

// A short local summary, so a human running this sees what was handed in.
const shotCount = existsSync(join(out, 'screenshots'))
  ? readdirSync(join(out, 'screenshots')).filter((f) => !f.startsWith('.')).length
  : 0;
console.log(`SOLMAR handed in: dossier ${dossier.length} bytes, ${shotCount} screenshots, index.html ${statSync(join(out, 'game', 'index.html')).size} bytes`);
