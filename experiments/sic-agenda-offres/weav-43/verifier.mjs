import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';
import {digest} from './operateur.mjs';
import {git,versions,withEngine} from '../moteur-reference.mjs';

const {values}=parseArgs({options:{pyodide:{type:'string'},recu:{type:'string'}}});
const vendor=resolve(values.pyodide),worker=fileURLToPath(new URL('operateur.mjs',import.meta.url));
const tmp=await mkdtemp(join(tmpdir(),'weav-43-')),out=join(tmp,'prefixe.json');
const variants={nominal:['nominal'],'selection-stationnaire':['stationnaire',1],'avance-stationnaire':['stationnaire',2],
  'sans-progression':['sans-progression',3],'sans-paire':['sans-paire',7]};
const live={admitted:true,reason:'crossed_prefix_bound'},rejected={admitted:false,reason:'crossed_prefix_context_changed'};
const comparison=(matched,reason)=>({matched,seal_prefix:true,reason});
const point=(x,y)=>['ACTION6',{x,y}];
const move=name=>[name,{}];
const row='0:0:-1',col='1:0:-1';
function ticket(p,mode,command){
  assert.deepEqual([p.family,p.slot,p.kind,p.bundle,p.plan.mode,p.command,p.guard],
    ['public_occurrence_recall','coupled_prefix_reference','coupled_prefix_reference','OP18',mode,command,live]);
  assert.deepEqual(p.scope,{live,stale:rejected,contrary:rejected,contraryAtMatchingDigest:rejected,
    contraryReturn:comparison(false,'reference_changed_unexpectedly'),precedent:true,referenceAltered:true});
  if(command[0]==='ACTION6')assert.deepEqual(p.point.point,[command[1].x,command[1].y]);
}
function record(step,matched,reason){
  assert.deepEqual([step.after.matched,step.after.seal,step.after.reason],[matched,true,reason]);
  assert.equal(step.after.record.ref,step.after.ref);
}
async function replay(engine,name){
  const [mode,i]=variants[name];
  execFileSync(process.execPath,[worker,'--source',engine,'--pyodide',vendor,'--variante',mode,...(i?['--tour',String(i)]:[]),'--recu',out],
    {stdio:['ignore','ignore','inherit']});
  const r=JSON.parse(await readFile(out,'utf8'));
  for(const cut of [...r.steps.map(s=>s.pre.cut),r.next?.cut].filter(Boolean))assert.equal(digest(cut.pre),cut.seal);
  return r;
}
const sameInput=(a,b)=>assert.deepEqual([a.ref,a.epoch,a.canonical,a.actions,a.layout,a.controls],
  [b.ref,b.epoch,b.canonical,b.actions,b.layout,b.controls]);

