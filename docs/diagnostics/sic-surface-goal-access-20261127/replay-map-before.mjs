import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { gzipSync, gunzipSync } from 'node:zlib';
import { sourceBackend } from '../../../scripts/sic-study-source-games.mjs';
import { measureSurface, rememberSurface, emptySurfaceMemory, observedSurfacePassage, rememberSurfaceStep, planAcrossSurfaces, surfaceDirections } from '../../../src/sic/observed-surfaces.ts';
const reference = JSON.parse(gunzipSync(readFileSync(new URL('../../architecture/sic-public-surface-passages-20261127/etag-native.jsonl.gz', import.meta.url))).toString().trim());
const { roles } = JSON.parse(gunzipSync(readFileSync(new URL('../../../tests/fixtures/sic-surface-passage-public.json.gz', import.meta.url))));
const games = await sourceBackend(process.cwd());
let board = games.dispatch({ type: 'load', code: 'ETAG', level: 1 }), memory = emptySurfaceMemory();
const publicBoard = b => ({ level:b.level, levelsCompleted:b.levelsCompleted, state:b.state, frame:b.frame, frames:b.frames });
const trajectory = createHash('sha256'), samples = [];
let levelAction = 0, matched = 0;
for (const [index, effect] of reference.effects.entries()) {
  const action = { id: effect[0], ...(effect[1] !== null ? { data:effect[1] } : {}) };
  const before = board;
  if (before.level === 4) levelAction++;
  const first = before.level === 4 ? measureSurface(before.frame, roles) : null;
  if (first) memory = rememberSurface(memory, first);
  const plan = first ? planAcrossSurfaces(memory, first.address, 81-levelAction) : null;
  const memoryBefore = structuredClone(memory);
  board = games.dispatch({ type:'action', actionId:action.id, ...(action.id === 6 ? {data:action.data} : {}) });
  trajectory.update(JSON.stringify([action,board.frame,board.frames,board.level,board.levelsCompleted,board.state]));
  if (!first) continue;
  const after = measureSurface(board.frame, roles), direction = surfaceDirections.findIndex(([command]) => command === 'ACTION'+action.id);
  if (after && direction >= 0 && board.level === before.level) {
    const passage = observedSurfacePassage(first,after,'ACTION'+action.id);
    const [,dx,dy] = surfaceDirections[direction];
    const step = passage ?? (plan?.direction === direction ? plan : {direction,expected:after.address,
      focus:{floor:first.address.floor,cell:[first.address.cell[0]+dx,first.address.cell[1]+dy]},kind:'move'});
    memory = rememberSurfaceStep(memory, first, after, step);
  }
  matched += plan?.direction === direction ? 1 : 0;
  samples.push({ index:index+1, levelAction, action, before:publicBoard(before), after:publicBoard(board), first, returned:after, plan,
    memoryBefore, memoryAfter:structuredClone(memory), recommendedMatches:plan?.direction === direction });
}
const digest = trajectory.digest('hex');
assert.equal(digest,reference.trace,'Public replay must exactly reproduce the archived native return trace');
const document = { sourceBranch:'01fd6683a4040b2b5d1f32a5ded51f4029bea93f', kind:'public-command-replay-without-solver',
  trace:digest, archivedTraceEqual:true, roleSource:'tests/fixtures/sic-surface-passage-public.json.gz', roles,
  commands:reference.actions, score:board.levelsCompleted, targetSamples:samples.length, reconstructedPlanMatches:matched, samples };
writeFileSync(new URL('./public-map.json.gz',import.meta.url),gzipSync(JSON.stringify(document),{mtime:0}));
console.log(JSON.stringify({commands:reference.actions,score:board.levelsCompleted,traceEqual:true,samples:samples.length,reconstructedPlanMatches:matched,
  last: samples.at(-1)?.returned, floors:Object.keys(memory.floors).length, links:Object.keys(memory.links).length}));
