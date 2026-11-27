import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { seal } from './sceau.mjs';

const [action, ...paths] = process.argv.slice(2);
const readJSON = async path => JSON.parse(await readFile(path, 'utf8'));
const encode = value => JSON.stringify(value, null, 2) + '\n';

async function predict(entries) {
  const { predictLocal } = await import('./predire.mjs');
  return seal(entries.map(predictLocal));
}

if (action === '--predire' && (paths.length === 1 || paths.length === 2)) {
  const result = encode(await predict(await readJSON(paths[0])));
  if (paths.length === 2) await writeFile(paths[1], result, { flag: 'wx' });
  else process.stdout.write(result);
} else if (action === '--comparer' && paths.length === 2) {
  const { compareLocal } = await import('./comparer.mjs');
  const predictions = await readJSON(paths[0]);
  const receipts = await readJSON(paths[1]);
  process.stdout.write(encode(compareLocal(predictions, receipts)));
} else if (action === undefined || (action === '--capturer' && paths.length === 1)) {
  const { compareRuns } = await import('./fixture.mjs');
  const capture = await compareRuns();
  const output = paths[0];
  if (output) await mkdir(output);
  async function save(name, value) {
    if (output) await writeFile(join(output, name), encode(value), { flag: 'wx' });
  }
  await save('avant.json', capture.entries);
  const predictions = await predict(capture.entries);
  await save('predictions.json', predictions);

  const { compareLocal } = await import('./comparer.mjs');
  const { verifyIsolation } = await import('./anti-fuite.mjs');
  const { receipts, calls, work, writes, pulseTick } = capture.native;
  await save('recus.json', receipts);
  verifyIsolation(capture.entries, receipts, predictions);
  const rows = compareLocal(predictions, receipts);
  console.log('Tour | Mode | Route | Sonde | Interaction | Prédit | Natif | Verdict | Famille avant fournisseurs');
  rows.forEach(({ local, native, verdict }, i) => {
    const { mode, routeSupported, eligibleProbe, knownInteraction } = capture.entries[i].event.facts;
    console.log([i + 1, mode, routeSupported, eligibleProbe, knownInteraction, local, native, verdict, 'indéterminé'].join(' | '));
  });
  console.log('Observation active/inactive identique. Appels fournisseurs ' + calls.length +
    ', appels du workflow ' + work.length + ', tickets ' + receipts.length + ', impulsion au pas ' + pulseTick + '.');
  console.log('Écritures cumulées ' + writes.map(w => w.count).join(' → ') + '. SHA-256 final ' + writes.at(-1).digest);
  console.log('Contrôles de fuite, de provenance et de gardes absentes ou fausses réussis.');
} else {
  throw new Error('Usage : sonde-locale [--capturer nouveau-dossier | --predire avant.json [nouveau-fichier] | --comparer predictions.json recus.json]');
}
