import assert from 'node:assert/strict';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import { createSicSettleMatchingEdges } from '../src/sic/settle-matching-edges.ts';
import { captureMatchingEdge, observeMatchingEdgeBoard, observeMatchingEdgeReturn, completeMatchingEdge } from '../scripts/sic-matching-edge-continuity.mjs';
import { capturePublicPanel, observePublicPanel, observePublicPanelReturn, completePublicPanel } from '../scripts/sic-public-panel-continuity.mjs';

const fixture = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/sic-edge-switch-public.json.gz', import.meta.url))));
const ticket = (observation, actionRef, actionIndex = 0) => ({ actionRef, actionIndex,
  observationRef: observation.observation_ref, levelsCompleted: observation.levels_completed });

test('edge evidence measures the archived public board and keeps predictions distinct', () => {
  const family = createSicSettleMatchingEdges(); family.restore(structuredClone(fixture.current.memory));
  const { observation, rows } = fixture.current;
  const proposal = family.propose(observation, rows, [], 20, {});
  assert.equal(proposal.actions[0].action_ref, 'ACTION5');
  const capture = captureMatchingEdge(proposal, ticket(observation, 'ACTION5'), rows, () => family.state());
  assert.ok(capture.before);
  assert.equal(capture.before.attached, false);
  assert.equal(capture.expectedAttached, true);
  const measured = structuredClone(capture.before);
  proposal.slidePath[0].predicted[0].x += 1;
  assert.deepEqual(capture.before, measured, 'Predicted positions cannot replace the observed board');
  family.restore({ memory: null });
  assert.ok(Object.keys(capture.learnedControls).length >= 4, 'The collector owns its proof copy');
  const missing = observeMatchingEdgeReturn(capture, null);
  assert.equal(missing.after, null);
  const completed = completeMatchingEdge(missing, () => { throw Error('absent'); }, { sealCount: 1 }, 5);
  assert.equal(completed.acquisition, null);
  assert.equal(completed.after, null);
});

test('edge measurement refuses a changed rim, erased piece mark or broken panel', () => {
  const family = createSicSettleMatchingEdges(); family.restore(structuredClone(fixture.current.memory));
  const { observation, rows } = fixture.current;
  const proposal = family.propose(observation, rows, [], 20, {});
  const capture = captureMatchingEdge(proposal, ticket(observation, 'ACTION5'), rows, () => family.state());
  assert.ok(capture.before);
  const { grid, panel } = capture.geometry;
  for (const damage of [
    frame => { frame[grid.y - 1][grid.x] = -99; },
    frame => { const piece = capture.before.pieces[0]; for (let y = 0; y < grid.pitch; y++) for (let x = 0; x < grid.pitch; x++)
      frame[grid.y + piece.y * grid.pitch + y][grid.x + piece.x * grid.pitch + x] = piece.ink; },
    frame => { frame[panel[1]][panel[0]] = -99; },
  ]) {
    const frame = structuredClone(rows); damage(frame);
    assert.equal(observeMatchingEdgeBoard(frame, capture.geometry), null);
  }
});

function panelFixture() {
  const rows = Array.from({ length: 16 }, () => Array(24).fill(2));
  const geometry = { field: [0, 0, 15, 15], panel: [18, 2, 22, 12], ink: 8 };
  for (let y = 5; y < 7; y++) for (let x = 3; x < 5; x++) rows[y][x] = 8;
  const ref = 'fixture:epoch:2:revision:12:frame:abc';
  const state = { epoch: 2, panelWalker: { ink: 8, controls: { ACTION4: { delta: [2, 0], evidence: ref } } }, panelEffects: [{ evidence: ref }] };
  const proposal = { kind: 'sic_public_input_exploration', panelContinuation: true, actions: [{ action_ref: 'ACTION4' }],
    panel: { area: geometry.field, panel: geometry.panel }, binding: { level_epoch: 2 }, route_refs: [ref],
    panelApproach: { route: [{ from: [3, 5, 4, 6], to: [5, 5, 6, 6] }] } };
  return { rows, geometry, ref, state, proposal };
}

test('panel evidence reads the actual actor and retains missing or ambiguous measurements', () => {
  const { rows, geometry, ref, state, proposal } = panelFixture();
  const captured = capturePublicPanel(proposal, { actionRef: 'ACTION4', actionIndex: 0, observationRef: ref, levelsCompleted: 1 }, rows, state);
  assert.deepEqual(captured.before.actor, [3, 5, 4, 6]);
  const after = structuredClone(rows);
  for (let y = 5; y < 7; y++) for (let x = 3; x < 5; x++) { after[y][x] = 2; after[y][x + 2] = 8; }
  const observed = observePublicPanelReturn(captured, after);
  assert.deepEqual(observed.after.actor, [5, 5, 6, 6]);
  assert.notEqual(observed.after.field, observed.before.field);
  assert.equal(observed.after.panel, observed.before.panel);
  for (let y = 9; y < 11; y++) for (let x = 3; x < 5; x++) after[y][x] = 8;
  assert.equal(observePublicPanel(after, geometry).actor, null);
  assert.equal(observePublicPanel(after, geometry).actorCandidates, 2);
  assert.equal(observePublicPanel(null, geometry), null);
  const unknown = completePublicPanel(observed, () => { throw Error('absent'); }, { sealCount: 1 }, 1);
  assert.equal(unknown.acquisition, null);
});

test('panel capture copies evidence and only samples acquisition at the actual native close', () => {
  const { rows, ref, state, proposal } = panelFixture();
  const captured = capturePublicPanel(proposal, { actionRef: 'ACTION4', actionIndex: 0, observationRef: ref, levelsCompleted: 1 }, rows, state);
  state.panelWalker.controls.ACTION4.delta[0] = 999;
  assert.deepEqual(captured.control.delta, [2, 0]);
  let reads = 0;
  const observed = observePublicPanelReturn(captured, rows);
  const read = () => { reads++; return state; };
  assert.equal(completePublicPanel(observed, read, { sealCount: 0 }, 1).acquisition, null);
  assert.equal(reads, 0);
  assert.equal(completePublicPanel(observed, read, { sealCount: 1 }, 1).acquisition.epoch, 2);
  assert.equal(reads, 1);
  assert.equal(capturePublicPanel({ ...proposal, panelContinuation: false }, {}, rows, state), null);
});
