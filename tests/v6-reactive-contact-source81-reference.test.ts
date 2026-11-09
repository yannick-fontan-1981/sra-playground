import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { Source81Policy } from '../src/logos-engine/v6-reactive-contact-source81-policy.ts';
import { ReactiveContact } from '../src/logos-engine/v6-reactive-contact.ts';
import { source81_project,materialize_selected,current_independent_inventory } from '../src/logos-engine/v6-reactive-contact-source81-projection.ts';
import { joined_rows,offer,before,after,record } from '../src/logos-engine/v6-reactive-contact-source81-execution.ts';
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/v6-reactive-contact-source81-reference.json.gz',import.meta.url))).toString());
const policy=Source81Policy.create(),family=ReactiveContact.create({});
test('Source81 independent oracle retains the pinned original source bytes',()=>{
  assert.equal(fixture.sourceUnchanged,true);
  for(const[path,sha]of Object.entries(fixture.sourceHashes))assert.equal(createHash('sha256').update(readFileSync(new URL('../reference/v6/'+fixture.referenceCommit+'/source/'+path,import.meta.url))).digest('hex'),sha);
});
for(const row of fixture.cases)test('Source81 original '+row.id,async()=>{
  const args=structuredClone(row.arguments),p=await policy;
  const run=async()=>{
    if(row.operation==='prepare')return p.prepare(args.rows,args.question_facts);
    if(['project','continue_target','revise_target'].includes(row.operation))return(p as any)[row.operation](args);
    if(row.operation==='projection'){const{scene,recipe,observation,rows,observed_support_values,directions,...options}=args;return source81_project(scene,recipe,observation,rows,observed_support_values,directions,options);}
    if(row.operation==='materialize')return materialize_selected(args.projection,args.candidate_ref,args.selected_row);
    if(row.operation==='independent')return current_independent_inventory(args.projection,args.actor,args.peer,args.part,args.origin_bbox,args.proposal_ref);
    const f=await family;f.restore(args.state);
    if(row.operation==='joined')return joined_rows(f,args.projection,args.observation,args.rows,args.remaining);
    if(row.operation==='offer')return offer(f,args.observation,args.rows,args.remaining,args.scene);
    if(row.operation==='before')return before(f,args.proposal,args.index,args.rows,args.observation);
    if(row.operation==='after')return after(f,args.proposal,args.index,args.first,args.second);
    if(row.operation==='record'){const result=record(f,args.offer,args.index,args.before,args.after,args.command,args.first,args.second);return{result,state:f.state()};}
    throw new Error('Unmapped Source81 operation '+row.operation);
  };
  if(row.error){await assert.rejects(run);return;}
  assert.deepEqual(await run(),row.value);
});
