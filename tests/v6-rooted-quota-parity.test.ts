import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { measureRootedQuota, measureRootedLengths } from '../src/logos-engine/v6-rooted-quota-observation.ts';
import { measureRootedPrefixMarginals, measureIndexedPrefixPrimitive, rootedQuotaCells, rootedQuotaQuotas,
  rootedQuotaRequestBase, propagateRootedQuota, stepRootedQuota } from '../src/logos-engine/v6-rooted-quota-mechanics.ts';
import { RootedQuotaMemory, rootedQuotaBefore, rootedQuotaAfter, commonRootedQuotaProposal, bindRootedQuota } from '../src/logos-engine/v6-rooted-quota-access.ts';
import { SharedSeriesConstraint, createNativeSharedSeriesFamily, SHARED_SERIES_DIGEST_SCOPE } from '../src/logos-engine/v6-shared-series.ts';
import { ObservedInputDomain } from '../src/logos-engine/v6-native-observer.ts';
import type { NativeObservation } from '../src/logos-engine/v6-native-types.ts';

type R = Record<string, any>;
const root = new URL('../', import.meta.url);
const fixture = JSON.parse(gunzipSync(await readFile(new URL('fixtures/v6-rooted-quota-reference.json.gz', import.meta.url))).toString()) as R;
const probe = JSON.parse(gunzipSync(await readFile(new URL('fixtures/v6-rooted-quota-original-public.json.gz', import.meta.url))).toString()) as R;
const clone = <T>(value: T): T => structuredClone(value);
const hash = (value: Uint8Array): string => createHash('sha256').update(value).digest('hex');
const restored = (events: readonly R[] = []): RootedQuotaMemory => {
  const memory = new RootedQuotaMemory(); for (const event of events) memory.applyEvent(clone(event)); return memory;
};
const configuration = JSON.parse(await readFile(new URL(`reference/v6/${fixture.sourceCommit}/source/agents/yf_arc3_v6/morphology_policy/strategy.drm`, root), 'utf8')).declarations[0].configuration;
const recallPolicy = configuration.window_constraints.occurrence_recall;

test('rooted quota reference pins unchanged source and separates isolated public play from contract export', async () => {
  assert.equal(fixture.sourceCommit, '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e');
  assert.equal(fixture.qualification.sourceModified, false);
  assert.equal(fixture.qualification.gameHostRunByExporter, false);
  assert.match(fixture.qualification.commonEnvelope, /True ObservedCompositionConstraint/);
  const manifest = JSON.parse(await readFile(new URL(`reference/v6/${fixture.sourceCommit}/manifest.json`, root), 'utf8'));
  for (const item of [fixture, probe]) {
    for (const [path, expected] of Object.entries(item.sourceHashes)) {
      assert.equal(hash(await readFile(new URL(`reference/v6/${fixture.sourceCommit}/source/${path}`, root))), expected, path);
      assert.equal(manifest.files[path].sha256, expected, path);
    }
    assert.equal(hash(await readFile(new URL(item.generator, root))), item.generatorSha256);
  }
  assert.equal(hash(await readFile(new URL(fixture.originalPublicProbe.path, root))), fixture.originalPublicProbe.sha256);
  for (const [name, expected] of Object.entries(probe.gameAssetHashes)) assert.equal(hash(await readFile(new URL(`public/python/${name}`, root))), expected, name);
});

