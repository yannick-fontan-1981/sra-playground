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
import { historicalReplayReferences, replayCampaignBudgets } from './sic-replay-budgets.mjs';
import { superviseSicReplay } from './sic-replay-watchdog.mjs';
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
  crypto.randomUUID=()=>"98d555fa-6cf9-42fc-b483-9225bfc834d9";
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
  const sourceArm=process.env.SIC_SOURCE_COMPOSER_ARM;
  if (sourceArm !== undefined && (mode !== 'sic' || !['fixed', 'active'].includes(sourceArm))) {
    throw new TypeError('The source composer comparison requires a registered arm and strict SIC.');
  }
  const sourceStrategy = process.env.SIC_SOURCE_COMPOSER_STRATEGY ?? 'bind_earlier_motions_to_registered_subjects';
  if (sourceArm && !['motion_contrast', 'bind_earlier_motions_to_registered_subjects'].includes(sourceStrategy)) {
    throw new TypeError('The source composer experiment requires a registered strategy.');
  }
  const pack={...defaultRecoveryPack,solver:mode,
    ...(sourceArm === 'active' ? { informationPreference: { mode:'active',
      strategy:sourceStrategy,minimumOutcomes:2 } } : {})};
  const captureRivals = process.env.SIC_SOURCE_RETURN_RIVALS === '1';
  if (captureRivals && (!sourceArm || /^SS(?:0[89]|1\d|2[0-5])$/.test(code))) {
    throw new Error('Return hypothesis capture requires an authorized source comparison.');
  }
  const observedReturns = new Map();
  let accessContext = null;
  const publicKey = board => createHash('sha256').update(JSON.stringify([board.level, board.levelsCompleted,
    board.state, [...board.availableActionIds].sort((a,b) => a-b), board.frame])).digest('hex');
  function recordRivals(before, action, after, turn) {
    const from = publicKey(before), to = publicKey(after);
    const command = JSON.stringify([action.id, action.data ?? null]);
    const key = JSON.stringify([from, command]);
    const returns = observedReturns.get(key) ?? { level: before.level, command: action.id, targets: new Map() };
    const hypothesis = returns.targets.get(to) ?? { firstTurn: turn, count: 0, contexts: new Set() };
    hypothesis.count++;
    if (accessContext !== null) hypothesis.contexts.add(accessContext);
    returns.targets.set(to, hypothesis);
    observedReturns.set(key, returns);
    accessContext = before.level === after.level ? JSON.stringify([from, command]) : null;
  }
  const games=createGameDispatcher(loadLegacy);
  const game=request=>games.dispatch(request);
  const preferTransportUndo = process.env.SIC_SOURCE_TRANSPORT_UNDO === '1';
  const preferShorterCoverage = process.env.SIC_SOURCE_SHORTEST_COVERAGE === '1';
  const allowUnframedContact = process.env.SIC_SOURCE_UNFRAMED_CONTACT === '1';
  const sealedCoverageQualified = process.env.SIC_SEALED_COVERAGE_QUALIFIED === '1';
  if (preferTransportUndo && sourceArm !== 'active') throw new Error('Transport undo requires the active comparison arm.');
  if (preferShorterCoverage && (sourceArm !== 'active'
    || (/^SS(?:0[89]|1\d|2[0-5])$/.test(code) && !sealedCoverageQualified))) {
    throw new Error('The coverage cost comparison requires the active arm and the sealed source qualification.');
  }
  if (allowUnframedContact && (sourceArm !== 'active' || /^SS(?:0[89]|1\d|2[0-5])$/.test(code))) {
    throw new Error('Unframed contact hypotheses require an authorized source comparison.');
  }
  let solver;const service=new V6AgentService(async recovery=>(solver=await createNativeV6Runtime({common,strategy},{recovery,
    ...(preferShorterCoverage ? { preferShorterCoverage: true } : {}),
    ...(allowUnframedContact ? { allowUnframedContact: true } : {}),
    ...(preferTransportUndo ? { preferTransportUndo: true } : {})})));
  const evidence = process.env.SIC_SOURCE_COMPOSER_EVIDENCE === '1' ? new Map() : null;
  const seenEvidence = new Set();
  const recoveryEvidence = new Map();
  const sourceDecisions = new Map();
  function retainSourceEvidence(response) {
    for (const event of response.snapshot?.trace ?? []) {
      if (event.kind === 'sic_transport_undo_available' || event.kind === 'action_undo') {
        const key = JSON.stringify([event.kind, event.observation_ref ?? event.after]);
        recoveryEvidence.set(key, Object.fromEntries(['kind', 'before', 'after', 'observation_ref',
          'before_observation_ref', 'cause', 'restoreFrame', 'alternativeLength', 'excludedPush', 'level']
          .filter(field => event[field] !== undefined).map(field => [field, event[field]])));
      }
      if (event.kind !== 'sic_preparation_outcome' || !Number.isSafeInteger(event.revision)) continue;
      const occurrence = JSON.stringify([event.epoch, event.revision, event.hypothesis, event.result]);
      if (seenEvidence.has(occurrence)) continue;
      seenEvidence.add(occurrence);
      const key = JSON.stringify([event.epoch, event.phase, event.hypothesis, event.result]);
      const entry = evidence.get(key) ?? { level: event.epoch, phase: event.phase, hypothesis: event.hypothesis,
        outcome: event.result, count: 0, first: { revision: event.revision,
          witnesses: (event.refs ?? []).filter(Number.isSafeInteger).slice(0, 8) } };
      entry.count++;
      evidence.set(key, entry);
    }
  }
  const costs={};const transport={request:async operation=>{if(operation.type==='resume') resumes++;const start=performance.now();try{const response=await service.handle(operation);if(evidence)retainSourceEvidence(response);return response;}finally{const stat=costs[operation.type]??={ms:0,count:0};stat.ms+=performance.now()-start;stat.count++;}},reset:()=>{},dispose:()=>{}};
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
      const card = evidence && agent.snapshot.proposal?.sicSituationCard;
      if (card && ['test_composition', 'selectMarkedCursor', 'verifyMarkedCursor'].includes(card.strategy)) {
        const key = JSON.stringify([previous.level, card.strategy, card.trigger ?? null, card.situation ?? null]);
        if (!sourceDecisions.has(key)) sourceDecisions.set(key, { level: previous.level, strategy: card.strategy,
          trigger: card.trigger ?? null, firstTurn: effects.length + 1, action: action.id });
      }
      if (card?.coverageRouteImprovement) {
        const cost = card.coverageRouteImprovement;
        const key = JSON.stringify([previous.level, 'compare_coverage_cost', cost.motion, cost.previous, cost.proposed]);
        if (!sourceDecisions.has(key)) sourceDecisions.set(key, { level: previous.level, strategy: 'compare_coverage_cost',
          firstTurn: effects.length + 1, action: action.id, ...cost });
      }
      if (card?.unframedContactHypothesis) {
        const key = JSON.stringify([previous.level, 'test_unframed_contact_hypothesis']);
        if (!sourceDecisions.has(key)) sourceDecisions.set(key, { level: previous.level, strategy: 'test_unframed_contact_hypothesis',
          firstTurn: effects.length + 1, action: action.id });
      }
      if (captureRivals) recordRivals(previous, action, board, effects.length + 1);
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
    return {code,target,mode,parallelWorkers,...(sourceArm ? { sourceArm } : {}),recoveries,resumes,gaps:{continued:metric(continuedGaps),boundary:metric(boundaryGaps)},series:[...series.values()].filter(n=>n>1),pathKinds:[...series].filter(([,n])=>n>1).map(([id,n])=>({length:n,type:[...pathKinds.get(id)].sort().join("+")})),effects,decisions:Object.fromEntries(decisions),usage:Object.fromEntries(usage),actions:snapshot.actionCount,levels:board.levelsCompleted,reason:snapshot.reason,status:snapshot.status,
      ...(snapshot.status==='error'?{message:snapshot.message}:{}),authority:snapshot.sicActionCoverage?.sicOnly??0,solverFamilies:snapshot.coverage?.registeredFamilies.length,
      levelStats,
      ...(evidence ? { sourceComposerEvidence: [...evidence.values()], sourceRecoveryEvidence: [...recoveryEvidence.values()],
        sourceDecisions: [...sourceDecisions.values()] } : {}),
      ...(captureRivals ? { sourceReturnRivals: [...observedReturns.values()].filter(row => row.targets.size > 1)
        .map(({ level, command, targets }) => {
          const hypotheses = [...targets.values()];
          const uniqueContexts = new Set(hypotheses.flatMap(item => [...item.contexts]));
          return { level, command, branches: hypotheses.map(item => ({ firstTurn: item.firstTurn, observations: item.count })),
            contexts: uniqueContexts.size, contextualConflict: hypotheses.reduce((sum, item) => sum + item.contexts.size, 0) > uniqueContexts.size };
        }) } : {}),
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
const codes=process.argv[2].split(',');
if (replayChild) {
  const [code]=codes;
  let result;
  try {
    result = await run(code,target,parallelWorkers);
  } catch (error) {
    result={code,target,status:'harness_error',message:String(error)};
  }
  process.send({ kind:'result', result }, () => process.disconnect());
} else for (const code of codes) {
  console.log(JSON.stringify({game:code,target,status:'started'}));
  const result=await superviseSicReplay(fileURLToPath(import.meta.url),[code,...process.argv.slice(3)],code);
  if(result.levelStats?.length) {
    await appendFile(process.argv[4]+'.levels',result.levelStats.map(level=>JSON.stringify({code,level})).join('\n')+'\n');
  }
  await appendFile(process.argv[4],JSON.stringify(result)+'\n');
}
