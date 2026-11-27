import assert from 'node:assert/strict';
import { ObservedInputDomain } from '../../src/logos-engine/v6-native-observer.ts';
import { NativeV6Runtime } from '../../src/logos-engine/v6-native-runtime.ts';
import type { NativeFamily } from '../../src/logos-engine/v6-native-types.ts';
import type { GameObservation } from '../../src/runtime/browser-games.ts';
import { V6AgentService } from '../../src/runtime/v6-agent-service.ts';
import { toV6PublicObservation } from '../../src/runtime/v6-agent-protocol.ts';

/** Drive the required native L1 start through unrelated public fixture boundaries.
 * The tested family's retained role is never modified by this fixture. */
export async function nativeAfterPublicBoundaries(family: NativeFamily<any>, next: GameObservation, sessionId: string, actionCap = 8, groupId?: string) {
  const source: NativeFamily = {
    id: 'test_public_boundary_source',
    async propose(observation, rows) {
      if (observation.levels_completed >= next.levelsCompleted) return null;
      const action_ref = observation.available_action_refs[0]!, action = { action_ref, data: action_ref === 'ACTION6' ? { x: 8, y: 8 } : {} };
      const point_binding = action_ref === 'ACTION6' ? await ObservedInputDomain.makeLocusWitness(observation, rows,
        [8, 8], { reason: 'Public boundary fixture', evidence: [observation.observation_ref] }) : undefined;
      return { status: 'proposed', kind: this.id, actions: [action], steps: [point_binding ? { point_binding } : {}],
        sicLocalDecision: { strategy: 'observe_public_input' } };
    },
    before: () => ({ admitted: true, reason: 'fixture_ready' }),
    after: () => ({ matched: true, seal_prefix: true, reason: 'fixture_observed' }),
    record: () => ({ events: [] }), state: () => ({}), restore() {},
  };
  const service = new V6AgentService(() => new NativeV6Runtime({ families: [family, source], sourceDigest: 'public-role-transfer', maxPointOccurrences: 250,
    ...(groupId ? { groups: [{ id: groupId, families: [family.id] },
      { id: 'public_boundary_fixture', families: [source.id] }] } : {}) }));
  const empty = Array.from({ length: 64 }, () => Array<number>(64).fill(0));
  const packet = (level: number) => level === next.level ? next : { ...next, level, levelsCompleted: level - 1, frame: empty, frames: [empty] };
  let sequence = 0, reply = await service.handle({ type: 'init', sessionId, sequence,
    observation: toV6PublicObservation(packet(1)), budgets: { targetLevels: next.level, levelActionCaps: Array(next.level).fill(actionCap) } });
  for (let level = 2; level <= next.level; level++) {
    assert.ok(reply.ticket);
    sequence++;
    reply = await service.handle({ type: 'advance', sessionId, sequence, ticketId: reply.ticket.id, executionMs: 1,
      observation: toV6PublicObservation(packet(level), sequence) });
    assert.equal(reply.kind, 'boundary');
    reply = await service.handle({ type: 'resume', sessionId, sequence });
  }
  return { service, reply, sequence, sessionId };
}