for (const c of fixture.cases as R[]) test(`Python ↔ TypeScript rooted quota: ${c.id}`, async () => {
  const a = c.arguments, scene = a.scene ? fixture.scenes[a.scene] : null, memory = restored(a.ownEvents);
  const state = memory.currentState(), proposal = a.proposal ? clone(fixture.plans[a.proposal]) : null;
  let actual: any;
  const calculate = () => c.operation === 'marginals' ? measureRootedPrefixMarginals(clone(a.request), () => 0)
    : measureIndexedPrefixPrimitive(clone(a.request), () => 0);
  switch (c.operation) {
    case 'measure': actual = measureRootedQuota(scene.rows, a.contentPalette); break;
    case 'lengths': actual = measureRootedLengths(scene.rows, clone(a.geometry), clone(a.model)); break;
    case 'cells': actual = rootedQuotaCells(clone(a.geometry)); break;
    case 'quotas': actual = rootedQuotaQuotas(clone(a.geometry)); break;
    case 'scope': actual = rootedQuotaRequestBase(a.observation, a.model, a.contribution, 300000, () => 0).scope; break;
    case 'propagate': actual = propagateRootedQuota(a.geometry, a.observation, a.model, 300000, () => 0); break;
    case 'step': actual = stepRootedQuota(a.geometry, a.lengths, a.chain, a.rank, a.observation, a.model, 300000, () => 0); break;
    case 'marginals': case 'primitive':
      if (c.expected.rejected) { assert.throws(calculate); return; }
      actual = calculate(); break;
    case 'propose':
      actual = memory.proposeRooted(clone(scene.observation), clone(scene.rows), [], a.remaining, clone(a.policy), 300000, () => 0);
      assert.deepEqual(memory.currentState(), state, 'A question is not acquired edit knowledge'); break;
    case 'common_propose': {
      const invoke = () => commonRootedQuotaProposal(memory, clone(scene.observation), clone(scene.rows), [], a.remaining,
        clone(a.policy), a.deadlinePresent ? 300000 : null, () => 0);
      if (c.expected?.rejected) { await assert.rejects(invoke); return; }
      actual = await invoke(); assert.deepEqual(memory.currentState(), state); break;
    }
    case 'bind': {
      const domain = new ObservedInputDomain(4096); if (a.observed) domain.candidates(scene.observation);
      if (c.expected.rejected) { assert.throws(() => bindRootedQuota(proposal!, domain), /not currently observed/); return; }
      bindRootedQuota(proposal!, domain); actual = proposal; break;
    }
    case 'before': actual = rootedQuotaBefore(proposal!, a.index, clone(scene.rows), clone(a.meta)); break;
    case 'after': actual = rootedQuotaAfter(proposal!, a.index, clone(fixture.scenes[a.before].rows), clone(fixture.scenes[a.after].rows), clone(a.meta)); break;
    case 'record': {
      const before = fixture.scenes[a.before], after = fixture.scenes[a.after];
      const inputs = [clone(before.observation), clone(a.command), clone(after.observation), clone(before.rows), clone(after.rows), proposal!, a.index] as const;
      const unchanged = clone(inputs), events = memory.record(...inputs);
      assert.deepEqual(inputs, unchanged);
      assert.equal(c.expected.sourceParentRecordCalls, 0, 'The original rooted plan cuts its older record chain');
      assert.deepEqual(events, c.expected.events);
      assert.deepEqual(memory.currentState(), c.expected.state.projection);
      assert.equal(memory.retainedDigest(c.expected.state.parentDigest), c.expected.state.digest);
      assert.deepEqual(restored(memory.currentState().quota_events).currentState(), memory.currentState());
      return;
    }
    default: throw new Error(`Unrecognized rooted operation ${c.operation}`);
  }
  assert.deepEqual(actual, c.expected);
});

test('the original component actually reached three levels cold, without any source-caller selection claim', () => {
  assert.equal(probe.status, 'passed'); assert.equal(probe.actions, 11); assert.equal(probe.levelsCompleted, 3);
  assert.equal(probe.sessionCount, 1); assert.equal(probe.manualPrimingActions, 0);
  assert.equal(probe.state, 'NOT_FINISHED'); assert.match(probe.scope, /not original full common caller/);
  assert.deepEqual(probe.boundaries.map((value: R) => value.levelActions), [4, 3, 4]);
  assert.equal(probe.packets.length, 12);
  assert.deepEqual(probe.prefixes.slice(0, 2).map((prefix: R) => prefix.proposal.actions.length), [1, 1]);
  assert.equal(probe.prefixes[0].proposal.rooted_quota_plan.phase, 'discriminate_local_effect_from_rooted_prefix');
  assert.equal(probe.prefixes[1].proposal.rooted_quota_plan.phase, 'discriminate_truncation_from_repeated_toggle');
});

