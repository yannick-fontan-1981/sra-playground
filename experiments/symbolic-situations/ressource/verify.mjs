import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseCard, keyPage } from './cards.mjs';
import { evaluate, initialState, step } from './world.mjs';

const enc = policy => JSON.stringify(Object.keys(policy).sort().map(code => [code, policy[code]]));
const read = path => readFileSync(path, 'utf8').replaceAll('\r\n', '\n');

export function verifyCase(m, key) {
  const r = evaluate(m);
  const codes = r.worlds.map(w => w.code);
  assert.deepEqual(Object.keys(key).sort(), codes, 'ensemble des mondes du corrigé');
  let claimed = [{}];
  for (const code of codes) {
    claimed = claimed.flatMap(p => key[code].map(plan => ({ ...p, [code]: plan })));
  }
  assert.deepEqual(new Set(claimed.map(enc)), new Set(r.optimal.map(enc)), 'politiques annoncées différentes des politiques minimales réalisables');

  const probe = 'sonder ' + m.source, purge = 'purger ' + m.source;
  const remove = 'retirer ' + m.source, lock = 'bloquer ' + m.source;
  const index = 'indexer ' + m.receiver, seal = 'sceller ' + m.receiver;
  assert.equal(r.minimum, 3 + Number(!m.purged) + Number(m.current === null) + Number(m.indexed));
  for (const policy of r.optimal) {
    for (const [code, plan] of Object.entries(policy)) {
      const physical = code === m.drop ? lock : remove;
      if (m.current !== null) assert.equal(plan[0], physical, 'agir est déjà justifié');
      else assert.deepEqual(plan.slice(0, m.purged ? 2 : 3), m.purged ? [probe, physical] : [purge, probe, physical]);
    }
  }
  for (const world of r.worlds) {
    const code = world.code;
    for (const plan of r.perWorld[code]) {
      const removed = plan.indexOf(remove), locked = plan.indexOf(lock);
      assert.ok(removed >= 0 && locked >= 0);
      assert.equal(locked < removed, code === m.drop, 'ordre des deux opérations irréversibles');
      assert.equal(plan.at(-1), seal);
      if (m.indexed) assert.ok(plan.indexOf(index) > removed && plan.indexOf(index) < plan.length - 1);
      if (!m.purged) assert.ok(plan.indexOf(purge) >= 0 && plan.indexOf(purge) < removed);
    }
    let state = initialState(world);
    assert.equal(step(world, state, seal).feedback, 'échec');
    if (!m.purged) {
      assert.equal(step(world, state, remove).feedback, 'clapet fermé');
      state = step(world, state, purge).next;
    }
    const observed = step(world, state, probe);
    assert.equal(observed.feedback, code);
    const archiveChoice = m.archive === m.drop ? lock : remove;
    const archiveResult = step(world, observed.next, archiveChoice);
    assert.equal(archiveResult.next !== null, code === m.archive, 'conséquence du choix suggéré par l’archive');
  }
  if (m.current === null) {
    assert.equal(codes.length, 2);
    const fixed = new Set(r.perWorld[codes[0]].map(p => JSON.stringify(p)));
    assert.ok(r.perWorld[codes[1]].every(p => !fixed.has(JSON.stringify(p))), 'un ordre fixe fonctionne dans les deux mondes');
    const prefix = m.purged ? [probe] : [purge, probe];
    for (const policy of r.policies) {
      for (const plan of Object.values(policy)) assert.deepEqual(plan.slice(0, prefix.length), prefix);
    }
  }
  return { worlds: codes.length, plans: Object.values(r.perWorld).flat().length, policies: r.policies.length,
    optimal: r.optimal.length, minimum: r.minimum };
}

export function verifyDirectory(dir) {
  const corpus = JSON.parse(read(join(dir, 'corriges', 'corpus.json')));
  assert.equal(corpus.version, 1);
  assert.equal(corpus.cases.length, 4);
  const ids = corpus.cases.map(c => c.id);
  assert.equal(new Set(ids).size, 4);
  assert.ok(ids.every(id => /^[a-f0-9]{20}$/.test(id)));
  for (const sub of ['public', 'corriges']) {
    const names = ids.map(id => id + '.md');
    if (sub === 'corriges') names.push('corpus.json');
    assert.deepEqual(readdirSync(join(dir, sub)).sort(), names.sort());
  }
  const rows = [];
  const models = [];
  for (const c of corpus.cases) {
    const model = parseCard(read(join(dir, 'public', c.id + '.md')));
    assert.deepEqual(c.model, model);
    const result = verifyCase(model, c.key);
    assert.equal(read(join(dir, 'corriges', c.id + '.md')), keyPage(model, c.key));
    models.push(model);
    rows.push({ id: c.id, ...result });
  }
  const first = models[0];
  const codes = [first.drop, first.jam].sort();
  for (const [i, [purged, current]] of [[true, codes[0]], [true, codes[1]], [true, null], [false, null]].entries()) {
    assert.deepEqual(models[i], { ...first, purged, current }, 'comparaison sur le même montage');
  }
  const total = field => rows.reduce((sum, row) => sum + row[field], 0);
  return { cases: rows.length, worlds: total('worlds'), plans: total('plans'), policies: total('policies'), optimal: total('optimal'), rows };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const dir = process.argv[2] ?? join(dirname(fileURLToPath(import.meta.url)), 'generated', '17');
  console.log(JSON.stringify(verifyDirectory(dir), null, 2));
}
