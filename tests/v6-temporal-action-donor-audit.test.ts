import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

function donor(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

test('V5 public adapter exposes only a source-authorized pending action', () => {
  const source = donor('reference/sra/212d8d426f07/agents/yf_arc3_v5/agent.py');
  assert.match(source, /V5 has no source-authorized action to choose/);
  assert.match(source, /authority": "source_action_release_permit"/);
  assert.match(source, /"action_intent_id": pending\["action_intent_id"\]/);
  assert.match(source, /"source_hash": pending\["source_hash"\]/);
  assert.match(source, /pending\.get\("action_ref"\) != action\.name/);
});

test('V5 execution rechecks exact runtime context before dispatch', () => {
  const source = donor('reference/sra/212d8d426f07/agents/yf_arc3_v5/agent.py');
  assert.match(source, /execute_pending_action/);
  for (const field of ['run_id', 'timeline_id', 'frame_id', 'state_revision']) {
    assert.equal(source.includes(`"${field}"`), true, `missing expected context field ${field}`);
  }
});

test('released action cycle keeps grounding, wisdom, release and ACT as distinct stages', () => {
  const source = donor('reference/sra/212d8d426f07/agents/yf_arc3_v5/src/core/released_action_cycle.src');
  const grounding = source.indexOf('validate_action_grounding');
  const wisdom = source.indexOf('operational_wisdom');
  const release = source.indexOf('release_action');
  const act = source.indexOf('ACT action_event');
  assert.ok(grounding >= 0 && grounding < wisdom);
  assert.ok(wisdom < release);
  assert.ok(release < act);
  assert.match(source, /FROM intent/);
  assert.match(source, /RELEASE release/);
  assert.match(source, /EXPECT intent\.expectation_refs/);
});

test('retained-grid action workflows prepare an intent but do not execute the environment action', () => {
  const source = donor('reference/sra/212d8d426f07/agents/yf_arc3_v5/src/arc3/conditional_reasoning_tree.src');
  const start = source.indexOf('WORKFLOW choose_retained_grid_motion_action');
  assert.ok(start >= 0);
  const snippet = source.slice(start, start + 7000);
  assert.match(snippet, /prepare_interaction_probe/);
  assert.match(snippet, /validate_action_grounding/);
  assert.match(snippet, /operational_wisdom/);
  assert.match(snippet, /release_action/);
  assert.doesNotMatch(snippet, /ACT action_event/);
});

test('architecture ledger requires the exact intent permit dispatch acquisition chain', () => {
  const source = donor('reference/sra/212d8d426f07/docs/architecture/resolving_architecture_overview.md');
  assert.match(source, /exact suspended execution,\s*intent\/permit\/dispatch\/acquisition chain/i);
  assert.match(source, /reject duplicate reconciliation/i);
  assert.match(source, /checks canonical intent, permit,\s*dispatch, acquisition and observation order/i);
});
