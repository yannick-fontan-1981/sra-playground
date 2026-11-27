import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { exportCard, serialize } from './export.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const read = path => readFileSync(path, 'utf8').replaceAll('\r\n', '\n');
const families = [['dial', '..'], ['resource', '../ressource']];
const inputs = families.flatMap(([family, relative]) => {
  const dir = join(here, relative, 'exemple/public');
  return readdirSync(dir).map(name => ({ family, path: join(dir, name), player: join(here, relative, 'play.mjs') }));
});
const lists = ['observations', 'domains', 'commands', 'rules'];
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const obs = (m, name) => m.observations.find(row => row.ref[0] === name);

test('12 fiches de développement, références publiques exactes et exemples reproductibles', () => {
  assert.equal(inputs.length, 12);
  for (const { path } of inputs) {
    const text = read(path), m = exportCard(text);
    const cited = new Set();
    for (const row of [m.goal, ...lists.flatMap(k => m[k])]) {
      assert.ok(row.source.length > 0);
      for (const n of row.source) {
        assert.equal(m.sources[n], text.split('\n')[n - 1]);
        cited.add(String(n));
      }
    }
    assert.deepEqual(cited, new Set(Object.keys(m.sources)));
    for (const row of m.rules) assert.ok(m.commands.some(c => same(c.command, row.command)));
    assert.ok(m.commands.some(c => same(c.command, m.goal.command)));
  }
  for (const [family, id] of [['dial', '9fd1072013fd810d513c'], ['resource', '345436640366130fd8c3']]) {
    const { path } = inputs.find(row => row.path.endsWith(id + '.md'));
    const actual = execFileSync(process.execPath, [join(here, 'export.mjs'), '-'], { input: read(path), encoding: 'utf8' });
    assert.equal(actual, read(join(here, 'examples', family + '.json')));
  }
});

test('12 bijections non triviales conservent le message entier, y compris commandes, relations et citations', () => {
  for (const { path } of inputs) {
    const page = read(path);
    const ids = [...new Set(page.match(/\b[XJ][a-f0-9]{6}\b/g))];
    assert.ok(ids.length >= 4);
    const rename = new Map(ids.map((id, i) => [id, 'Objet' + (ids.length - i)]));
    const replace = text => text.replace(/\b[XJ][a-f0-9]{6}\b/g, key => rename.get(key));
    assert.deepEqual(exportCard(replace(page)), JSON.parse(replace(JSON.stringify(exportCard(page)))));
  }
});

test('6 paires de mondes : entrées JSON identiques avant toute commande et révélations différentes', () => {
  let pairs = 0;
  for (const { path, player } of inputs) {
    const text = read(path), m = exportCard(text);
    if (!m.observations.some(row => row.status === 'unknown')) continue;
    const probe = m.rules.find(rule => rule.effect?.reveal).command;
    const actions = [probe];
    if (obs(m, 'purged')?.value === false) actions.unshift(m.commands.find(c => c.command[0] === 'purger').command);
    const feedback = [];
    const messages = [];
    for (const n of [1, 2]) {
      // Independent public replay. World ordinal stays exclusively on the operator's side.
      const stdout = execFileSync(process.execPath, [player, path, '--monde', String(n)],
        { input: actions.map(a => a.join(' ')).join('\n') + '\n', encoding: 'utf8' }).replaceAll('\r\n', '\n');
      const lines = stdout.trimEnd().split('\n');
      const returns = lines.splice(-actions.length);
      messages.push(serialize(exportCard(lines.join('\n'))));
      feedback.push(returns);
    }
    assert.equal(messages[0], messages[1]);
    assert.equal(messages[0], serialize(m));
    assert.deepEqual(feedback[0].slice(0, -1), feedback[1].slice(0, -1));
    assert.deepEqual(new Set(feedback.map(array => array.at(-1))), new Set(m.domains[0].values));
    pairs++;
  }
  assert.equal(pairs, 6);
});

test('retrait de chaque ligne citée : aucune assertion nouvelle, ou refus explicite de la fiche incomplète', t => {
  let omitted = 0, refused = 0;
  for (const { path } of inputs) {
    const page = read(path), m = exportCard(page);
    for (const n of Object.keys(m.sources).map(Number)) {
      const lines = page.split('\n');
      lines[n - 1] = '';
      let partial;
      try { partial = exportCard(lines.join('\n')); } catch (err) {
        assert.match(err.message, /manquante|non reconnue/);
        refused++;
        continue;
      }
      assert.ok(!Object.hasOwn(partial.sources, n));
      assert.deepEqual(partial.goal, m.goal);
      for (const k of lists) assert.deepEqual(partial[k], m[k].filter(row => !row.source.includes(n)));
      omitted++;
    }
  }
  assert.ok(omitted > 0 && refused > 0);
  t.diagnostic(omitted + ' exports partiels et ' + refused + ' refus');
});

test('distinctions entre inconnu, omission, état archivé, condition de réussite et garde de commande', () => {
  const input = read(inputs.find(x => x.path.endsWith('345436640366130fd8c3.md')).path);
  const m = exportCard(input);
  assert.equal(obs(m, 'effort').status, 'unknown');
  assert.ok(!Object.hasOwn(obs(m, 'effort'), 'value'));
  const missing = exportCard(input.replace(/^- Mesure certifiée.*$/m, ''));
  assert.equal(obs(missing, 'effort'), undefined);
  assert.deepEqual(obs(missing, 'archive'), obs(m, 'archive'));
  const noInitialIndex = exportCard(input.replace(' est ouvert et reste à indexer.', ' est ouvert.'));
  assert.equal(obs(noInitialIndex, 'indexed'), undefined);
  assert.ok(noInitialIndex.commands.some(c => c.command[0] === 'indexer'));
  const end = m.rules.filter(r => r.command[0] === 'sceller');
  assert.ok(end.some(r => r.successRequires));
  assert.ok(end.every(r => !r.requires && r.effect?.end !== 'success'));
  assert.throws(() => exportCard(input.replace('une fois par partie après la purge', 'deux fois pendant la purge')), /manquante/);
  const page = read(inputs.find(x => x.path.endsWith('9fd1072013fd810d513c.md')).path);
  const knownBlank = obs(exportCard(page), 'mark');
  assert.equal(knownBlank.status, 'known');
  assert.equal(knownBlank.value, null);
  const blankWiring = exportCard(page.replace(/^- La sortie .*$/gm, ''));
  assert.equal(obs(blankWiring, 'required_stamp'), undefined);
  assert.ok(blankWiring.commands.length > 0);
});
