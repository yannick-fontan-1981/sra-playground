import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {copyFileSync,readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {mount} from '../ls19-ligne-90/montage.mjs';

const [sha,group,destination]=process.argv.slice(2);
const gel='d0e7527ca8033bd805a6d7a8bb021eff62e87021',candidat='88e8abe8389ba9e5809de6aa8e2f911053f14959';
assert.ok([gel,candidat].includes(sha));
const work=mount(sha,'.');
try{
  const repo=execFileSync('git',['rev-parse','--show-toplevel'],{encoding:'utf8'}).trim();
  const tar=join(work.program,'qualification.tar'),test='tests/sic-sc25-motif-transfer.test.ts';
  execFileSync('git',['-C',repo,'archive','--output='+tar,candidat,test,'tests/fixtures/v6-motif-access-reference.json']);
  execFileSync('tar',['-xf',tar,'-C',work.program]);
  if(group==='auteur'){
    const report=execFileSync(process.execPath,['--test',test],{cwd:work.program,encoding:'utf8',
      env:{...process.env,SIC_SC25_TRANSFER_ENGINE_ROOT:work.program}});
    assert.match(report,/fail 0/);writeFileSync(destination,report,{flag:'wx'});
  }else{
    assert.equal(group,'contrôles');
    const source=readFileSync(join(work.program,test),'utf8').replaceAll('\r\n','\n');
    const start=source.indexOf('\nconst { frames }'),end=source.indexOf('\nasync function start(');
    assert.ok(start>=0&&end>start);
    const pre="import assert from 'node:assert/strict';\nimport {readFileSync} from 'node:fs';\n"+
      "import type {V6Command,V6PublicObservation} from './src/runtime/v6-agent-protocol.ts';\n"+
      "const read=p=>JSON.parse(readFileSync(new URL('./tests/'+p,import.meta.url),'utf8'));\n";
    writeFileSync(join(work.program,'terrain.ts'),pre+source.slice(start,end)+'\nexport {field};\n');
    const local=join(work.program,'parcours.mjs');
    copyFileSync(new URL('parcours.mjs',import.meta.url),local);
    const {run}=await import(pathToFileURL(local));
    writeFileSync(destination,JSON.stringify({sha,cases:await run()})+'\n',{flag:'wx'});
  }
}finally{work.close();}
