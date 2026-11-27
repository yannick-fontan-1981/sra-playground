import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { answerCard, parseCard } from './cards.mjs';
import { enumerate, initialState, initialView, step } from './enumerate.mjs';

const sorted = xs => [...xs].sort();
const identifiers = m => [...m.stamps, ...m.cells, ...Object.keys(m.wiring)];
const read = path => readFileSync(path, 'utf8').replaceAll('\r\n', '\n');

function checkModel(model) {
  const names = identifiers(model);
  assert.ok(names.every(x => /^X[0-9a-f]{6}$/.test(x)), 'nom non opaque');
  assert.equal(new Set(names).size, names.length);
  assert.equal(model.cells.length, 2);
  assert.ok(model.stamps.length >= 3);
  assert.equal(Object.keys(model.wiring).length, 2);
  assert.equal(new Set(Object.values(model.wiring)).size, 2);
  assert.ok(Object.values(model.wiring).every(x => model.stamps.includes(x)));
  assert.ok(model.seen === null || Object.hasOwn(model.wiring, model.seen));
}

const policyCode = policy => JSON.stringify(sorted(Object.keys(policy)).map(out => [out, policy[out]]));
const policySet = policies => new Set(policies.map(policyCode));
const planSet = plans => new Set(plans.map(plan => JSON.stringify(plan)));

function checkKey(model, key, result) {
  const outcomes = result.worlds.map(w => w.dial);
  assert.deepEqual(sorted(key.branches.map(b => b.output)), sorted(outcomes), 'mondes du corrigé');
  for (const { output, stamp } of key.branches) {
    const used = result.perWorld[output].flatMap(plan => plan.filter(a => a.startsWith('marquer ')).map(a => a.split(' ')[2]));
    assert.deepEqual(new Set(used), new Set([stamp]), 'tampon justifié par les plans réalisables');
  }
  // Each listed suffix is a free choice for its own observation.
  let claimed = [{}];
  for (const { output, plans } of key.branches) {
    claimed = claimed.flatMap(policy => plans.map(plan => ({ ...policy, [output]: [...key.prefix, ...plan] })));
  }
  assert.deepEqual(policySet(claimed), policySet(result.optimal), 'corrigé différent des politiques minimales énumérées');
  assert.deepEqual(key.prefix, model.seen === null ? ['lire'] : [], 'préfixe associé aux preuves disponibles');
  if (model.seen === null) {
    const [a, b] = result.worlds;
    assert.deepEqual(initialView(a), initialView(b), 'observations initiales différentes');
    assert.notEqual(step(a, initialState(), 'lire').feedback, step(b, initialState(), 'lire').feedback);
    assert.deepEqual(new Set(result.policies.flatMap(p => Object.values(p).map(plan => plan[0]))), new Set(['lire']),
      'une autre première action garantit le but');
    const fixed = planSet(result.perWorld[a.dial]);
    assert.ok(result.perWorld[b.dial].every(plan => !fixed.has(JSON.stringify(plan))), 'un plan fixe réussit dans les deux mondes');
  }
}

function relabel(value, map) {
  if (Array.isArray(value)) return value.map(item => relabel(item, map));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [map[k] ?? k, relabel(v, map)]));
  }
  if (typeof value === 'string') return value.split(' ').map(k => map[k] ?? k).join(' ');
  return value;
}

