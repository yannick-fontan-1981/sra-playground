import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { parseCard as parseDial } from '../../cards.mjs';
import * as dial from '../../enumerate.mjs';
import { episode } from './operer.mjs';
import { bundle } from './solveur.mjs';

const here = dirname(fileURLToPath(import.meta.url));

test('même transport et mêmes blobs du gel, deux réussites sur le cadran public de référence', async () => {
  const page = readFileSync(join(here, '../../exemple/public/9fd1072013fd810d513c.md'), 'utf8').replaceAll('\r\n', '\n');
  for (const world of dial.completions(parseDial(page))) {
    const r = await episode(bundle(), page.trimEnd(), world, dial);
    assert.equal(r.statut, 'succes', JSON.stringify(r));
    assert.equal(r.premierEcart, null);
    assert.equal(r.tours.length, 4);
    assert.equal(r.tours[0].action, 'lire');
    assert.equal(r.tours[0].retour, world.dial);
    assert.equal(r.tours.at(-1).retour, 'succès');
  }
});

test('solveur alternatif, lecture privée interdite, messages publics et état neuf sur six départs', async t => {
  const dir = mkdtempSync(join(tmpdir(), 'temoin-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  cpSync(join(here, '../exemple/public'), join(dir, 'public'), { recursive: true });
  mkdirSync(join(dir, 'corriges'));
  const secret = join(dir, 'corriges', 'corpus.json');
  writeFileSync(secret, 'valeur réservée au processus opérateur');
  process.env.SRA_TEST_PRIVATE = 'variable réservée';
  t.after(() => { delete process.env.SRA_TEST_PRIVATE; });
  const entry = join(dir, 'temoin.mjs');
  writeFileSync(entry, `
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
assert.throws(() => readFileSync(${JSON.stringify(secret)}), { code: 'ERR_ACCESS_DENIED' });
assert.throws(() => writeFileSync('memo', 'état persistant'), { code: 'ERR_ACCESS_DENIED' });
assert.deepEqual(readdirSync('.'), ['solveur.mjs']);
assert.equal(process.env.SRA_TEST_PRIVATE, undefined);
assert.equal(process.argv.length, 2);
assert.equal(process.permission.has('child'), false);
assert.equal(process.permission.has('worker'), false);
let page, count = 0;
for await (const line of createInterface({input: process.stdin})) {
  const input = JSON.parse(line);
  assert.deepEqual(Object.keys(input), [count ? 'retour' : 'fiche']);
  if (!count++) {
    page = input.fiche;
    assert.ok(page.startsWith('# Situation'));
    assert.ok(!/corriges|valeur réservée|--monde|graine/i.test(page));
    console.log(JSON.stringify({action: 'commande témoin'}));
  } else if (count === 2) {
    assert.equal(input.retour, 'Action indisponible.');
    const command = /sceller (\\w+)/.exec(page)[0];
    console.log(JSON.stringify({action: command}));
  } else {
    assert.equal(input.retour, 'échec');
    break;
  }
}`);
  const report = JSON.parse(execFileSync(process.execPath, [join(here, 'operer.mjs'), '--lot', dir, '--solveur', entry],
    { encoding: 'utf8', windowsHide: true }));
  assert.deepEqual(report.totaux, { departs: 6, formatsIncompatibles: 0, succes: 0, echecsAction: 6,
    autresArrets: 0, commandesProposees: 12, commandesExecutees: 6, commandesRefusees: 6 });
  const views = new Map();
  for (const run of report.departs) {
    assert.deepEqual(run.premierEcart, { tour: 1, etape: 'commande_refusee', detail: 'commande témoin' });
    const expected = readFileSync(join(dir, 'public', run.fiche), 'utf8').replaceAll('\r\n', '\n').trimEnd();
    assert.ok(expected.includes(run.tours[1].action));
    if (views.has(run.fiche)) assert.equal(run.sha256Entree, views.get(run.fiche));
    views.set(run.fiche, run.sha256Entree);
  }
  assert.equal(views.size, 4);
});

test('arrêt du solveur et message illisible conservés comme erreurs distinctes du jeu', async () => {
  for (const [reply, status] of [['{"arret":"aucune décision"}', 'arret_solveur'], ['message illisible', 'erreur_solveur']]) {
    const files = new Map([['solveur.mjs', Buffer.from("process.stdin.once('data', () => console.log(" + JSON.stringify(reply) + '));')]]);
    const r = await episode(files, 'fiche témoin', {}, { initialState: () => ({}) });
    assert.equal(r.statut, status);
    assert.equal(r.tours.length, 0);
  }
});
