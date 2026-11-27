import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { pathToFileURL } from 'node:url';
export const root=new URL('../../../',import.meta.url).href;
export async function inquire(colors=[],engine=root) {
  const fn=p=>import(new URL('src/logos-engine/'+p,engine));
  const {RootedLineMemory}=await fn('v6-rooted-line-access.ts');
  const {measureRootedLine,projectedRootedLine}=await fn('v6-rooted-line-observation.ts');
  const {publicFrameHash}=await fn('v6-native-observer.ts');
  const {planRootedLine}=await fn('v6-rooted-line-mechanics.ts');
  const fixture='docs/migration/lot3d-evidence/final/sk48-rooted-session/sk48-public-trace.json.gz';
  const {packets}=JSON.parse(gunzipSync(await readFile(new URL(fixture,root))));
  const dir='reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/';
  const doc=JSON.parse(await readFile(new URL(dir+'morphology_policy/strategy.drm',engine)));
  const options=doc.declarations[0].configuration.observed_composition_services;
  const names=c=>c===colors[0]?colors[1]:c===colors[1]?colors[0]:c;
  const frames=packets.slice(0,5).map(p=>p.packet.frame_rows.map(row=>row.map(names)));
  const observations=await Promise.all(frames.map(async (f,i)=>({level_epoch:1,levels_completed:0,
    observation_ref:'contact-qualification:epoch:1:revision:'+(i+1)+':frame:'+await publicFrameHash(f),
    available_action_refs:packets[i].packet.available_action_refs})));
  const memory=new RootedLineMemory();
  for(let i=0;i<4;i++) {
    const p=memory.propose(observations[i],frames[i],[],16,options);
    assert.equal(p.actions[0].action_ref,packets[i+1].command.action_ref);
    memory.record(observations[i],p.actions[0],observations[i+1],frames[i],frames[i+1],p,0);
  }
  const last=observations[4],scene=measureRootedLine(frames[4]),state=memory.currentState().line_memory;
  const proposal=memory.propose(last,frames[4],[],16,options);
  const cfg=options.rooted_line_question;
  const [configuration,search]=planRootedLine(scene,last,state.controls,cfg);
  const physical=projectedRootedLine(configuration);
  return {colors,ref:last.observation_ref,scene,physical,configuration,state,cfg,search,proposal,
    publicFrames:frames,observations};
}
if(process.argv[1] && pathToFileURL(process.argv[1]).href===import.meta.url) {
  const r=await inquire(process.argv.slice(2).map(Number)),s=r.search;
  console.log(JSON.stringify({scene:r.scene.order,physical:r.physical,controls:Object.keys(r.state.controls),
    proposal:r.proposal.reason ?? r.proposal.kind,action:r.proposal.actions?.[0],
    max_nodes:r.cfg.max_nodes,expanded:s.expanded_node_count,bounds:s.exhausted_bound_refs,missing:s.missing_premise_refs,
    open:s.open_frontier_count,plans:s.plans.map(p=>p.effects.map(e=>e.action_ref))}));
}
