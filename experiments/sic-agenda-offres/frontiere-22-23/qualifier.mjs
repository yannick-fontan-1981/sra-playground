import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { digest } from './observation.mjs';
import { predict } from './prediction.mjs';
import { digest as nativeDigest } from '../../../src/logos-engine/canonical.ts';

const base = new URL('./', import.meta.url);
const root = fileURLToPath(new URL('../../../', base));
const historical = '8ce7ee3563fa1d5eca1639c6ad03975cfc962460';
const frozen = 'd0e7527ca8033bd805a6d7a8bb021eff62e87021';
const { values } = parseArgs({ options: { jeux: { type: 'string' }, recu: { type: 'string' } } });
const vendor = values.jeux && resolve(values.jeux);
const destination = values.recu && resolve(values.recu);
function run(bin, args) {
  const result = spawnSync(bin, args, { cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw Error(result.stderr.split(/\r?\n/).filter(line => line.length < 600).slice(-22).join('\n'));
  return result.stdout;
}
const script = (file, ...args) => JSON.parse(run(process.execPath, [fileURLToPath(new URL(file, base)), ...args]));
function checkOffer(row, release, boundary) {
  const pre = JSON.parse(row.seal.payload), expected = row.prediction;
  assert.deepEqual(predict(row.seal), expected);
  assert.equal(expected.familyPrediction, 'indéterminée');
  assert.equal(release.ticket.observationRef, pre.observation);
  assert.equal(expected.decision, 'selectionner');
  assert.equal(release.family, 'observed_frontier');
  assert.equal(release.global.selected, release.family);
  assert.equal(release.strategy, expected.strategy);
  assert.equal(release.ticket.actionRef, expected.command.action_ref);
  assert.deepEqual(release.ticket.data, expected.command.data ?? {});
  assert.equal(release.ticket.actionIndex, 0);
  assert.equal(release.question, expected.question);
  assert.equal(boundary.ticket, release.ticket.id);
  assert.equal(boundary.plan, 'sic-plan:' + pre.observation);
}

const on = script('parcours.mjs', 'fixture', 'on');
const off = script('parcours.mjs', 'fixture', 'off');
assert.deepEqual(off.records, []);
assert.equal(digest(on.native), digest(off.native), 'neutralité sur tickets, chaîne native, décisions et retours');
const { released, boundaries, stop } = on.native;
assert.deepEqual(released.map(r => [r.strategy, r.ticket.actionRef]), [
  ['test_local_input','ACTION1'], ['test_local_input','ACTION4'], ['test_local_input','ACTION2'],
  ['reach_open_input','ACTION4'], ['reach_open_input','ACTION3'],
]);
assert.equal(on.records.length, 5);
for (let i = 0; i < 4; i++) checkOffer(on.records[i], released[i], boundaries[i]);
const route = JSON.parse(on.records[3].seal.payload);
const earlier = 'transition:' + await nativeDigest([released[1].ticket.observationRef, { action_ref: 'ACTION4' }, boundaries[1].ref]);
assert.deepEqual(route.path[0].witnesses, [earlier]);
assert.ok(released[3].accessNeed && released[3].accessNeed !== released[3].need);
assert.equal(boundaries[3].matched, true);
assert.equal(released[4].ticket.actionIndex, 1);
assert.equal(released[4].observation, released[3].observation);
assert.equal(released[4].ticket.observationRef, boundaries[3].ref);
assert.equal(released[4].need, released[3].need);
assert.equal(released[4].ticket.actionRef, route.remote.action.action_ref);
assert.equal(boundaries[4].outcome.objective, route.remote.ref);
assert.equal(boundaries[4].outcome.status, 'observed');
assert.equal(boundaries[4].matched, null);
assert.equal(stop.ref, JSON.parse(on.records[4].seal.payload).observation);
assert.equal(on.records[4].prediction.decision, 'suspendre');
assert.equal(JSON.parse(on.records[4].seal.payload).routeStatus, 'exhausted');
assert.equal(stop.need.status, 'open');
assert.equal(stop.need.kind, 'find_observable_frontier_access');
assert.equal(stop.ticket, null);

// Deux contrôles distincts. Une altération d'entrée casse le sceau. Un résultat
// introduit à la coupe est rejeté même si son auteur recalcule le condensat.
const original = on.records[3], altered = { ...route, winningStrategy: 'test_local_input' };
const poison = { payload: JSON.stringify(altered), sha256: digest(altered) };
assert.throws(() => predict({ ...poison, sha256: original.seal.sha256 }));
assert.throws(() => predict(poison));
// Seule la confrontation aval détecte un reçu natif permuté.
assert.deepEqual(predict(original.seal), original.prediction);
assert.throws(() => checkOffer(original, { ...released[3], strategy: 'test_local_input' }, boundaries[3]));
const intervention = script('retrait.mjs');
const specimen = JSON.parse(await readFile(new URL('temoins.json', base), 'utf8'));
assert.deepEqual(route, specimen.fixture.pre);
assert.equal(original.seal.sha256, specimen.fixture.sha256);
assert.equal(on.nativeDigest, specimen.fixture.parity);
const report = { fixture: { parity: on.nativeDigest, pre: on.records, native: on.native }, intervention, references: [] };
console.log('Fixture | rangée 23 : 3 décisions | rangée 22 : 1 décision, 2 tickets | suspension : 1, aucun ticket');
console.log('Retrait de la seule question locale | ACTION5 ici → ACTION4 vers ACTION1 | même état et même arête apprise');
if (vendor) {
  // On extrait seulement les sources et les données requises dans un répertoire temporaire neuf.
  const temp = await mkdtemp(join(tmpdir(), 'sic-frontier-'));
  try {
    const archive = join(temp, 'reference.tar');
    const declarations = 'reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/';
    run('git', ['archive', '--format=tar', '--output', archive, historical, 'src', 'package.json', 'public/python',
      declarations + 'laya_proto', declarations + 'morphology_policy']);
    run('tar', ['-xf', archive, '-C', temp]);
    run('git', ['diff', '--exit-code', frozen, '--', 'src', 'public/python', declarations]);
    for (const revision of [historical, frozen]) {
      for (const game of ['G50T', 'REGN']) {
        const args = [game, 'on', vendor];
        if (revision === historical) args.push(pathToFileURL(temp + sep).href);
        const result = script('parcours.mjs', ...args);
        const last = result.native.released.at(-1), boundary = result.native.boundaries.at(-1);
        const row = result.records.find(r => JSON.parse(r.seal.payload).observation === last.ticket.observationRef);
        const local = row?.prediction.strategy ?? null;
        const point = specimen.references.find(point => point.revision === revision && point.game === game);
        assert.ok(point);
        assert.deepEqual(point, { revision, game, preSha256: row?.seal.sha256 ?? null, question: last.question ?? null,
          observation: last.ticket.observationRef, family: last.family, strategy: last.strategy, ticket: last.ticket.id,
          command: last.ticket.actionRef, after: boundary.ref, matched: boundary.matched });
        if (game === 'G50T') {
          assert.deepEqual([last.sequence, last.level, last.kind, last.ticket.actionRef, local, boundary.matched],
            [1, 1, 'experiment', 'ACTION1', 'test_local_input', null]);
          checkOffer(row, last, boundary);
          assert.equal(boundary.outcome.objective, last.question);
        } else {
          assert.deepEqual([last.sequence, last.level, last.kind, last.ticket.actionRef, boundary.matched], [16, 3, 'access', 'ACTION4', true]);
          assert.equal(last.family, 'returned_branch_contrast');
          assert.equal(last.global.selected, last.family);
          assert.equal(last.global.visited.includes('observed_frontier'), false);
          assert.equal(row, undefined, 'la sélection globale a terminé le parcours avant cette famille');
        }
        report.references.push({ revision, game, pre: row ?? null, release: last, boundary });
        console.log(revision.slice(0,8), game, last.level, last.sequence, last.family, last.strategy,
          last.ticket.actionRef, boundary.status, local ?? 'coupe locale non atteinte');
      }
    }
  } finally { await rm(temp, { recursive: true, force: true }); }
}
if (destination) await writeFile(destination, JSON.stringify(report, null, 2) + '\n', 'utf8');
