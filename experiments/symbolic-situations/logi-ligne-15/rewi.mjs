import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import {isDeepStrictEqual as equal} from 'node:util';
import {gunzipSync} from 'node:zlib';
import {native,run} from './service.mjs';
import {readRow,reference} from './situations.mjs';

const [sha,receipt,repo='.']=process.argv.slice(2);
const blob=execFileSync('git',['-C',repo,'show',reference+':tests/fixtures/sic-information-displays-public.json.gz']);
assert.equal(createHash('sha256').update(blob).digest('hex'),'9f2a049421405a35829214a44950ceb9a30e08c126ae052e32e53de459949158');
const {observations,commands,budgets}=JSON.parse(gunzipSync(blob)).games.REWI;
const game={initial:observations[0],budgets,length:1,
  advance(i,command){return equal(command,commands[i])?observations[i+1]:null;}};
const host=native(sha,repo);
let turns;
try{turns=await run(game,host.program);}finally{host.close();}
const [first,next]=turns;
const ok={};
ok.clicInitial=equal(first?.command,{actionRef:'ACTION6',data:{x:34,y:61}}) && equal(first.command,commands[0]);
const q=first?.info,n=next?.info,m=next?.measured;
ok.offre=q?.source==='coupled_displays' && q.family==='information_goal' && q.released===q.objective;
ok.geometrie=q?.controls?.length===6 && q?.receivers?.length===5 && new Set([...q.controls,...q.receivers].map(String)).size===11;
if(ok.geometrie){
  const rows=observations.slice(0,2).map(o=>({c:readRow(o.frame,q.controls),r:readRow(o.frame,q.receivers)}));
  ok.pixelsStables=equal(rows[0],rows[1]) && equal(rows[0].c,q.before) && equal(rows[0].r,q.lamps);
  ok.recepteursRepris=equal(n?.receivers,q.receivers) && equal(n?.lamps,rows[1].r) && equal(n?.before,rows[1].c);
}
ok.retour=m?.value==='unchanged' && equal(m.checks,{coupled_switch:'contradicted',inert_decoration:'matched',local_switch:'contradicted'});
ok.attribution=!!m?.revision && q?.revision!==m.revision && m.evidence===m.revision && m.objective===q.released && n?.revision===m.revision;
ok.clicSuivant=equal(next?.command,{actionRef:'ACTION6',data:{x:28,y:61}}) && equal(next.command,commands[1]) && n?.control!==q?.control;
const result={sha,ok,turns};
if(receipt)writeFileSync(receipt,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({sha,checks:Object.keys(ok).length,ecarts:Object.entries(ok).filter(([,v])=>!v).map(([k])=>k)}));
process.exitCode=Number(Object.values(ok).some(x=>!x));
