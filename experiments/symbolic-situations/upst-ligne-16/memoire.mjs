import {PointExperimentMemory} from './src/logos-engine/v6-point-contrasts.ts';
import {readFileSync} from 'node:fs';
const mode=readFileSync(new URL('./intervention.txt',import.meta.url),'utf8');
const original=PointExperimentMemory.prototype.offers,rows=[];
PointExperimentMemory.prototype.offers=async function(obs,actions){
  const regular=await original.call(this,obs,actions),s=this.state();
  if(!obs.observation_ref.includes(':revision:4:'))return regular;
  const evidence=structuredClone(s),cloned=new PointExperimentMemory();
  if(mode==='sans-positif'){
    evidence.records=evidence.records.filter(r=>!r.observed_local_change);
    evidence.has_positive=false;
  }else{
    const all=new Map([...s.compared_pairs,...regular.flatMap(o=>o.new_contrast_pairs)].map(p=>[JSON.stringify(p),p]));
    evidence.compared_pairs=[...all.values()];
  }
  cloned.restore(evidence);
  const replay=await original.call(cloned,obs,actions);
  rows.push({ref:obs.observation_ref,offresAvant:regular.length,offresApres:replay.length,
    témoinsPositifs:evidence.records.filter(r=>r.observed_local_change).length,pairesConnues:evidence.compared_pairs.length});
  return replay;
};
export const drain=()=>rows.splice(0);
