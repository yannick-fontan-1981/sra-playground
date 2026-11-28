import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';
import {digest} from './operateur.mjs';
import {publicContrast} from './contraste.mjs';
import {git,versions,withEngine} from '../moteur-reference.mjs';

const {values}=parseArgs({options:{pyodide:{type:'string'},recu:{type:'string'}}});
const vendor=resolve(values.pyodide),worker=fileURLToPath(new URL('operateur.mjs',import.meta.url));
const tmp=await mkdtemp(join(tmpdir(),'pola-33-')),out=join(tmp,'prefixe.json');
const variants={nominal:[],'sans-attestation':[],'axe-perpendiculaire':['--pair','41,25'],stationnaire:[],'sans-methode':[]};
const safeGuard={admitted:true,reason:'selected_marker_body_peer_target_and_command_current'};
const getActor=m=>m.bodies.find(b=>b.center.toString()===m.selected.toString());
const facts=(a,b)=>assert.deepEqual([a.observation,a.input,a.actions],[b.observation,b.input,b.actions]);
function ticket(s,action){
  assert.deepEqual([s.pre.family,s.pre.slot,s.pre.kind,s.pre.bundle,s.pre.command,s.pre.guard,s.pre.plan.root],
    ['public_axial_question','axial_question','public_axial_question','OP18',[action,{}],safeGuard,'G_official_completion']);
  assert.deepEqual(s.pre.scope,{live:safeGuard,old:{admitted:false,reason:'scope_changed'}});
  assert.equal(s.pre.plan.policy.choice.release_authority,false);
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
  const fixture=await withEngine('gel',publicContrast);
  assert.deepEqual(h,g.nominal);
  const n=g.nominal.steps,[,,,a]=n,cut=a.pre.cut.pre;
  assert.equal(n.length,16);
  assert.equal(g.nominal.stop,'session_action_budget');
  assert.deepEqual(n.filter(s=>s.pre.slot==='axial_question').map(s=>s.i),[4,8,9,13,14,15]);
  assert.deepEqual(n.slice(0,3).map(s=>s.pre.family),Array(3).fill('observed_frontier'));
  assert.deepEqual(n[2].after.record.result.events,['selection_marker_changed_under_input']);
  assert.equal(n[2].after.record.owned,false);
  assert.deepEqual(cut.selection.source_action,{action_ref:'ACTION5'});
  assert.deepEqual(cut.selection.evidence,[n[2].pre.ref,n[2].after.ref]);
  assert.equal(cut.observation,n[2].after.ref);
  assert.deepEqual(cut.rotations,[]);
  assert.deepEqual(cut.portable,[]);
  ticket(a,'ACTION4');
  assert.deepEqual(cut.usedGeometry.target.center,[26,25]);
  assert.deepEqual([getActor(cut.usedGeometry).center,getActor(cut.usedGeometry).axis],[[21,25],[-1,0]]);
  assert.deepEqual(cut.offers.map(o=>[o.action,o.kind,o.distance,o.turn,o.peer,o.peerAxis,o.desired,o.projection.axis,o.method]),
    [['ACTION3','between',3,-1,[41,25],[0,1],[0,1],[0,-1],null],
      ['ACTION4','between',1,1,[41,25],[0,1],[0,1],[0,1],null]]);
  assert.deepEqual(a.pre.plan.offer,cut.offers[1]);
  assert.deepEqual([a.after.matched,a.after.seal,a.after.frames,a.after.levels],[null,true,5,1]);
  const rr=a.after.record;
  assert.deepEqual(rr.result.native_packet_attribution,{extension:'current_epoch_axial_packet_attribution',status:'old_scene_frames_only',
    accepted_frame_ordinals:[0],new_scene_is_old_effect_evidence:false});
  assert.deepEqual(rr.result.events,['quarter_rotation_observed',{joint_positions_before:[[21,25],[41,25]],
    joint_positions_after:[[21,25],[41,25]],sealed_score_delta:1}]);
  assert.deepEqual(getActor(rr.compared).axis,[0,1]);
  const [method]=rr.portable[0].methods;
  assert.deepEqual([method.action,method.turn,method.source_epoch,method.frame_ordinal],['ACTION4',1,1,0]);
  assert.deepEqual(method.evidence.slice(0,2),[a.pre.ref,a.after.ref]);

  const s=g['sans-attestation'].steps[3],sc=s.pre.cut.pre;
  facts(cut,sc);
  assert.deepEqual(sc.usedGeometry,cut.usedGeometry);
  assert.equal(sc.selection,null);
  assert.deepEqual(sc.offers,[]);
  assert.deepEqual([s.pre.family,s.pre.command],['observed_frontier',['ACTION6',{x:11,y:10}]]);

  const p=g['axe-perpendiculaire'].steps[3],pc=p.pre.cut.pre;
  facts(cut,pc);
  assert.notEqual(pc.usedRows,cut.usedRows);
  assert.deepEqual(pc.selection,cut.selection);
  assert.deepEqual(getActor(pc.usedGeometry),getActor(cut.usedGeometry));
  assert.deepEqual(pc.usedGeometry.target,cut.usedGeometry.target);
  assert.deepEqual(pc.usedGeometry.bodies.map(b=>[b.center,b.bbox]),cut.usedGeometry.bodies.map(b=>[b.center,b.bbox]));
  assert.deepEqual(pc.usedGeometry.bodies.find(b=>b.center[0]===41).axis.map(Math.abs),[1,0]);
  assert.deepEqual(pc.offers,[]);
  assert.deepEqual([p.pre.family,p.pre.command],[s.pre.family,s.pre.command]);

  const still=g.stationnaire.steps[3];
  assert.deepEqual(still.pre,a.pre);
  assert.equal(still.after.packet,a.after.packet);
  assert.notEqual(still.after.physical,still.after.presented);
  assert.deepEqual([still.after.levels,still.after.matched,still.after.seal],[0,null,true]);
  assert.equal(still.after.record.result.events.includes('quarter_rotation_observed'),false);
  assert.deepEqual(still.after.record.rotations,[]);
  assert.ok(still.after.record.attempts.includes(a.pre.plan.offer.key));
  assert.deepEqual(g.stationnaire.next?.command,['ACTION3',{}]);
  assert.notEqual(g.stationnaire.next?.plan?.offer.key,a.pre.plan.offer.key);

  const l2=n[7],without=g['sans-methode'].steps[7];
  assert.deepEqual(g['sans-methode'].steps.slice(0,7),n.slice(0,7));
  ticket(l2,'ACTION4');
  ticket(without,'ACTION3');
  const recalled=l2.pre.cut.pre,noRecall=without.pre.cut.pre;
  facts(recalled,noRecall);
  assert.deepEqual(recalled.usedGeometry,noRecall.usedGeometry);
  assert.deepEqual(recalled.selection,noRecall.selection);
  assert.deepEqual([recalled.offers.map(o=>o.distance),noRecall.offers.map(o=>o.distance)],[[2,2],[2,2]]);
  assert.deepEqual(l2.pre.plan.offer.method.method,method);
  assert.equal(l2.pre.plan.offer.method.release_authority,false);
  assert.equal(without.pre.plan.offer.method,null);
  assert.equal(l2.after.record.result.events.includes('quarter_rotation_observed'),true);
  ticket(n[8],'ACTION4');
  ticket(g['sans-methode'].steps[8],'ACTION3');
  assert.deepEqual([n[8].after.levels,g['sans-methode'].steps[8].after.levels],[2,2]);

  await writeFile(values.recu,JSON.stringify({versions:{...versions,qualification:git('rev-parse','HEAD'),
    attendus:git('log','-1','--format=%H','--',fileURLToPath(new URL('ATTENDUS.md',import.meta.url)))},prefixes:6,
    native:g,contraste:fixture},null,2)+'\n');
  console.log('POLA 33 · six préfixes natifs et contraste public. Origine de la preuve, effet et retrait dans deux niveaux vérifiés.');
}finally{await rm(tmp,{recursive:true,force:true});}
