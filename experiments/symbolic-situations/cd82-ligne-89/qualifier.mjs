import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {copyFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {mount} from '../ls19-ligne-90/montage.mjs';

const [sha,group,gameRoot,destination]=process.argv.slice(2);
const gel='d0e7527ca8033bd805a6d7a8bb021eff62e87021',candidat='a6f7b0de19f013b132ff133b1084be86988b2dc1';
assert.ok([gel,candidat].includes(sha));
const work=mount(sha,'.');
try{
  const repo=execFileSync('git',['rev-parse','--show-toplevel'],{encoding:'utf8'}).trim();
  const tar=join(work.program,'qualification.tar'),test='tests/sic-cd82-line-89.test.ts';
  execFileSync('git',['-C',repo,'archive','--output='+tar,candidat,'scripts/sic-study-source-games.mjs',test]);
  execFileSync('tar',['-xf',tar,'-C',work.program]);
  if(group==='auteur'){
    const report=execFileSync(process.execPath,['--test',test],{cwd:work.program,encoding:'utf8',
      env:{...process.env,SIC_CD82_GAME_ROOT:gameRoot,SIC_CD82_ENGINE_ROOT:work.program}});
    assert.match(report,/fail 0/);writeFileSync(destination,report,{flag:'wx'});
  }else{
    const local=join(work.program,'parcours.mjs');
    copyFileSync(new URL('parcours.mjs',import.meta.url),local);
    const {run}=await import(pathToFileURL(local));
    writeFileSync(destination,JSON.stringify({sha,group,cases:await run(group,gameRoot)})+'\n',{flag:'wx'});
  }
}finally{work.close();}
