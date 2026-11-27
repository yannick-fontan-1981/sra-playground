import { inquire,root } from './enquete.mjs';
import { pathToFileURL } from 'node:url';
export async function trace(r,commands,engine=root) {
  const fn=p=>import(new URL('src/logos-engine/'+p,engine));
  const {simulatePiercingModel,measurePiercingGoal,measurePiercingIntersections}=await fn('v5-piercing-plan.ts');
  const {rootedLineModel}=await fn('v6-rooted-line-mechanics.ts');
  const {projectedRootedLine}=await fn('v6-rooted-line-observation.ts');
  const model=rootedLineModel(r.cfg), out=[];
  let configuration=r.configuration;
  for(const cmd of commands) {
    const step=simulatePiercingModel({configuration,effect:r.state.controls[cmd],models:[model],max_microsteps:r.cfg.max_microsteps,
      require_finite_domain:true},model);
    configuration=step.configuration;
    const goal=measurePiercingGoal({configuration,requested_root_ref:'current_root',requested_type_order:r.scene.order});
    const intersection=measurePiercingIntersections({rods:configuration.rods,pieces:configuration.pieces,
      requested_root_ref:'current_root',requested_type_order:r.scene.order});
    out.push({cmd,configuration,physical:projectedRootedLine(configuration),supports:configuration.pieces.map(p=>[p.piece_ref,p.support_refs]),
      contacts:intersection.intersections.map(p=>[p.piece_ref,p.first_root_index]),matched:goal.predicted_rooted_match});
  }
  return out;
}
if(process.argv[1] && pathToFileURL(process.argv[1]).href===import.meta.url){
  const r=await inquire(process.argv.slice(2).map(Number));
  const cmds=[1,1,1,4,4,4,4,2,3,2,4].map(i=>'ACTION'+i);
  const report=await trace(r,cmds);
  const end=report.at(-1);
  console.log(JSON.stringify({gestes:report.length,physique:end.physical,stations:end.contacts,accordDeReference:end.matched}));
}
