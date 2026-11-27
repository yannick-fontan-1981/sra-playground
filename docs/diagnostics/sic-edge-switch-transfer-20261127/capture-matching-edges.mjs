// Reproduce a SIC campaign from level 1 through the requested victory on either game backend.
// Node 22+, repository root: node scripts/check-sic-chronological.mjs LP85 7 result.jsonl 1
// Arguments: comma-separated games, target (1–10 or auto), local result path, worker count, optional sic or sic-fallback.
// SIC_REPLAY_REFERENCES may provide per-level counts from prior wins or a verified oracle.
// One process runs games sequentially. No source-game logic or oracle is exposed to SIC.
// Raw observations remain local; per-level prefixes hash actions and official returns.
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import { historicalReplayReferences, replayCampaignBudgets } from '/workspace/scratch/082336907086/sic-27-work/matching-edges/scripts/sic-replay-budgets.mjs';
import { superviseSicReplay } from '/workspace/scratch/082336907086/sic-27-work/matching-edges/scripts/sic-replay-watchdog.mjs';
const replayChild=process.env.SIC_REPLAY_CHILD==='1' && typeof process.send==='function';
const load=file=>import(pathToFileURL(resolve(file)));
const pinned=resolve('reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6');
const json=async file=>JSON.parse(await readFile(resolve(pinned,file),'utf8'));
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
  const [{createGameDispatcher},{createNativeV6Runtime},{BrowserV6Agent},{V6_MAX_RUN_ACTIONS},
    {V6AgentService},{defaultRecoveryPack},common,strategy,historicalData,suppliedData]=await Promise.all([
    load('src/runtime/native-game-dispatcher.ts'),load('src/logos-engine/v6-native-runtime.ts'),
    load('src/runtime/v6-agent.ts'),load('src/runtime/v6-agent-protocol.ts'),
    load('src/runtime/v6-agent-service.ts'),load('src/sic/active-recovery.ts'),
    json('laya_proto/common_frontier_policy.drm.json'),json('morphology_policy/strategy.drm'),
    readFile(resolve('docs/architecture/sic-v8-level6-campaign-7bb9f152.json'),'utf8'),
    process.env.SIC_REPLAY_REFERENCES ? readFile(process.env.SIC_REPLAY_REFERENCES,'utf8') : null,
  ]);
  const historical=historicalReplayReferences(JSON.parse(historicalData));
  const supplied=suppliedData ? JSON.parse(suppliedData) : undefined;
  const pack={...defaultRecoveryPack,solver:mode};
  const games=createGameDispatcher(loadLegacy);
  const game=request=>games.dispatch(request);
  let solver;const service=new V6AgentService(async recovery=>(solver=await createNativeV6Runtime({common,strategy},{recovery})));
  const costs={};const transport={request:async operation=>{if(operation.type==='resume') resumes++;const start=performance.now();try{return await service.handle(operation);}finally{const stat=costs[operation.type]??={ms:0,count:0};stat.ms+=performance.now()-start;stat.count++;}},reset:()=>{},dispose:()=>{}};
  const usage = new Map(), decisions = new Map(), series = new Map(); let resumes=0, priorDispatch=null;const continuedGaps=[], boundaryGaps=[]; let board=await game({type:'load',code,level:1}), gameMs=0, first=null; const effects=[]; const pathKinds = new Map();
  const target = requestedTarget ?? board.levelCount;
  const levelBudgets = replayCampaignBudgets(code, target, historical, supplied);
  const recoveries = { reset: 0, undo: 0 };
  const publicEvidence = []; const levelActions = new Map(); let captureStopped = false;
  const trajectory=createHash('sha256');
  const start=performance.now();
  const agent=new BrowserV6Agent({transport,targetLevels:target,levelBudgets,parallelWorkers,
    resetLevel:async()=>{recoveries.reset++;return board=await game({type:'reset'});},
    canUndoAction:()=>!!board.canUndo,undoAction:async()=>{recoveries.undo++;return board=await game({type:'undo'});},
    recoveryConfiguration:()=>pack,getObservation:()=>board,canDispatch:()=>!captureStopped,onState:()=>{},
    dispatch:async action=>{
      if (board.levelsCompleted >= target || board.level > target) throw new Error('Dispatch past the requested level');
      const issued=performance.now(); if(effects.length%25===0)console.log(JSON.stringify({progress:effects.length,level:board.level})); const plan=agent.snapshot.trace.findLast(e=>e.kind==='sic_native_plan'); if(plan){const kind=action.id===6?"click":action.id>=1&&action.id<=4?"move":"other"; const types=pathKinds.get(plan.id)??new Set();types.add(kind);pathKinds.set(plan.id,types);series.set(plan.id,(series.get(plan.id)??0)+1);if(priorDispatch){(priorDispatch.plan===plan.id?continuedGaps:boundaryGaps).push(issued-priorDispatch.at);}priorDispatch={plan:plan.id,at:issued};}
      first??=issued-start;
      const previous=board;
      const prepared=solver?.families?.find(f=>f.id==='sic_test_prepared_effects');
      const families = Object.fromEntries((solver?.families??[]).filter(f=>f.id.includes('crossing_rows') || f.id==='sic_settle_pieces_at_matching_edges').map(f=>[f.id,structuredClone(f.state?.()??null)]));
      const levelAction = (levelActions.get(previous.level) ?? 0) + 1; levelActions.set(previous.level, levelAction);
      const publicBefore={level:previous.level,levelsCompleted:previous.levelsCompleted,state:previous.state,frame:previous.frame,frames:previous.frames,availableActionIds:previous.availableActionIds};
      const captured={families,levelAction,index:effects.length+1,action:structuredClone(action),plan:structuredClone(plan??null),proposal:structuredClone(agent.snapshot.proposal),nativeObservation:structuredClone(solver?.observation??null),selectionReceipt:structuredClone(solver?.selectionReceipt??null),publicBefore,
        ...(previous.level===target?{previewLearning:structuredClone(prepared?.state?.()?.previewLearning??null)}:{})};
      board=await game({type:'action',actionId:action.id,...(action.id===6?{data:action.data}:{})});
      publicEvidence.push({...captured,publicAfter:{level:board.level,levelsCompleted:board.levelsCompleted,state:board.state,frame:board.frame,frames:board.frames,availableActionIds:board.availableActionIds}});
      if((previous.level===target && levelAction>=targetCommands) || effects.length+1>=captureLimit)captureStopped=true;
      const executionMs=performance.now()-issued; let changed=0, left=64, right=-1, top=64, bottom=-1; for(let y=0;y<64;y++) for(let x=0;x<64;x++) if(previous.frame[y][x]!==board.frame[y][x]){changed++; left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);} effects.push([action.id,action.data??null,changed,changed?[left,top,right,bottom]:null,board.frames.length,board.levelsCompleted,agent.snapshot.proposal?.sicSituationCard?.strategy,agent.snapshot.trace.findLast(e=>e.kind==="sic_native_plan")?.family,agent.snapshot.proposal?.sicSituationCard?.situation,agent.snapshot.proposal?.sicSituationCard?.evidence?.length]);
      process.send({ kind:'command-applied', sicAuthorized:plan!==undefined && mode==='sic', levelsCompleted:board.levelsCompleted,
        command: { id:action.id, family:plan?.family??null, strategy:plan?.strategy??null } });
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
      if(agent.snapshot.actionCount>=captureLimit)break;
      process.send({ kind:'level-started', target, level:level+1, budget:levelBudgets[level] });
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
      process.send({ kind:'level-finished', level:levelStats.at(-1) });
      console.log(JSON.stringify({game:code,level:level+1,won:board.levelsCompleted>level,totalCommands:agent.snapshot.actionCount}));
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
      publicEvidence, finalFamilies:Object.fromEntries((solver?.families??[]).filter(f=>f.id.includes('crossing_rows') || f.id==='sic_settle_pieces_at_matching_edges').map(f=>[f.id,structuredClone(f.state?.()??null)])), nativeTrace:structuredClone(snapshot.trace), diagnosticOnly:true, captureLimit, captureStopped, trace:trajectory.digest('hex')};
  }finally{agent.dispose();}
}

