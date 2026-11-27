import assert from 'node:assert/strict';
import {copyFileSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {once} from 'node:events';
import {historical} from './situations.mjs';
import {native} from './service.mjs';

const [sha,receipt,repo='.']=process.argv.slice(2);
const existing=JSON.parse(readFileSync(receipt,'utf8'));
assert.equal(existing.sha,sha);
const main=existing.results.find(row=>row.id==='historique').turns;
const m=native(sha,repo);
try{
  copyFileSync(new URL('./sonder.mjs',import.meta.url),join(m.program,'sonder.mjs'));
  const child=spawn(process.execPath,['--permission','--allow-inspector','--allow-fs-read='+m.program,'worker.mjs'],
    {cwd:m.program,env:{},windowsHide:true,stdio:['pipe','pipe','inherit']});
  const done=once(child,'close'),out=createInterface({input:child.stdout})[Symbol.asyncIterator]();
  const timeout=setTimeout(()=>child.kill(),90000);
  const trace=[];
  try {
    for(const [i,observation] of historical.observations.entries()) {
      child.stdin.write(JSON.stringify(i?{observation}:{observation,budgets:historical.budgets})+'\n');
      const line=await out.next();assert.ok(!line.done);
      const row=JSON.parse(line.value);trace.push(row);
      if(i<historical.length) assert.deepEqual(row.command,historical.commands[i]);
    }
  }finally{child.stdin.end();await done;clearTimeout(timeout);}
  assert.deepEqual(trace.map(({elections,...turn})=>turn),main);
  const eligible=trace.slice(0,2).map(e=>e.elections.findLast(r=>r.revision===e.info.revision)?.ranked);
  console.log(JSON.stringify(eligible));
  assert.deepEqual(eligible.map(e=>e?.length),[1,2]);
}finally{m.close();}
