import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';

export async function publicContrast(engine){
  const {ChartNavigation}=await import(new URL('src/logos-engine/v6-chart-navigation.ts',engine));
  const {chartScene,chartInventory}=await import(new URL('src/logos-engine/v6-chart-navigation-geometry.ts',engine));
  const path='../../../docs/migration/lot9a-evidence/reference-01/reference.json.gz';
  const fixture=JSON.parse(gunzipSync(await readFile(new URL(path,import.meta.url))));
  const rows=name=>fixture.frames[name].rows;
  const summary=p=>p&&({action:p.actions[0].action_ref,kind:p.chart_plan.offer.kind,target:p.chart_plan.offer.target.center,
    route:p.chart_plan.offer.route,refs:p.route_refs});
  async function replay(sequence){
    const family=await ChartNavigation.create(),receipts=[];
    for(const step of fixture.sequences[sequence].steps){
      const first=rows(step.beforeFrame),second=rows(step.afterFrame);
      const p=await family.proposeSource(step.observation,first,[],8);
      assert.deepEqual(summary(p),summary(step.proposal));
      assert.deepEqual(family.before(p,0,{frame_rows:first},step.observation),step.before);
      const result=family.record(step.observation,step.afterObservation,p.actions[0],first,second,p,0,step.returnedFrames.map(rows)).events[0];
      assert.deepEqual(result,step.record);
      receipts.push({proposal:summary(p),result});
    }
    return receipts;
  }
  const primary=await replay('primary'),contrary=await replay('contraryAnchor');
  assert.equal(primary[0].result.events[1].peripheral_value_gained.value,4);
  assert.deepEqual(primary[0].result.position,[22,10]);
  assert.equal(primary[1].result.events[1].peripheral_value_lost,4);
  const grant=primary[1].result.events[2].inventory_loss_and_local_boundary_change;
  assert.equal(grant.status,'local_permission_hypothesis_not_confirmed_transaction');
  assert.deepEqual(grant.from,[34,10]);
  assert.ok(grant.evidence[0].includes(':returned-frame:0:'));
  assert.equal(contrary[0].result.events.includes('predicted_arrival_refuted_by_current_anchor'),true);
  assert.deepEqual(contrary[0].result.position,[46,10]);

  const [first,second]=fixture.sequences.primary.steps,withHeld=rows(second.beforeFrame),withoutHeld=rows('room_b_empty');
  const earned=await ChartNavigation.create();
  earned.restore(first.afterState);
  const evidence=earned.state();
  assert.equal(chartScene(withHeld,earned.chart),chartScene(withoutHeld,earned.chart));
  assert.deepEqual(chartInventory(withHeld,earned.chart),[4]);
  assert.deepEqual(chartInventory(withoutHeld,earned.chart),[]);
  const known=await earned.proposeSource(second.observation,withHeld,[],8);
  const missing=await ChartNavigation.create();
  missing.restore(evidence);
  const withoutObs={...second.observation,frame_hash:fixture.frames.room_b_empty.public.frame_hash,
    observation_ref:second.observation.observation_ref+':same-room-empty-inventory'};
  const withheld=await missing.proposeSource(withoutObs,withoutHeld,[],8);
  assert.equal(known.chart_plan.offer.kind,'homologous_marker');
  assert.equal(withheld,null);
  assert.deepEqual(missing.positions,earned.positions);
  assert.deepEqual(missing.evidence,earned.evidence);
  return {fixture:'reference-01',primary,contrary,inventory:{sameScene:true,location:earned.positions,
    held:{inventory:[4],plan:summary(known)},empty:{inventory:[],plan:summary(withheld)}}};
}
