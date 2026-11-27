// Public-prefix diagnostic only. No full SIC checkpoint or timing qualification.
import assert from 'node:assert/strict';
import {readFile,writeFile,appendFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const root='/workspace/scratch/8b7740e8a750/carriers-wa30-strict';
const load=file=>import(pathToFileURL(resolve(root,file)));
const [{createGameDispatcher},{createSicVerifyOrientedDelivery},{measureNativeObservation},{v6FrameHash},{orientedCouplingScene}]=await Promise.all([
load('src/runtime/native-game-dispatcher.ts'),load('src/sic/oriented-delivery.ts'),load('src/logos-engine/v6-native-observer.ts'),load('src/runtime/v6-agent-protocol.ts'),load('src/logos-engine/v6-oriented-coupling.ts')]);
let legacy;
async function loadLegacy(){
 if(legacy)return legacy;
 const {loadPyodide}=await load('public/vendor/pyodide/pyodide.mjs');
 const py=await loadPyodide({indexURL:resolve(root,'public/vendor/pyodide'),stdout:()=>{},stderr:()=>{}});
 await py.loadPackage(['numpy','pydantic','typing-extensions']);
 for(const name of ['custom-games.zip','official-games.zip'])py.unpackArchive(new Uint8Array(await readFile(resolve(root,'public/python',name))),'zip',{extractDir:'/games'});
 for(const name of ['game_bridge.py','official_adapter.py','custom_level_navigation.py'])py.FS.writeFile('/games/'+name,await readFile(resolve(root,'public/python',name),'utf8'));
 py.runPython("import sys\nsys.path.insert(0,'/games')\nfrom game_bridge import dispatch");
 const dispatch=request=>{py.globals.set('_test_request',JSON.stringify(request));const result=JSON.parse(py.runPython('dispatch(_test_request)'));if(result.error)throw Error(result.error);return {...result,gameCode:result.code??result.gameCode};};
 return legacy={dispatch};
}

const folder='/workspace/scratch/8b7740e8a750/';
const saved=JSON.parse(gunzipSync(await readFile(resolve(root,'docs/diagnostics/sic-resume-20261126/wa30-continuity.jsonl.gz'))));
const previous=(await readFile(folder+'wa30-study/baseline/wa30-baseline-13.jsonl','utf8')).trim().split('\n').map(JSON.parse);
const captures=(await readFile(folder+'wa30-strict-3872019d.jsonl.public.jsonl','utf8')).trim().split('\n').map(JSON.parse).filter(row=>row.level===8);
const old=(await readFile(folder+'wa30-strict-bd2c45e5.jsonl.public.jsonl','utf8')).trim().split('\n').map(JSON.parse).find(row=>row.level===8&&row.proposal.local.count===61);
const games=createGameDispatcher(loadLegacy);let board=await games.dispatch({type:'load',code:'WA30',level:1});
for(const ticket of saved.executedTickets)board=await games.dispatch({type:'action',actionId:Number(ticket.action.slice(6)),data:ticket.data??{}});
for(const row of previous.filter(row=>row.kind==='command-applied'&&row.levelActions<=61))board=await games.dispatch({type:'action',actionId:row.command.id});
assert.equal(board.level,8);assert.deepEqual(board.frame,old.first);
const family=createSicVerifyOrientedDelivery();
await family.attachPrograms({registerProgram:async()=>({run:async({situation})=>({result:situation.routeSupported?'P07':situation.knownInteraction?'P02':'P05',receipt:{}})})});
const initial=structuredClone(old.proposal.local);
initial.transportCouplings=captures[0].proposal.local.transportCouplings.filter(role=>role.sources.every(ref=>Number(ref.split(':revision:')[1].split(':')[0])<=474));
const scene=orientedCouplingScene(board.frame,initial.geometry,initial.color);
initial.transports=initial.transports.map(item=>({...item,shell:scene.boxes[item.box.join(',')]}));
family.restore({state:initial});
const scope=old.beforeRef.split(':epoch:')[0];let revision=474,commands=61;
const packet=async board=>({frame_rows:board.frame,frame_hash:await v6FrameHash(board.frame),level:board.level,levels_completed:board.levelsCompleted,state:board.state,available_action_refs:board.availableActionIds.map(id=>'ACTION'+id)});
let observation=await measureNativeObservation(await packet(board),revision,scope);
const output=folder+'wa30-last-part-public.jsonl';await writeFile(output,'');
while(board.levelsCompleted<8&&commands<166){
 const proposal=await family.propose(observation,board.frame,[],166-commands);
 if(!proposal){await appendFile(output,JSON.stringify({kind:'declined',commands,board,observation,owner:family.state()})+'\n');break;}
 const plannedAt=commands+1;
 await appendFile(output,JSON.stringify({kind:'plan',commands:plannedAt,proposal,observation,rows:board.frame})+'\n');
 const actual=[];
 for(let index=0;index<proposal.actions.length;index++){
  const gate=await family.before(proposal,index,await packet(board),observation);if(!gate.admitted)break;
  const comparison=captures.find(row=>Number(row.beforeRef.split(':revision:')[1].split(':')[0])-412===commands+1);
  if(comparison) assert.deepEqual(board.frame,comparison.first,'The owner-only diagnostic must preserve each actual captured frame at '+(commands+1));
  const before=board,first=observation,command=proposal.actions[index];
  board=await games.dispatch({type:'action',actionId:Number(command.action_ref.slice(6)),data:command.data});commands++;
  observation=await measureNativeObservation(await packet(board),++revision,scope);
  const outcome=await family.after(proposal,index,first,observation,before.frame,board.frame);
  actual.push({first,after:observation,command,before:before.frame,second:board.frame,index});
  await appendFile(output,JSON.stringify({kind:'return',commands,plannedAt,index,command,outcome,first:before.frame,second:board.frame,observation})+'\n');
  if(outcome.seal_prefix||board.levelsCompleted>=8)break;
 }
 for(const row of actual)await family.record(row.first,row.after,row.command,row.before,row.second,proposal,row.index,[]);
 console.log(JSON.stringify({plannedAt,declared:proposal.actions.length,executed:actual.length,commands,held:proposal.local.held,pending:Object.keys(proposal.scene.boxes).filter(k=>!proposal.local.geometry.targets.some(p=>p.join(',')===k)).length,approach:proposal.local.parallel?.approach.length,route:proposal.step.route?.length,score:board.levelsCompleted}));
 if(!actual.length)break;
}
console.log(JSON.stringify({kind:'done',commands,score:board.levelsCompleted}));
