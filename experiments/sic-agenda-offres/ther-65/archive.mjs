import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';

export async function verifyArchive(engine){
  const {measureRootedQuota}=await import(new URL('src/logos-engine/v6-rooted-quota-observation.ts',engine));
  const {measureRootedQuotaWithMarkSupport}=await import(new URL('src/logos-engine/v6-rooted-quota-mark-support.ts',engine));
  const {propagateRootedQuota}=await import(new URL('src/logos-engine/v6-rooted-quota-mechanics.ts',engine));
  const {RootedQuotaMemory}=await import(new URL('src/logos-engine/v6-rooted-quota-access.ts',engine));
  const read=path=>readFile(new URL('../../../'+path,import.meta.url));
  const witness='docs/migration/native-campaigns-v42/ther-four-level';
  const trace=JSON.parse(gunzipSync(await read(witness+'-public-trace.json.gz')));
  const report=JSON.parse(await read(witness+'s.json'));
  const {policy}=JSON.parse(gunzipSync(await read('tests/fixtures/v6-rooted-quota-reference.json.gz')));
  const packet=trace.packets[15].packet,rows=packet.frame_rows;
  const acquired=report.prefixes.find(item=>item.callerAcquiredTransitions===15).sharedSeries.rootedQuotaLatestState;
  assert.ok(acquired.model.addition_observed&&acquired.model.cut_observed);
  const obs={level_epoch:packet.level,levels_completed:packet.levels_completed,observation_ref:acquired.evidence.at(-1),
    frame_hash:packet.frame_hash,state:packet.state,available_action_refs:packet.available_action_refs};
  const memory=new RootedQuotaMemory();
  memory.applyEvent(acquired);
  const direct=measureRootedQuota(rows,acquired.model.empty_palette);
  const before=measureRootedQuotaWithMarkSupport(rows,acquired.model.empty_palette);
  assert.deepEqual([direct.row_marks,direct.column_marks],[[3,3,3,3,1],[2,3,3,3,2]]);
  assert.deepEqual([before.status,before.reason,before.scene.row_marks,before.scene.column_marks],
    ['measured','complete_visible_support_extends_source_counts',[3,3,4,3,1],[2,3,4,3,2]]);
  const altered=structuredClone(rows),axis=before.receipt.axes[0],group=axis.groups[4];
  const gap=-axis.repetition_pitch,unit=group.units[0];
  for(const [x,y] of unit.pixels){
    assert.equal(altered[y][x+gap],group.outward_empty_slot.pixels[0][2]);
    altered[y][x+gap]=unit.palette_value;
  }
  const after=measureRootedQuotaWithMarkSupport(altered,acquired.model.empty_palette);
  assert.deepEqual([after.status,after.scene.row_marks,after.scene.column_marks],['measured',[3,3,4,3,2],[2,3,4,3,2]]);
  assert.deepEqual(after.scene.chains,before.scene.chains);
  const apply=s=>propagateRootedQuota(s,obs,acquired.model,300000,()=>0);
  const first=apply(before.scene),changed=apply(after.scene);
  assert.equal(first.status,'COMPLETE');
  assert.equal(first.values.all_domains_singleton,true);
  assert.equal(changed.cause,'EMPTY_DOMAIN_CONTRADICTION');
  const propose=r=>memory.proposeRooted(obs,r,[],16,policy,300000,()=>0,undefined,{extendedMarkSupport:true});
  const base=propose(rows),control=propose(altered);
  assert.equal(base.rooted_quota_plan.phase,'realize_conditional_joint_prefixes');
  assert.equal(control.reason,'conditional_prefix_marginals_not_singleton');
  return {witness:'V42 public THER, 15 retours acquis',ref:obs.observation_ref,evidence:acquired.model.evidence,
    source:[direct.row_marks,direct.column_marks],
    nominal:{marks:[before.scene.row_marks,before.scene.column_marks],ref:before.receipt.support_ref,
      lengths:base.rooted_quota_plan.lengths_before,domains:first.values.retained_domains,actions:base.actions},
    control:{marks:[after.scene.row_marks,after.scene.column_marks],ref:after.receipt.support_ref,
      edited:unit.pixels.map(([x,y])=>[x+gap,y]),cause:changed.cause,refusal:control.reason}};
}
