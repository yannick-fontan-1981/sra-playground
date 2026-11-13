import test from 'node:test';
import assert from 'node:assert/strict';
import { BranchRouting } from '../src/logos-engine/v6-branch-routing.ts';
import { branchBbox, branchReadState } from '../src/logos-engine/v6-branch-routing-geometry.ts';
import type { BranchModel, BranchPoint } from '../src/logos-engine/v6-branch-routing-geometry.ts';
import { geometricComponents, validateRows } from '../src/logos-engine/v6-native-observer.ts';

type R = Record<string, any>;
const PIXELS = 65_536;

/** Generic counterfactual checkpoints test the necessary public numeric domain.
 * They do not assert that restore authenticates an acquired original policy. */
function model(): BranchModel {
  return { axis: 0, tangent: 1, sign: 1, unit: 1, goals: [1, 4], sources: [2],
    bars: [{ position: [2, 0], length: 2, hue: 9 }], active: 0, highlight: 9,
    order: [0], limit: 5, goal_boxes: [[6, 1, 6, 1], [6, 4, 6, 4]] };
}
function checkpoint(value: BranchModel = model()): R {
  return { format: 'native.branch_routing.v1', epoch: 1, motion: {}, passed: [], events: [],
    model: structuredClone(value), current: value.bars.map(bar => [...bar.position]),
    verified: [], seen: [], refs: {}, finished: false };
}
function event(before: [BranchPoint[], number], after: [BranchPoint[], number] | null = null): R {
  return { status: 'measured_response', mode: 'move', before, after, ref: 'O_boundary_case' };
}
function assertAtomicRefusal(owner: BranchRouting, candidate: R, description: string): void {
  const retained = owner.state();
  assert.throws(() => owner.restore(candidate), TypeError, description);
  assert.deepEqual(owner.state(), retained, description);
}

test('the source public validator limits total surface and permits both thin orientations', () => {
  // Pin the source of the restore bounds. A per-axis ceiling alone would admit
  // 256*257, while an invented square ceiling would reject the thin matrices.
  for (const [width, height] of [[PIXELS, 1], [1, PIXELS], [256, 256], [512, 128]]) {
    const rows = Array.from({ length: height! }, () => Array<number>(width!).fill(0));
    assert.doesNotThrow(() => validateRows(rows));
  }
  for (const [width, height] of [[PIXELS + 1, 1], [1, PIXELS + 1], [256, 257]]) {
    const rows = Array.from({ length: height! }, () => Array<number>(width!).fill(0));
    assert.throws(() => validateRows(rows), TypeError);
  }
});

test('current identities can occupy a different public shape from the acquired model', async () => {
  const horizontal: BranchModel = { ...model(), axis: 1, tangent: 0,
    bars: [{ position: [0, 2], length: 2, hue: 9 }], goal_boxes: [[1, 6, 1, 6], [4, 6, 4, 6]] };
  const input = checkpoint(horizontal); input.current = [[PIXELS - 2, 0]];
  const owner = new BranchRouting({ boundedSearch: {} }); owner.restore(input);
  assert.deepEqual(owner.state(), input);
  // One public row, with the measured length-two contributor at its far end.
  // The source does not rederive layout merely because the frame changed shape.
  const rows = [Array<number>(PIXELS).fill(0)]; rows[0]![PIXELS - 2] = 9; rows[0]![PIXELS - 1] = 9;
  const observation = { level_epoch: 1, levels_completed: 0, state: 'NOT_FINISHED',
    observation_ref: 'O_changed_shape', frame_hash: 'F_changed_shape',
    entities: geometricComponents(rows).map(part => ({ ...part, palette_value: part.color,
      position: part.bbox.slice(0, 2) })) };
  const proposal = await owner.propose(observation, rows, [{ action_ref: 'ACTION1' }], 1,
    { yieldControl: async () => {} });
  assert.ok(proposal); assert.equal(proposal.steps[0].mode, 'calibrate');
  assert.deepEqual(proposal.steps[0].state, [[[PIXELS - 2, 0]], 0]);
});

test('restore rejects out-of-domain coordinates and products before replacing retained state', () => {
  const owner = new BranchRouting({ boundedSearch: {} }), initial = checkpoint();
  initial.motion = { ACTION1: [0, 3] }; initial.verified = ['ACTION1']; initial.refs = { ACTION1: 'O_learned' };
  initial.passed = [{ score: 1, ref: 'O_official' }];
  owner.restore(initial);
  const corruptions: Array<[string, (value: R) => void]> = [
    ['unit product can overflow even when its input is a safe integer', value => { value.model.unit = Number.MAX_SAFE_INTEGER; }],
    ['limit product can overflow even when its input is a safe integer', value => { value.model.limit = Number.MAX_SAFE_INTEGER; }],
    ['bar length product can overflow even when its input is a safe integer', value => { value.model.bars[0].length = Number.MAX_SAFE_INTEGER; }],
    ['a square unit that consumes the full budget cannot form a length-two bar', value => { value.model.unit = 256; }],
    ['initial tangent and normal extents share one surface budget', value => { value.model.limit = PIXELS; }],
    ['initial cavity positions also participate in the surface budget', value => {
      value.model.goal_boxes = [[14_000, 1, 14_000, 1], [14_000, 4, 14_000, 4]];
    }],
    ['an initial bar must fit the measured tangent extent', value => { value.model.bars[0].position[1] = 4; }],
    ['source indices are inside the initial measured tangent extent', value => { value.model.sources = [5]; }],
    ['a position cannot name the pixel after the maximum public extent', value => { value.current = [[PIXELS, 0]]; }],
    ['current requires full measured boxes, not merely visible origins', value => { value.current = [[255, 255]]; }],
    ['seen origins must jointly fit one possible public rectangle', value => { value.seen = [['ACTION1', [[255, 256]], 0]]; }],
    ['historical predicted origins have their own public surface bound', value => { value.events = [event([[[255, 256]], 0])]; }],
    ['historical measured origins have their own public surface bound', value => { value.events = [event([[[2, 0]], 0], [[[255, 256]], 0])]; }],
    ['learned displacement cannot exceed the public coordinate difference', value => { value.motion.ACTION1 = [0, PIXELS]; }],
  ];
  for (const [description, corrupt] of corruptions) {
    const candidate = structuredClone(initial); corrupt(candidate); assertAtomicRefusal(owner, candidate, description);
  }
});

