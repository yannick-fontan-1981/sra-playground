import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {mount} from '../ls19-ligne-90/montage.mjs';

const [sha,group,vendor,out,selection]=process.argv.slice(2);
const base='d0e7527ca8033bd805a6d7a8bb021eff62e87021',candidate='d84d0b938904a9e10a1ab82f8b8f92a0cfec5cdc';
assert.ok([base,candidate].includes(sha));
const groupCases={nominal:['nominal'],contrôles:['autre-commande','permutation','retrait','stationnaire'],
  réserve:['imageT3','stationnaireT3']};
assert.ok(groupCases[group]);
let byte;
if(group==='réserve'){
  const bytes=readFileSync(selection);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),'e932e1549ec26cc0971c3867c9a24c6e116f13d79e38f614e3ed80dc294af8c0');
  byte=Buffer.from(JSON.parse(bytes).seed,'hex')[0];
}
const instance=mount(sha,'.');
try{
  const repo=execFileSync('git',['rev-parse','--show-toplevel'],{encoding:'utf8'}).trim();
  const tar=join(instance.program,'operator.tar'),exp='experiments/sic-agenda-offres/';
  execFileSync('git',['-C',repo,'archive','--output='+tar,candidate,exp+'evaluateur-jeu.mjs',exp+'frontiere-22-23/game.mjs',
    exp+'moteur-reference.mjs',exp+'dico-86','public/python']);
  execFileSync('tar',['-xf',tar,'-C',instance.program]);
  const source=join(instance.program,exp,'dico-86','operateur.mjs');
  let code=readFileSync(source,'utf8');
  const replace=(anchor,value)=>{
    assert.equal(code.split(anchor).length,2,anchor);code=code.replace(anchor,value);
  };
  replace("['nominal','autre-commande','permutation','retrait','stationnaire']",
    "['nominal','autre-commande','permutation','retrait','stationnaire','imageT3','stationnaireT3']");
  replace('const steps=[],staleChecks=[];','const steps=[],staleChecks=[];let formeT3=null;');
  replace("const shown=i===2&&variant==='stationnaire'?{...actual,frame:board.frame,frames:[board.frame]}:actual;",
    `let shown=actual;
      if((i===2&&variant==='stationnaire')||(i===3&&variant==='stationnaireT3'))
        shown={...actual,frame:board.frame,frames:actual.frames.map(()=>board.frame)};
      if(i===3&&variant==='imageT3'){
        const end=digest(actual.frame);
        const intermediate=actual.frames.map((image,index)=>({index,hash:digest(image)}))
          .filter(v=>v.index<actual.frames.length-1 && v.hash!==end);
        const kept=intermediate.length?intermediate[${byte??0}%intermediate.length].index:null;
        formeT3={choisie:kept,possibles:intermediate.length};
        shown={...actual,frames:actual.frames.map((image,index)=>index===kept?image:actual.frame)};
      }`);
  replace('const after={ref:e.observation_ref','const after={ticket:ticket.id,propriétaire:e.family,ref:e.observation_ref');
  replace('count:shown.frames.length,completed:','count:shown.frames.length,images:shown.frames.map(digest),imagesJeu:actual.frames.map(digest),avant:digest(board.frame),completed:');
  replace("if(i===2 && variant==='stationnaire')break;","if((i===2 && variant==='stationnaire') || (i===3 && ['imageT3','stationnaireT3'].includes(variant)))break;");
  replace("if(variant==='stationnaire'){","if(['stationnaire','imageT3','stationnaireT3'].includes(variant)){");
  replace('type:\'resume\',sessionId,sequence:2','type:\'resume\',sessionId,sequence:steps.length');
  replace('return {steps,staleChecks,nextStationary:{ref:ticket.observationRef,command:[ticket.actionRef,ticket.data],',
    'return {steps,staleChecks,formeT3,nextStationary:{ref:ticket.observationRef,propriétaire:r.snapshot.lastDecision,command:[ticket.actionRef,ticket.data],');
  const prepared=join(dirname(source),'observations-operateur.mjs');writeFileSync(prepared,code);
  const {play}=await import(pathToFileURL(prepared));
  const engine=pathToFileURL(instance.program+'/').href, results={};
  for(const name of groupCases[group])results[name]=await play(engine,name,vendor);
  writeFileSync(out,JSON.stringify({sha,group,results})+'\n',{flag:'wx'});
}finally{instance.close();}
