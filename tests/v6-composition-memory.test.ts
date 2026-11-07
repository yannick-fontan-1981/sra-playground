import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { Snapshot, GoalAccessMemory, compositionIdentity, localPatch, equalityPattern, orientationPatterns,
  relativeMotion, registered, motionModels, repeatedChanges, scoringContactDirection, fitBoundary,
  proposeAccess, occurrenceAt, addPoint, compositionOccurs, checkAccessBefore, checkAccessAfter,
} from '../src/logos-engine/v6-composition-memory.ts';

const reference = JSON.parse(await readFile(new URL('./fixtures/v6-composition-reference.json', import.meta.url), 'utf8'));
const plain = (value: unknown) => JSON.parse(JSON.stringify(value));
const snapshot = (name: string) => {
  const scene = reference.scenes[name];
  return Snapshot.fromPublic(scene.observation, scene.rows);
};
const episode = (spec: [string, string, string][]) => spec.map(([first, action, last]) => [snapshot(first), action, snapshot(last)] as const);

async function execute(sample: any): Promise<unknown> {
  const a = sample.arguments;
  switch (sample.operation) {
    case 'snapshot': return snapshot(a.scene);
    case 'local_patch': return localPatch(snapshot(a.scene), a.origin, a.size);
    case 'equality_pattern': return equalityPattern(a.patch);
    case 'orientation_patterns': return orientationPatterns(a.patch, a.size);
    case 'relative_motion': return relativeMotion(snapshot(a.before), snapshot(a.after), a.signature);
    case 'registered': return registered(snapshot(a.first), snapshot(a.last));
    case 'motion_models': return motionModels(episode(a.episode), snapshot(a.terminal));
    case 'repeated_changes': return repeatedChanges(snapshot(a.before), snapshot(a.after));
    case 'scoring_contact_direction': return scoringContactDirection(episode(a.episode), a.signature, a.moves, a.contact);
    case 'fit_boundary': return fitBoundary(episode(a.episode), a.contact ?? null);
    case 'propose_access': return proposeAccess(a.model, snapshot(a.scene), a.tried, a.max_prefix, a.transfers, a.observed_context, a.refuted, a.occurrences);
    case 'memory_propose': {
      const memory = new GoalAccessMemory(); memory.models = structuredClone(a.models);
      const scene = reference.scenes[a.scene];
      return memory.propose(scene.observation, scene.rows, a.actions);
    }
    case 'check_access_before': return checkAccessBefore(a.plan, a.index, a.rows, a.options);
    case 'check_access_after': return checkAccessAfter(a.plan, a.index, a.before_rows, a.after_rows, a.options);
    case 'occurs': return compositionOccurs(a.rows, a.position, a.mask, a.value);
    case 'apply_event_error': return new GoalAccessMemory().applyEvent(a.event);
    case 'identity': return compositionIdentity(a.value);
    case 'occurrence_at': return occurrenceAt(a.epoch, a.role, a.site);
    case 'add': return addPoint(a.point, a.delta);
    default: throw new Error(`Unimplemented oracle operation: ${sample.operation}`);
  }
}

for (const sample of reference.cases) test(`V6 composition original Python parity: ${sample.id}`, async () => {
  if (sample.error) await assert.rejects(() => execute(sample), (error: unknown) => error instanceof Error && error.message === sample.error);
  else assert.deepEqual(plain(await execute(sample)), sample.expected);
});

for (const scenario of reference.scenarios) test(`V6 composition retained event replay: ${scenario.id}`, async () => {
  const memory = new GoalAccessMemory(), replay = new GoalAccessMemory();
  for (const [index, sample] of scenario.steps.entries()) {
    const operation = sample.operation;
    let result: unknown = null;
    if (operation.kind === 'apply_event') {
      await memory.applyEvent(structuredClone(operation.event));
      await replay.applyEvent(structuredClone(operation.event));
    } else if (operation.kind === 'record') {
      const before = reference.scenes[operation.before], after = reference.scenes[operation.after];
      const events = await memory.record(before.observation, before.rows, operation.command, after.observation, after.rows, operation.options);
      result = events;
      for (const event of events) await replay.applyEvent(structuredClone(event));
    } else if (operation.kind === 'propose') {
      const scene = reference.scenes[operation.scene];
      result = await memory.propose(scene.observation, scene.rows, operation.actions, operation.max_prefix);
    } else assert.fail(`Unknown original memory operation: ${operation.kind}`);
    const actual = { result, retained: memory.retainedState(), episode: memory.episode.map(([b, action, a]) => [b.ref, action, a.ref]),
      last: memory.last?.ref ?? null, replay: replay.retainedState() };
    assert.deepEqual(plain(actual), sample.expected, `${scenario.id}, step ${index + 1}`);
  }
});

test('composition snapshots retain the source cache semantics and immutable public raster ownership', async () => {
  const scene = structuredClone(reference.scenes['learn:0']);
  const value = Snapshot.fromPublic(scene.observation, scene.rows);
  const oldPixel = value.rows[0]![0];
  scene.rows[0][0] = 55;
  scene.observation.entities[0].bbox[0] = 16;
  assert.equal(value.rows[0]![0], oldPixel);
  assert.equal(value.roles['role:measured']![0], 3);
  assert.ok(Object.isFrozen(value) && Object.isFrozen(value.rows) && Object.isFrozen(value.rows[0]));
  const memory = new GoalAccessMemory(); memory.last = value;
  assert.equal(memory.snapshot(scene.observation, scene.rows), value);
  await memory.applyEvent({ kind: 'goal_approach_retrospective', models: [] });
  assert.equal(memory.last, null);
  assert.notEqual(memory.snapshot(scene.observation, scene.rows), value);
});

test('composition fixture executes every original function and verifies the pinned source bytes', async () => {
  const required = ['__init__', '_occurs', '_retain_occurrence', 'add', 'apply_event', 'check_access_after', 'check_access_before',
    'equality_pattern', 'fit_boundary', 'from_public', 'identity', 'local_patch', 'motion_models', 'occurrence_at', 'orientation_patterns',
    'premise', 'propose', 'propose_access', 'record', 'registered', 'relative_motion', 'repeated_changes', 'retained_state',
    'scoring_contact_direction', 'snapshot', 'trial_key'];
  assert.deepEqual(reference.coveredSourceFunctions, required);
  assert.equal(reference.commit, '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e');
  for (const [path, expected] of Object.entries(reference.sourceHashes)) {
    const bytes = await readFile(new URL(`../reference/v6/${reference.commit}/source/${path}`, import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), expected);
  }
});
