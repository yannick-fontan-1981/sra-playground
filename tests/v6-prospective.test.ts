import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { EffectAccess, supportBox } from '../src/logos-engine/v6-effect-access.ts';
import { FactoredEffectAccess, factoredProposal, measuredPartitions, partition } from '../src/logos-engine/v6-factored-return.ts';
import { ScoredRewriteAccess, localRewrites, scoredModel } from '../src/logos-engine/v6-scored-rewrite.ts';
import { PassageOptions, patch, calibrated } from '../src/logos-engine/v6-passage-options.ts';
import { ProspectiveContactAdapter } from '../src/logos-engine/v6-prospective-contact.ts';
import { Snapshot } from '../src/logos-engine/v6-composition-memory.ts';
import type { CompositionTransition } from '../src/logos-engine/v6-composition-memory.ts';

const fixture = JSON.parse(await readFile(new URL('./fixtures/v6-prospective-reference.json', import.meta.url), 'utf8'));
type R = Record<string, any>;
const classes = { EffectAccess, FactoredEffectAccess, ScoredRewriteAccess, PassageOptions, ProspectiveContactAdapter };
const snapshots = Object.fromEntries(Object.entries(fixture.scenes as Record<string, R>).map(([key, scene]) => [key, Snapshot.fromPublic(scene.observation, scene.rows)]));
function episode(name: string): CompositionTransition[] { return fixture.episodes[name].map(([b, a, c]: string[]) => [snapshots[b!]!, a!, snapshots[c!]!] as const); }
async function expected(call: () => unknown | Promise<unknown>, outcome: R) {
  if (outcome.accepted) assert.deepEqual(await call(), outcome.value);
  else await assert.rejects(async () => call(), (error: unknown) => {
    assert.ok(error instanceof Error); assert.equal(error.message, outcome.error.message); return true;
  });
}

for (const sample of fixture.helpers) test(`V6 prospective helper original parity: ${sample.id}`, async () => {
  const a = sample.arguments;
  await expected(() => {
    if (sample.operation === 'support_box') return supportBox(a.origin, a.size).sort((p, q) => p[0] - q[0] || p[1] - q[1]);
    if (sample.operation === 'partition') return partition(fixture.scenes[a.scene].rows, a.axis, a.indices);
    if (sample.operation === 'measured_partitions') { const transitions = episode(a.episode); return measuredPartitions(a.exclude_last ? transitions.slice(0, -1) : transitions); }
    if (sample.operation === 'factored_proposal') return factoredProposal(episode(a.episode), fixture.scenes[a.scene].observation, a.inputs, a.limit);
    if (sample.operation === 'local_rewrites') return localRewrites(fixture.scenes[a.before].observation, fixture.scenes[a.after].observation);
    if (sample.operation === 'scored_model') return scoredModel(a.series, fixture.scenes[a.before].observation, a.command);
    if (sample.operation === 'patch') return patch(fixture.scenes[a.scene].rows, a.position, a.size);
    if (sample.operation === 'calibrated') {
      const [roles, surfaces] = calibrated(a.samples);
      return [roles, [...surfaces].map(([compound, origins]) => [JSON.parse(compound), [...origins.values()].sort((p, q) => p[0] - q[0] || p[1] - q[1])])];
    }
    assert.fail(`Uncovered helper ${sample.operation}`);
  }, sample.outcome);
});

