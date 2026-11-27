import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { measure } from './measure.mjs';
import { consumer } from './frozen.mjs';
import { derive } from './reserved.mjs';
import { development, exampleFile, formatDir } from './schedule.mjs';
import { serialize } from '../export.mjs';

const op = join(formatDir, 'operator/run.mjs');
function scratch(t) {
  const dir = mkdtempSync(join(tmpdir(), 'transport-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}
function stub(source) {
  return { files: new Map([['solveur.mjs', Buffer.from(source)]]), program: 'solveur.mjs' };
}

const cases = development();
test('chaque entrée publiée est exactement la fiche transmise, 12 fiches et 18 départs', () => {
  assert.equal(cases.length, 12);
  assert.equal(cases.flatMap(c => c.worlds).length, 18);
  for (const c of cases) {
    assert.equal(readFileSync(join(formatDir, 'examples', exampleFile(c)), 'utf8').replaceAll('\r\n', '\n'), serialize(c.message));
  }
});

test('un témoin local reçoit uniquement le dialogue public sur les 18 départs ; les six paires divergent à la lecture', async t => {
  const dir = scratch(t);
  const secret = join(dir, 'prive.txt');
  writeFileSync(secret, 'témoin privé');
  const solver = join(dir, 'entree.mjs');
  writeFileSync(solver, `
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {createInterface} from 'node:readline';
assert.throws(() => readFileSync(` + JSON.stringify(secret) + `), {code:'ERR_ACCESS_DENIED'});
assert.deepEqual(readdirSync('.'), ['solveur.mjs']);
assert.equal(process.argv.length, 2);
let m, stage;
for await (const line of createInterface({input:process.stdin})) {
  const msg = JSON.parse(line);
  assert.deepEqual(Object.keys(msg), [m ? 'retour' : 'fiche']);
  if (!m) {
    m = msg.fiche;
    assert.equal(m.format, 'sra.public/1');
    assert.deepEqual(Object.keys(m).sort(), ['commands','domains','format','goal','observations','rules','sources']);
    stage = 'refus';
    console.log(JSON.stringify({action:'requête indisponible'}));
  } else if (stage === 'refus' && m.observations.some(o => o.ref[0] === 'purged' && o.value === false)) {
    assert.equal(msg.retour, 'Action indisponible.');
    stage = 'purge';
    console.log(JSON.stringify({action:m.commands.find(c => c.command[0] === 'purger').command.join(' ')}));
  } else if (stage !== 'lecture') {
    assert.equal(msg.retour, stage === 'purge' ? 'purge terminée' : 'Action indisponible.');
    stage = 'lecture';
    console.log(JSON.stringify({action:m.rules.find(r => r.effect?.reveal).command.join(' ')}));
  } else {
    assert.ok(m.domains[0].values.includes(msg.retour));
    console.log(JSON.stringify({arret:'relevé reçu'}));
    break;
  }
}`);
  const path = join(dir, 'rapport.json');
  execFileSync(process.execPath, [op, '--solveur', solver, '--rapport', path], { windowsHide: true, stdio: 'pipe' });
  const report = JSON.parse(readFileSync(path));
  assert.deepEqual(report.bilan.admission, { admises: 18, incompatibles: 0, indeterminees: 0 });
  assert.deepEqual(report.bilan.actions, { proposees: 38, executees: 20, refusees: 18 });
  assert.deepEqual(report.bilan.lectures, { demandes: 18, retours: 18, nouvellesValeurs: 12, avecReponse: 18, suiviesDuneCommande: 0 });
  assert.equal(report.bilan.issues.abandons, 18);
  assert.equal(report.paires.length, 6);
  for (const pair of report.paires) {
    assert.equal(pair.fin, 'premier_retour_distinct');
    assert.ok(['lire','sonder'].includes(pair.action.split(' ')[0]));
    assert.ok(pair.communs >= 1);
  }
  for (const r of report.departs) assert.equal(r.premierEcart.etape, 'commande_refusee');
});

test('le solveur atteste les octets réellement reçus avant chaque première observation discriminante', async () => {
  const solver = stub(`
import {createHash} from 'node:crypto';
import {createInterface} from 'node:readline';
const hash = createHash('sha256');
let queue;
for await (const line of createInterface({input:process.stdin})) {
  if (queue && !queue.length) {
    console.log(JSON.stringify({arret:hash.digest('hex')}));
    break;
  }
  hash.update(line+'\\n');
  const {fiche} = JSON.parse(line);
  if (fiche) {
    queue = [fiche.rules.find(r => r.effect?.reveal).command];
    if (fiche.observations.some(o => o.ref[0] === 'purged' && !o.value))
      queue.unshift(fiche.commands.find(c => c.command[0] === 'purger').command);
  }
  console.log(JSON.stringify({action:queue.shift().join(' ')}));
}`);
  const ambiguous = cases.filter(c => c.worlds.length === 2);
  const report = await measure(ambiguous, solver);
  for (const c of ambiguous) {
    const pair = report.departs.filter(r => r.fiche === c.id);
    const example = JSON.parse(readFileSync(join(formatDir, 'examples', exampleFile(c)), 'utf8'));
    const prefix = [JSON.stringify({fiche:example}), ...pair[0].tours.slice(0,-1).map(t => JSON.stringify({retour:t.retour}))];
    const expected = createHash('sha256').update(prefix.join('\n') + '\n').digest('hex');
    assert.equal(pair[0].premierEcart.detail, expected);
    assert.equal(pair[1].premierEcart.detail, expected);
    assert.notEqual(pair[0].tours.at(-1).retour, pair[1].tours.at(-1).retour);
  }
});

test('deux scripts de développement aboutissent dans les deux mondes de leurs seules fiches', async () => {
  const examples = cases.filter(c => ['dial.json','resource.json'].includes(exampleFile(c)));
  // Fixed public test transcripts. The only branch input is the actual returned code.
  const actions = {
    valider: ['lire'],
    sceller: ['purger J4cdc9a', 'sonder J4cdc9a'],
    X4c94cf: ['marquer X022d46 X03a3e1', 'marquer Xfc26f3 X03a3e1', 'valider'],
    X6e9ba2: ['marquer X022d46 Xa16dcd', 'marquer Xfc26f3 Xa16dcd', 'valider'],
    Jbbd6ad: ['bloquer J4cdc9a', 'retirer J4cdc9a', 'indexer J679fb3', 'sceller J679fb3'],
    Jbc2cd1: ['retirer J4cdc9a', 'bloquer J4cdc9a', 'indexer J679fb3', 'sceller J679fb3'],
  };
  const solver = stub(`
import {createInterface} from 'node:readline';
const scripts = ` + JSON.stringify(actions) + `;
let q;
for await (const line of createInterface({input:process.stdin})) {
  const m = JSON.parse(line);
  if (m.fiche) q = scripts[m.fiche.goal.command[0]];
  else if (m.retour === 'succès') break;
  else if (scripts[m.retour]) q = scripts[m.retour];
  console.log(JSON.stringify({action:q.shift()}));
}`);
  const r = await measure(examples, solver);
  assert.equal(r.bilan.issues.succes, 4);
  assert.deepEqual(r.bilan.actions, { proposees: 20, executees: 20, refusees: 0 });
  assert.deepEqual(r.bilan.lectures, { demandes: 4, retours: 4, nouvellesValeurs: 4, avecReponse: 4, suiviesDuneCommande: 4 });
  assert.deepEqual(r.paires.map(p => p.communs), [0,1]);
  for (const run of r.departs) assert.equal(run.tours.at(-1).retour, 'succès');
});

test('incompatibilité, message illisible, abandon et défaite restent des événements distincts', async () => {
  const one = cases.find(c => c.family === 'dial' && c.worlds.length === 1);
  for (const [line, admission, status] of [
    ['{"incompatible":"format"}','incompatible','format_incompatible'],
    ['{"action":[]}','indeterminee','erreur_solveur'],
    ['{"arret":"arrêt volontaire"}','admise','arret_solveur'],
    ['{"action":"valider"}','admise','echec_action'],
  ]) {
    const solver = stub("process.stdin.once('data', () => console.log(" + JSON.stringify(line) + "));");
    const { departs: [r] } = await measure([one], solver);
    assert.equal(r.admission, admission);
    assert.equal(r.statut, status);
  }
});

test('le SHA fixe le point d’entrée et les imports relatifs malgré un checkout modifié ; la réserve exige un gel', async t => {
  const dir = scratch(t);
  const git = args => execFileSync('git', ['-C', dir, ...args], {encoding:'utf8',windowsHide:true}).trim();
  git(['init', '--quiet']);
  mkdirSync(join(dir, 'src'));
  writeFileSync(join(dir, 'src/main.mjs'), "import {stop} from './dep.mjs'; process.stdin.once('data', () => console.log(JSON.stringify({arret:stop})));");
  writeFileSync(join(dir, 'src/dep.mjs'), "export const stop='gel contrôlé';");
  git(['add', 'src']);
  git(['-c','user.name=Test','-c','user.email=test@example.invalid','commit','--quiet','-m','test fixture']);
  const sha = git(['rev-parse','HEAD']);
  writeFileSync(join(dir,'src/dep.mjs'), "throw Error('copie modifiée');");
  const solver = consumer({sha, depot:dir, entree:'src/main.mjs', dep:['src/dep.mjs']});
  assert.equal(solver.sha, sha);
  assert.equal(Object.keys(solver.hashes).length, 2);
  const result = await measure([cases.find(c => c.worlds.length === 1)], solver);
  assert.equal(result.departs[0].premierEcart.detail, 'gel contrôlé');
  assert.throws(() => consumer({sha, depot:dir, entree:'../private'}), /Chemin relatif/);
  const run = spawnSync(process.execPath, [op,'--partition','reserve','--solveur',join(dir,'src/main.mjs')], {encoding:'utf8'});
  assert.notEqual(run.status, 0);
  assert.match(run.stderr, /commit consommateur figé/);
  const seeds = derive(Buffer.alloc(32, 7));
  assert.deepEqual(derive(Buffer.alloc(32, 7)), seeds);
  assert.ok(seeds.dialSeed > 107);
  assert.match(seeds.resourceSeed, /^public1-[a-f0-9]{32}$/);
});
