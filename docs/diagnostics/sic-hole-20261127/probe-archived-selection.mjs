import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { gunzipSync, gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const open = p => import(pathToFileURL(resolve(p)));
const { createGameDispatcher } = await open('src/runtime/native-game-dispatcher.ts');
const { measureNativeObservation } = await open('src/logos-engine/v6-native-observer.ts');
const { v6FrameHash } = await open('src/runtime/v6-agent-protocol.ts');
const { createSicLegendRecolor } = await open('src/sic/legend-recolor.ts');
const pyodide = await open('public/vendor/pyodide/pyodide.mjs');
const py = await pyodide.loadPyodide({ indexURL: resolve('public/vendor/pyodide'), stdout: () => {}, stderr: () => {} });
await py.loadPackage(['numpy','pydantic','typing-extensions']);
for (const name of ['custom-games.zip','official-games.zip']) {
  py.unpackArchive(new Uint8Array(await readFile(resolve('public/python',name))), 'zip', {extractDir:'/games'});
}
for (const name of ['game_bridge.py','official_adapter.py','custom_level_navigation.py']) {
  py.FS.writeFile('/games/'+name, await readFile(resolve('public/python',name),'utf8'));
}
py.runPython("import sys\nsys.path.insert(0,'/games')\nfrom game_bridge import dispatch");
const engine = createGameDispatcher(async () => ({ dispatch(request) {
  py.globals.set('_test_request',JSON.stringify(request));
  const result = JSON.parse(py.runPython('dispatch(_test_request)'));
  assert.ok(!result.error, result.error);
  return result;
}}));
const pick = bytes => bytes.toString().trim().split(/\r?\n/).map(JSON.parse).find(r => r.code === 'HOLE');
const load = ref => pick(gunzipSync(execFileSync('git',['show',ref], {maxBuffer:8_388_608})));
const archived = load('0fe417b2:docs/diagnostics/sic-107-4a546a13-20261126/results.jsonl.gz');
const integrated = load('fca904de:docs/diagnostics/sic-107-0fe417b2-20261127/aggregate/results.jsonl.gz');
const scope = 'sra-v6-98d555fa-6cf9-42fc-b483-9225bfc834d9';
const observe = (board, revision, digest) => measureNativeObservation({
  frame_rows:board.frame, frame_hash:digest, available_action_refs:board.availableActionIds.map(id=>'ACTION'+id),
  level:board.level, levels_completed:board.levelsCompleted, state:board.state
}, revision, scope);
async function replay(run, diagnose = false) {
  let board = await engine.dispatch({type:'load',code:'HOLE',level:1}), revision=1;
  const owner = createSicLegendRecolor();
  const bounds = new Map(run.levelStats.map(({level,actions},i)=>[run.levelStats.slice(0,i).reduce((n,r)=>n+r.actions,0)+actions,level]));
  const windows = new Map(), trajectory = createHash('sha256'), actuals = [];
  for (const [i,[id,data,,,,,strategy,family]] of run.effects.entries()) {
    const hash = await v6FrameHash(board.frame);
    const number = (windows.get(board.level) ?? 0) + 1;
    windows.set(board.level, number);
    const before = board, command = { id, data };
    const watched = diagnose && before.level === 5 && [2,3,5].includes(number);
    const local = watched ? structuredClone(owner.state()) : null;
    const obs = watched || family === owner.id ? await observe(before, revision, hash) : null;
    const proposed = obs && await owner.propose(obs, before.frame, [], run.levelStats.find(row=>row.level===before.level).budget.actions-number+1);
    if (family === owner.id) {
      assert.deepEqual(proposed?.actions, [{ action_ref:'ACTION6',data }]);
    }
    board = await engine.dispatch({type:'action',actionId:id,data});
    revision++;
    const nextHash = await v6FrameHash(board.frame);
    trajectory.update(JSON.stringify([command,board.frame,board.frames,board.level,board.levelsCompleted,board.state]));
    if (family === owner.id) {
      await owner.record(obs, await observe(board, revision, nextHash), proposed.actions[0], before.frame, board.frame, proposed);
    }
    if (bounds.has(i+1)) assert.equal(trajectory.copy().digest('hex'), run.levelStats.find(x=>x.level===bounds.get(i+1)).prefixHash);
    actuals.push({number,level:before.level,id,data,hash,nextHash,score:board.levelsCompleted, family,strategy,
      ...(watched?{before:before.frame,after:board.frame,observation:obs,local,
        expected:proposed && {actions:proposed.actions,selecting:proposed.selecting,body:proposed.body.bbox,active:proposed.local.active,evidence:proposed.route_refs,rules:proposed.sicSituationCard.strategy}}:{})});
  }
  return actuals;
}
const before = await replay(archived), now = await replay(integrated,true);
const history = before.filter(x=>x.level===5), current = now.filter(x=>x.level===5);
assert.equal(current[4].hash, history[4].hash);
assert.equal(current.at(-1).nextHash, history.at(-1).hash);
assert.equal(history.at(-1).score,5);
const evidence = current.filter(x=>x.local);
console.log(JSON.stringify({
  original:archived.levels,current:integrated.levels,
  windows:evidence.map(({number,hash,nextHash,data,expected,local})=>({number,hash,nextHash,interposed:data,expected,
    currentMemory:{ active:local.state.active,ref:local.state.evidence.at(-1),stopped:local.state.stopped }})),
  sameBeforeHistoricalWin:history.at(-1).hash, winningClick:history.at(-1).data
}, null, 2));
if (process.argv[2]) writeFileSync(process.argv[2],gzipSync(JSON.stringify(evidence)),{flag:'wx'});
