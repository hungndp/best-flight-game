// AZURE REACH — entrypoint (Node 22, standard library only).
// Hands the game in: copies game/ and screenshots/ from beside this file
// to /output and writes /output/dossier.json with the vendored make.fun
// library. Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// The program runs twice and both runs must write the same bytes, so it
// does nothing time- or randomness-dependent: a plain copy plus the
// deterministic dossier build.

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The grader runs this as uid 65534 on a read-only filesystem with only
// /output writable — and its parent NOT writable. So the output directory
// itself is never removed; only its contents are cleared, then written.
function clearOutputContents(dir) {
  mkdirSync(dir, { recursive: true });
  for (const entry of readdirSync(dir)) {
    rmSync(join(dir, entry), { recursive: true, force: true });
  }
}

function copyTree(source, target) {
  if (!existsSync(source)) return;
  cpSync(source, target, { recursive: true });
}

// The dossier caps are the scorer's own limits (reference/gate.json):
// only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse — more than 4 screenshots or one over 256 KiB, more
// than 993 files in game/ or 48 MiB of game files in all, or a path under
// game/ over 1000 bytes (game/ counts beside /output's own 1000-entry cap,
// its screenshots/ and dossier.json).
const DOSSIER_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

function writeDossier(dir) {
  writeFileSync(join(dir, 'dossier.json'), buildDossier(dir, DOSSIER_CAPS));
}

clearOutputContents(out);
copyTree(join(here, 'game'), join(out, 'game'));
copyTree(join(here, 'screenshots'), join(out, 'screenshots'));
writeDossier(out);
