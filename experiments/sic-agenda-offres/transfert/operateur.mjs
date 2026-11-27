import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { PartiePublique } from './fiche-publique.mjs';

// L'opérateur possède le chemin de la fiche et le sélecteur de monde de play.mjs.
const [transferRoot, ...options] = process.argv.slice(2);
if (!transferRoot) throw new Error('Usage : node operateur.mjs CHEMIN_DU_CHECKOUT_TRANSFERT [--trace]');
const folder = resolve(transferRoot, 'experiments/symbolic-situations');
const name = '9fd1072013fd810d513c.md';
let path = resolve(folder, 'generated/107/public', name);
const publicText = await readFile(path, 'utf8').catch(error => {
  if (error.code !== 'ENOENT') throw error;
  path = resolve(folder, 'exemple/public', name);
  return readFile(path, 'utf8');
});
const card = publicText.trimEnd().split(/\r?\n/);

async function play(world) {
  const child = spawn(process.execPath, [resolve(folder, 'play.mjs'), path, '--monde', String(world)],
    { stdio: ['pipe', 'pipe', 'inherit'], windowsHide: true });
  const closed = new Promise((ok, fail) => {
    child.once('error', fail);
    child.once('close', ok);
  });
  const lines = createInterface({ input: child.stdout, crlfDelay: Infinity })[Symbol.asyncIterator]();
  const turns = [];
  try {
    const initial = [];
    for (const expected of card) {
      const { value, done } = await lines.next();
      assert.ok(!done && value === expected, 'Fiche initiale du jeu');
      initial.push(value);
    }
    const agent = new PartiePublique(initial.join('\n'));
    while (turns.length < 6) {
      const { decision, action } = agent.next();
      if (!action) throw new Error('Première étape sans action publique : ' + JSON.stringify(decision));
      child.stdin.write(action + '\n');
      const { value: feedback, done } = await lines.next();
      assert.ok(!done, 'Retour attendu pour ' + action);
      const ref = agent.record(action, feedback);
      turns.push({ action, decision, ref, feedback });
      if (action === 'valider') break;
    }
    child.stdin.end();
    assert.equal(await closed, 0);
    return turns;
  } finally {
    if (child.exitCode === null) child.kill();
  }
}

const results = [];
for (const world of [1, 2]) results.push(await play(world));
assert.deepEqual(results[0][0].decision, results[1][0].decision);
for (const [i, turns] of results.entries()) {
  assert.equal(turns.length, 4);
  const [read, first, second, end] = turns;
  assert.equal(read.action, 'lire');
  assert.equal(read.decision.decision, 'ouvrir_preuve');
  assert.equal(read.decision.proof, 'cadranSurPremiereSortie');
  assert.ok(first.decision.returns.some(ret => ret.fact === read.decision.proof && ret.evidence.includes(read.ref)));
  const [exit] = first.decision.branch.split('/');
  assert.equal(read.feedback, exit);
  const answer = first.decision.returns.find(r => r.branch === read.decision.branch);
  assert.equal(answer.result, first.decision.branch === read.decision.branch ? 'confirmee' : 'contraire');
  assert.deepEqual(answer.evidence, [read.ref]);
  assert.equal(first.decision.decision, 'selectionner');
  assert.ok(second.decision.branch.startsWith(exit + '/'));
  assert.ok(first.decision.evidence.includes(read.ref));
  assert.equal(first.action.split(' ')[2], second.action.split(' ')[2]);
  assert.notEqual(first.action.split(' ')[1], second.action.split(' ')[1]);
  assert.equal(end.action, 'valider');
  assert.equal(end.decision.decision, 'selectionner');
  assert.equal(end.feedback, 'succès');
  console.log('Monde ' + (i + 1));
  for (const { action, decision, ref, feedback } of turns) {
    console.log([decision.decision, decision.branch, action, ref, feedback].join(' | '));
  }
}
assert.notEqual(results[0][1].decision.branch, results[1][1].decision.branch);
if (options.includes('--trace')) console.log(JSON.stringify(results, null, 2));
