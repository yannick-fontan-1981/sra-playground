import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createNativeInterfaceFamilies } from '../src/logos-engine/v6-native-interface-families.ts';
import type { NativeInterfaceQuestion } from '../src/logos-engine/v6-native-interface-families.ts';
import { NativeKnowledgeStore } from '../src/logos-engine/v6-knowledge-store.ts';
import { ObservedInputDomain } from '../src/logos-engine/v6-native-observer.ts';
import type { NativeFamily, NativeProposal, NativeRecord } from '../src/logos-engine/v6-native-types.ts';

// Expectations are the immutable, independently exported Python journals used
// by the family transfer tests. Here they cross the new runtime adapter and the
// actual common V7 graph, including asynchronous acquisition and source guards.
const fixture = JSON.parse(await readFile(new URL('./fixtures/v6-interface-families-reference.json', import.meta.url), 'utf8'));
const questions: Record<string, NativeInterfaceQuestion> = {
  slot: 'slot_substitution', word: 'typed_word_interface',
  port: 'rigid_port_assembly', cover: 'controlled_constellation_cover',
};
const ids: Record<string, string> = {
  slot: 'slot_substitution', word: 'word_interface', port: 'port_assembly', cover: 'constellation_cover',
};
const decorate = (proposal: any, question: NativeInterfaceQuestion): NativeProposal | null =>
  proposal === null ? null : { ...structuredClone(proposal), program_subquestion: question };

for (const scenario of fixture.scenarios) {
  test(`native program interface / V7 persistence: ${scenario.id}`, async () => {
    const question = questions[scenario.family]!;
    const fresh = (): NativeFamily => createNativeInterfaceFamilies()[question];
    let family = fresh(), proposal: NativeProposal | null = null, domain: ObservedInputDomain | null = null;
    assert.equal(family.id, ids[scenario.family]);
    const store = new NativeKnowledgeStore('original-interface-oracle', scenario.id);
    const nodeId = `family_state:${family.id}`;
    let acquired = 0;

    for (const [ordinal, step] of scenario.steps.entries()) {
      const op = step.operation;
      let result: unknown = null, expected: unknown = step.expected.result;
      if (op.kind === 'seed') {
        family = fresh(); family.restore(op.state);
        proposal = decorate(op.proposal, question);
      } else if (op.kind === 'propose') {
        const current = fixture.scenes[op.scene];
        domain = new ObservedInputDomain(4096);
        const inputs = domain.candidates(current.observation);
        proposal = await family.propose(current.observation, current.rows, op.inputs ?? inputs, op.remaining ?? 100);
        result = proposal; expected = decorate(step.expected.result, question);
      } else if (op.kind === 'bind') {
        assert.ok(proposal); assert.ok(domain);
        await family.bind!(proposal, domain); result = proposal;
        expected = decorate(step.expected.result, question);
      } else if (op.kind === 'before') {
        assert.ok(proposal);
        result = await family.before(proposal, op.index ?? 0,
          fixture.scenes[op.scene].public, fixture.scenes[op.observation ?? op.scene].observation);
      } else if (op.kind === 'after' || op.kind === 'record') {
        assert.ok(proposal);
        const before = fixture.scenes[op.before], after = fixture.scenes[op.after], index = op.index ?? 0;
        if (op.kind === 'after') {
          result = await family.after(proposal, index, before.observation, after.observation, before.rows, after.rows);
        } else {
          result = await family.record(before.observation, after.observation, op.command ?? proposal.actions[index]!,
            before.rows, after.rows, proposal, index, after.public.frame_packet);
          expected = { events: [step.expected.result] };
          acquired += 1;
        }
      } else if (op.kind === 'proposal') {
        proposal = decorate(op.proposal, question); result = proposal;
        expected = decorate(step.expected.result, question);
      } else throw new Error(`Unexpected source journal operation: ${op.kind}`);

      assert.deepEqual(result, expected, `${ordinal} ${op.kind}: source result through the native adapter`);
      assert.deepEqual(family.state(), step.expected.state, `${ordinal} ${op.kind}: complete retained family state`);

      // Persist and reconstruct the real state rather than using the previous
      // working object's caches. This also rejects a leaked Promise from an
      // un-awaited Word/Constellation record before it could enter the graph.
      await store.commit([
        { id: nodeId, kind: 'family_state', family: family.id, value: family.state() },
        ...(op.kind === 'record' ? [{ id: `acquisition:${ordinal}`, kind: 'prefix_evidence' as const,
          family: family.id, value: result, relations: [{ relation: 'updates', target: nodeId }] }] : []),
      ], { workflow: 'v6.composition_strategy.choose', step: question, statement: op.kind });
      if (op.kind === 'record') assert.deepEqual(store.stateValue(`acquisition:${ordinal}`), expected);
      family = fresh(); family.restore(store.stateValue(nodeId) as NativeRecord);
      assert.deepEqual(family.state(), step.expected.state, `${ordinal} ${op.kind}: state acquired from the V7 node`);
    }
    assert.ok(acquired > 0, 'Every integration journal must actually acquire public transition evidence');
  });
}
