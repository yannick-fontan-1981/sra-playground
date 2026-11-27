import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {copyFileSync,readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {mount} from '../ls19-ligne-90/montage.mjs';
import {cases,development,parameters} from './situations.mjs';
import {dialogue} from './dialogue.mjs';
const [sha,path,selection]=process.argv.slice(2);
let params=development;
if(selection){
  const bytes=readFileSync(selection);
  assert.ok(readFileSync(new URL('CONTRAT.md',import.meta.url),'utf8').includes(createHash('sha256').update(bytes).digest('hex')));
  params=parameters(JSON.parse(bytes).seed);
}
const mountPoint=mount(sha,'.'),reports=[];
try{
  copyFileSync(new URL('fournisseur.mjs',import.meta.url),join(mountPoint.program,'fournisseur.mjs'));
  for(const s of cases(params)){
    const result=await dialogue(['--permission','--allow-fs-read='+mountPoint.program,'fournisseur.mjs'],mountPoint.program,async({send})=>{
      const history=[],decisions=[],returns=[];
      for(const [before,id,after] of s.history)history.push(await send({type:'past',before,id,after}));
      const ask=(observation,domain)=>send({type:'decide',observation,domain});
      decisions.push(await ask(s.obs,s.domain));
      for(const after of s.afters){
        if(!decisions.at(-1).actions.length)break;
        returns.push(await send({type:'return',after}));
        decisions.push(await ask(after,s.domain));
      }
      return {history,decisions,returns};
    });
    reports.push(result);
  }
}finally{mountPoint.close();}
const [u,v]=params.ids.map(id=>'ACTION'+id);
const goals=[[u],[u],[v],[u],[v],[u],[u,v,u],[u,v],[]];
const verdicts=reports.map(({history,decisions,returns},i)=>{
  const issues=[],check=(label,b)=>{if(!b)issues.push(label);};
  const d=decisions[0],a=i===6?decisions.map(x=>x.actions[0]):d.actions;
  check('commandes',JSON.stringify(a)===JSON.stringify(goals[i]));
  if(i<7)for(const dec of decisions){
    check('question locale admise',dec.kind==='experiment' && dec.strategy==='test_local_input' &&
      dec.selected===dec.need?.subjects?.[0] && dec.context===dec.index && dec.projection===null &&
      dec.need?.parentObjective==='G_protocol_completion' && dec.need?.status==='assigned' &&
      dec.available.some(q=>q.action===dec.actions[0] && q.ref===dec.selected));
    check('garde sur occurrence',dec.guard===true && dec.wrongOccurrence===false);
  }
  if(i<2){check('égalité et permutation',d.available.length===2 && d.selected===reports[0].decisions[0].selected);}
  if(i===2 || i===3){
    const spent=i===2?u:v, tried=d.trials.find(t=>t.action===spent);
    check('preuve de la commande locale',d.available.length===1 && tried?.refs.includes(history[0].ref));
    check('même index',d.index===reports[2].decisions[0].index);
  }
  if(i===4 || i===5)check('deux questions neuves au même index',d.index===reports[4].decisions[0].index && d.available.length===2 &&
    d.available[0].priority===d.available[1].priority && d.trials.every(t=>!t.refs.length));
  if(i===6){
    check('retours acquis',returns.length===2 && returns.every((r,n)=>r.outcome.matched===null && r.outcome.status==='unknown_effect_observed' &&
      r.outcome.sic_frontier_outcome?.status==='observed' && r.outcome.sic_frontier_outcome?.objective===decisions[n].selected &&
      r.outcome.sic_frontier_outcome?.need===decisions[n].need.id));
    check('fermeture sur l’index d’origine',returns.length===2 && returns[0].stillOpen.length===1 && !returns[0].stillOpen.includes(d.selected) && !returns[1].stillOpen.length);
    check('reprise sur le nouveau plateau',decisions.length===3 && d.index===decisions[1].index && d.index!==decisions[2].index &&
      d.selected!==decisions[2].selected && decisions[2].available.length===2);
  }
  if(i===7)check('accès étayé vers la question distante',d.kind==='access' && d.strategy==='reach_open_input' && !d.available.length &&
    d.route.length===1 && d.route[0].edge===history[0].edge && d.route[0].witnesses.includes(history[0].ref) &&
    d.guard && !d.wrongOccurrence && d.context!==d.index && d.need.id!==d.prerequisite?.id && d.projection!==null);
  if(i===8)check('absence de trajet et besoin ouvert',!d.available.length && d.status==='frontier_exhausted' && d.need?.status==='open' && d.need?.kind==='find_observable_frontier_access');
  return {cas:i+1,issues};
});
writeFileSync(path,JSON.stringify({sha,reports,verdicts})+'\n',{flag:'wx'});
console.log(JSON.stringify({cas:reports.length,reussis:verdicts.filter(r=>!r.issues.length).length,ecarts:verdicts.filter(r=>r.issues.length)}));
process.exitCode=Number(verdicts.some(r=>r.issues.length));
