import assert from 'node:assert/strict';
import { NativeV6Runtime } from '../../src/logos-engine/v6-native-runtime.ts';
import { ObservedInputDomain } from '../../src/logos-engine/v6-native-observer.ts';
import { toV6PublicObservation } from '../../src/runtime/v6-agent-protocol.ts';
import { V6AgentService } from '../../src/runtime/v6-agent-service.ts';
import { signal, signalKey } from './domain.mjs';

const familyId = 'experimental_conditional_composition';
const sessionId = 'conditional-composition-session';
const actionRef = 'ACTION6';

export function createNativeBridge(domain, policy) {
  const views = [...new Set(domain.worlds.flatMap(world => Object.values(world.nodes).map(node => node.view)))];
  const viewIndices = new Map(views.map((view, index) => [view, index]));
  const outcomes = [null, 'win', 'loss'];
  assert.ok(views.length <= 16 ** 3 && domain.actions.length <= 360);
  const commands = new Map(domain.actions.map((action, index) => [action, {
    action_ref: actionRef, data: { x: 2 + 3 * (index % 20), y: 8 + 3 * Math.floor(index / 20) },
  }]));

  let sequence = 0, last = signal(domain.worlds[0].nodes[domain.worlds[0].start]);
  let choice, proposal, acquisition, ticket, guarded, compared;
  function publicObservation() {
    const frame = Array.from({ length: 64 }, () => Array(64).fill(0));
    const index = viewIndices.get(last.view);
    assert.ok(index !== undefined && outcomes.includes(last.outcome));
    frame[2][2] = index % 16;
    frame[2][3] = Math.floor(index / 16) % 16;
    frame[2][4] = Math.floor(index / 256);
    frame[2][5] = outcomes.indexOf(last.outcome);
    for (const { data: { x, y } } of commands.values()) frame[y][x] = 7;
    return toV6PublicObservation({ gameCode: 'CONDITIONAL-COMPOSITION', frame, frames: [frame],
      level: 1, levelCount: 1, levelsCompleted: last.outcome === 'win' ? 1 : 0,
      state: last.outcome === 'win' ? 'WIN' : last.outcome === 'loss' ? 'GAME_OVER' : 'NOT_FINISHED',
      availableActionIds: last.outcome ? [] : [6], canUndo: false, canSelectLevel: false, defaultFps: 10 }, sequence);
  }
  function read(rows) {
    const view = views[rows[2][2] + rows[2][3] * 16 + rows[2][4] * 256];
    const outcome = outcomes[rows[2][5]];
    assert.ok(view !== undefined && outcome !== undefined, 'Invalid native public signal');
    return { view, outcome };
  }
  const family = {
    id: familyId,
    async propose(observation, rows) {
      const publicSignal = read(rows);
      assert.equal(signalKey(publicSignal), signalKey(last));
      assert.ok(!publicSignal.outcome);
      choice ??= policy.decide();
      if (choice.action === undefined) return null;
      if (proposal) return proposal;
      const command = commands.get(choice.action);
      assert.ok(observation.available_action_refs.includes(command.action_ref));
      const point = [command.data.x, command.data.y];
      const point_binding = await ObservedInputDomain.makeLocusWitness(observation, rows, point,
        { reason: 'Current public command locus', evidence: [observation.observation_ref] });
      assert.ok(point_binding);
      proposal = { status: 'proposed', kind: familyId, actions: [command], steps: [{ point_binding }],
        observedAt: observation.observation_ref };
      return proposal;
    },
    before(step, _index, _packet, observation) {
      const admitted = step.observedAt === observation.observation_ref
        && observation.available_action_refs.includes(actionRef);
      guarded = admitted;
      return { admitted, reason: 'current_public_command_locus' };
    },
    after(_step, _index, _before, _after, _beforeRows, afterRows) {
      const recognized = policy.expects(read(afterRows));
      compared = recognized;
      return { matched: recognized ? null : false, seal_prefix: true,
        reason: recognized ? 'public_contingent_branch_observed' : 'public_return_outside_hypotheses' };
    },
    record(before, after, _command, _first, second) {
      assert.ok(guarded && compared && before.observation_ref !== after.observation_ref);
      acquisition = policy.record(read(second));
      choice = undefined;
      proposal = undefined;
      return { events: [] };
    },
    state: () => ({ policy: policy.checkpoint(), choice: choice ?? null, proposal: proposal ?? null,
      acquisition: acquisition ?? null, guarded: guarded ?? false, compared: compared ?? false }),
    restore(saved) {
      if (!saved.policy) return;
      policy.restore(saved.policy);
      ({ choice, proposal, acquisition, guarded, compared } = saved);
    },
  };
  const service = new V6AgentService(() => new NativeV6Runtime({
    sourceDigest: familyId, maxPointOccurrences: 512, families: [family],
    groups: [{ id: familyId, families: [familyId] }],
  }));
  function decision(reply) {
    ticket = reply.ticket;
    if (!ticket) {
      assert.ok(choice?.stop, 'Native path withheld a planned command');
      return choice;
    }
    assert.ok(guarded && choice?.action !== undefined);
    const command = commands.get(choice.action);
    assert.equal(ticket.actionRef, command.action_ref);
    assert.deepEqual(ticket.data, command.data);
    return { ...choice, nativeTicket: true };
  }
  return {
    async start() {
      return decision(await service.handle({ type: 'init', sessionId, sequence,
        observation: publicObservation(), budgets: { targetLevels: 1, maxActions: domain.budget.commands,
          levelActionCaps: [domain.budget.commands] } }));
    },
    async advance(returned) {
      assert.ok(ticket);
      sequence++;
      compared = false;
      acquisition = undefined;
      last = returned;
      let reply = await service.handle({ type: 'advance', sessionId, sequence, ticketId: ticket.id,
        executionMs: 1, observation: publicObservation() });
      assert.ok(compared && acquisition, 'Native return was not compared and recorded');
      assert.equal(reply.snapshot.actions, sequence);
      if (returned.outcome) {
        assert.equal(reply.snapshot.levelsCompleted, returned.outcome === 'win' ? 1 : 0);
        return { acquisition, decision: null, nativeSealed: true };
      }
      if (sequence === domain.budget.commands) {
        return { acquisition, decision: policy.decide(), nativeSealed: true };
      }
      if (reply.kind === 'boundary') reply = await service.handle({ type: 'resume', sessionId, sequence });
      return { acquisition, decision: decision(reply), nativeSealed: true };
    },
  };
}
