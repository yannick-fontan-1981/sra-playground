import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp,readFile,rm,writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join,resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { digest } from './operateur.mjs';
import { git,versions,withEngine } from '../moteur-reference.mjs';

const {values}=parseArgs({options:{pyodide:{type:'string'},recu:{type:'string'}}});
const vendor=resolve(values.pyodide);
const containment='containment_and_contact', cover='conditional_reflected_cover';
const variants={nominal:16,'autre-calibrage':5,'retour-contenant':4,'preuve-reflet':5,
  'retrait-reflet':5,'retour-reflet':5,'reprise-reflet':16};
const point=(s)=>s.pre.command[0];
const prefix=(left,right,count)=>{
  assert.ok(left.length>=count&&right.length>=count);
  for(let i=0;i<count;i++)assert.equal(digest(left[i]),digest(right[i]),'geste '+(i+1));
};
function ticket(s,family,kind,command,index=0){
  assert.deepEqual([s.pre.family,s.pre.kind,point(s),s.pre.index,s.pre.guard],[family,kind,command,index,true]);
}
function verify8(g,c){
  const [s1,s2]=c.nominal.steps;
  const [,second]=c['autre-calibrage'].steps,firstAlt=c['autre-calibrage'].steps[0];
  const blocked=c['retour-contenant'],stay=blocked.steps[0];
  ticket(s1,'containment',containment,'ACTION1');
  assert.equal(s1.pre.containmentPlan.mode,'calibrate');
  assert.equal(s1.pre.containmentPlan.body,null);
  assert.equal(s1.pre.containmentPlan.expected,null);
  const state=s1.pre.containment.fact;
  assert.deepEqual(state.poses,[[36,15]]);
  assert.deepEqual(state.assignments,[[0]]);
  assert.deepEqual(state.goals,[[51,45]]);
  assert.equal(state.bodies[0].color,4);
  assert.equal(state.bodies[0].shapeSize,state.bodies[0].shellSize);
  assert.deepEqual(state.availableCalibration,['ACTION1','ACTION2','ACTION3','ACTION4','ACTION5']);
  const a=s1.after.containment;
  assert.deepEqual(a.event.moved,[0]);
  assert.equal(a.event.evidence,s1.after.ref);
  assert.deepEqual(a.event.after,[[36,12]]);
  assert.deepEqual(a.rim,[{goal:[51,45],size:35,before:[9],after:[9],unchanged:true}]);
  assert.deepEqual(a.vectors,[['ACTION1',[0,-3]]]);
  assert.equal(a.active,0);
  assert.deepEqual(s2.pre.containment.fact.refs,[['ACTION1',s1.after.ref]]);
  assert.ok(!s2.pre.containment.fact.availableCalibration.includes('ACTION1'));
  assert.equal(s1.after.matched,null);
  ticket(s2,'containment',containment,'ACTION2');
  ticket(firstAlt,'containment',containment,'ACTION2');
  assert.deepEqual(firstAlt.pre.containment,s1.pre.containment);
  assert.deepEqual(firstAlt.after.containment.event.after,[[36,18]]);
  assert.deepEqual(firstAlt.after.containment.vectors,[['ACTION2',[0,3]]]);
  assert.deepEqual(firstAlt.after.containment.rim,a.rim);
  ticket(second,'containment',containment,'ACTION1');
  assert.deepEqual(stay.pre,s1.pre);
  assert.equal(stay.after.packet,s1.after.packet);
  assert.notEqual(stay.after.presented,stay.after.actual);
  assert.deepEqual(stay.after.containment.event.moved,[]);
  assert.deepEqual(stay.after.containment.noMoves,[['ACTION1',[[36,15]]]]);
  assert.deepEqual(stay.after.containment.vectors,[]);
  assert.equal(stay.after.containment.active,null);
  assert.equal(blocked.next.action,'ACTION2');
  assert.equal(blocked.next.kind,containment);
  const [t1,t2]=g.nominal.steps;
  return {nominal:[t1,t2],alternative:[firstAlt,second],stationnaire:blocked};
}
function verify77(g,c){
  const nominal=g.nominal.steps,initial=nominal[3],start=initial.pre.reflection,solved=start.solved;
  ticket(initial,'reflected_cover',cover,'ACTION3');
  assert.equal(start.pre.fact.ready,true);
  assert.deepEqual(start.pre.fact.axes,[0,1]);
  assert.deepEqual(solved.pre.fact.effects.map(([k,v])=>[JSON.parse(k),v]),[
    [['body','ACTION1'],[0,-1]],[['body','ACTION2'],[0,1]],[['body','ACTION3'],[-1,0]]]);
  assert.deepEqual(solved.pre.fact.refs,nominal.slice(0,3).map(s=>s.after.ref));
  for(const s of nominal.slice(0,3)){
    assert.equal(s.after.reflection.events[0].kind,'public_reflection_covariation');
    assert.equal(s.after.reflection.events[0].stationary_support_revalidated,true);
    assert.equal(s.after.reflection.events[0].evidence,s.after.ref);
  }
  assert.deepEqual([solved.pre.fact.world.dim,solved.pre.fact.world.axis,solved.pre.fact.world.pitch],[0,10,3]);
  assert.deepEqual(initial.pre.reflectionPlan.coveredBefore,[{direct:[],reflected:[]}]);
  assert.deepEqual(solved.solution,[[14,10,[[-4,10]]],10,[[-4,10]]]);
  assert.deepEqual(nominal.slice(3).map(s=>s.after.matched),Array(13).fill(true));
  assert.equal(nominal.at(-1).after.levels,0);

  const loss=g['preuve-reflet'].steps;
  prefix(loss,nominal,2);
  assert.deepEqual(loss[2].pre,nominal[2].pre);
  assert.deepEqual(loss[2].after.containment,nominal[2].after.containment);
  assert.equal(loss[2].after.packet,nominal[2].after.packet);
  assert.deepEqual(loss[3].pre.reflection.pre.fact.axes,[1]);
  assert.equal(loss[3].pre.reflection.pre.fact.ready,false);
  assert.equal(loss[3].pre.kind,containment);
  assert.equal(point(loss[3]),'ACTION4');

  const withdrawal=g['retrait-reflet'].steps;
  prefix(withdrawal,nominal,3);
  assert.deepEqual(withdrawal[3].pre.reflection.solved.pre,solved.pre);
  assert.equal(withdrawal[3].pre.reflection.solved.solution,null);
  ticket(withdrawal[3],'containment',containment,'ACTION4');
  ticket(withdrawal[4],'reflected_cover',cover,'ACTION3');

  const bad=g['retour-reflet'];
  prefix(bad.steps,nominal,3);
  assert.deepEqual(bad.steps[3].pre,initial.pre);
  assert.equal(bad.steps[3].after.packet,initial.after.packet);
  assert.notEqual(bad.steps[3].after.presented,bad.steps[3].after.actual);
  assert.deepEqual([bad.steps[3].after.matched,bad.steps[3].after.seal,bad.steps[3].after.reason],
    [false,true,'reflection_or_control_contradiction']);
  assert.deepEqual([bad.next.kind,bad.next.action,bad.next.index],[cover,'ACTION3',0]);

  const restart=g['reprise-reflet'].steps,final=restart[15],prior=restart[14];
  assert.deepEqual(restart.map(s=>s.after.packet),nominal.map(s=>s.after.packet));
  assert.deepEqual(restart.map(point),nominal.map(point));
  assert.equal(restart[3].pre.reflection.pre.fact.allowed,12);
  assert.equal(prior.pre.index,11);
  ticket(final,'reflected_cover',cover,'ACTION2');
  assert.deepEqual(final.pre.reflection.solved.solution,[[2,10,[[0,2]]],10,[[0,2]]]);
  assert.deepEqual(final.pre.reflection.solved.pre.fact.covered,[{direct:[],reflected:[[17,15]]}]);
  assert.deepEqual(final.pre.reflectionPlan.coveredAfter,[{direct:[],reflected:[[17,15],[17,16]]}]);
  assert.equal(final.after.matched,true);
  prefix(restart,c['reprise-reflet'].steps,16);
  return {entree:initial,preuveRetiree:loss.slice(2,4),offreRetiree:withdrawal.slice(3,5),
    retourContraire:bad.steps[3],apresContradiction:bad.next,reprise:[prior,final]};
}
const worker=fileURLToPath(new URL('operateur.mjs',import.meta.url));
const tmp=await mkdtemp(join(tmpdir(),'ar25-8-77-')),out=join(tmp,'rejeu.json');
try{
  const matrix={historique:['nominal'],gel:['nominal','preuve-reflet','retrait-reflet','retour-reflet','reprise-reflet'],
    candidat:['nominal','autre-calibrage','retour-contenant','reprise-reflet']};
  const runs={};
  for(const [v,arms]of Object.entries(matrix)){
    runs[v]={};
    await withEngine(v,async engine=>{
      for(const arm of arms){
        execFileSync(process.execPath,[worker,'--source',engine,'--pyodide',vendor,'--variante',arm,'--gestes',String(variants[arm]),'--recu',out],
          {stdio:['ignore','ignore','inherit']});
        const run=JSON.parse(await readFile(out,'utf8'));
        assert.equal(run.steps.length,{'retour-contenant':1,'retour-reflet':4}[arm]??variants[arm],arm);
        for(const s of run.steps){
          for(const capture of [s.pre.containment,s.pre.reflection?.pre,s.pre.reflection?.solved?.pre].filter(Boolean))
            assert.equal(digest(capture.fact),capture.seal);
        }
        runs[v][arm]=run;
      }
    });
  }
  const {historique:h,gel:g,candidat:c}=runs;
  prefix(h.nominal.steps,g.nominal.steps,16);
  prefix(g.nominal.steps,c.nominal.steps,16);
  const receipt={versions:{...versions,candidat:git('rev-parse','HEAD'),attendus:git('rev-parse','b70a2957')},
    ligne8:verify8(g,c),ligne77:verify77(g,c),parite:digest(g.nominal.steps),services:10};
  if(values.recu)await writeFile(values.recu,JSON.stringify(receipt,null,2)+'\n');
  console.log('AR25 · 10 préfixes natifs. 8 : attribution de la translation et substitution du calibrage. 77 : double axe, retrait, contradiction et reprise sur couverture partielle.');
}finally{await rm(tmp,{recursive:true,force:true});}