function edge(parent, child, before, after) {
  let expected = structuredClone(parent.model);
  const t = child.transformation;
  switch (t.kind) {
    case 'rename': {
      assert.deepEqual(sorted(Object.keys(t.map)), sorted(identifiers(expected)));
      assert.deepEqual(sorted(Object.values(t.map)), sorted(identifiers(child.model)));
      assert.ok(Object.entries(t.map).every(([old, fresh]) => old !== fresh));
      expected = relabel(expected, t.map);
      const translated = relabel(before.perWorld, t.map);
      for (const [out, plans] of Object.entries(translated)) {
        assert.deepEqual(planSet(plans), planSet(after.perWorld[out]), 'bijection des plans valides');
      }
      assert.deepEqual(policySet(relabel(before.policies, t.map)), policySet(after.policies), 'bijection des politiques');
      break;
    }
    case 'add': {
      assert.ok(!identifiers(expected).includes(t.stamp));
      expected.stamps.push(t.stamp);
      for (const [out, plans] of Object.entries(before.perWorld)) {
        const shortest = rows => rows.filter(p => p.length === Math.min(...rows.map(row => row.length)));
        assert.deepEqual(planSet(shortest(plans)), planSet(shortest(after.perWorld[out])), 'plans minimaux par monde');
      }
      assert.deepEqual(policySet(before.optimal), policySet(after.optimal), 'politiques minimales avec objet supplémentaire');
      break;
    }
    case 'rewire': {
      assert.equal(expected.wiring[t.output], t.from);
      assert.ok(expected.stamps.includes(t.to) && !Object.values(expected.wiring).includes(t.to));
      expected.wiring[t.output] = t.to;
      const old = planSet(before.perWorld[t.output]);
      const current = planSet(after.perWorld[t.output]);
      assert.ok(old.size && current.size && [...old].every(p => !current.has(p)), 'anciens plans encore utilisables');
      assert.ok(after.perWorld[t.output].every(plan => plan.some(a => a.endsWith(' ' + t.to))), 'nouveau prérequis absent');
      break;
    }
    case 'mask':
      assert.notEqual(expected.seen, null);
      assert.equal(after.worlds.length, 2);
      assert.deepEqual(planSet(before.perWorld[expected.seen]), planSet(after.perWorld[expected.seen]),
        'le monde de départ doit subsister avec les mêmes plans physiques');
      expected.seen = null;
      break;
    default:
      throw new Error('Transformation inconnue : ' + t.kind);
  }
  expected.stamps.sort();
  expected.cells.sort();
  assert.deepEqual(child.model, expected, 'la fiche diffère aussi sur une autre propriété');
}

export function verifyCorpus(corpus, publicModels = corpus.cases.map(c => c.model)) {
  assert.equal(corpus.version, 1);
  assert.ok(Number.isInteger(corpus.seed) && corpus.seed >= 1 && corpus.seed <= 0xffffffff);
  assert.ok(corpus.cases.length > 0);
  const records = new Map();
  const report = { cases: 0, worlds: 0, hidden: 0, winningPlansByWorld: 0, winningPolicies: 0,
    minimalPolicies: 0, edges: {}, maxDepth: 0 };
  for (const [i, c] of corpus.cases.entries()) {
    try {
      assert.match(c.id, /^[0-9a-f]{20}$/);
      assert.ok(!records.has(c.id), 'identifiant dupliqué');
      const publicModel = publicModels[i];
      assert.deepEqual(c.model, publicModel, 'le modèle privé diffère de la fiche');
      checkModel(publicModel);
      const result = enumerate(publicModel);
      checkKey(publicModel, c.key, result);
      let depth = 0;
      if (i === 0) {
        assert.equal(c.parentId, null);
        assert.equal(c.transformation.kind, 'root');
        assert.notEqual(c.model.seen, null);
      } else {
        const parent = records.get(c.parentId);
        assert.ok(parent, 'parent absent ou postérieur');
        edge(parent.c, c, parent.result, result);
        depth = parent.depth + 1;
        const kind = c.transformation.kind;
        report.edges[kind] = (report.edges[kind] ?? 0) + 1;
      }
      const contentId = createHash('sha256').update(JSON.stringify([c.parentId, c.transformation, c.model])).digest('hex').slice(0, 20);
      assert.equal(c.id, contentId, 'identifiant incohérent avec le parent, la transformation ou le contenu');
      records.set(c.id, { c, result, depth });
      report.maxDepth = Math.max(depth, report.maxDepth);
      report.cases++;
      report.worlds += result.worlds.length;
      report.hidden += Number(c.model.seen === null);
      report.winningPlansByWorld += Object.values(result.perWorld).reduce((n, plans) => n + plans.length, 0);
      report.winningPolicies += result.policies.length;
      report.minimalPolicies += result.optimal.length;
    } catch (error) {
      throw new Error('Cas ' + c.id + ' : ' + error.message, { cause: error });
    }
  }
  return report;
}

export function verifyDirectory(dir) {
  const corpus = JSON.parse(read(join(dir, 'corriges', 'corpus.json')));
  const filenames = corpus.cases.map(c => c.id + '.md');
  for (const subdir of ['public', 'corriges']) {
    const expected = subdir === 'public' ? filenames : [...filenames, 'corpus.json'];
    assert.deepEqual(sorted(readdirSync(join(dir, subdir))), sorted(expected), 'inventaire ' + subdir);
  }
  const models = filenames.map(name => parseCard(read(join(dir, 'public', name))));
  const report = verifyCorpus(corpus, models);
  for (const c of corpus.cases) {
    assert.equal(read(join(dir, 'corriges', c.id + '.md')), answerCard(c.key, c.model), 'texte du corrigé ' + c.id);
  }
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const dir = process.argv[2] ?? join(dirname(fileURLToPath(import.meta.url)), 'generated', '107');
  console.log(JSON.stringify(verifyDirectory(dir), null, 2));
}
