import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { executeWorkflow, SrcDeferredError, SrcExecutionError } from '../src/logos-engine/interpreter.ts';
import type { JsonObject, Primitive } from '../src/logos-engine/ir.ts';

const fixture = JSON.parse(await readFile(new URL('./fixtures/src-while-reference.json', import.meta.url), 'utf8'));

function callbacks(log: string[]): Record<string, Primitive> {
  return Object.fromEntries(['begin', 'advance', 'condition', 'stop', 'progress'].map(name => [
    `test.${name}`, (args: JsonObject) => {
      if (name === 'begin') { log.push('begin'); return { ...(args.request as JsonObject), index: 0, progress: 0 }; }
      const session = args.session as JsonObject;
      log.push(`${name}:${session.index}`);
      if (name === 'condition') return session.pending!;
      if (name === 'stop') return session.done!;
      if (name === 'progress') return session.progress!;
      const index = Number(session.index) + 1;
      return { ...session, index, progress: Number(session.progress) + Number(session.increment),
        done: index >= Number(session.finishAt), pending: index < Number(session.conditionAt) };
    },
  ]));
}

for (const scenario of fixture.cases) {
  test(`WHILE equals original scheduler: ${scenario.id}`, async () => {
    const expected = scenario.expected, log: string[] = [];
    if (expected.status === 'completed') {
      const result = await executeWorkflow(fixture.programs[String(scenario.depth)], 'test.bounded_loop.run', scenario.inputs, callbacks(log));
      assert.deepEqual(result.value, expected.value);
      assert.deepEqual(result.bindings.session, expected.session);
      assert.deepEqual(result.trace.map(event => event.statementId), expected.executedStatements);
      assert.equal(result.instructions, expected.executedStatements.length);
    } else {
      await assert.rejects(executeWorkflow(fixture.programs[String(scenario.depth)], 'test.bounded_loop.run', scenario.inputs, callbacks(log)), error => {
        assert.ok(error instanceof SrcDeferredError);
        assert.equal(error.code, 'deferred');
        assert.equal(error.result, expected.value);
        assert.deepEqual(error.bindings.session, expected.session);
        assert.deepEqual(error.trace.map(event => event.statementId), expected.executedStatements);
        assert.equal(error.instructions, expected.executedStatements.length);
        assert.equal(error.trace.at(-1)?.status, 'deferred');
        assert.equal(error.trace.at(-1)?.phase, 'frame_complete');
        return true;
      });
    }
    assert.deepEqual(log, expected.calls);
  });
}

test('WHILE budgets count frame completion before evaluating another condition', async () => {
  const scenario = fixture.cases[0], instructions = scenario.expected.executedStatements.length;
  const success = await executeWorkflow(fixture.programs[String(scenario.depth)], 'test.bounded_loop.run', scenario.inputs, callbacks([]), { maxInstructions: instructions });
  assert.equal(success.instructions, instructions);
  await assert.rejects(executeWorkflow(fixture.programs[String(scenario.depth)], 'test.bounded_loop.run', scenario.inputs, callbacks([]), { maxInstructions: instructions - 1 }), error => {
    assert.ok(error instanceof SrcExecutionError);
    assert.equal(error.code, 'instruction_limit');
    assert.equal(error.instructions, instructions - 1);
    assert.equal(error.trace.some(event => event.kind === 'STOP'), false);
    return true;
  });
});

test('malformed WHILE contracts are rejected before running any callback', async () => {
  const program = structuredClone(fixture.programs['3']);
  const loop = program.workflows[0].steps[1].statements[0];
  loop.loop_contract.maximum_symbolic_depth = 0;
  const log: string[] = [];
  await assert.rejects(executeWorkflow(program, 'test.bounded_loop.run', fixture.cases[0].inputs, callbacks(log)), error => {
    assert.ok(error instanceof SrcExecutionError);
    assert.equal(error.code, 'invalid_ir');
    return true;
  });
  assert.deepEqual(log, []);
});
