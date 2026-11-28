import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {copyFileSync,readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {mount} from '../ls19-ligne-90/montage.mjs';

const [sha,group,gameRoot,out]=process.argv.slice(2);
const base='d0e7527ca8033bd805a6d7a8bb021eff62e87021',candidate='6172e2d3579f36af9c0912578f6d58333a298343';
assert.ok([base,candidate].includes(sha));
const work=mount(sha,'.');
try {
  const repo=execFileSync('git',['rev-parse','--show-toplevel'],{encoding:'utf8'}).trim();
  const tar=join(work.program,'qualification.tar'),test='tests/sic-sc25-line-21.test.ts';
  execFileSync('git',['-C',repo,'archive','--output='+tar,candidate,'scripts/sic-study-source-games.mjs',
    test,'tests/v6-motif-access-kernel.test.ts','tests/fixtures/v6-motif-access-reference.json']);
  execFileSync('tar',['-xf',tar,'-C',work.program]);
  if(group==='auteur'){
    const report=execFileSync(process.execPath,['--test',test],{cwd:work.program,encoding:'utf8',
      env:{...process.env,SIC_SC25_GAME_ROOT:gameRoot,SIC_SC25_ENGINE_ROOT:work.program}});
    assert.match(report,/fail 0/);writeFileSync(out,report,{flag:'wx'});
  } else if(group==='noyau'){
    const report=execFileSync(process.execPath,['--test','--test-name-pattern','cold production caller|a contrary invocation response','tests/v6-motif-access-kernel.test.ts'],{cwd:work.program,encoding:'utf8'});
    assert.match(report,/pass 2\b/);
    assert.match(report,/fail 0/);
    writeFileSync(out,report,{flag:'wx'});
  } else {
    const local=join(work.program,'parcours.mjs');
    copyFileSync(new URL('parcours.mjs',import.meta.url),local);
    const {run}=await import(pathToFileURL(local));
    writeFileSync(out,JSON.stringify({sha,group,cases:await run(group,gameRoot)})+'\n',{flag:'wx'});
  }
} finally {work.close();}
