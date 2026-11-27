import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { executeWorkflow } from '../src/logos-engine/interpreter.ts';
import { NativeV6Runtime } from '../src/logos-engine/v6-native-runtime.ts';
import { ObservedInputDomain } from '../src/logos-engine/v6-native-observer.ts';
import type { NativeFamily, NativePoint } from '../src/logos-engine/v6-native-types.ts';
import { measure } from '../src/logos-engine/v6-topological-recolor-geometry.ts';
import { checkExampleWorkflow, matchExampleModule, matchExampleOperations, matchExampleWorkflow } from '../src/sic/legend-recolor-card.ts';
import { createSicLegendRecolor } from '../src/sic/legend-recolor.ts';
import { observedPressureRecoveryGroup } from '../src/sic/public-input-exploration.ts';
import { preparedEffectsId } from '../src/sic/test-prepared-effects.ts';
import { V6AgentService } from '../src/runtime/v6-agent-service.ts';
import { toV6PublicObservation } from '../src/runtime/v6-agent-protocol.ts';

test('the SRC example card selects or reuses a value and checks outside preservation', async () => {
  const module = await matchExampleModule();
  const pending = [{ index: 0, color: 4 }, { index: 1, color: 7 }];
  const run = (hasReadyRegion: boolean) => executeWorkflow(module, matchExampleWorkflow, {
    situation: { hasReadyRegion, pending, ready: [pending[1]!] },
  }, matchExampleOperations);
  assert.deepEqual((await run(true)).value, { candidate: pending[1], strategy: 'apply_legend_pigment' });
  assert.deepEqual((await run(false)).value, { candidate: pending[0], strategy: 'acquire_legend_pigment' });
  for (const preserved of [true, false]) for (const expectedValueObserved of [true, false]) {
    const result = await executeWorkflow(module, checkExampleWorkflow, {
      outcome: { preserved, expectedValueObserved },
    }, matchExampleOperations);
    assert.equal(result.value, preserved && expectedValueObserved);
  }
});

function twoSidedLegend(fieldSize: number) {
  const rows = Array.from({ length: 32 }, () => Array<number>(32).fill(0));
  function square(left: number, top: number, size: number, color: number, outline = false) {
    for (let y = top; y < top + size; y++) for (let x = left; x < left + size; x++) {
      if (!outline || y === top || x === left || y === top + size - 1 || x === left + size - 1) rows[y]![x] = color;
    }
  }
  for (let y = 0; y < 23; y++) {
    rows[y]!.fill(1, 0, 7);
    rows[y]![7] = 4;
  }
  rows[23]!.fill(4);
  square(2, 2, 3, 2);
  square(2, 9, 3, 3, true);
  square(10, 2, fieldSize, 3);
  square(10, 10, fieldSize, 2, true);
  square(1, 25, 4, 7);
  square(2, 26, 2, 2);
  square(9, 26, 2, 3);
  square(16, 26, 2, 5);
  return rows;
}

test('recolor orients a reversible divider using consistently smaller legend examples', () => {
  const rows = twoSidedLegend(6);
  const observation = { observation_ref: 'observed-layout' };
  for (const flip of [false, true]) {
    const scene = measure(flip ? rows.map(row => [...row].reverse()) : rows, observation, [], { examples: true });
    assert.ok(scene?.reduced_examples);
    assert.deepEqual(scene.legend, flip ? [25, 0, 31, 22] : [0, 0, 6, 22]);
    assert.deepEqual(scene.mapping, { 0: 2, 1: 3 });
    assert.equal(scene.active, 2);
  }
  assert.equal(measure(twoSidedLegend(3), observation, [], { examples: true }), null);
  assert.equal(measure(rows, observation), null);
});

test('palette ink inside a legend symbol describes the matching pocket', () => {
  const rows = twoSidedLegend(6);
  for (let y = 0; y < 23; y++) for (let x = 0; x < 7; x++) {
    if (rows[y]![x] === 1) rows[y]![x] = 5;
  }
  const scene = measure(rows, { observation_ref: 'painted-example' }, [], { examples: true });
  assert.deepEqual(scene?.legend, [0, 0, 6, 22]);
  assert.deepEqual(scene?.mapping, { 0: 2, 1: 3 });
  const pockets = scene?.bodies.filter((body: { relation_kind: string }) => body.relation_kind === 'pocket');
  assert.equal(pockets.length, 1);
  assert.deepEqual({ region: pockets[0].bbox, example: pockets[0].example, target: pockets[0].target },
    { region: [11, 11, 14, 14], example: [2, 9, 4, 11], target: 5 });
});

