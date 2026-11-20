import {readFileSync,writeFileSync} from 'node:fs';
import {solve,replay} from '../../scripts/solver.mjs';
const results=[];
for(const level of [2,3,4]){
 const design=JSON.parse(readFileSync(new URL(`../level${level}-design.json`,import.meta.url),'utf8'));
 const played=replay(design.spec,design.commands);
 if(!played.state.complete||played.metrics.blocked||played.metrics.deaths)throw Error(`L${level} witness failed`);
 for(const [label,options] of [['no-warrior-push',{disablePush:true}],['no-thief-pull',{disablePull:true}],...(level===4?[['no-reflection',{disableReflections:true}],['monsters-retained',{goal:s=>s.complete&&s.monsters.length>0}]]:[])]){
  const result=solve(design.spec,{maxStates:250000,maxMs:10000,...options});
  const entry={level,label,...result};delete entry.state;results.push(entry);console.log(JSON.stringify(entry));
 }
}
writeFileSync(new URL('../levels2-4-necessity.json',import.meta.url),JSON.stringify({note:'Queue exhaustion proves impossibility; a limit remains inconclusive.',results},null,2)+'\n');
