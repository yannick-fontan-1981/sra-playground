import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { config, selectReserve, suite, writeSuite } from './generate.mjs';
import { verifyDirectory } from './verify.mjs';
import { keyPage } from './cards.mjs';

const here = dirname(fileURLToPath(import.meta.url));
function temp(t) {
  const dir = mkdtempSync(join(tmpdir(), 'poignee-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}
const text = path => readFileSync(path, 'utf8').replaceAll('\r\n', '\n');

test('sélection préenregistrée, rejouable sans matérialiser les fiches de réserve', () => {
  const { seed, n } = selectReserve();
  assert.equal(n, 1);
  assert.equal(createHash('sha256').update(seed).digest('hex'), '0022ec7f9c0bb6be7844a0f683c4ba980c25379a9bd0af43b79d2095750c85fe');
  assert.ok(config(seed).every((bit, i) => bit !== config('17')[i]));
});

test('36 situations sur les neuf graines de développement, reproduction et égalité exacte des corrigés', t => {
  const dir = temp(t);
  const totals = { cases: 0, worlds: 0, plans: 0, policies: 0, optimal: 0 };
  const ids = new Set();
  for (const seed of ['17', '1', '2', '3', '4', '5', '6', '7', '8']) {
    const corpus = suite(seed);
    assert.deepEqual(suite(seed), corpus);
    const staging = join(dir, seed);
    writeSuite(staging, corpus);
    const result = verifyDirectory(staging);
    for (const key of Object.keys(totals)) totals[key] += result[key];
    for (const c of corpus.cases) ids.add(c.id);
  }
  assert.equal(ids.size, 36);
  assert.deepEqual(totals, { cases: 36, worlds: 54, plans: 342, policies: 144, optimal: 54 });
  const copy = join(dir, 'copie');
  writeSuite(copy, suite('17'));
  for (const sub of ['public', 'corriges']) {
    for (const name of readdirSync(join(copy, sub))) {
      const bytes = readFileSync(join(copy, sub, name));
      assert.deepEqual(bytes, readFileSync(join(dir, '17', sub, name)));
      assert.equal(bytes.toString('utf8'), text(join(here, 'exemple', sub, name)));
    }
  }
});

test('rejet de trois faux corrigés écrits sur disque', t => {
  const dir = temp(t);
  const mutations = {
    clairvoyance(c) {
      for (const [code, plans] of Object.entries(c.key)) c.key[code] = plans.map(p => p.filter(a => !a.startsWith('sonder ')));
    },
    archive(c) {
      const other = Object.keys(c.key).find(code => code !== c.model.archive);
      c.key[other] = structuredClone(c.key[c.model.archive]);
    },
    incomplet(c) {
      const branch = Object.values(c.key).find(plans => plans.length > 1);
      branch.pop();
    },
  };
  for (const [name, mutate] of Object.entries(mutations)) {
    const path = join(dir, name);
    const corpus = suite('17');
    writeSuite(path, corpus);
    const c = corpus.cases[2];
    mutate(c);
    writeFileSync(join(path, 'corriges', 'corpus.json'), JSON.stringify(corpus));
    writeFileSync(join(path, 'corriges', c.id + '.md'), keyPage(c.model, c.key));
    assert.throws(() => verifyDirectory(path), /politiques annoncées différentes des politiques minimales réalisables/);
  }
});

test('interface publique en ligne, 6 épisodes et 2 paires de transcripts indiscernables avant mesure', t => {
  const dir = temp(t);
  function replay(path, ordinal, actions) {
    const run = spawnSync(process.execPath, [join(here, 'play.mjs'), path, '--monde', String(ordinal)],
      { cwd: dir, encoding: 'utf8', input: actions.join('\n') + '\n' });
    assert.equal(run.status, 0, run.stderr);
    const initial = text(path).trimEnd() + '\n';
    const stdout = run.stdout.replaceAll('\r\n', '\n');
    assert.ok(stdout.startsWith(initial));
    return stdout.slice(initial.length).trimEnd().split('\n');
  }
  for (const c of suite('17').cases) {
    const path = join(dir, 'public.md');
    copyFileSync(join(here, 'exemple', 'public', c.id + '.md'), path);
    const responses = [];
    for (const [i, [code, plans]] of Object.entries(c.key).sort().entries()) {
      const plan = plans[0];
      const feedback = replay(path, i + 1, plan);
      assert.equal(feedback.length, plan.length);
      assert.equal(feedback.at(-1), 'succès');
      if (c.model.current === null) {
        const at = plan.indexOf('sonder ' + c.model.source);
        assert.equal(feedback[at], code);
        responses.push(feedback.slice(0, at));
      }
    }
    if (responses.length) assert.deepEqual(responses, c.model.purged ? [[], []] : [['purge terminée'], ['purge terminée']]);
  }
});
