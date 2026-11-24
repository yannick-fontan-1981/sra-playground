import assert from 'node:assert/strict';
import test from 'node:test';
import { compileLevel, initialState, renderWorld, stepDetailed, type State, type World } from '../experiments/sinking-star-ss05/src/core.ts';
import { SS05_LEVELS } from '../experiments/sinking-star-ss05/src/levels.ts';
import { findCompositionFrontier } from '../src/sic/composition-frontier.ts';
import { objectRelations } from '../src/sic/object-composition.ts';
import { admitFieldCarry, checkFieldCarryReturn, observeFieldCarry, planFieldCarry,
  type FieldCarryMemory, type FieldCarryPlan } from '../src/sic/observed-field-carry.ts';

for (const mirrored of [false, true]) test(`carry and object composition transfer across four levels${mirrored ? ' with different object shapes and mirrored geometry' : ''}`, () => {
  const transform = (world: World, state: State) => {
    const rows = renderWorld(world, state);
    if (mirrored) for (const [index, point] of state.monsters.entries()) {
      const x = 2 + 3 * point.x, y = 2 + 3 * point.y;
      rows[y]![x + 1] = index === 0 ? 8 : 10;
      rows[y + 1]![x] = index === 0 ? 5 : 10;
    }
    return rows.map(row => (mirrored ? [...row].reverse() : row).map(ink => (ink + (mirrored ? 9 : 4)) % 16));
  };
  const commands = new Map([1, 2, 3, 4, 5].map(id => [`ACTION${id + (mirrored ? 10 : 20)}`, id]));
  const inputs = [...commands].map(([action_ref]) => ({ action_ref, data: {} }));
  let memory: FieldCarryMemory | undefined;
  for (let level = 0; level < 4; level++) {
    const world = compileLevel(SS05_LEVELS[level]!);
    let current = initialState(world), marks: FieldCarryPlan['marks'] | undefined;
    let actions = 0, firstCarry = 0, continuousCarry = false, firstBody: number | undefined, compositions = 0;
    if (memory) delete memory.supportAt;
    while (!current.complete && actions < 120) {
      const visible = transform(world, current), entry = `entry:${level}:${actions}`;
      const plan = planFieldCarry(memory, visible, inputs, entry, 120 - actions, marks)
        ?? planFieldCarry(memory, visible, inputs, entry, 120 - actions, marks, [], true);
      assert.ok(plan, `No plan at level ${level + 1}, command ${actions}`);
      assert.ok(plan.steps.length <= 16);
      if (level) {
        assert.equal(plan.observe, false);
        assert.ok(plan.evidence.includes('return:0:1'));
      }
      marks = plan.marks;
      for (const [index, step] of plan.steps.entries()) {
        const before = transform(world, current);
        assert.ok(admitFieldCarry(plan, index, before));
        const detail = stepDetailed(world, current, commands.get(step.action.action_ref)!);
        if (detail.state.monsters.length < current.monsters.length) {
          assert.equal(plan.composition?.at, index);
          assert.equal(current.monsters.length - detail.state.monsters.length, 2);
          compositions++;
        }
        if (level === 3 && detail.state.monsters.some(({ x, y }) => world.buttons.some(button => button.x === x && button.y === y))
          && !current.monsters.some(({ x, y }) => world.buttons.some(button => button.x === x && button.y === y))) {
          assert.equal(plan.composition?.at, index);
          compositions++;
        }
        current = detail.state;
        assert.equal(current.dead, false);
        actions++;
        const moved = detail.phases[0]?.moves.find(piece => piece.actor === 'stone');
        if (moved) {
          if (!firstCarry) {
            firstCarry = actions;
            firstBody = world.stones.findIndex(p => p.x === moved.from.x && p.y === moved.from.y);
          }
          continuousCarry ||= index > 0;
        }
        if (current.complete) break;
        const after = transform(world, current);
        if (!plan.observe) {
          assert.ok(checkFieldCarryReturn(plan, index, before, after));
          if (moved) assert.equal(checkFieldCarryReturn(plan, index, before, before), false);
          if (level === 3 && plan.composition?.at === index) {
            assert.ok(plan.evidence.some(ref => ref.startsWith('return:2:')));
            const gates = plan.composition.opens;
            assert.ok(gates?.length);
            for (const gate of gates) {
              const [x, y] = gate.split(',').map(Number) as [number, number];
              for (let offset = 0; offset < 3; offset++) {
                after[y + offset]!.splice(x, 3, ...before[y + offset]!.slice(x, x + 3));
              }
            }
            assert.equal(checkFieldCarryReturn(plan, index, before, after), false);
          }
        }
        memory = observeFieldCarry(memory, before, transform(world, current), step.action, `return:${level}:${actions}`,
          inputs.map(input => input.action_ref), marks);
      }
    }
    assert.ok(current.complete);
    if (level >= 2) assert.equal(compositions, 1);
    else assert.ok(continuousCarry);
    if (level === 1) {
      assert.equal(firstCarry, 5);
      assert.equal(firstBody, 0);
    } else if (level === 0) assert.equal(firstCarry, 1);
  }
});

