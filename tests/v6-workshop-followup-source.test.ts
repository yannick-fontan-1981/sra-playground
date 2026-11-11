import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { RankedWorkshop } from '../src/logos-engine/v6-ranked-workshop.ts';
import { syntheticWorkshopPublicState } from './helpers/v6-synthetic-workshop.ts';

type R = Record<string, any>;
const copy = <T>(value: T): T => structuredClone(value);
const fixture = JSON.parse(await readFile(new URL('./fixtures/v6-workshop-followup-synthetic-reference.json', import.meta.url), 'utf8')) as R;
const sourceRoot = new URL(`../reference/v6/${fixture.referenceCommit}/source/`, import.meta.url);
const hash = (value: Uint8Array): string => createHash('sha256').update(value).digest('hex');

test('fresh independent Workshop oracle pins unchanged original source and excludes game inputs and native caller parity', async () => {
  assert.equal(fixture.referenceCommit, '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e');
  assert.equal(fixture.sourceModified, false);
  assert.ok(fixture.sourceFilesVerifiedBeforeAndAfter >= 1786);
  assert.equal(fixture.inputOrigin.kind, 'independently_constructed_geometry');
  assert.equal(fixture.inputOrigin.gameFilesRead, 0);
  assert.equal(fixture.inputOrigin.actionsDispatched, 0);
  assert.deepEqual(fixture.inputOrigin.shape, [40, 44]);
  assert.match(fixture.qualification, /native coordination extension is outside original caller parity/);
  assert.equal(fixture.generator.command, 'python -B scripts/export-v6-workshop-followup-synthetic-reference.py');
  assert.equal(hash(await readFile(new URL(`../${fixture.generator.path}`, import.meta.url))), fixture.generator.sha256);
  assert.equal(hash(await readFile(new URL('../manifest.json', sourceRoot))), fixture.sourceManifestSha256);
  for (const [path, expected] of Object.entries(fixture.sourceHashes)) {
    assert.equal(hash(await readFile(new URL(path, sourceRoot))), expected, path);
  }
  for (const name of ['RankedWorkshop.propose', 'RankedWorkshop.measure', 'RankedWorkshop.select', 'RankedWorkshop.record',
    'RankedWorkshop.bind', 'RankedWorkshop.before', 'RankedWorkshop.after', 'RankedWorkshop.state', 'RankedWorkshop.restore']) {
    assert.ok(fixture.executedSourceFunctions.some((row: R) => row.function === name && row.calls > 0), name);
  }
  assert.equal(fixture.scenarios.length, 2);
  assert.equal(fixture.scenarios.reduce((count: number, row: R) => count + row.steps.length, 0), 24);
});

for (const [name, frame] of Object.entries(fixture.frames) as [string, R][]) test(`independent Workshop raster and complete public measurement match Python: ${name}`, async () => {
  const actual = await syntheticWorkshopPublicState(frame.held, frame.revision, frame.epoch);
  assert.deepEqual(actual.publicPacket, frame.public);
  assert.deepEqual(actual.observation, frame.observation);
});

for (const scenario of fixture.scenarios as R[]) test(`original acquired Workshop chain: ${scenario.id}`, async context => {
  const owner = await RankedWorkshop.create(); let proposal: R | null = null;
  assert.deepEqual(owner.state(), scenario.coldState, 'Each chain begins with a genuinely cold owner');
  for (const [index, step] of (scenario.steps as R[]).entries()) await context.test(`${index + 1} ${step.operation}`, async () => {
    let result: unknown;
    switch (step.operation) {
      case 'propose': {
        const frame = fixture.frames[step.frame];
        result = proposal = await owner.proposeSource(copy(frame.observation), copy(frame.public.frame_rows), [], 16);
        break;
      }
      case 'record': {
        const before = fixture.frames[step.before], after = fixture.frames[step.after];
        result = owner.recordSource(copy(before.observation), copy(after.observation),
          copy(step.selected ? proposal!.actions[0] : step.command), copy(before.public.frame_rows), copy(after.public.frame_rows),
          step.selected ? copy(proposal) : null, 0);
        break;
      }
      case 'bind': result = owner.bind(copy(proposal!)); break;
      case 'before': {
        const frame = fixture.frames[step.frame], packet = copy(frame.public);
        if (Object.hasOwn(step, 'available')) packet.available_action_refs = step.available;
        result = owner.before(copy(proposal!), 0, packet, copy(frame.observation));
        break;
      }
      case 'after': {
        const before = fixture.frames[step.before], after = fixture.frames[step.after];
        result = owner.after(copy(proposal!), 0, copy(before.observation), copy(after.observation), copy(before.public.frame_rows), copy(after.public.frame_rows));
        break;
      }
      case 'restore': result = owner.restore(JSON.parse(JSON.stringify(owner.state()))); break;
      default: assert.fail(`Unknown source chain operation ${step.operation}`);
    }
    assert.deepEqual(result ?? null, step.result, 'Compare the entire original proposal, effect record or guard result');
    assert.deepEqual(owner.state(), step.afterState, 'Compare all eight original persistent state fields after every operation');
  });
});
