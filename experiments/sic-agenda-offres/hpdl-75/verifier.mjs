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
const tmp=await mkdtemp(join(tmpdir(),'hpdl-75-')),out=join(tmp,'prefixe.json');
const modes=['nominal','sans-methode','preuve-etrangere','stationnaire'];
function edit(s,field,before,after){
  const e=s.after.record.registered.events[0];
  assert.deepEqual([e.field,e.before,e.after,e.authority],[field,before,after,'observed_field_change_not_capture_law']);
  assert.deepEqual(e.evidence,[s.pre.ref,s.after.ref]);
}
function ticket(s,kind,command){
  assert.deepEqual(s.pre.command,command);
  assert.deepEqual([s.pre.family,s.pre.type,s.pre.entry,s.pre.plan.offer.kind,s.pre.bundle],
    ['public_window_question','public_window_question','window_question',kind,'OP18']);
  assert.deepEqual(s.pre.guard,{admitted:true,reason:'exact_current_geometry_method_and_payload'});
  assert.equal(s.pre.plan.choice.release_authority,false);
  assert.equal(s.pre.plan.choice.status,'selected');
  assert.deepEqual([s.after.matched,s.after.seal],[null,true]);
}
async function replay(version,arms){
  const runs={};
  await withEngine(version,async engine=>{
    for(const arm of arms){
      execFileSync(process.execPath,[worker,'--source',engine,'--pyodide',vendor,'--variante',arm,'--recu',out],
        {stdio:['ignore','ignore','inherit']});
      const j=JSON.parse(await readFile(out,'utf8'));
      for(const cut of [...j.steps.map(s=>s.pre.cut),j.next?.cut].filter(Boolean))assert.equal(cut.seal,digest(cut.pre));
      runs[arm]=j;
    }
  });
  return runs;
}
try{
  const h=await replay('historique',['nominal']),g=await replay('gel',modes);
  assert.deepEqual(h.nominal,g.nominal);
  const nominal=g.nominal.steps, [prior,a,b,c,launch,rebound]=nominal.slice(2);
  assert.equal(nominal.length,16);
  assert.equal(g.nominal.stop,'session_action_budget');
  assert.equal(nominal.filter(s=>s.pre.entry==='window_question').length,10);
  assert.equal(prior.pre.family,'observed_frontier');
  assert.deepEqual(prior.pre.command,['ACTION3',{}]);
  edit(prior,'capacity',1,4);
  const cut=a.pre.cut,method=prior.after.record.edits[0],point=['ACTION6',{x:14,y:30}];
  ticket(a,'setting_question',point);
  assert.deepEqual(a.pre.point,[14,30]);
  assert.deepEqual(cut.pre.geometry.signature,{box_shape:[17,8],unit:2,word_shape:[3,3]});
  assert.deepEqual(cut.pre.geometry.boxes.map(x=>[x.capacity,x.filter]),[[4,null],[2,8]]);
  assert.deepEqual(cut.pre.geometry.word.map(x=>x.value),[8,8,9,9]);
  assert.deepEqual(cut.pre.edits,[method]);
  assert.deepEqual(cut.bound,{truncated:false,domain:8});
  assert.deepEqual(cut.offers,[a.pre.plan.offer]);
  assert.equal(a.pre.plan.choice.index,0);
  assert.deepEqual(a.pre.plan.offer.methods,[method]);
  assert.deepEqual(a.pre.refs,[a.pre.ref,...method.evidence]);
  assert.deepEqual(a.pre.plan.offer.edit,{box:0,field:'capacity',point:[14,30],desired:2});
  assert.deepEqual(a.pre.plan.offer.settings,[[2,null,null],[2,9,null]]);
  assert.equal(a.pre.plan.offer.cost,4);
  edit(a,'capacity',4,1);
  ticket(b,'setting_question',point);
  assert.notEqual(a.pre.plan.offer.key,b.pre.plan.offer.key);
  assert.ok(b.pre.cut.pre.attempts.includes(a.pre.plan.offer.key));
  edit(b,'capacity',1,2);
  edit(c,'filter',8,9);
  ticket(launch,'traversal_question',['ACTION5',{}]);
  assert.equal(launch.after.levels,1);
  assert.equal(launch.after.record.registered.events[0].frames,78);
  assert.equal(launch.after.record.registered.events[0].authority,'observed_packet_not_complete_mechanical_model');
  assert.equal(rebound.pre.level,2);
  assert.equal(rebound.pre.cut.pre.portable[0].epoch,1);
  assert.equal(rebound.pre.cut.pre.portable[0].methods.length,4);

  for(const v of modes.slice(1))assert.deepEqual(g[v].steps.slice(0,3),nominal.slice(0,3));
  const loss=g['sans-methode'].steps,off=loss[3].pre.cut;
  assert.deepEqual(off.removed,[method]);
  assert.deepEqual(off.pre.geometry,cut.pre.geometry);
  assert.deepEqual(off.pre.edits,[]);
  assert.deepEqual(off.offers,[]);
  assert.equal(off.bound,null);
  assert.deepEqual([loss[3].pre.family,loss[3].pre.command],['observed_frontier',['ACTION4',{}]]);
  ticket(loss[4],'setting_question',point);

  const neutral=g['preuve-etrangere'].steps,extra=neutral[3].pre.cut;
  assert.notDeepEqual(extra.foreign.signature,method.signature);
  assert.deepEqual(extra.offers,cut.offers);
  assert.deepEqual({...neutral[3],pre:{...neutral[3].pre,cut}},a);
  assert.deepEqual(neutral[4],b);

  const held=g.stationnaire,s=held.steps[3];
  assert.equal(held.steps.length,4);
  assert.deepEqual(s.pre,a.pre);
  assert.equal(s.after.packet,a.after.packet);
  assert.notEqual(s.after.presented,s.after.physical);
  assert.equal(s.after.record.registered.status,'no_supported_window_change');
  assert.deepEqual(s.after.record.edits,[method]);
  assert.deepEqual(s.after.record.attempts,[a.pre.plan.offer.key]);
  assert.deepEqual([held.next.family,held.next.command,held.next.cut.offers],['observed_frontier',['ACTION4',{}],[]]);
  assert.equal(git('rev-parse','HEAD:src'),git('rev-parse','d0e7527c:src'));

  const receipt={versions:{...versions,qualification:git('rev-parse','HEAD'),attendus:git('rev-parse','88dcf789')},
    prefixes:5,source:prior,temoin:a,reprise:[b,c,launch,rebound],retrait:loss.slice(3),
    stationnaire:{last:s,next:held.next},etranger:extra.foreign,parite:digest(nominal)};
  if(values.recu)await writeFile(values.recu,JSON.stringify(receipt,null,2)+'\n');
  console.log('HPDL 75 · cinq préfixes. Méthode de fenêtre, offre DRM, changements de champs et reprise vérifiés.');
}finally{await rm(tmp,{recursive:true,force:true});}