test('pair enumeration keeps distinct instances and can compose differently bound objects', () => {
  const bindings = [
    { id: 'one:0', cell: (positions: readonly string[]) => positions[0], movable: true },
    { id: 'one:1', cell: (positions: readonly string[]) => positions[1], movable: true },
    { id: 'another', cell: (positions: readonly string[]) => positions[2], movable: true },
    { id: 'fixture', cell: () => '9', movable: false },
  ];
  const relations = objectRelations(bindings, (left, right) => Math.abs(Number(left) - Number(right)) === 1);
  const before = ['1', '2', '6'], after = ['1', '5', '9'];
  const reached = relations.filter(relation => !relation.cells(before) && relation.cells(after));
  assert.deepEqual(reached.map(relation => relation.cells(after)), [['9', '9']]);
  const mixed = ['1', '5', '6'];
  assert.deepEqual(relations.filter(relation => !relation.cells(before) && relation.cells(mixed)).map(relation => relation.cells(mixed)), [['5', '6']]);
  assert.equal(relations.length, 12);
});

test('composition search considers reachable effects beyond an already visited pose', () => {
  const edges: Record<string, string[]> = { start: ['empty_walk', 'approach'], approach: ['start'], empty_walk: ['start'] };
  const route = (depth: number) => findCompositionFrontier({
    start: 'start', key: pose => pose, depth, limit: 12,
    successors: pose => (edges[pose] ?? []).map(after => ({ action: `${pose}:${after}`, after })),
    isComposition: (before, after) => before === 'approach' && after === 'start',
  });
  assert.equal(route(1), undefined);
  assert.deepEqual(route(2)?.map(step => step.action), ['start:approach', 'approach:start']);
});

test('carry abstains when two observed fields give equally strong controller matches', () => {
  const world = compileLevel(SS05_LEVELS[0]!);
  const frame = renderWorld(world, initialState(world));
  const inputs = [1, 2, 3, 4, 5].map(id => ({ action_ref: `ACTION${id}`, data: {} }));
  assert.ok(planFieldCarry(undefined, frame, inputs, 'unique', 16));
  const ambiguous = frame.map(row => [...row, ...row]);
  assert.equal(planFieldCarry(undefined, ambiguous, inputs, 'ambiguous', 16), undefined);
});

test('a fresh controller can reach a new composition and use its observed outcome', () => {
  const world = compileLevel(SS05_LEVELS[2]!);
  const inputs = [1, 2, 3, 4, 5].map(id => ({ action_ref: `ACTION${id}`, data: {} }));
  let current = initialState(world), memory: FieldCarryMemory | undefined;
  let moves = 0;
  while (!current.complete && moves < 60) {
    const visible = renderWorld(world, current);
    const propose = (contactOnly: boolean) => planFieldCarry(memory, visible, inputs, `entry:${moves}`, 60 - moves, undefined, [], contactOnly);
    const plan = propose(false) ?? propose(true);
    assert.ok(plan, `No plan at command ${moves}`);
    for (const [index, step] of plan.steps.entries()) {
      const before = renderWorld(world, current);
      assert.ok(admitFieldCarry(plan, index, before));
      const next = stepDetailed(world, current, Number(step.action.action_ref.slice(6))).state;
      assert.equal(next.dead, false);
      moves++;
      if (next.complete) {
        current = next;
        break;
      }
      const after = renderWorld(world, next), ref = `return:${moves}`;
      memory = observeFieldCarry(memory, before, after, step.action, ref, inputs.map(input => input.action_ref), plan.marks);
      if (!plan.observe) assert.ok(checkFieldCarryReturn(plan, index, before, after));
      if (plan.composition?.at === index) {
        assert.equal(next.monsters.length, 0);
        assert.ok(memory);
        memory.contactRef = ref;
      }
      current = next;
    }
  }
  assert.ok(current.complete);
  assert.ok(memory?.contactRef);
});
