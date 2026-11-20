import {readFileSync,writeFileSync} from 'node:fs';
import {compileLevel,initialState,stepDetailed} from '../../dist/core.js';
import {decodeCommand,stateKey} from '../../scripts/solver.mjs';
const d=JSON.parse(readFileSync(new URL('../level4-design.json',import.meta.url),'utf8'));
const w=compileLevel(d.spec),s=initialState(w),queue=[{s,prev:-1,c:''}],seen=new Set([stateKey(s)]),began=performance.now();
let status='unsolvable',answer=null,expanded=0;
for(let i=0;i<queue.length;i++){
 if(seen.size>300000||performance.now()-began>10000){status='limit';break;}
 const n=queue[i];expanded++;
 if(n.s.complete){status='solved';answer=i;break;}
 for(const c of 'UDLRXC'){
  const a=decodeCommand(c,n.s),next=stepDetailed(w,n.s,a.id,a.data).state;
  // Monsters never reappear; zero-monster states cannot meet this goal.
  if(next.dead||next.failed||!next.monsters.length)continue;
  const k=stateKey(next);if(seen.has(k))continue;seen.add(k);queue.push({s:next,prev:i,c});
 }
}
let commands='';if(answer!==null){while(queue[answer].prev>=0){commands=queue[answer].c+commands;answer=queue[answer].prev;}}
const result={level:4,label:'monsters-retained-pruned-monotone-count',status,states:seen.size,expanded,ms:Math.round(performance.now()-began),commands};
const path=new URL('../levels2-4-necessity.json',import.meta.url),report=JSON.parse(readFileSync(path,'utf8'));
report.results=report.results.filter(r=>r.label!==result.label);report.results.push(result);
writeFileSync(path,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(result));
