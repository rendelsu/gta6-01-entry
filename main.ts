// SOLMAR — Vice Harbor: the entry program. It copies game/ and screenshots/
// from this repository to the output directory and writes dossier.json with
// buildDossier from the kit's vendored library. Node 22 standard library only.

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = resolve(import.meta.dirname);
const outDir = resolve(process.env.MAKEFUN_OUTPUT_DIR || '/output');

function copyTree(src: string, dest: string): void {
  mkdirSync(dest, { recursive: true });
  cpSync(src, dest, { recursive: true, dereference: false });
}

function main(): void {
  const gameSrc = join(repoRoot, 'game');
  const shotsSrc = join(repoRoot, 'screenshots');
  if (!existsSync(gameSrc)) throw new Error('game/: no such directory in this repository');
  if (!existsSync(shotsSrc)) throw new Error('screenshots/: no such directory in this repository');

  // The output directory is rebuilt from scratch every run, so two runs of
  // this program over the same repository write byte-identical output.
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  copyTree(gameSrc, join(outDir, 'game'));
  copyTree(shotsSrc, join(outDir, 'screenshots'));

  const dossier = buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
  });
  writeFileSync(join(outDir, 'dossier.json'), dossier);
  console.log(`SOLMAR — Vice Harbor: wrote ${outDir} (dossier ${dossier.length} bytes)`);
}

main();