test('true combined original envelopes match native passive acquisition, including the first official boundary', async () => {
  const family = new SharedSeriesConstraint(recallPolicy), domain = new ObservedInputDomain(4096);
  assert.deepEqual(family.state().events, []);
  let transitions = 0, official = 0;
  for (const envelope of fixture.commonEnvelopes as R[]) {
    const view = fixture.scenes[`public:${envelope.beforeIndex}`], inputs = domain.candidates(view.observation);
    const proposal = await family.rootedPropose(view.observation, view.rows, inputs, 120, fixture.policy, 300000, () => 0);
    assert.deepEqual(proposal, envelope.proposal);
    family.bind(proposal!, domain); assert.deepEqual(proposal, envelope.boundProposal);
    for (const item of envelope.steps as R[]) {
      const before = fixture.scenes[`public:${item.actionIndex - 1}`], after = fixture.scenes[`public:${item.actionIndex}`];
      assert.deepEqual(family.before(proposal!, item.index, before.public, before.observation), item.beforeGuard);
      assert.deepEqual(family.after(proposal!, item.index, before.observation, after.observation, before.rows, after.rows), item.outcome);
      const result = family.record(before.observation, after.observation, proposal!.actions[item.index], before.rows, after.rows, proposal!, item.index, after.public.frame_packet);
      assert.deepEqual(result, item.record, 'Complete source family acquisition envelope, including passive events');
      assert.deepEqual(family.state().events, item.state.events, 'Complete supported journal event sequence equals original envelope');
      assert.deepEqual(family.rooted.currentState(), item.rootedState.projection);
      const checkpoint = family.state(), rebuilt = new SharedSeriesConstraint(recallPolicy);
      rebuilt.restore(clone(checkpoint)); assert.deepEqual(rebuilt.state(), checkpoint);
      assert.deepEqual(rebuilt.rooted.currentState(), family.rooted.currentState());
      assert.notEqual(checkpoint.digest, item.state.digest, 'Native supported closure is explicitly narrower than full original inheritance');
      transitions++; official += Number(result.status === 'official_boundary_witness');
    }
  }
  assert.equal(transitions, 11); assert.equal(official, 3);
  assert.match(SHARED_SERIES_DIGEST_SCOPE, /rooted_quota/);
  assert.equal(family.rooted.requestedStopReason, null);
  const checkpoint = family.state(), tampered = clone(checkpoint);
  tampered.events.find((event: R) => event.kind === 'rooted_quota_state').model.empty_palette = 99;
  assert.throws(() => family.restore(tampered), /changed during recall/);
  assert.deepEqual(family.state(), checkpoint, 'Rejected reconstruction preserves the acquired journal');
});

test('rooted acquisition owns its event payloads and refutations survive the shared reducer/stop interface', () => {
  const source = fixture.cases.find((item: R) => item.id === 'record:unchanged_initial_effect');
  const event = clone(source.expected.events[0]), memory = new RootedQuotaMemory();
  memory.applyEvent(event);
  const state = memory.currentState(), digest = memory.retainedDigest('ancestor'), revision = memory.nativeRevision;
  event.model.evidence.push('foreign'); state.quota_model.evidence.push('foreign'); state.quota_events.length = 0;
  assert.equal(memory.retainedDigest('ancestor'), digest); assert.equal(memory.nativeRevision, revision);
  assert.equal(memory.requestedStopReason, source.expected.state.projection.requested_stop_reason);
  assert.throws(() => memory.applyEvent({ kind: 'other' }), /Outside rooted/);
  const family = new SharedSeriesConstraint(recallPolicy), scene = fixture.scenes['public:0'], proposal = clone(fixture.plans['public:prefix:0']);
  family.record(scene.observation, scene.observation, proposal.actions[0], scene.rows, scene.rows, proposal, 0, [scene.rows]);
  const saved = family.state(); assert.equal(family.rooted.requestedStopReason, 'indexed_edit_response_not_supported');
  const adapted = createNativeSharedSeriesFamily(recallPolicy, undefined, undefined, undefined, {}, undefined, fixture.policy);
  adapted.restore(saved);
  assert.equal(adapted.requestedStopReason!(scene.observation as NativeObservation), 'indexed_edit_response_not_supported');
  assert.deepEqual(adapted.state(), saved);
});

test('real time-bound interruption is retained as incomplete mechanical evidence, never a complete receipt', () => {
  const marginal = fixture.cases.find((item: R) => item.id === 'mechanical:marginals:complete').arguments.request;
  let tick = 0;
  const result = measureRootedPrefixMarginals({ ...clone(marginal), time_bound_ms: 1 }, () => tick++);
  assert.equal(result.status, 'NEEDS_EVIDENCE'); assert.equal(result.cause, 'TIME_BOUND');
  assert.equal(result.domain_complete, false); assert.equal(result.descriptive_facts.primitive_release_authorized, false);
  assert.equal(result.frontier.restart_unfinished_round, true);
  const primitive = fixture.cases.find((item: R) => item.id === 'mechanical:indexed:click').arguments.request;
  tick = 0;
  const second = measureIndexedPrefixPrimitive({ ...clone(primitive), time_bound_ms: 1 }, () => tick++);
  assert.equal(second.cause, 'TIME_BOUND'); assert.equal(second.domain_complete, false); assert.equal(second.frontier.restart_atomic_command, true);
});
