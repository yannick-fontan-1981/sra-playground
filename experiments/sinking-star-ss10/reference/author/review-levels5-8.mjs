import{readFileSync,writeFileSync}from'node:fs';
import{solve,replay}from'../../scripts/solver.mjs';
const report={scope:'Counterfactual searches: exhausted queues prove impossibility; capped searches are inconclusive.',levels:[]};
for(const level of [6,7,8]){
 const d=JSON.parse(readFileSync(new URL(`../level${level}-design.json`,import.meta.url)));const checks=[];
 for(const [label,options]of [['without-warrior-push',{disableWarriorPushes:true}],['without-thief-pull',{disableThiefPulls:true}],...(level===8?[['without-mirrors',{disableReflections:true}],['without-created-supports',{disablePlatforms:true}]]:[]),...(level===7?[['without-press-push',{disablePistons:true}]]:[])]){
  const r=solve(d.spec,{maxStates:100000,maxMs:3000,...options});checks.push({label,...r,state:undefined});console.log(level,label,r.status,r.states,r.ms);
 }
 const variants=level===6?[['without-hydraulics',{...d.spec,platforms:[]}]]:[];
 for(const[label,spec]of variants){const r=solve(spec,{maxStates:100000,maxMs:3000});checks.push({label,...r,state:undefined});console.log(level,label,r.status,r.states,r.ms);}
 report.levels.push({level,witness:replay(d.spec,d.commands).metrics,checks});
}
writeFileSync(new URL('../levels5-8-review.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
