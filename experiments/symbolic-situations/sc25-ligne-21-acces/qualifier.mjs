import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {copyFileSync,readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {mount} from '../ls19-ligne-90/montage.mjs';

const [sha,group,out]=process.argv.slice(2);
const gel='d0e7527ca8033bd805a6d7a8bb021eff62e87021',candidat='4dcc659183c31502edcca85f29d661426660a426';
assert.ok([gel,candidat].includes(sha));
const work=mount(sha,'.');
try{
  const repo=execFileSync('git',['rev-parse','--show-toplevel'],{encoding:'utf8'}).trim();
  const tar=join(work.program,'qualification.tar'),test='tests/sic-sc25-access-transition.test.ts';
  const fixture='tests/fixtures/v6-motif-access-reference.json';
  execFileSync('git',['-C',repo,'archive','--output='+tar,candidat,test,fixture,'tests/v6-motif-access-kernel.test.ts']);
  execFileSync('tar',['-xf',tar,'-C',work.program]);
  if(group==='auteur'){
    const report=execFileSync(process.execPath,['--test',test,'tests/v6-motif-access-kernel.test.ts'],{cwd:work.program,
      encoding:'utf8',env:{...process.env,SIC_SC25_ACCESS_ENGINE_ROOT:work.program}});
    assert.match(report,/fail 0/);
    writeFileSync(out,report,{flag:'wx'});
  }else{
    assert.equal(group,'contrôles');
    const source=readFileSync(join(work.program,test),'utf8').replaceAll('\r\n','\n');
    const ino=source.indexOf('\nconst { frames }'),start=source.indexOf('\nfunction field('),stop=source.indexOf('\nasync function start(');
    assert.ok(ino>=0&&ino<start&&start<stop);
    const foundation=source.slice(ino,start).replace(/\nconst boardDigest[^\n]*\n/,'\n');
    const imports="import assert from 'node:assert/strict';\nimport {readFileSync} from 'node:fs';\n"+
      "import type {V6Command,V6PublicObservation} from './src/runtime/v6-agent-protocol.ts';\n"+
      "const read=p=>JSON.parse(readFileSync(new URL('./tests/'+p,import.meta.url),'utf8'));\n";
    writeFileSync(join(work.program,'terrain.ts'),imports+foundation+source.slice(start,stop)+'\nexport {field};\n');
    const local=join(work.program,'parcours.mjs');
    copyFileSync(new URL('parcours.mjs',import.meta.url),local);
    const {run}=await import(pathToFileURL(local));
    writeFileSync(out,JSON.stringify({sha,...await run()})+'\n',{flag:'wx'});
  }
}finally{work.close();}
