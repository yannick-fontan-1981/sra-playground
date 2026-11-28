import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync,readFileSync,writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { mount } from '../ls19-ligne-90/montage.mjs';

const [sha,group,gameRoot,out,selection]=process.argv.slice(2);
const base='d0e7527ca8033bd805a6d7a8bb021eff62e87021', candidate='8e820aa64f321153bb858040d462d7f766178947';
assert.ok([base,candidate].includes(sha));
const work=mount(sha,'.');
try {
  const repo=execFileSync('git',['rev-parse','--show-toplevel'],{encoding:'utf8'}).trim();
  const tar=join(work.program,'qualification.tar');
  const test='tests/sic-re86-line-7.test.ts';
  execFileSync('git',['-C',repo,'archive','--output='+tar,candidate,'scripts/sic-study-source-games.mjs',
    'docs/migration/native-campaigns-v54/baseline-re86/re86-public-trace.json.gz','tests/fixtures/sic-re86-alternate-returns.json.gz',test]);
  execFileSync('tar',['-xf',tar,'-C',work.program]);
  if(group==='auteur'){
    const report=execFileSync(process.execPath,['--test',test],{cwd:work.program,encoding:'utf8',
      env:{...process.env,SIC_RE86_GAME_ROOT:gameRoot,SIC_RE86_ENGINE_ROOT:work.program}});
    assert.match(report,/fail 0/);writeFileSync(out,report,{flag:'wx'});
  } else {
    let seed;
    if(group==='réserve'){
      const bytes=readFileSync(selection);
      assert.equal(createHash('sha256').update(bytes).digest('hex'),'1d4d2f9dbce726dbf9cc6f5d93bc637693304b1498acb394aaacc30d0a3e36fa');
      seed=Buffer.from(JSON.parse(bytes).seed,'hex');
    }
    const local=join(work.program,'parcours.mjs');
    copyFileSync(new URL('parcours.mjs',import.meta.url),local);
    const {run}=await import(pathToFileURL(local));
    writeFileSync(out,JSON.stringify({sha,group,cases:await run(group,gameRoot,seed)})+'\n',{flag:'wx'});
  }
} finally {work.close();}
