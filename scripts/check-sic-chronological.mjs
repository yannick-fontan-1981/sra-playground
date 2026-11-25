// Reproduce a SIC campaign from level 1 through the requested victory on either game backend.
// Node 22+, repository root: node scripts/check-sic-chronological.mjs LP85 7 result.jsonl 1
// Arguments: comma-separated games, target (1–10 or auto), local result path, worker count, optional sic or sic-fallback.
// SIC_REPLAY_REFERENCES may provide per-level counts from prior wins or a verified oracle.
// One process runs games sequentially. No source-game logic or oracle is exposed to SIC.
// Raw observations remain local; per-level prefixes hash actions and official returns.
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import { historicalReplayReferences, replayCampaignBudgets } from './sic-replay-budgets.mjs';
crypto.randomUUID=()=>"98d555fa-6cf9-42fc-b483-9225bfc834d9";
const load=file=>import(pathToFileURL(resolve(file)));
const {createGameDispatcher}=await load('src/runtime/native-game-dispatcher.ts');
const {createNativeV6Runtime}=await load('src/logos-engine/v6-native-runtime.ts');
const {BrowserV6Agent}=await load('src/runtime/v6-agent.ts');
const {V6_MAX_RUN_ACTIONS}=await load('src/runtime/v6-agent-protocol.ts');
const {V6AgentService}=await load('src/runtime/v6-agent-service.ts');
const {defaultRecoveryPack}=await load('src/sic/active-recovery.ts');
const pinned=resolve('reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6');
const json=async file=>JSON.parse(await readFile(resolve(pinned,file),'utf8'));
const declarations={common:await json('laya_proto/common_frontier_policy.drm.json'),strategy:await json('morphology_policy/strategy.drm')};
const historical=historicalReplayReferences(JSON.parse(await readFile(resolve('docs/architecture/sic-v8-level6-campaign-7bb9f152.json'),'utf8')));
const supplied=process.env.SIC_REPLAY_REFERENCES
  ? JSON.parse(await readFile(process.env.SIC_REPLAY_REFERENCES, 'utf8')) : undefined;