test('aligned pockets reveal an example whose contour shares the legend backdrop', () => {
  const rows = Array.from({ length: 44 }, () => Array<number>(40).fill(0));
  for (let y = 0; y < 35; y++) {
    rows[y]!.fill(1, 0, 5);
    rows[y]![5] = 4;
  }
  rows[35]!.fill(4);
  function strip(left: number, top: number, count: number, contour: number, pocket: number) {
    for (let i = 0; i <= count * 2; i++) {
      rows[top + i]!.fill(contour, left, left + 3);
      if (i % 2) rows[top + i]![left + 1] = pocket;
    }
  }
  strip(1, 3, 2, 2, 1);
  strip(1, 11, 3, 1, 7);
  strip(1, 21, 4, 3, 1);
  strip(15, 10, 3, 6, 0);
  for (const [i, color] of [1, 2, 3, 6, 7].entries()) for (let y = 39; y < 42; y++) {
    rows[y]!.fill(color, 2 + i * 6, 5 + i * 6);
  }
  const read = () => measure(rows, { observation_ref: 'visible-pocket-pattern' }, [], { examples: true });
  const scene = read();
  assert.deepEqual(scene?.mapping, { 2: 2, 3: 1, 4: 3 });
  const pockets = scene?.bodies.filter((body: { relation_kind: string }) => body.relation_kind === 'pocket');
  assert.equal(pockets?.length, 3);
  assert.ok(pockets.every((body: { target: number }) => body.target === 7));
  rows[14]![2] = 1;
  assert.equal(read(), null);
});

const captured = JSON.parse(gunzipSync(readFileSync(new URL(
  '../docs/diagnostics/sic-hole-20261127/selection-window-public.json.gz', import.meta.url,
))).toString()) as { number: number; before: number[][]; after: number[][] }[];

for (const scenario of ['observed', 'permuted palette', 'wrong pigment', 'changed field', 'unwitnessed selection'] as const) {
  test('a palette selection retains priority for its immediate acquired recoloring: ' + scenario, async () => {
    const owner = createSicLegendRecolor();
    const selection = captured.find(row => row.number === 2)!;
    const disruption = captured.find(row => row.number === 3)!;
    const permuted = scenario === 'permuted palette', unwitnessed = scenario === 'unwitnessed selection';
    const preview: NativeFamily = {
      id: preparedEffectsId,
      async propose(observation, rows) {
        if (observation.revision === 1 && !unwitnessed) return null;
        const point: NativePoint = [22, 59];
        const action = { action_ref: 'ACTION6', data: { x: point[0], y: point[1] } };
        const witness = await ObservedInputDomain.makeLocusWitness(observation, rows, point,
          { reason: 'Inspect the other visible control', evidence: [observation.observation_ref] });
        return { status: 'proposed', kind: this.id, actions: [action], steps: [{ action, point_binding: witness }],
          sicLocalDecision: { strategy: 'inspect_visible_control' }, binding: { observation_ref: observation.observation_ref } };
      },
      before: (proposal, _index, _packet, observation) =>
        ({ admitted: proposal.binding?.observation_ref === observation.observation_ref, reason: 'visible_control_bound' }),
      after: () => ({ matched: null, seal_prefix: true, reason: 'inquiry_return' }),
      record: () => ({ events: [] }), state: () => ({}), restore() {},
    };
    const observe = (rows: number[][], stepIndex = 0) => {
      const frame = permuted ? rows.map(row => row.map(value => (value + 5) % 16)) : rows;
      return toV6PublicObservation({ gameCode: 'PUBLIC', frame, frames: [frame], state: 'NOT_FINISHED',
        level: 1, levelCount: 2, levelsCompleted: 0, availableActionIds: [6], canUndo: false, canSelectLevel: true, defaultFps: 10 }, stepIndex);
    };
    const service = new V6AgentService(() => new NativeV6Runtime({ families: [owner, preview], sourceDigest: 'legend-retained-color',
      maxPointOccurrences: 250, groups: [
        { id: observedPressureRecoveryGroup, families: [owner.id, preview.id] },
        { id: 'follow_symbol_diagram', families: [owner.id] },
      ] }));
    const sessionId = 'legend-color-' + scenario.replaceAll(' ', '-');
    let result = await service.handle({ type: 'init', sessionId, sequence: 0, observation: observe(unwitnessed ? selection.after : selection.before),
      budgets: { targetLevels: 2, levelActionCaps: [10, 10] } });
    const currentPlan = () => result.snapshot.trace.findLast(event => event.kind === 'sic_native_plan');
    assert.ok(result.ticket, result.snapshot.reason);
    if (unwitnessed) {
      assert.equal(currentPlan()?.family, preview.id);
      return;
    }
    assert.equal(currentPlan()?.strategy, 'acquire_legend_pigment');
    const returned = structuredClone(scenario === 'wrong pigment' ? disruption.after : selection.after);
    if (scenario === 'changed field') returned[1]![8] = (returned[1]![8]! + 1) % 16;
    result = await service.handle({ type: 'advance', sessionId, sequence: 1, ticketId: result.ticket.id, executionMs: 1,
      observation: observe(returned, 1) });
    const matched = scenario === 'observed' || permuted;
    const actual = result.snapshot.trace.findLast(event => event.kind === 'actual_outcome');
    assert.equal(actual?.matched, matched, actual?.reason);
    assert.equal(result.kind, 'boundary');
    result = await service.handle({ type: 'resume', sessionId, sequence: 1 });
    assert.ok(result.ticket, result.snapshot.reason);
    assert.equal(currentPlan()?.family, matched ? owner.id : preview.id);
    if (matched) {
      assert.equal(currentPlan()?.strategy, 'apply_legend_pigment');
      const proposal = result.snapshot.proposal as Record<string, any>;
      assert.ok(proposal.route_refs.includes(actual?.observation_ref));
    }
  });
}