try{
  const h=await withEngine('historique',e=>replay(e,'nominal'));
  const g=await withEngine('gel',async engine=>{
    const runs={};
    for(const name of Object.keys(variants))runs[name]=await replay(engine,name);
    return runs;
  });
  assert.deepEqual(h,g.nominal);
  const n=g.nominal.steps,[a,b,c,d,e,f,r]=n;
  assert.equal(n.length,16);
  assert.equal(g.nominal.stop,'session_action_budget');
  assert.ok(n.every(s=>s.pre.slot==='coupled_prefix_reference'&&s.after.seal&&s.after.levels===0));

  const pre=a.pre.cut.pre,layout=pre.layout;
  assert.deepEqual([layout.shape,layout.reference.origin,layout.reference.scale,layout.reference.values],
    [[3,3],[57,53],[2,2],[[14,14,14],[10,10,10],[14,14,14]]]);
  assert.equal(layout.controllers.length,6);
  assert.equal(pre.incoming,null);
  assert.deepEqual(pre.axisInputs,{'0':[],'1':[]});
  assert.deepEqual(pre.pairs,[]);
  ticket(a.pre,'select',point(15,20));
  assert.deepEqual([a.pre.plan.controller.key,a.pre.plan.controller.color],[row,14]);
  record(a,null,'selection_is_hypothesis_until_advance');
  assert.equal(a.after.physical,pre.canonical);
  assert.equal(a.after.record.state.selected,row);
  assert.ok(Object.values(a.after.record.state.progress).every(x=>x===0));
  assert.deepEqual(a.after.record.events,[]);

  ticket(b.pre,'advance',move('ACTION1'));
  assert.deepEqual(b.pre.plan.intent.cell,[0,0]);
  assert.equal(b.pre.plan.intent.predicted_pair,null);
  record(b,true,'prefix_contribution_observed');
  assert.deepEqual(b.after.record.slot,{cell:[0,0],changed:true,before:0,after:14});
  assert.deepEqual(b.after.record.events,[{kind:'crossed_prefix_input',axis:0,action:'ACTION1',evidence:b.after.ref,epoch:1}]);
  assert.equal(b.after.record.state.progress[row],1);
  assert.equal(b.after.record.state.actions[row+':0'],'ACTION1');
  assert.deepEqual(b.after.record.state.questions,[{axis:0,action:'ACTION1',cell:[0,0],desired_owners:[0],
    opposite_key:col,opposite_index:0,source:b.after.ref}]);
  ticket(c.pre,'select',point(20,15));
  assert.equal(c.pre.plan.controller.key,col);
  assert.equal(c.pre.plan.state.progress[row],1);

  ticket(d.pre,'advance',move('ACTION2'));
  record(d,false,'input_has_no_effect_in_current_crossing');
  assert.deepEqual(d.after.record.slot,{cell:[0,0],changed:false,before:0,after:0});
  const blocked={context:[col,0,'ACTION1'],action:'ACTION2',evidence:d.after.ref};
  assert.deepEqual(d.after.record.state.blocked,[blocked]);
  assert.equal(d.after.record.state.progress[col],0);
  assert.deepEqual(d.after.record.events,[]);
  ticket(e.pre,'advance',move('ACTION3'));
  assert.deepEqual(e.pre.plan.intent.trial_context,blocked.context);
  record(e,true,'prefix_contribution_observed');
  assert.equal(e.after.record.outcome.reference_property_matched,true);
  const pair=e.after.record.events[1];
  assert.deepEqual([pair.kind,pair.inputs,pair.owner,pair.visible_palette,pair.evidence],
    ['crossed_prefix_pair',{'0':'ACTION1','1':'ACTION3'},0,14,[e.pre.ref,e.after.ref]]);
  assert.equal(e.after.record.state.progress[col],1);

  ticket(f.pre,'select',point(15,20));
  ticket(r.pre,'advance',move('ACTION1'));
  assert.equal(r.pre.plan.intent.index,1);
  assert.deepEqual(r.pre.plan.intent.cell,[1,0]);
  assert.deepEqual(r.pre.plan.intent.predicted_pair,pair);
  assert.ok(pair.evidence.every(ref=>r.pre.refs.includes(ref)));
  record(r,true,'prefix_contribution_observed');

  const noTurn=g['selection-stationnaire'];
  assert.deepEqual(noTurn.steps[0].pre,a.pre);
  assert.deepEqual(noTurn.steps[0].after.record,a.after.record);
  ticket(noTurn.next,'advance',b.pre.command);
  const noCell=g['avance-stationnaire'];
  assert.deepEqual(noCell.steps[1].pre,b.pre);
  assert.equal(noCell.steps[1].after.packet,b.after.packet);
  assert.notEqual(noCell.steps[1].after.presented,b.after.physical);
  record(noCell.steps[1],false,'input_has_no_effect_in_current_crossing');
  const stalled=noCell.steps[1].after.record;
  assert.equal(stalled.state.progress[row],0);
  assert.deepEqual(stalled.events,[]);
  assert.deepEqual(stalled.state.blocked,[{context:[row,0,null],action:'ACTION1',evidence:stalled.ref}]);
  ticket(noCell.next,'advance',move('ACTION2'));
  assert.deepEqual(noCell.next.plan.intent.cell,[0,0]);

  const missing=g['sans-progression'];
  assert.deepEqual(missing.steps,n.slice(0,2));
  const mc=missing.next.cut.pre,cc=c.pre.cut.pre;
  sameInput(cc,mc);
  assert.deepEqual(mc.incoming,cc.incoming);
  assert.deepEqual(mc.axisInputs,cc.axisInputs);
  assert.deepEqual(mc.state,{...cc.state,progress:{...cc.state.progress,[row]:0},actions:{},questions:[]});
  ticket(missing.next,'advance',move('ACTION1'));
  assert.deepEqual(missing.next.plan.intent.cell,[0,0]);

  const noPair=g['sans-paire'];
  assert.deepEqual(noPair.steps,n.slice(0,6));
  const nc=noPair.next.cut.pre,rc=r.pre.cut.pre;
  sameInput(rc,nc);
  assert.deepEqual(nc,{...rc,pairs:[]});
  assert.deepEqual(nc.incomingPairs,[pair]);
  assert.deepEqual([noPair.next.family,noPair.next.kind,noPair.next.plan,noPair.next.command],
    ['information_goal','experiment',null,point(28,61)]);

  await writeFile(values.recu,JSON.stringify({versions:{...versions,qualification:git('rev-parse','HEAD'),
    attendus:git('log','-1','--format=%H','--',fileURLToPath(new URL('ATTENDUS.md',import.meta.url)))},prefixes:6,native:g},null,2)+'\n');
  console.log('WEAV 43 · six préfixes. Sélection conditionnelle, apport, croisement observé et reprise vérifiés.');
}finally{await rm(tmp,{recursive:true,force:true});}
