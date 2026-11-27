// Diagnostic only: reproduce an already recorded public prefix, then expose
// the actual returns of the candidate family. Never a qualification campaign.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {gunzipSync} from 'node:zlib';
const root=fileURLToPath(new URL('../../../',import.meta.url));
const load=file=>import(pathToFileURL(resolve(root,file)));
const [{createGameDispatcher},{createSicObservedCarrierReduction},{measureNativeObservation},{v6FrameHash},{observedPressureRecoveryGroup}]=await Promise.all([
 load('src/runtime/native-game-dispatcher.ts'),load('src/sic/observed-carrier-reduction.ts'),load('src/logos-engine/v6-native-observer.ts'),
 load('src/runtime/v6-agent-protocol.ts'),load('src/sic/public-input-exploration.ts')]);
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
const games=createGameDispatcher(loadLegacy), run=JSON.parse(gunzipSync(await readFile(new URL('./public-prefix-278.json.gz',import.meta.url))).toString());
const capture=JSON.parse(gunzipSync(await readFile(new URL('./first-preemption.json.gz',import.meta.url))).toString());
let board=await games.dispatch({type:'load',code:'LF52',level:1});
for(const [id,data] of run.commands)board=await games.dispatch({type:'action',actionId:id,...(id===6?{data}:{})});
assert.equal(board.level,6);assert.equal(await v6FrameHash(board.frame),capture.observation.frame_hash,'The diagnostic must reach the identical public frame');
const family=createSicObservedCarrierReduction();family.restore(capture.local);
const scope=capture.observation.observation_ref.split(':epoch:')[0];let observation=capture.observation;
const packet=async board=>({frame_rows:board.frame,frame_hash:await v6FrameHash(board.frame),level:board.level,levels_completed:board.levelsCompleted,
 state:board.state,available_action_refs:board.availableActionIds.map(id=>'ACTION'+id)});
const results=[];
for(let index=0;index<12;index++){
 const before=board,local=structuredClone(family.state()),inputs=observation.available_action_refs.map(action_ref=>({action_ref,data:{}}));
 const proposal=await family.proposeInGroup(observedPressureRecoveryGroup,observation,board.frame,inputs,79-index);
 if(!proposal){results.push({index,declined:true,local,observation});break;}
 const beforeGuard=await family.before(proposal,0,await packet(board),observation);
 const command=proposal.actions[0];board=await games.dispatch({type:'action',actionId:Number(command.action_ref.slice(6)),...(command.action_ref==='ACTION6'?{data:command.data}:{})});
 const after=await measureNativeObservation(await packet(board),observation.revision+1,scope);
 const outcome=await family.after(proposal,0,observation,after,before.frame,board.frame);
 await family.record(observation,after,command,before.frame,board.frame,proposal,0);
 results.push({index,proposal,beforeGuard,first:before.frame,second:board.frame,before:observation,after,outcome,ownerBefore:local,ownerAfter:structuredClone(family.state())});
 console.log(JSON.stringify({index,command,choice:proposal.choice.stage,purpose:proposal.local.segment?.purpose,outcome,selected:family.state().state?.selected,stopped:family.state().state?.stopped}));
 observation=after;if(board.levelsCompleted>=6)break;
}
await writeFile(process.argv[2]??'/tmp/lf52-public-return-probe.json',JSON.stringify({kind:'public-prefix-diagnostic-not-qualification',replayedCommands:278,initialFrame:capture.observation.frame_hash,results}));
