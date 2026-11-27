import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { campaign } from './generate.mjs';
import { verifyCorpus, verifyDirectory } from './verify.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const example = join(here, 'exemple');
const run = (script, args, cwd, input = '') =>
  spawnSync(process.execPath, [join(here, script), ...args], { cwd, encoding: 'utf8', input });
function temp(t) {
  const directory = mkdtempSync(join(tmpdir(), 'situations-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return directory;
}

test('8 fiches livrées, reproduction octet par octet et lecture du corpus sur disque', t => {
  const dir = temp(t);
  const a = join(dir, 'a'), b = join(dir, 'b');
  for (const target of [a, b, b]) {
    const process = run('generate.mjs', ['--seed', '107', '--out', target], dir);
    assert.equal(process.status, 0, process.stderr);
  }
  const expected = { cases: 8, worlds: 12, hidden: 4, winningPlansByWorld: 96, winningPolicies: 48,
    minimalPolicies: 24, edges: { rename: 2, add: 2, rewire: 1, mask: 2 }, maxDepth: 4 };
  for (const target of [a, b, example]) assert.deepEqual(verifyDirectory(target), expected);
  for (const sub of ['public', 'corriges']) {
    for (const name of readdirSync(join(a, sub))) {
      const bytes = readFileSync(join(a, sub, name));
      assert.deepEqual(readFileSync(join(b, sub, name)), bytes);
      assert.equal(readFileSync(join(example, sub, name), 'utf8').replaceAll('\r\n', '\n'), bytes.toString());
    }
  }
  const publicFile = join(b, 'public', readdirSync(join(b, 'public'))[0]);
  writeFileSync(publicFile, readFileSync(publicFile, 'utf8').replace('Une marque est définitive.', 'Une marque est effaçable.'));
  assert.throws(() => verifyDirectory(b), /règles ou des observations non reconnues/);
});

function permutations(items) {
  if (!items.length) return [[]];
  return items.flatMap(item => permutations(items.filter(x => x !== item)).map(rest => [item, ...rest]));
}

test('24 ordres des transformations, 65 cas distincts sur la graine 107 et 120 sur 15 autres graines', () => {
  const cases = new Map();
  const orderings = permutations(['rename', 'add', 'rewire', 'mask']);
  for (const chain of orderings) {
    for (const c of campaign(107, chain).cases) cases.set(c.id, c);
  }
  assert.equal(orderings.length, 24);
  const combined = verifyCorpus({ version: 1, seed: 107, cases: [...cases.values()] });
  assert.equal(combined.cases, 65);
  assert.equal(combined.hidden, 49);
  assert.deepEqual(combined.edges, { rename: 16, add: 16, rewire: 16, mask: 16 });
  const totals = { ...combined.edges, hidden: combined.hidden, worlds: combined.worlds };
  for (const c of campaign(107).cases) assert.deepEqual(c, cases.get(c.id));
  for (let seed = 1; seed <= 15; seed++) {
    const corpus = campaign(seed);
    assert.deepEqual(corpus, campaign(seed));
    const report = verifyCorpus(corpus);
    assert.equal(report.cases, 8);
    assert.equal(report.hidden, 4);
    for (const [kind, count] of Object.entries(report.edges)) totals[kind] += count;
    totals.hidden += report.hidden;
    totals.worlds += report.worlds;
    for (const c of corpus.cases) {
      assert.ok(!cases.has(c.id));
      cases.set(c.id, c);
    }
  }
  assert.equal(cases.size, 185);
  assert.deepEqual(totals, { rename: 46, add: 46, rewire: 31, mask: 46, hidden: 109, worlds: 294 });
});

test('rejet sur disque du corrigé qui agit comme si le cadran était déjà connu', t => {
  const dir = temp(t);
  const target = join(dir, 'lot');
  const generated = run('generate.mjs', ['--seed', '107', '--chain', 'mask', '--out', target], dir);
  assert.equal(generated.status, 0, generated.stderr);
  const file = join(target, 'corriges', 'corpus.json');
  const corpus = JSON.parse(readFileSync(file, 'utf8'));
  corpus.cases[1].key.prefix = [];
  writeFileSync(file, JSON.stringify(corpus));
  const evaluated = run('verify.mjs', [target], dir);
  assert.notEqual(evaluated.status, 0);
  assert.match(evaluated.stderr, /corrigé différent des politiques minimales énumérées/);
});

test('rejet d’une solution manquante, d’une fausse preuve et d’un ancien plan après déplacement', () => {
  const corpus = campaign(107);
  const incomplete = structuredClone(corpus);
  incomplete.cases[0].key.branches[0].plans.pop();
  assert.throws(() => verifyCorpus(incomplete), /corrigé différent/);
  const ungrounded = structuredClone(corpus);
  ungrounded.cases[0].key.branches[0].stamp = 'inconnu';
  assert.throws(() => verifyCorpus(ungrounded), /tampon justifié/);
  const moved = corpus.cases.find(c => c.transformation.kind === 'rewire');
  moved.key = corpus.cases[0].key;
  assert.throws(() => verifyCorpus(corpus), /tampon justifié/);
});

test('rejeu autonome de la même fiche publique dans les deux mondes et engagement erroné', t => {
  const dir = temp(t);
  const c = campaign(107, ['mask']).cases[1];
  const path = join(dir, 'fiche.md');
  copyFileSync(join(example, 'public', c.id + '.md'), path);
  const initial = readFileSync(path, 'utf8').replaceAll('\r\n', '\n').trimEnd();
  const branches = c.key.branches;
  for (const [i, b] of branches.entries()) {
    const args = [path, '--monde', String(i + 1)];
    for (const [branch, result] of [[b, 'succès'], [branches[1 - i], 'échec']]) {
      const replay = run('play.mjs', args, dir, ['lire', ...branch.plans[0]].join('\n') + '\n');
      assert.equal(replay.status, 0, replay.stderr);
      assert.deepEqual(replay.stdout.replaceAll('\r\n', '\n').trimEnd().split(initial + '\n'),
        ['', [b.output, 'marqué', 'marqué', result].join('\n')]);
    }
  }
});