test('all distinct measured bars and square sources must respect their pixel budgets', () => {
  const owner = new BranchRouting({ boundedSearch: {} }); owner.restore(checkpoint());
  // Each rectangle and the enclosing 32768*2 extent fits independently. Three
  // different measured rectangles of area 32766 cannot coexist in that budget.
  const overlapping: BranchModel = { axis: 1, tangent: 0, sign: 1, unit: 1,
    goals: [0, 1], sources: [2], bars: [0, 1, 2].map((x, index) => ({
      position: [x, 0] as BranchPoint, length: 32_766, hue: index === 0 ? 9 : 8,
    })), active: 0, highlight: 9, order: [0, 1, 2], limit: 32_768,
    goal_boxes: [[0, 1, 0, 1], [1, 1, 1, 1]] };
  assertAtomicRefusal(owner, checkpoint(overlapping), 'sum of measured contributor areas');
  const squareSources: BranchModel = { ...model(), unit: 2,
    sources: Array<number>(PIXELS / 4 + 1).fill(0),
    goal_boxes: [[12, 2, 13, 3], [12, 8, 13, 9]] };
  assertAtomicRefusal(owner, checkpoint(squareSources), 'one unit-square area per measured source');
});

test('seen and event.before retain a source-admitted partial box at the full public surface', () => {
  const value: BranchModel = { ...model(), limit: 1_024, goals: [255, 258], sources: [256],
    bars: [{ position: [2, 254], length: 2, hue: 9 }], goal_boxes: [[6, 255, 6, 255], [6, 258, 6, 258]] };
  const predicted: [BranchPoint[], number] = [[[255, 255]], 0];
  const input = checkpoint(value); input.current = [[255, 254]];
  input.motion = { ACTION1: [0, 1] }; input.verified = ['ACTION1']; input.refs = { ACTION1: 'O_last_full_pose' };
  input.seen = [['ACTION1', predicted[0], predicted[1]]]; input.events = [event(predicted)];
  const owner = new BranchRouting({ boundedSearch: {} }); owner.restore(input);
  assert.deepEqual(owner.state(), input);
  const rows = Array.from({ length: 256 }, () => Array<number>(256).fill(0)); rows[255]![255] = 9;
  validateRows(rows);
  // A complete measured box here would require 256*257 pixels. read_state
  // instead accepts the one-pixel remainder at the bottom of this public frame.
  assert.deepEqual(branchBbox(predicted[0][0]!, 2, value), [255, 255, 255, 256]);
  assert.deepEqual(branchReadState(rows, value, predicted[0]), predicted);
  const proposal = { binding: { level_epoch: 1, levels_completed: 0, observation_ref: 'O_partial' },
    steps: [{ action: { action_ref: 'ACTION1' }, state: predicted }] };
  assert.deepEqual(owner.before(proposal, 0, { level: 1, levels_completed: 0,
    available_action_refs: ['ACTION1'], frame_rows: rows } as any, { observation_ref: 'O_partial' }),
  { admitted: true, reason: 'bind_selected_contributor_and_all_positions' });
});

test('the pure source slice helper still preserves negative indexing', () => {
  const rows = [[0, 0, 9, 0], [0, 0, 9, 0]];
  assert.deepEqual(branchReadState(rows, model(), [[-2, 0]]), [[[-2, 0]], 0]);
});

test('historical shapes and axial motion survive different and model-free epochs', () => {
  const historical: [BranchPoint[], number] = [[[65_528, 0], [65_531, 0], [65_534, 0]], 0];
  const input = checkpoint();
  input.events = [{ ...event(historical, [structuredClone(historical[0]), 2]), mode: 'select' }];
  input.passed = [{ score: 12, ref: 'O_old_official' }];
  // Learned vectors have no source unit-norm restriction, and persist across
  // epochs whose current bars have a different axis or unit.
  input.motion = { ACTION1: [65_000, 0], ACTION2: [-65_000, 0] };
  const owner = new BranchRouting({ boundedSearch: {} }); owner.restore(input); assert.deepEqual(owner.state(), input);
  const absent = { ...structuredClone(input), epoch: 2, model: null, current: [], verified: [], seen: [], refs: {}, finished: false };
  owner.restore(absent); assert.deepEqual(owner.state(), absent);
  assert.equal(owner.events[0]!.before[0].length, 3); assert.deepEqual(owner.motion.ACTION1, [65_000, 0]);
});
