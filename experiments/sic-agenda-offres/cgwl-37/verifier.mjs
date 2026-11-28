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
const tmp=await mkdtemp(join(tmpdir(),'cgwl-37-')),out=join(tmp,'prefixe.json');
const frame='empty_frame:3060f8c6379a23c26b77f236';
const variants={nominal:[],'sans-corps':[],'sans-correspondance':['--cible',frame],'sans-deplacement':[],'sans-attache':[],stationnaire:[]};
const guard={admitted:true,reason:'body_current_scope_and_exact_prefix_bound'};
const cmd=a=>[a,{}];
const input=(a,b)=>assert.deepEqual([a.ref,a.epoch,a.input,a.actions,a.remaining],[b.ref,b.epoch,b.input,b.actions,b.remaining]);
function ticket(s,type,action){
  const p=s.pre;
  assert.deepEqual([p.family,p.kind,p.slot,p.bundle,p.command,p.guard,p.plan.root,p.plan.offer.kind],
    ['public_observed_binding','public_observed_binding','observed_object_binding','OP18',cmd(action),guard,
      'G_official_completion',type]);
  assert.deepEqual(p.scope,{live:guard,old:p.index===0?{admitted:false,reason:'binding_changed'}:guard});
}
async function replay(engine,mode){
  execFileSync(process.execPath,[worker,'--source',engine,'--pyodide',vendor,'--variante',mode,...variants[mode],'--recu',out],
    {stdio:['ignore','ignore','inherit']});
  const r=JSON.parse(await readFile(out,'utf8'));
  for(const cut of [...r.steps.map(s=>s.pre.cut),r.next?.cut].filter(Boolean))assert.equal(digest(cut.pre),cut.seal);
  return r;
}

