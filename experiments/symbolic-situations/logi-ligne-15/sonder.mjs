// Diagnostic séparé. Le point d'arrêt lit les offres déjà constituées dans la fonction native.
// L'élection et la planification continuent avec leurs valeurs d'origine.
import { Session } from 'node:inspector';
import { readFileSync } from 'node:fs';
const file=new URL('./src/logos-engine/v6-native-caller.ts',import.meta.url);
const lines=readFileSync(file,'utf8').split(/\r?\n/);
const lineNumber=lines.findIndex(s=>s.includes('const ordered = electInformationGoals(offers,'));
if(lineNumber<0) throw Error('Point de mesure de l’élection introuvable');
const session=new Session();session.connect();
const post=(method,params={})=>new Promise((resolve,reject)=>session.post(method,params,(err,res)=>err?reject(err):resolve(res)));
await post('Debugger.enable');
const {breakpointId}=await post('Debugger.setBreakpointByUrl',{urlRegex:'v6-native-caller\\.ts$',lineNumber});
const measurements=[];
session.on('Debugger.paused',({params})=>{
  if (!params.hitBreakpoints?.includes(breakpointId)) {session.post('Debugger.resume');return;}
  const expression='({revision:observation.observation_ref,submitted:offers.map(o=>o.source),ranked:Array.from(electInformationGoals(offers,observation,remaining,options.meter,policy,opening==="active",preference),pair=>pair[0].source)})';
  session.post('Debugger.evaluateOnCallFrame',{callFrameId:params.callFrames[0].callFrameId,expression,returnByValue:true},(err,res)=>{
    if(!err && res?.result?.value) measurements.push(res.result.value);
    session.post('Debugger.resume');
  });
});
globalThis.takeElection=()=>measurements.splice(0);
