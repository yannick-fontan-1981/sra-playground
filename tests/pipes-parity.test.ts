/**
 * Cross-language differential tests against the unchanged, pinned Python engine.
 * Regenerate oracle: python3 scripts/generate-pipe-fixtures.py
 * Run: node --test tests/pipes-parity.test.ts (Node 24+).
 * The independent witness generator and all fixture actions are test-only.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { analyze, LEVELS, PALETTE, PipesEngine, rotate, type PipesObservation, type Raster } from '../src/games/pipes.ts';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/pipes-python.json', import.meta.url), 'utf8'));

function decode(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(decode);
  if (value !== null && typeof value === 'object') {
    const entry = value as Record<string, unknown>;
    if (Object.keys(entry).length === 1 && '$number' in entry) {
      return { NaN: Number.NaN, Infinity: Number.POSITIVE_INFINITY, '-Infinity': Number.NEGATIVE_INFINITY }[entry.$number as string];
    }
    return Object.fromEntries(Object.entries(entry).map(([key, item]) => [key, decode(item)]));
  }
  return value;
}

function frameHash(frame: Raster): string {
  assert.equal(frame.length, 64);
  for (const row of frame) {
    assert.equal(row.length, 64);
    for (const pixel of row) assert.ok(Number.isInteger(pixel) && pixel >= 0 && pixel <= 15);
  }
  return createHash('sha256').update(Uint8Array.from(frame.flat())).digest('hex');
}

function snapshot(engine: PipesEngine, result: PipesObservation, translated: boolean) {
  const { frame, frames, ...values } = result;
  const observation: Record<string, unknown> = { ...values,
    frame_sha256: frameHash(frame), frames_sha256: frames.map(frameHash) };
  const view: Record<string, unknown> = engine.view();
  if (translated) {
    delete observation.level_name;
    delete view.title;
    delete view.note;
  }
  return { observation, view };
}

test('oracle is tied to the unchanged pinned Python source', () => {
  assert.equal(fixture.reference_commit, '212d8d426f07eea2b6797c2bb647545767488a96');
  assert.equal(createHash('sha256').update(readFileSync(new URL('../reference/python/pipes.py', import.meta.url))).digest('hex'),
    fixture.reference_sha256);
  assert.deepEqual([...PALETTE], fixture.palette);
  assert.equal(LEVELS.length, 6);
});

for (const scenario of fixture.scenarios) {
  test(`Python / TypeScript parity — ${scenario.name}`, () => {
    const engine = new PipesEngine(scenario.options);
    for (let index = 0; index < scenario.steps.length; index++) {
      const step = scenario.steps[index];
      const label = `${scenario.name}, command ${index}: ${JSON.stringify(step.command)}`;
      const method = engine[step.command.method as keyof PipesEngine];
      assert.equal(typeof method, 'function', label);
      const run = () => (method as (...args: unknown[]) => PipesObservation).apply(engine, decode(step.command.args) as unknown[]);
      if (step.throws) {
        assert.throws(run, { name: 'RangeError' }, label);
      } else {
        const actual = run();
        assert.deepEqual(snapshot(engine, actual, scenario.translated_copy), step.expected, label);
        assert.equal(actual.frame, actual.frames.at(-1), 'frame points to the final returned animation frame');
        if (actual.event === 'success' || actual.event === 'win') {
          assert.equal(actual.frame_count, actual.event === 'success' ? 4 : 3);
          assert.deepEqual(actual.frames[0], actual.frames[2], 'green pulse returns to the identical solved image');
          const pulse = actual.frames[1];
          assert.ok(pulse[0].every(pixel => pixel === 14));
          assert.ok(pulse[63].every(pixel => pixel === 14));
          assert.ok(pulse.every(row => row[0] === 14 && row[63] === 14));
        }
        const last = actual.frame;
        for (let bar = 0; bar < 6; bar++) {
          assert.deepEqual(last[62].slice(3 + bar * 5, 7 + bar * 5),
            Array(4).fill(actual.completed[bar] ? 14 : 2), 'each completion bar is exactly four native pixels');
          if (bar < 5) assert.equal(last[62][7 + bar * 5], 4, 'exactly one background pixel separates bars');
        }
      }
    }
  });
}

for (const graph of fixture.graph_cases) {
  test(`Python graph parity — ${graph.name}`, () => {
    const original = JSON.stringify([graph.pipes, graph.source]);
    assert.deepEqual(analyze(graph.pipes, graph.source), graph.expected);
    assert.equal(JSON.stringify([graph.pipes, graph.source]), original);
  });
}

test('all 15 pipe masks rotate exactly like Python and return after four turns', () => {
  for (let mask = 1; mask <= 15; mask++) {
    assert.equal(rotate(mask), fixture.rotations[mask - 1]);
    assert.equal(rotate(rotate(rotate(rotate(mask)))), mask);
  }
});

test('observations, render output, diagnostics and templates are detached from live boards', () => {
  const engine = new PipesEngine();
  const before = engine.observe();
  const expected = structuredClone(before);
  before.frame[0][0] = 15;
  before.frames.push([]);
  before.completed.fill(true);
  before.available_actions.length = 0;
  before.available_action_ids.length = 0;
  const view = engine.view();
  view.pipes[0][0] = 15;
  view.source[0] = 2;
  view.wet[0][0] = false;
  view.geometry.ox = 400;
  view.completed.fill(true);
  engine.render()[0][0] = 15;
  engine.metadata()[0].title = 'Changed outside engine';
  assert.deepEqual(engine.observe(), expected);
  assert.equal(engine.view().pipes[0][0], 2);
  const selected = engine.action(4);
  selected.selected_cell![0] = 2;
  assert.deepEqual(engine.observe().selected_cell, [0, 0]);
  const second = new PipesEngine();
  engine.action(5);
  assert.deepEqual(second.observe(), expected, 'one instance cannot mutate another');
  assert.throws(() => (LEVELS[0].pipes[0] as number[])[0] = 15, TypeError);
});

test('JavaScript-only invalid values cannot act or change counters', () => {
  const engine = new PipesEngine();
  const expected = { ...engine.observe(), event: 'ignored' };
  for (const input of [undefined, Symbol('action'), 6n, () => 5, new Number(5)]) {
    assert.deepEqual(engine.action(input), expected);
  }
  for (const point of [{ x: undefined, y: 16 }, { x: 16, y: 12n }, { x: Symbol(), y: 12 }]) {
    assert.deepEqual(engine.action(6, point), expected);
  }
});

test('level authoring validation rejects malformed or unsafe numeric data', () => {
  for (const levels of [[], LEVELS.slice(0, 5), null, {}]) assert.throws(() => new PipesEngine({ levels }));
  const change = (edit: (level: Record<string, unknown>) => void) => {
    const levels = JSON.parse(JSON.stringify(LEVELS));
    edit(levels[0]);
    return levels;
  };
  for (const edit of [
    (level: Record<string, unknown>) => { level.number = 2; },
    (level: Record<string, unknown>) => { level.size = true; },
    (level: Record<string, unknown>) => { level.size = 2.5; },
    (level: Record<string, unknown>) => { level.title = null; },
    (level: Record<string, unknown>) => { level.note = 3; },
    (level: Record<string, unknown>) => { level.source = [0, 3]; },
    (level: Record<string, unknown>) => { level.pipes = [[1, 2]]; },
    (level: Record<string, unknown>) => { (level.pipes as number[][])[0][0] = Number.NaN; },
    (level: Record<string, unknown>) => { (level.pipes as number[][])[0][0] = 0; },
  ]) assert.throws(() => new PipesEngine({ levels: change(edit) }));
  for (const levels of [0, 7, 1.5, Number.NaN]) assert.throws(() => new PipesEngine({ info: { levels } }));
  for (const default_fps of [0, 241, 1.5, Number.POSITIVE_INFINITY]) {
    assert.throws(() => new PipesEngine({ info: { default_fps } }));
  }
});