try{
  const h=await withEngine('historique',engine=>replay(engine,'nominal'));
  const g=await withEngine('gel',async engine=>{
    const runs={};
    for(const mode of Object.keys(variants))runs[mode]=await replay(engine,mode);
    return runs;
  });
  assert.deepEqual(h,g.nominal);
  const n=g.nominal.steps,[a,b,c]=n,cut=b.pre.cut.pre,m=cut.measured;
  assert.equal(n.length,16);
  assert.equal(g.nominal.stop,'session_action_budget');
  assert.equal(n.filter(s=>s.pre.slot==='observed_object_binding').length,15);
  assert.deepEqual([a.pre.family,a.pre.command],['observed_frontier',cmd('ACTION1')]);
  const body=a.after.record,control=b.after.record;
  const refs=s=>[s.pre.ref,s.after.ref];
  const method=(delta,evidence)=>({delta,evidence,status:'observed_local_displacement'});
  assert.equal(body.owned,false);
  assert.equal(body.prior.core,null);
  assert.deepEqual([body.state.core.palette_value,body.state.core.area,body.state.core.evidence],[15,32,refs(a)]);
  assert.deepEqual(m.tracker.core,body.state.core);
  assert.deepEqual(m.tracker.moves,{ACTION1:method([0,-4],refs(a))});
  assert.deepEqual([m.tracker.held,m.tracker.interaction],[null,null]);
  const target=b.pre.plan.offer.target;
  assert.deepEqual([target.center,target.palette_value,target.frame.ref,target.frame.center,target.frame.palette_value],
    [[12,44],14,frame,[52,44],14]);
  assert.deepEqual(target.evidence,[b.pre.ref]);
  assert.deepEqual(m.offers.map(o=>o.actions[0].action_ref),['ACTION2','ACTION3','ACTION4','ACTION5','ACTION7']);
  assert.ok(m.offers.every(o=>o.actions.length===1&&o.target.ref===target.ref&&o.distance===36&&o.delta===null&&o.control===null));
  ticket(b,'probe_control_for_correspondence','ACTION2');
  assert.deepEqual([b.pre.plan.offer.poses,b.pre.plan.expected,b.after.matched,b.after.seal],[[[20,16]],null,null,true]);
  assert.deepEqual([control.state.held,control.state.interaction,control.result],[null,null,null]);
  assert.deepEqual(control.state.moves.ACTION2,method([0,4],refs(b)));
  ticket(c,'approach_correspondence','ACTION2');
  assert.deepEqual(c.pre.cut.pre.measured.tracker.moves.ACTION2,control.state.moves.ACTION2);
  assert.deepEqual(c.pre.plan.expected.body_center,[20,24]);
  assert.equal(c.pre.plan.offer.actions.length,6);
  assert.deepEqual(n.slice(2,8).map(s=>[s.pre.plan.offer.kind,s.pre.index,s.after.matched]),
    Array.from({length:6},(_,i)=>['approach_correspondence',i,true]));

  const objectRemoved=g['sans-correspondance'].steps[1],oc=objectRemoved.pre.cut.pre;
  input(cut,oc);
  assert.deepEqual(oc.measured.tracker,m.tracker);
  assert.deepEqual(oc.measured.before,m.before);
  assert.deepEqual(oc.measured.removed,m.offers);
  assert.deepEqual(oc.measured.offers,[]);
  assert.deepEqual([objectRemoved.pre.family,objectRemoved.pre.command],['observed_frontier',cmd('ACTION1')]);
  const withoutBody=g['sans-corps'].steps[1],wc=withoutBody.pre.cut.pre;
  input(cut,wc);
  assert.deepEqual(wc.incoming,cut.incoming);
  assert.equal(wc.measured,null);
  assert.deepEqual([withoutBody.pre.family,withoutBody.pre.command],[objectRemoved.pre.family,objectRemoved.pre.command]);

  const motionRemoved=g['sans-deplacement'].steps[2],mc=motionRemoved.pre.cut.pre,base=c.pre.cut.pre;
  assert.deepEqual(g['sans-deplacement'].steps.slice(0,2),n.slice(0,2));
  input(base,mc);
  assert.deepEqual(mc.measured.tracker,{...base.measured.tracker,moves:{ACTION1:m.tracker.moves.ACTION1}});
  assert.ok(mc.measured.offers.every(o=>o.target.ref===target.ref&&o.kind==='probe_control_for_correspondence'));
  ticket(motionRemoved,'probe_control_for_correspondence','ACTION3');

  const still=g.stationnaire.steps[1];
  assert.deepEqual(still.pre,b.pre);
  assert.equal(still.after.packet,b.after.packet);
  assert.notEqual(still.after.physical,still.after.presented);
  assert.equal(still.after.record.result.status,'interaction_no_observed_identity_effect');
  assert.equal(still.after.record.state.moves.ACTION2,undefined);
  assert.equal(still.after.record.state.held,null);
  assert.deepEqual(g.stationnaire.next.command,cmd('ACTION3'));

  const touch=n[11],reception=n[12],contrary=n[13];
  ticket(touch,'probe_unknown_contact_control','ACTION5');
  const rr=touch.after.record,attached=rr.state.held,identity=rr.result.identity_binding;
  assert.deepEqual([rr.prior.held,rr.prior.interaction],[null,null]);
  assert.equal(rr.result.status,'local_attachment_hypothesis');
  assert.deepEqual(rr.state.interaction,{action:'ACTION5',evidence:refs(touch)});
  assert.equal(identity.status,'visible_shape_compatible_under_bounded_translation');
  assert.equal(identity.scope,'visible_part_only_occluded_part_unknown');
  assert.deepEqual(identity.alternatives.map(o=>o.translation),[[-1,-6]]);
  assert.deepEqual([attached.original_bbox,attached.bbox],[[9,41,14,47],[8,35,14,41]]);
  ticket(reception,'approach_reception','ACTION4');
  assert.equal(reception.pre.plan.offer.target.ref,attached.ref);
  assert.equal(reception.pre.plan.offer.target.frame.ref,frame);
  assert.ok(reception.pre.refs.includes(touch.after.ref));
  const unattached=g['sans-attache'].steps[12],uc=unattached.pre.cut.pre,rc=reception.pre.cut.pre;
  assert.deepEqual(g['sans-attache'].steps.slice(0,12),n.slice(0,12));
  input(rc,uc);
  assert.deepEqual(uc.measured.tracker,{...rc.measured.tracker,held:null});
  assert.ok(uc.measured.offers.every(o=>o.target.mode==='binding'));
  ticket(unattached,'probe_observed_binding','ACTION5');
  assert.equal(unattached.pre.plan.offer.target.ref,target.ref);
  assert.deepEqual([contrary.after.matched,contrary.after.seal],[false,true]);
  assert.equal(contrary.after.record.state.held.status,'joint_transport_observed');
  ticket(n[14],'approach_reception','ACTION4');
  assert.notEqual(n[14].pre.plan.offer.poses[0][0],contrary.pre.plan.expected.body_center[0]);

  await writeFile(values.recu,JSON.stringify({versions:{...versions,qualification:git('rev-parse','HEAD'),
    attendus:git('log','-1','--format=%H','--',fileURLToPath(new URL('ATTENDUS.md',import.meta.url)))},prefixes:7,native:g},null,2)+'\n');
  console.log('CGWL 37 · sept préfixes. Contrôle du corps, correspondance, attache et reprise séparés.');
}finally{await rm(tmp,{recursive:true,force:true});}
