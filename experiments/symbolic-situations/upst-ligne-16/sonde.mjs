import {PointExperimentMemory} from './src/logos-engine/v6-point-contrasts.ts';
const original=PointExperimentMemory.prototype.offers,rows=[];
PointExperimentMemory.prototype.offers=async function(observation,actions){
  const result=await original.call(this,observation,actions);
  const state=this.state();
  rows.push({ref:observation.observation_ref,seen:state.records.map(r=>r.observed_local_change),compared:state.compared_pairs,
    alternatives:result.map(o=>{
      const e=observation.entities.find(x=>x.id===o.binding.entity_ref);
      const pixels=e.mask.map(([x,y])=>[e.position[0]+x,e.position[1]+y]);
      return {action:o.binding.action,predictions:o.frozen_predictions,pairs:o.new_contrast_pairs,pixels};
    })});
  return result;
};
export const drain=()=>rows.splice(0);
