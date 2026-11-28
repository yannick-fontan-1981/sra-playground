import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync,readFileSync,writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { mount } from '../ls19-ligne-90/montage.mjs';

const [sha,group,gameRoot,out,selection]=process.argv.slice(2);
const base='d0e7527ca8033bd805a6d7a8bb021eff62e87021', candidate='915e0601e3aad82653733ac602909bef2286343d';
assert.ok([base,candidate].includes(sha));
const work=mount(sha,'.');
try {
  const repo=execFileSync('git',['rev-parse','--show-toplevel'],{encoding:'utf8'}).trim();
  const tar=join(work.program,'qualification.tar');
  const test='tests/sic-gril-lines-40-54.test.ts';
  execFileSync('git',['-C',repo,'archive','--output='+tar,candidate,'scripts/sic-study-source-games.mjs',
    'docs/migration/native-campaigns-v49/gril-public-trace.json.gz','tests/fixtures/sic-gril-alternate-returns.json.gz',test]);
  execFileSync('tar',['-xf',tar,'-C',work.program]);
  if(group==='auteur'){
    const report=execFileSync(process.execPath,['--test',test],{cwd:work.program,encoding:'utf8',
      env:{...process.env,SIC_GRIL_GAME_ROOT:gameRoot,SIC_GRIL_ENGINE_ROOT:work.program}});
    assert.match(report,/fail 0/);writeFileSync(out,report,{flag:'wx'});
  } else {
    let seed;
    if(group==='réserve'){
      const bytes=readFileSync(selection);
      assert.equal(createHash('sha256').update(bytes).digest('hex'),'4c5bc47cdc54f21e57e930ea6ebb0553fa7f22e2c491bb0b9ad64869408d9ccd');
      seed=Buffer.from(JSON.parse(bytes).seed,'hex');
    }
    const local=join(work.program,'parcours.mjs');
    copyFileSync(new URL('parcours.mjs',import.meta.url),local);
    const {run}=await import(pathToFileURL(local));
    writeFileSync(out,JSON.stringify({sha,group,cases:await run(group,gameRoot,seed)})+'\n',{flag:'wx'});
  }
} finally {work.close();}
