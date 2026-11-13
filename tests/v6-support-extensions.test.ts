import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { JointTransport, measureJointTransport } from '../src/logos-engine/v6-joint-transport.ts';
import { ContextualCompartments, measureContextualCompartments, measureProgramInstructionShape } from '../src/logos-engine/v6-contextual-compartments.ts';
import { InvitedReduction } from '../src/logos-engine/v6-invited-reduction.ts';
import { measureRayCaptureDomain } from '../src/logos-engine/v6-ray-capture-domain.ts';
import { NativeKnowledgeStore } from '../src/logos-engine/v6-knowledge-store.ts';
import { ObservedInputDomain } from '../src/logos-engine/v6-native-observer.ts';
type R = Record<string, any>;
const data = JSON.parse(gunzipSync(await readFile(new URL('./fixtures/v6-support-extensions-reference.json.gz', import.meta.url))).toString());
const fresh = (kind: string): any => kind === 'joint' ? new JointTransport(data.policy.joint_transport_question) : kind === 'reduction' ? new InvitedReduction(data.policy.invited_reduction) : new ContextualCompartments(data.policy.contextual_compartments);

test('support extensions source oracle retains unchanged pinned implementation bytes', async () => {
  for (const [path, expected] of Object.entries(data.sourceHashes)) {
    const bytes = await readFile(new URL(`../reference/v6/${data.commit}/source/${path}`, import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), expected, path);
  }
});

for (const session of data.games) test(`original family public campaign: ${session.game} / ${session.kind}`, async () => {
  let family = fresh(session.kind), current = session.initial, acquired = 0;
  const store = new NativeKnowledgeStore('support-extension-source-oracle', session.game);
  for (const [prefixIndex, prefix] of session.journal.entries()) {
    if (session.kind === 'joint') family.level_deadline = performance.now() / 1000 + 360;
    const domain = new ObservedInputDomain(4096), proposal = await family.propose(current.observation, current.public.frame_rows, domain.candidates(current.observation), prefix.remaining);
    assert.deepEqual(proposal, prefix.proposal, `proposal ${prefixIndex}`);
    assert.deepEqual(family.state(), prefix.proposedState, `state after proposal ${prefixIndex}`);
    if (!proposal) continue;
    const witnessed: R[] = [];
    for (const [index, step] of prefix.steps.entries()) {
      assert.deepEqual(await family.before(proposal, index, current.public, current.observation), step.beforeGuard, `before ${prefixIndex}/${index}`);
      if (!step.after) continue;
      assert.deepEqual(await family.after(proposal, index, current.observation, step.after.observation, current.public.frame_rows, step.after.public.frame_rows), step.afterGuard, `after ${prefixIndex}/${index}`);
      witnessed.push({ before: current, after: step.after, index, expected: step }); current = step.after;
    }
    for (const { before, after, index, expected } of witnessed) {
      const result = await family.record(before.observation, after.observation, proposal.actions[index], before.public.frame_rows, after.public.frame_rows, proposal, index, after.public.frame_packet);
      assert.deepEqual(result, expected.record, `acquisition ${prefixIndex}/${index}`);
      assert.deepEqual(family.state(), expected.state, `retained state ${prefixIndex}/${index}`); acquired++;
    }
    assert.deepEqual(family.state(), prefix.finalState);
    await store.commit([{ id: `family_state:${family.id}`, kind: 'family_state', family: family.id, value: family.state() }], { workflow: 'support.original.parity', step: 'sealed_prefix', statement: String(prefixIndex) });
    family = fresh(session.kind); await family.restore(store.stateValue(`family_state:${family.id}`)); assert.deepEqual(family.state(), prefix.finalState, 'complete state restored from real V7 node');
  }
  assert.equal(acquired, session.actions); assert.deepEqual(family.state(), session.finalState);
  assert.equal(current.public.levels_completed, session.levelsCompleted);
});

test('contextual compartment controls acquire dependencies and reuse retained transitions', async () => {
  let family = new ContextualCompartments(data.policy.contextual_compartments);
  const store = new NativeKnowledgeStore('support-extension-source-oracle', 'controlled-compartments');
  for (const [i, row] of data.compartments.entries()) {
    assert.deepEqual(await measureContextualCompartments(row.before.public.frame_rows, family.mark), row.measurement);
    const proposal = await family.propose(row.before.observation, row.before.public.frame_rows, row.before.inputs, 100);
    assert.deepEqual(proposal, row.proposal, `compartment proposal ${i}`); assert.deepEqual(family.state(), row.proposedState);
    if (proposal) {
      assert.deepEqual(await family.before(proposal, 0, row.before.public, row.before.observation), row.beforeGuard);
      assert.deepEqual(await family.after(proposal, 0, row.before.observation, row.after.observation, row.before.public.frame_rows, row.after.public.frame_rows), row.afterGuard);
      assert.deepEqual(await family.record(row.before.observation, row.after.observation, proposal.actions[0], row.before.public.frame_rows, row.after.public.frame_rows, proposal, 0), row.record);
    }
    assert.deepEqual(family.state(), row.state);
    await store.commit([{ id: 'family_state:contextual_compartments', kind: 'family_state', family: family.id, value: family.state() }], { workflow: 'support.original.parity', step: 'controlled_scene', statement: String(i) });
    family = new ContextualCompartments(data.policy.contextual_compartments); family.restore(store.stateValue('family_state:contextual_compartments') as R); assert.deepEqual(family.state(), row.state);
  }
  assert.ok(data.compartments.some((x: R) => x.proposal), 'positive controlled scene is required');
});

for (const [i, row] of data.shapes.entries()) test(`bounded instruction shape source parity ${i}`, () => assert.deepEqual(measureProgramInstructionShape(row.support), row.result));
for (const row of data.rays) test(`typed ray/short capture source parity: ${row.name}`, () => assert.deepEqual(measureRayCaptureDomain(row.request), row.result));

test('joint transfer requires a live caller deadline and rejects changed authorizations', async () => {
  const initial = data.games.find((s: R) => s.kind === 'joint').initial, family = new JointTransport(data.policy.joint_transport_question, () => 100);
  assert.equal(await family.propose(initial.observation, initial.public.frame_rows, initial.inputs, 240), null);
  family.level_deadline = 99; assert.equal(await family.propose(initial.observation, initial.public.frame_rows, initial.inputs, 240), null);
  family.level_deadline = 460; const proposal = await family.propose(initial.observation, initial.public.frame_rows, initial.inputs, 240); assert.ok(proposal);
  assert.equal((await family.before(proposal, 0, initial.public, initial.observation)).admitted, true);
  const altered = structuredClone(proposal); altered.actions[0].action_ref = 'ACTION5';
  assert.equal((await family.before(altered, 0, initial.public, initial.observation)).admitted, false);
  assert.throws(() => measureJointTransport(Array.from({ length: 64 }, () => Array(64).fill(0))));
});