const [code, targetArg, targetCommandsArg, capArg, output] = process.argv.slice(2);
const mode='sic', target=Number(targetArg), targetCommands=Number(targetCommandsArg), captureLimit=Number(capArg);
if(!code||!Number.isSafeInteger(target)||target<1||!Number.isSafeInteger(captureLimit)||captureLimit<1||!Number.isSafeInteger(targetCommands)||targetCommands<1||!output)throw Error('Usage: capture-crossing-edges.mjs CODE TARGET_LEVEL COMMANDS_AT_TARGET TOTAL_ACTIONS OUTPUT.json');
process.send=()=>{};
const {execFileSync}=await import('node:child_process');
const source=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const began=new Date().toISOString();
const result=await run(code,target,1);
const baseline=(await readFile('/workspace/scratch/082336907086/sic-27-work/baseline-results.jsonl','utf8')).trim().split('\n').map(JSON.parse).find(r=>r.code===code);
const commandPrefixMatches=!!baseline && result.effects.every((effect,i)=>JSON.stringify(effect.slice(0,2))===JSON.stringify(baseline.effects[i]?.slice(0,2)));
const scoredPrefixesMatch=result.levelStats.filter(level=>level.won).every(level=>level.prefixHash===baseline?.levelStats.find(other=>other.level===level.level)?.prefixHash);
const sourceUnchanged=source===execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim() && !execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim();
const document={probeSha256:createHash('sha256').update(await readFile(fileURLToPath(import.meta.url))).digest('hex'),scoredPrefixesMatch,schema:'sic.public-role-first-loss.v1',source,sourceUnchanged,targetCommands,checkout:process.cwd(),startedAt:began,finishedAt:new Date().toISOString(),qualification:'Diagnostic borné depuis L1, une session SIC, commandes natives. Le collecteur est passif ; aucune qualification de temps. Budgets archivés inchangés ; arrêt de capture au nombre total indiqué ou après le nombre demandé de gestes du niveau cible. Aucun watchdog ni plafond augmenté.',commandPrefixMatches,...result};
await writeFile(output,JSON.stringify(document));
console.log(JSON.stringify({output,code,source,scoredPrefixesMatch,captureStopped:result.captureStopped,actions:result.actions,levels:result.levels,commandPrefixMatches,reason:result.reason,status:result.status,prepared:result.effects.filter(e=>e[7]==='sic_test_prepared_effects').length}));