async function invoke(instance: EffectAccess | ProspectiveContactAdapter, sample: R) {
  const a = sample.arguments;
  const methods = { propose_effect: 'proposeEffect', propose_factored: 'proposeFactored', propose_scored_rewrite: 'proposeScoredRewrite', propose_passage_options: 'proposePassageOptions' } as const;
  if (['propose', ...Object.keys(methods).filter(method => method !== 'propose_factored')].includes(sample.method)) {
    const scene = fixture.scenes[a.scene];
    if (instance instanceof ProspectiveContactAdapter) {
      if (sample.method === 'propose') return instance.propose(scene.observation, scene.rows, a.inputs, a.limit);
      return instance[methods[sample.method as keyof typeof methods]](scene.observation, scene.rows, a.inputs, a.limit, a.config);
    }
    return instance.propose(episode(a.episode), scene.observation, scene.rows, a.inputs, a.limit, a.config);
  }
  if (sample.method === 'propose_factored') return (instance as ProspectiveContactAdapter).proposeFactored(fixture.scenes[a.scene].observation, a.inputs, a.limit);
  if (sample.method === 'before') return instance.before(a.proposal, a.index, fixture.scenes[a.scene].rows, a.metadata);
  if (sample.method === 'after') return instance.after(a.proposal, a.index, fixture.scenes[a.first].rows, fixture.scenes[a.last].rows, a.metadata);
  if (sample.method === 'record') {
    const b = fixture.scenes[a.before], c = fixture.scenes[a.after];
    if (instance instanceof ProspectiveContactAdapter) return instance.record(b.observation, b.rows, a.command, c.observation, c.rows, { proposal: a.proposal, index: a.index });
    return instance.record(b.observation, a.command, c.observation, b.rows, c.rows, a.proposal, a.index);
  }
  if (sample.method === 'apply_event') return instance instanceof ProspectiveContactAdapter ? instance.memory.applyEvent(a.event) : instance.applyEvent(a.event);
  assert.fail(`Uncovered operation ${sample.method}`);
}

for (const sample of fixture.cases) test(`V6 full prospective provider parity: ${sample.id}`, async () => {
  const Class = classes[sample.class as keyof typeof classes], instance = new Class();
  instance.restore(sample.initialState);
  assert.deepEqual(instance.state(), sample.initialState, 'complete nested state must restore without inference');
  const inputs = structuredClone(sample);
  await expected(async () => (await invoke(instance, sample)) ?? null, sample.outcome);
  assert.deepEqual(instance.state(), sample.state, 'events and public caches must remain exact');
  assert.equal(instance instanceof ProspectiveContactAdapter ? instance.memory.pre_score.retainedDigest() : instance.retainedDigest(), sample.retainedDigest);
  assert.deepEqual(sample, inputs, 'planning and acquisition must not mutate the recorded input');
  const replay = new Class(); replay.restore(instance.state()); assert.deepEqual(replay.state(), instance.state());
});

test('prospective closure supplies four genuine source-produced proposal kinds', () => {
  const kinds = new Set(fixture.cases.filter((sample: R) => sample.outcome.accepted && sample.outcome.value?.status === 'proposed').map((sample: R) => sample.outcome.value.kind));
  for (const kind of ['observed_effect_access', 'public_factored_return', 'public_scored_rewrite', 'public_passage_options']) assert.ok(kinds.has(kind), kind);
  for (const sample of fixture.cases) if (sample.outcome.value?.status === 'proposed') {
    const proposal = sample.outcome.value;
    assert.ok(proposal.actions.length > 0);
    assert.ok(['OP18', 'OP28'].includes(proposal.bundle_template.operation_key));
    assert.equal(proposal.binding.observation_ref, fixture.scenes[sample.arguments.scene].observation.observation_ref);
  }
});

test('full prospective checkpoint binds pre-score state to its retained digest', () => {
  const sample = fixture.cases.find((sample: R) => sample.id === 'adapter-scored-rewrite-provider');
  const adapter = new ProspectiveContactAdapter(); adapter.restore(sample.initialState);
  const before = adapter.state(), corrupted = structuredClone(before); corrupted.pre_score_digest = 'stale';
  assert.throws(() => adapter.restore(corrupted), /digest does not match/); assert.deepEqual(adapter.state(), before);
  const external = adapter.state(); external.episode.length = 0; external.pre_score.motion_samples.length = 0;
  assert.deepEqual(adapter.state(), before);
});

test('prospective providers preserve the pinned five source modules and their public dependency hashes', async () => {
  assert.equal(fixture.commit, '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e');
  for (const [path, expected] of Object.entries(fixture.sourceHashes)) {
    const bytes = await readFile(new URL(`../reference/v6/${fixture.commit}/source/${path}`, import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), expected, path);
  }
});
