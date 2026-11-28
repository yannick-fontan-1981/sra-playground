import { randomUUID } from 'node:crypto';
import { NativeV6Runtime } from '../../src/logos-engine/v6-native-runtime.ts';
import { ObservedInputDomain } from '../../src/logos-engine/v6-native-observer.ts';
import { V6AgentService } from '../../src/runtime/v6-agent-service.ts';
import { toV6PublicObservation } from '../../src/runtime/v6-agent-protocol.ts';
import { initialModels, observationKey, transitions } from './models.mjs';
import { observeControl, retainedControl } from './rejouer.mjs';
import { scenario } from './terrain.mjs';

const familyId = 'experimental_delayed_passage';
const exitPoints = { left: [11, 44], right: [41, 44] };
const indicators = { position: [8, 9], open: [12, 9], target: [16, 9], outcome: [20, 9], armed: [24, 9] };

function actions(rules) {
  return new Map([
    ...rules.controls.map((code, index) => [code, { action_ref: 'ACTION' + (index + 1), data: {} }]),
    ['advance', { action_ref: 'ACTION4', data: {} }],
    ['inspect', { action_ref: 'ACTION5', data: {} }],
    ['wait', { action_ref: 'ACTION7', data: {} }],
    ...Object.entries(exitPoints).map(([code, [x, y]]) => [code, { action_ref: 'ACTION6', data: { x, y } }]),
  ]);
}

function packet({ position, open, target, outcome, armed }, allowed) {
  const frame = Array.from({ length: 64 }, () => Array(64).fill(0));
  for (const [x, y] of Object.values(exitPoints)) {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) frame[y + dy][x + dx] = 7;
  }
  const marks = { position: position + 1, open: open ? 4 : 5, target: [null, 'left', 'right'].indexOf(target) + 8,
    outcome: [null, 'win', 'loss'].indexOf(outcome) + 11, armed: armed === undefined ? 0 : armed ? 14 : 15 };
  for (const [field, [x, y]] of Object.entries(indicators)) frame[y][x] = marks[field];
  return {
    gameCode: 'DELAYED-PASSAGE', frame, frames: [frame], level: 1, levelCount: 1,
    levelsCompleted: outcome === 'win' ? 1 : 0, state: outcome === 'win' ? 'WIN' : outcome === 'loss' ? 'GAME_OVER' : 'NOT_FINISHED',
    availableActionIds: [...new Set([...allowed.values()].map(command => Number(command.action_ref.slice(6))))],
    canUndo: false, canSelectLevel: false, defaultFps: 10,
  };
}

function decode(rows) {
  const value = ([x, y]) => rows[y][x];
  return {
    position: value(indicators.position) - 1, open: value(indicators.open) === 4,
    target: [null, 'left', 'right'][value(indicators.target) - 8],
    outcome: [null, 'win', 'loss'][value(indicators.outcome) - 11],
    ...(value(indicators.armed) ? { armed: value(indicators.armed) === 14 } : {}),
  };
}

function family(rules, controller, commands) {
  let models = initialModels(rules), stop, learned;
  const outcomes = (rows, choice) => transitions(rules, decode(rows), models, choice);
  const controlSet = candidates => [...new Set(candidates.map(model => model.control))];
  return {
    get stop() { return stop; },
    id: familyId,
    async propose(observation, rows, _inputs, remaining) {
      const decision = controller.decide({ observed: decode(rows), models, remaining });
      if (decision.action === undefined) {
        stop = decision;
        return null;
      }
      const command = commands.get(decision.action);
      if (!observation.available_action_refs.includes(command.action_ref)) return null;
      const point = Object.hasOwn(exitPoints, decision.action) ? exitPoints[decision.action] : undefined;
      const binding = point && await ObservedInputDomain.makeLocusWitness(observation, rows, point, {
        reason: 'Public exit locus', evidence: [observation.observation_ref],
      });
      return {
        status: 'proposed', kind: familyId, actions: [command], steps: [binding ? { point_binding: binding } : {}],
        observedAt: observation.observation_ref, decision,
      };
    },
    before: (proposal, _index, _packet, observation) => ({
      admitted: proposal.observedAt === observation.observation_ref,
      reason: 'current_delayed_passage_observation',
    }),
    after(proposal, _index, _before, _after, beforeRows, afterRows) {
      const predictions = outcomes(beforeRows, proposal.decision.action);
      const found = predictions.has(observationKey(decode(afterRows)));
      return { matched: found ? predictions.size === 1 ? true : null : false, seal_prefix: true,
        reason: found ? 'returned_observation_checked' : 'unexpected_delayed_passage_observation' };
    },
    record(before, after, _command, beforeRows, afterRows, proposal) {
      const returned = decode(afterRows);
      const branch = outcomes(beforeRows, proposal.decision.action).get(observationKey(returned));
      if (branch) {
        learned = observeControl(rules, decode(beforeRows), returned, controlSet(models), controlSet(branch.models),
          { before: before.observation_ref, after: after.observation_ref }, learned);
        models = branch.models;
      }
      return { events: [] };
    },
    state: () => ({ models, ...(learned ? { learned } : {}) }),
    restore(state) { models = state.models; learned = state.learned; },
  };
}

export async function playNative(spec, policy, transferred = undefined) {
  const terrain = scenario(spec);
  const { rules } = terrain;
  const prior = retainedControl(rules, transferred);
  const commands = actions(rules), candidate = family(rules, policy(rules, prior), commands);
  const service = new V6AgentService(() => new NativeV6Runtime({
    sourceDigest: familyId, maxPointOccurrences: 250, families: [candidate],
    groups: [{ id: familyId, families: [familyId] }],
  }));
  const sessionId = 'delayed-passage-' + randomUUID();
  let sequence = 0, observed = terrain.read();
  const transport = () => toV6PublicObservation(packet(observed, commands), sequence);
  let reply = await service.handle({ type: 'init', sessionId, sequence, observation: transport(),
    budgets: { targetLevels: 1, maxActions: rules.moveBudget, levelActionCaps: [rules.moveBudget] } });
  const moves = [];
  while (reply.ticket) {
    const ticket = reply.ticket;
    const entry = [...commands].find(([, command]) => command.action_ref === ticket.actionRef
      && command.data.x === ticket.data.x && command.data.y === ticket.data.y);
    if (!entry) throw new Error('Native ticket did not bind an available terrain action');
    const [action] = entry;
    observed = terrain.step(action);
    moves.push({ action, ticket: ticket.id, observationRef: ticket.observationRef, returned: observed });
    sequence++;
    reply = await service.handle({ type: 'advance', sessionId, sequence, ticketId: ticket.id,
      executionMs: 1, observation: transport() });
    if (reply.kind === 'boundary' && !observed.outcome && sequence < rules.moveBudget) {
      reply = await service.handle({ type: 'resume', sessionId, sequence });
    }
  }
  return { moves, observed, stop: candidate.stop, kind: reply.kind, nativeActions: reply.snapshot.actions,
    prior, learned: candidate.state().learned };
}
