/**
 * Read-only analysis of an already witnessed public L4 frame. No game calls.
 * The relaxed-mixture variant is an unexecuted counterfactual, not a solution.
 * Run after m0r0-witness-diagnostic.mjs; this annotates the exact frozen route
 * function locally to distinguish exhausted search from its expansion bound.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { jointCoupledPairRoute } from '../../../src/logos-engine/v6-coupled-pair-route.ts';
import { auxiliarySupportErased, auxiliarySupportControls, auxiliarySupportOccurrences }
  from '../../../src/logos-engine/v6-auxiliary-support-preparation.ts';

const ROOT = new URL('../../../', import.meta.url), here = new URL('.', import.meta.url);
const input = new URL('m0r0-witness-diagnostic.json', here), bytes = await readFile(input), witness = JSON.parse(bytes);
const hash = value => createHash('sha256').update(value).digest('hex');
const routePath = 'src/logos-engine/v6-coupled-pair-route.ts', routeUrl = new URL(routePath, ROOT);
const routeSource = await readFile(routeUrl, 'utf8');
assert.equal(hash(routeSource), witness.diagnosticSources[routePath]);
let tracedSource = stripTypeScriptTypes(routeSource, { mode: 'strip' });
function replaceOnce(before, after) {
  assert.equal(tracedSource.split(before).length, 2, `Instrumentation anchor is not unique: ${before}`);
  tracedSource = tracedSource.replace(before, after);
}
tracedSource = 'export let diagnostic = null;\n' + tracedSource;
replaceOnce('const transition = (state', 'const excludedContacts = new Set();\n  const transition = (state');
replaceOnce('if (firstCell && excluded.has(firstCell.pattern) || secondCell && excluded.has(secondCell.pattern)) return null;',
  `if (firstCell && excluded.has(firstCell.pattern) || secondCell && excluded.has(secondCell.pattern)) {
    for (const cell of [firstCell, secondCell]) if (cell && excluded.has(cell.pattern)) excludedContacts.add(cell.row + ',' + cell.column);
    return null;
  }`);
replaceOnce('if (endpoint < 0) return null;',
  `diagnostic = { states: visited.size, expanded, queued: queue.length,
    exhausted: expanded === queue.length, expansionBoundReached: expanded >= 4096 && expanded < queue.length,
    maxDepth, deepestQueuedDepth: Math.max(...queue.map(node => node.depth)), found: endpoint >= 0,
    excludedCells: cells.filter(cell => excluded.has(cell.pattern)).map(cell => ({ row: cell.row, column: cell.column,
      box: cell.box, palette: cell.palette, reachedByRejectedContact: excludedContacts.has(cell.row + ',' + cell.column) })) };
  if (endpoint < 0) return null;`);
tracedSource = tracedSource.replace(/from '(\.\/[^']+)'/g, (_, relative) => `from '${new URL(relative, routeUrl).href}'`);
const traced = await import('data:text/javascript;base64,' + Buffer.from(tracedSource).toString('base64'));

const state = witness.level4.finalPairState;
const checkpoint = witness.level4.checkpoints.find(checkpoint => checkpoint.afterSequence === 112);
assert.ok(checkpoint, 'The fourth public control response must exist');
const rows = checkpoint.frame, available = ['ACTION1', 'ACTION2', 'ACTION3', 'ACTION4', 'ACTION5', 'ACTION6'];
const [controls, signs] = auxiliarySupportControls(state, available);
assert.deepEqual(signs, [1, -1]); assert.equal(state.floors.length, 1);
const items = auxiliarySupportOccurrences(rows, state.pair, state.floors[0]);
const virtual = auxiliarySupportErased(rows, items, state.floors[0]);
const cases = [];
for (const [scene, frame] of [['actual_public_frame', rows], ['recognized_auxiliary_erased', virtual]]) {
  for (const excludeUnmatchedFloorMixtures of [true, false]) {
    const args = [frame, state.pair, controls, state.floors, signs, 40, [], excludeUnmatchedFloorMixtures];
    const route = jointCoupledPairRoute(...args), instrumented = traced.jointCoupledPairRoute(...args);
    assert.deepEqual(instrumented, route, 'Instrumentation must preserve the complete production return');
    assert.ok(traced.diagnostic, 'The route must have reached the bounded BFS');
    cases.push({ scene, excludeUnmatchedFloorMixtures, route, search: structuredClone(traced.diagnostic) });
  }
}
const result = { schema: 'logos-engine.v6.public-route-question-diagnostic.v1',
  qualification: 'No game is executed. This reads the public frame after already witnessed action 112 and the measured pair/control projection after action 151. Actions 113–151 are verified zero-displacement samples, so the four movement controls and pair loci are unchanged. The first two true-mixture cases are the production policy. The false-mixture cases are counterfactual explanation only; their hypothetical actions were never dispatched. Local instrumentation records counters while preserving all four complete production return values.',
  inputFile: input.pathname, inputSha256: hash(bytes), routeSourceFile: routePath, routeSourceSha256: hash(routeSource),
  observedFrameAfterSequence: 112, controls, signs, pair: state.pair, floors: state.floors,
  recognizedAuxiliaries: items, gameRequests: 0, cases };
assert.ok(witness.level4.transitions.filter(transition => transition.sequence > 112)
  .every(transition => transition.latestSample.deltas.flat().every(value => value === 0)));
const output = new URL('m0r0-route-question-diagnostic.json', here);
await writeFile(output, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ output: output.pathname, cases: cases.map(({ scene, excludeUnmatchedFloorMixtures, route, search }) => ({
  scene, excludeUnmatchedFloorMixtures, actions: route?.actions ?? null, states: search.states, expanded: search.expanded,
  exhausted: search.exhausted, expansionBoundReached: search.expansionBoundReached, deepestQueuedDepth: search.deepestQueuedDepth,
  excludedCellCount: search.excludedCells.length,
  excludedPalettes: [...new Set(search.excludedCells.map(cell => JSON.stringify(cell.palette)))].map(value => JSON.parse(value)) })) }));
