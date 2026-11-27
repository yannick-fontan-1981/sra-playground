import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { sourceBackend } from '../scripts/sic-study-source-games.mjs';
import { LinkedTemporalPreparation } from '../src/logos-engine/v6-linked-temporal-preparation.ts';
import { createNativeV6Runtime } from '../src/logos-engine/v6-native-runtime.ts';
import { V6AgentService } from '../src/runtime/v6-agent-service.ts';
import { toV6PublicObservation, type V6Command } from '../src/runtime/v6-agent-protocol.ts';

type Row = Record<string, any>;
const fixture = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/sic-linked-contact-g50t-public.json.gz', import.meta.url))).toString());
const source = new URL('../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/', import.meta.url);
const read = (p: string) => JSON.parse(readFileSync(new URL(p, source), 'utf8'));
const declarations = { common: read('laya_proto/common_frontier_policy.drm.json'), strategy: read('morphology_policy/strategy.drm') };
const carrier = '9377082569ed42fe9b01ec63cc82ad5830e10c23e6a57819c134e54024168cb5';

test('G50T native binding, access and remote contact remain distinct from L1 through the departure trial', async t => {
  const observed = new Map<number, { beforeRef: string; afterRef: string; pose: unknown; vectors: ReadonlyMap<string, unknown>;
    contact: Row | null; departure: Row | null; reversal: Row | null; events: Row[] }>();
  const record = LinkedTemporalPreparation.prototype.recordSource;
  t.mock.method(LinkedTemporalPreparation.prototype, 'recordSource', function (this: LinkedTemporalPreparation, ...args: Parameters<typeof record>) {
    const events = record.apply(this, args), [before, after] = args, contact = this.phase.linked_contact;
    observed.set(after.revision, { beforeRef: before.observation_ref, afterRef: after.observation_ref, pose: this.phase.states.at(-1)?.poses[carrier],
      vectors: new Map(contact.vectors), contact: contact.contact, departure: contact.departure, reversal: contact.reversal, events });
    return events;
  });
  const backend = process.env.SIC_LINKED_GAME_ROOT ? await sourceBackend(process.env.SIC_LINKED_GAME_ROOT) : null;
  function input(sequence: number, command?: V6Command) {
    const historical = fixture.observations[sequence];
    if (!backend) return historical;
    const board = backend.dispatch(command ? { type: 'action', actionId: Number(command.actionRef.slice(6)), data: command.data } : { type: 'load', code: 'G50T', level: 1 });
    const packet = toV6PublicObservation(board, sequence);
    const { palette, ...fields } = packet;
    assert.deepEqual(fields, historical, 'G50T public return ' + sequence);
    return packet;
  }
  const runtime = await createNativeV6Runtime(declarations, { now: () => 0 });
  const service = new V6AgentService(() => runtime), sessionId = fixture.sessionId;
  let result = await service.handle({ type: 'init', sessionId, sequence: 0, budgets: fixture.budgets, observation: input(0) });
  let contactRef: string | undefined;
  for (let turn = 1; turn <= 16; turn++) {
    if (result.kind === 'boundary') result = await service.handle({ type: 'resume', sessionId, sequence: turn - 1 });
    assert.equal(result.kind, 'action');
    const command = result.command!, trace = result.snapshot.trace as readonly Row[];
    const release = trace.findLast(e => e.kind === 'sic_native_plan')!, guard = trace.findLast(e => e.kind === 'before_guard')!;
    const proposal = result.snapshot.proposal as Row, plan = proposal.phase_plan, binding = [3, 4, 5, 9].includes(turn);
    assert.equal(command.actionRef, 'ACTION' + fixture.commands[turn - 1].id);
    assert.equal(guard.admitted, true);
    if (turn < 3) assert.equal(release.family, 'observed_frontier');
    else if (turn > 10) {
      assert.deepEqual([release.family, proposal.kind, plan.mode, release.missingControl],
        ['linked_temporal_preparation', 'linked_contact_experiment', turn === 11 ? 'phase' : 'access', undefined]);
    } else {
      assert.deepEqual([release.family, release.authority, proposal.kind, plan.primary, plan.site, plan.mode, guard.reason],
        ['linked_temporal_preparation', 'native', 'linked_contact_experiment', carrier, [38, 8], binding ? 'binding' : 'access', 'linked_contact_receiver_bound']);
      const step = proposal.steps[guard.index];
      assert.equal(step.action.action_ref, command.actionRef);
      if (binding) {
        assert.equal(step.to, null);
        const evidence = turn === 9 ? [release.observationRef, contactRef] : [release.observationRef];
        assert.deepEqual(proposal.question.hypothesis_refs, evidence);
        assert.equal(release.missingControl.id, 'test_missing_control');
        assert.equal(release.missingControl.action, command.actionRef);
        assert.ok(release.missingControl.evidence.includes(release.observationRef));
      } else {
        assert.equal(release.missingControl, undefined);
        if (turn >= 6 && turn <= 8) {
          assert.equal(guard.index, turn - 6);
          assert.deepEqual([step.from, step.to], [[20 + 6 * (turn - 6), 8], [26 + 6 * (turn - 6), 8]]);
        }
      }
    }
    result = await service.handle({ type: 'advance', sessionId, sequence: turn, ticketId: result.ticket!.id, observation: input(turn, command), executionMs: 0 });
    if (turn < 3 || turn > 10) continue;
    const outcome = (result.snapshot.trace as readonly Row[]).findLast(e => e.kind === 'actual_outcome')!;
    assert.deepEqual([outcome.family, outcome.reason, outcome.matched], [release.family, 'linked_contact_conditional_response', binding ? null : true]);
    // The three access steps enter shared memory together when the prefix is sealed at turn eight.
    if (turn === 6 || turn === 7) continue;
    const contact = observed.get(turn + 1)!;
    assert.equal(contact.afterRef, outcome.observation_ref);
    if (turn === 3) {
      assert.deepEqual([plan.from, contact.pose, contact.vectors.get('ACTION1')], [[14, 14], [14, 8], [0, -6]]);
    }
    if (turn === 4) {
      assert.deepEqual(contact.pose, [14, 8]);
      assert.ok(!contact.vectors.has('ACTION3'));
    }
    if (turn === 5) assert.deepEqual([contact.pose, contact.vectors.get('ACTION4')], [[20, 8], [6, 0]]);
    if (turn < 8) {
      assert.equal(contact.contact, null);
      assert.ok(!contact.events.some(e => e.kind === 'linked_contact_effect'));
    }
    if (turn === 8) {
      for (const [revision, position] of [[7, [26, 8]], [8, [32, 8]]] as const) {
        const approach = observed.get(revision)!;
        assert.deepEqual(approach.pose, position);
        assert.equal(approach.contact, null);
        assert.ok(!approach.events.some(e => e.kind === 'linked_contact_effect'));
      }
      contactRef = outcome.observation_ref;
      const event = contact.events.find(e => e.kind === 'linked_contact_effect')!;
      assert.deepEqual([event.site, event.from, event.action, event.before_ref, event.after_ref, event.exclusive_cause_established],
        [[38, 8], [32, 8], 'ACTION4', contact.beforeRef, contactRef, false]);
      assert.equal(event.pixels.length, 23);
      for (const [x, y, old, changed] of event.pixels) {
        assert.equal(fixture.observations[7].frame[y][x], old);
        assert.equal(fixture.observations[8].frame[y][x], changed);
        assert.notEqual(old, changed);
      }
    }
    if (turn === 9) assert.deepEqual([contact.departure!.position, contact.departure!.remote_restored, contact.departure!.effect_pixels], [[32, 8], true, 23]);
    if (turn === 10) assert.equal(contact.reversal!.conditional_hold_supported, true);
  }
});
