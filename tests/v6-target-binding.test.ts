import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { deriveProjection } from '../src/logos-engine/v6-derive.ts';
import { observedDerivations } from '../src/logos-engine/v6-observed-derivations.ts';
import { CompositionTargetTree, mainObjective, postAnalysis, protocolProjection, stateCompositions } from '../src/logos-engine/v6-target-binding.ts';

const fixture = JSON.parse(await readFile(new URL('./fixtures/v6-target-reference.json', import.meta.url), 'utf8'));
const source = new URL('../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/', import.meta.url);

test('target binding/derivation fixtures bind the exact original source bytes', async () => {
  for (const [path, expected] of Object.entries(fixture.provenance.sources) as [string, { bytes: number; sha256: string }][]) {
    const bytes = await readFile(new URL(path, source));
    assert.equal(bytes.length, expected.bytes); assert.equal(createHash('sha256').update(bytes).digest('hex'), expected.sha256);
  }
});

for (const row of fixture.cases) test(`original ${row.operation}: ${row.id}`, async () => {
  const tree = new CompositionTargetTree(), args = structuredClone(row.args);
  const run = async () => {
    switch (row.operation) {
      case 'derive': return deriveProjection(args[0], args[1], args[2], { preserve: args[3].preserve,
        remainingActions: args[3].remaining_actions, maxDepth: args[3].max_depth, maxStates: args[3].max_states });
      case 'observed': return observedDerivations(args[0], args[1], args[2], args[3], args[4], args[5], args[6]);
      case 'extend': return tree.extendTarget(args[0], args[1], args[2], args[3], args[4], args[5]);
      case 'bind': return tree.bind(args[0], args[1], args[2], args[3]);
      case 'seal': return CompositionTargetTree.seal(args[0], args[1]);
      case 'objective': return mainObjective(args[0], args[1]);
      case 'state_compositions': return stateCompositions(args[0], args[1]);
      case 'protocol': return protocolProjection(args[0], args[1], args[2]);
      case 'post_analysis': {
        const calls: unknown[] = [];
        const memory = { put(episode: string, key: string, value: any, evidence: string, revision: number) {
          calls.push({ type: 'put', episode, key, value: structuredClone(value), evidence, revision });
        } };
        const bridge = { async run(request: any) { calls.push({ type: 'run', request: structuredClone(request) });
          return { src_status: 'completed', decision: { status: 'composition_analysis', operation_result: { operation: request.bundles.R0.operation_key } } };
        } };
        const result = await postAnalysis(memory, bridge, 'episode', args[0], args[1], args[2], args[3], args[4]);
        return { calls, result };
      }
      default: throw new Error(`Uncovered oracle operation: ${row.operation}`);
    }
  };
  if (row.error) await assert.rejects(run(), { message: row.error });
  else assert.deepEqual(await run(), row.expected);
  assert.deepEqual(args, row.args, 'Projection must not mutate its input observations/evidence');
});
