import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { RootedLineMemory, rootedLineBefore } from '../src/logos-engine/v6-rooted-line-access.ts';
import { planCellPush } from '../src/logos-engine/v6-rooted-line-revision.ts';
import { measureRootedLine } from '../src/logos-engine/v6-rooted-line-observation.ts';

const trace = new URL('../docs/migration/lot3d-evidence/final/sk48-rooted-session/sk48-public-trace.json.gz', import.meta.url);
const policy = new URL('../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/morphology_policy/strategy.drm', import.meta.url);

test('an observed push chain unblocks rooted-line search, retaining its estimate and counterexample', () => {
  const { packets } = JSON.parse(gunzipSync(readFileSync(trace)).toString());
  const config = JSON.parse(readFileSync(policy, 'utf8')).declarations[0].configuration.observed_composition_services;
  const memory = new RootedLineMemory();
  const observation = (index: number) => ({
    observation_ref: `local:epoch:1:revision:${index + 1}:frame:witness`,
    level_epoch: 1, levels_completed: 0, available_action_refs: packets[index].packet.available_action_refs,
  });
  let proposal;
  for (let i = 0; i < packets.length - 1; i++) {
    const before = packets[i].packet.frame_rows, { command, packet } = packets[i + 1];
    const index = i < 4 ? 0 : i - 4;
    if (!index) proposal = memory.propose(observation(i), before, [], 16, config);
    assert.equal(proposal?.actions[index].action_ref, command.action_ref);
    memory.record(observation(i), command, observation(i + 1), before, packet.frame_rows, proposal!, index);
  }
  const last = packets.length - 1, current = observation(last), rows = packets[last].packet.frame_rows;
  const state = memory.currentState().line_memory;
  assert.equal(state.refuted[0]?.cell_push_witness, true);
  const revised = memory.propose(current, rows, [], 16, config)!;
  assert.equal(revised.rooted_line_plan.search.operation, 'OP26');
  assert.equal(revised.bundle_template.operation_key, 'OP18');
  assert.deepEqual(revised.actions, [{ action_ref: 'ACTION3' }]);
  assert.equal(rootedLineBefore(revised, 0, rows, {
    epoch: 1, score: 0, observation_ref: current.observation_ref, available: current.available_action_refs,
  }).admitted, true);
  assert.equal(planCellPush(measureRootedLine(rows)!, state.controls, 1, 1000, () => false), null);
  assert.equal(planCellPush(measureRootedLine(rows)!, state.controls, 20, 1000, () => true), null);
});
