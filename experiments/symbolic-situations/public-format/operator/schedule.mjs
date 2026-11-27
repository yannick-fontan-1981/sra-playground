import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { exportCard, serialize } from '../export.mjs';
import { parseCard as parseDial } from '../../cards.mjs';
import * as dial from '../../enumerate.mjs';
import { parseCard as parseResource } from '../../ressource/cards.mjs';
import * as resource from '../../ressource/world.mjs';

export const formatDir = dirname(dirname(fileURLToPath(import.meta.url)));
const engines = {
  dial: { parse: parseDial, worlds: dial.completions, dynamics: dial },
  resource: { parse: parseResource, worlds: resource.worlds, dynamics: resource },
};

export function makeCase(family, id, text) {
  const engine = engines[family];
  const message = JSON.parse(serialize(exportCard(text)));
  return { family, id, message, worlds: engine.worlds(engine.parse(text)), dynamics: engine.dynamics };
}

export function development() {
  const rows = [];
  for (const [family, dir] of [['dial', '../exemple/public'], ['resource', '../ressource/exemple/public']]) {
    const folder = join(formatDir, dir);
    for (const name of readdirSync(folder).sort()) {
      rows.push(makeCase(family, name.slice(0, -3), readFileSync(join(folder, name), 'utf8')));
    }
  }
  return rows;
}

export function exampleFile({ family, id }) {
  const first = family === 'dial' ? '9fd1072013fd810d513c' : '345436640366130fd8c3';
  return family + (id === first ? '' : '-' + id) + '.json';
}
