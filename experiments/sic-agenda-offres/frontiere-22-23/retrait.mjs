// Deux restaurations natives depuis la même mémoire. Une seule entrée admise est retirée.
import assert from 'node:assert/strict';
import { observeFrontier } from './observation.mjs';
import { predict } from './prediction.mjs';
const rows = [];
observeFrontier(seal => rows.push({ pre: JSON.parse(seal.payload), prediction: predict(seal) }));
const { ObservedFrontier } = await import('../../../src/logos-engine/v6-observed-frontier.ts');
const action = id => ({ action_ref: 'ACTION' + id });
const a = { observation_ref: 'fixture:A', frame_hash: 'board-a', level_epoch: 1, state: 'NOT_FINISHED',
  levels_completed: 0, available_action_refs: ['ACTION4', 'ACTION5'] };
const b = { ...a, observation_ref: 'fixture:B', frame_hash: 'board-b', available_action_refs: ['ACTION1'] };
const base = new ObservedFrontier(1, 4);
await base.observe(a, [action(4), action(5)]);
const witness = await base.recordTransition(a, action(4), b, { after_action_candidates: [action(1)] });
const memory = base.snapshot();
const proposals = [];
for (const commands of [[action(4), action(5)], [action(4)]]) {
  const graph = new ObservedFrontier(1, 4, memory);
  const p = await graph.propose(a, commands, { sic_agenda: true, sic_frontier: { inputOrder: 'least_tried' } });
  const { pre, prediction } = rows.at(-1);
  assert.equal(p.sic_frontier_decision.strategy, prediction.strategy);
  assert.deepEqual(p.actions[0], prediction.command);
  proposals.push({ ref: pre.observation, routeStatus: pre.routeStatus, action: prediction.command.action_ref,
    strategy: prediction.strategy, question: prediction.question });
}
assert.deepEqual(proposals.map(p => p.action), ['ACTION5', 'ACTION4']);
assert.deepEqual(proposals.map(p => p.strategy), ['test_local_input', 'reach_open_input']);
assert.deepEqual(proposals.map(p => p.routeStatus), ['unqueried', 'found']);
assert.equal(rows[0].pre.index, rows[1].pre.index);
assert.equal(rows[1].pre.path[0].ref, witness.edge_ref);
assert.deepEqual(rows[1].pre.path[0].witnesses, [witness.transition_ref]);
assert.deepEqual(rows[0].pre.domain.filter(d => d.command.action_ref !== 'ACTION5'), rows[1].pre.domain);
assert.equal(rows[1].pre.remote.action.action_ref, 'ACTION1');
assert.deepEqual(base.snapshot(), memory);
process.stdout.write(JSON.stringify({ proposals, witness: witness.transition_ref }));
