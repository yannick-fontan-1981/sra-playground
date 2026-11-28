import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {mount} from '../ls19-ligne-90/montage.mjs';

const [sha,group,vendor,out,selection]=process.argv.slice(2);
const base='d0e7527ca8033bd805a6d7a8bb021eff62e87021',candidate='4d9f1a397bd3706469f419739d077d366eb1b13c';
assert.ok([base,candidate].includes(sha));
const groups={nominal:['nominal'],contrôles:['sans-exemple','sans-voisin'],réserve:['permutation']};
assert.ok(groups[group]);
let byte;
if(group==='réserve'){
  const bytes=readFileSync(selection);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),'aa5fc4a24786f462eb276e5d1e6e62627a4451606a6514eda107da928c56988e');
  byte=Buffer.from(JSON.parse(bytes).seed,'hex')[0];
}
const instance=mount(sha,'.');
try{
  const repo=execFileSync('git',['rev-parse','--show-toplevel'],{encoding:'utf8'}).trim();
  const tar=join(instance.program,'operator.tar'),exp='experiments/sic-agenda-offres/';
  execFileSync('git',['-C',repo,'archive','--output='+tar,candidate,exp+'evaluateur-jeu.mjs',exp+'frontiere-22-23/game.mjs',
    exp+'moteur-reference.mjs',exp+'memo-56','public/python']);
  execFileSync('tar',['-xf',tar,'-C',instance.program]);
  const source=join(instance.program,exp,'memo-56','operateur.mjs');
  let code=readFileSync(source,'utf8').replaceAll('\r\n','\n');
  const replace=(anchor,value)=>{
    assert.equal(code.split(anchor).length,2,anchor);code=code.replace(anchor,value);
  };
  replace("variant==='nominal'||Object.hasOwn(interventions,variant)","variant==='nominal'||variant==='permutation'||Object.hasOwn(interventions,variant)");
  replace('let turn=1, removed=null, comparisons=[];','let turn=1, removed=null, comparisons=[],pair=null;');
  replace('const candidates=find(scene,input,seen,relation,comparison);',`if(turn===7&&variant==='permutation'){
      const previous=input.previous,list=previous.occurrences.slice(),available=[];
      for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++)available.push([i,j]);
      pair=available[${byte??0}%available.length];
      const [i,j]=pair;[list[i],list[j]]=[list[j],list[i]];
      input={...input,previous:{...previous,occurrences:list}};
    }
    const candidates=find(scene,input,seen,relation,comparison);`);
  replace('removed=null;\n    comparisons=[];', 'removed=null;pair=null;\n    comparisons=[];');
  replace('seal:digest(pre),removed,comparisons,','seal:digest(pre),removed,comparisons,pair,');
  replace('const after={ref:e.observation_ref','const after={ticket:ticket.id,owner:e.family,ref:e.observation_ref');
  const adapted=join(dirname(source),'observations-operateur.mjs');writeFileSync(adapted,code);
  const {play}=await import(pathToFileURL(adapted));
  const engine=pathToFileURL(instance.program+'/').href, results={};
  for(const name of groups[group])results[name]=await play(engine,name,vendor);
  writeFileSync(out,JSON.stringify({sha,group,results})+'\n',{flag:'wx'});
}finally{instance.close();}