let legacy;
async function loadLegacy() {
  if (legacy) return legacy;
  const {loadPyodide} = await load('public/vendor/pyodide/pyodide.mjs');
  const py=await loadPyodide({indexURL:resolve('public/vendor/pyodide'),stdout:()=>{},stderr:()=>{}});
  await py.loadPackage(['numpy','pydantic','typing-extensions']);
  for(const name of ['custom-games.zip','official-games.zip'])py.unpackArchive(new Uint8Array(await readFile(resolve('public/python',name))), 'zip', {extractDir:'/games'});
  for(const name of ['game_bridge.py','official_adapter.py','custom_level_navigation.py'])py.FS.writeFile('/games/'+name,await readFile(resolve('public/python',name),'utf8'));
  py.runPython("import sys\nsys.path.insert(0, '/games')\nfrom game_bridge import dispatch");
  function dispatch(request){
    py.globals.set('_test_request',JSON.stringify(request));
    const packet=JSON.parse(py.runPython('dispatch(_test_request)'));
    if(packet.error)throw new Error(packet.error);
    return {...packet,gameCode:packet.code??packet.gameCode};
  }
  legacy = {dispatch};
  return legacy;
}
const metric=values=>{const sorted=[...values].sort((a,b)=>a-b);return {count:sorted.length,median:sorted.length?Math.round(sorted[Math.floor(sorted.length/2)]):null};};
async function run(code,requestedTarget,parallelWorkers) {
  const pack={...defaultRecoveryPack,solver:mode};
  const games=createGameDispatcher(loadLegacy);
  const game=request=>games.dispatch(request);
  let solver;const service=new V6AgentService(async recovery=>(solver=await createNativeV6Runtime(declarations,{recovery})));
  const costs={};const transport={request:async operation=>{if(operation.type==='resume') resumes++;const start=performance.now();try{return await service.handle(operation);}finally{const stat=costs[operation.type]??={ms:0,count:0};stat.ms+=performance.now()-start;stat.count++;}},reset:()=>{},dispose:()=>{}};
  const usage = new Map(), decisions = new Map(), series = new Map(); let resumes=0, priorDispatch=null;const continuedGaps=[], boundaryGaps=[]; let board=await game({type:'load',code,level:1}), gameMs=0, first=null; const effects=[]; const pathKinds = new Map();
  const target = requestedTarget ?? board.levelCount;
  const levelBudgets = replayCampaignBudgets(code, target, historical, supplied);
  const recoveries = { reset: 0, undo: 0 };
  const trajectory=createHash('sha256');
  const start=performance.now();
  const agent=new BrowserV6Agent({transport,targetLevels:target,levelBudgets,parallelWorkers,
    resetLevel:async()=>{recoveries.reset++;return board=await game({type:'reset'});},
    canUndoAction:()=>!!board.canUndo,undoAction:async()=>{recoveries.undo++;return board=await game({type:'undo'});},
    recoveryConfiguration:()=>pack,getObservation:()=>board,canDispatch:()=>true,onState:()=>{},
    dispatch:async action=>{
      if (board.levelsCompleted >= target || board.level > target) throw new Error('Dispatch past the requested level');
      const issued=performance.now(); if(effects.length%25===0)console.log(JSON.stringify({progress:effects.length,level:board.level})); const plan=agent.snapshot.trace.findLast(e=>e.kind==='sic_native_plan'); if(plan){const kind=action.id===6?"click":action.id>=1&&action.id<=4?"move":"other"; const types=pathKinds.get(plan.id)??new Set();types.add(kind);pathKinds.set(plan.id,types);series.set(plan.id,(series.get(plan.id)??0)+1);if(priorDispatch){(priorDispatch.plan===plan.id?continuedGaps:boundaryGaps).push(issued-priorDispatch.at);}priorDispatch={plan:plan.id,at:issued};}
      first??=issued-start;
      const previous=board; board=await game({type:'action',actionId:action.id,...(action.id===6?{data:action.data}:{})});
      const executionMs=performance.now()-issued; let changed=0, left=64, right=-1, top=64, bottom=-1; for(let y=0;y<64;y++) for(let x=0;x<64;x++) if(previous.frame[y][x]!==board.frame[y][x]){changed++; left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);} effects.push([action.id,action.data??null,changed,changed?[left,top,right,bottom]:null,board.frames.length,board.levelsCompleted,agent.snapshot.proposal?.sicSituationCard?.strategy,agent.snapshot.trace.findLast(e=>e.kind==="sic_native_plan")?.family,agent.snapshot.proposal?.sicSituationCard?.situation,agent.snapshot.proposal?.sicSituationCard?.evidence?.length]);
      const family=agent.snapshot.trace.findLast(e=>e.kind==='sic_native_plan')?.family??'unbound'; usage.set(family,(usage.get(family)??0)+1); const strategy=agent.snapshot.trace.findLast(e=>e.kind==='sic_native_plan')?.strategy??'unbound'; decisions.set(strategy,(decisions.get(strategy)??0)+1);
      gameMs+=executionMs;
      trajectory.update(JSON.stringify([action,board.frame,board.frames,board.level,board.levelsCompleted,board.state]));
      return {observation:board,executionMs};
    }});
  try {
    const levelStats = [];
    for (let level = 0; level < target; level++) {
      const before = agent.snapshot.actionCount;
      const beforeActive = agent.snapshot.activeSeconds;
      const started = performance.now(), phases=structuredClone(costs), gameStart=gameMs;
      const actionCap=levelBudgets[level].actions;
      let priorActions;
      do {
        priorActions=agent.snapshot.actionCount;
        await agent.run(Math.min(actionCap,V6_MAX_RUN_ACTIONS));
      } while (board.levelsCompleted<=level && agent.snapshot.status==='paused'
        && agent.snapshot.actionCount>priorActions && agent.snapshot.actionCount-before<actionCap);
      levelStats.push({ level: level + 1, won: board.levelsCompleted > level,
        activeMs:Math.max(0,Math.round(1000*(agent.snapshot.activeSeconds-beforeActive))),
        budget:levelBudgets[level],
        actions: agent.snapshot.actionCount - before, ms: Math.round(performance.now() - started), gameMs:Math.round(gameMs-gameStart), costs:Object.fromEntries(Object.entries(costs).map(([key,stat])=>[key,{ms:Math.round(stat.ms-(phases[key]?.ms??0)),count:stat.count-(phases[key]?.count??0)}])), graph:solver?.inspectKnowledge().chain, deltas:solver?.inspectKnowledge().deltas.length, acquiredRecords:agent.snapshot.acquiredRecords, nodes:agent.snapshot.nodeCount, traceEvents:agent.snapshot.trace.length, prefixHash:trajectory.copy().digest("hex") });
      await appendFile(process.argv[4]+'.levels',JSON.stringify({code,level:levelStats.at(-1)})+String.fromCharCode(10)); console.log(JSON.stringify({game:code,level:level+1,won:board.levelsCompleted>level,totalCommands:agent.snapshot.actionCount}));
      if (board.levelsCompleted <= level || agent.snapshot.status === 'stopped') break;
    }
    const wall=performance.now()-start;
    const snapshot=agent.snapshot;
    return {code,target,mode,parallelWorkers,recoveries,resumes,gaps:{continued:metric(continuedGaps),boundary:metric(boundaryGaps)},series:[...series.values()].filter(n=>n>1),pathKinds:[...series].filter(([,n])=>n>1).map(([id,n])=>({length:n,type:[...pathKinds.get(id)].sort().join("+")})),effects,decisions:Object.fromEntries(decisions),usage:Object.fromEntries(usage),actions:snapshot.actionCount,levels:board.levelsCompleted,reason:snapshot.reason,status:snapshot.status,
      ...(snapshot.status==='error'?{message:snapshot.message}:{}),authority:snapshot.sicActionCoverage?.sicOnly??0,solverFamilies:snapshot.coverage?.registeredFamilies.length,
      levelStats,
      ...(board.levelsCompleted < target ? { terminalDecisions: snapshot.trace
        .filter(event => ['sic_native_plan','before_guard','actual_outcome','sealed_prefix','native_acquisition_incomplete'].includes(event.kind))
        .slice(-32).map(event => Object.fromEntries(['kind','family','strategy','index','admitted','point_bound','matched','reason',
          'seal_prefix','acquired_actions'].filter(key => typeof event[key] === 'boolean' || typeof event[key] === 'string'
            || typeof event[key] === 'number').map(key => [key,event[key]]))) } : {}),
      trace:trajectory.digest('hex')};
  }finally{agent.dispose();}
}
const { appendFile } = await import('node:fs/promises');
const mode=process.argv[6]??'sic';
if (mode !== 'sic' && mode !== 'sic-fallback') throw new Error('Invalid solver mode');
const target=process.argv[3]==='auto' ? undefined : Number(process.argv[3]);
const parallelWorkers=Number(process.argv[5]);
if ((target!==undefined && (!Number.isInteger(target)||target<1||target>10))
  || !Number.isInteger(parallelWorkers) || parallelWorkers<1) throw new Error('Invalid chronological campaign configuration');
for (const code of process.argv[2].split(',')) {
  console.log(JSON.stringify({game:code,target,status:'started'}));
  try {
    const result = await run(code,target,parallelWorkers);
    await appendFile(process.argv[4], JSON.stringify(result)+'\n');
  } catch (error) {
    await appendFile(process.argv[4], JSON.stringify({code,target,status:'harness_error',message:String(error)})+'\n');
  }
}
