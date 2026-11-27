import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export function writeFiles(directory, files) {
  if (existsSync(directory)) {
    // Allow an identical rerun, including a checked-out example with native newlines.
    for (const sub of ['public', 'corriges']) {
      const folder = join(directory, sub);
      const expected = [...files.keys()].filter(file => file.startsWith(sub + '/')).length;
      if (!existsSync(folder) || readdirSync(folder).length !== expected) {
        throw new Error('Inventaire différent dans ' + folder + '. Choisir un nouveau --out.');
      }
    }
    for (const [file, data] of files) {
      const path = join(directory, file);
      if (!existsSync(path) || readFileSync(path, 'utf8').replaceAll('\r\n', '\n') !== data) {
        throw new Error('Le dossier contient un autre jeu de fiches. Choisir un nouveau --out.');
      }
    }
    return;
  }
  mkdirSync(dirname(directory), { recursive: true });
  const staging = mkdtempSync(directory + '.');
  try {
    for (const [file, data] of files) {
      const target = join(staging, file);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, data, 'utf8');
    }
    renameSync(staging, directory);
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }
}
