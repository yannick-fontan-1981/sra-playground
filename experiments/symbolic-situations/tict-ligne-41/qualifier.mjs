import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { copyFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { mount } from '../ls19-ligne-90/montage.mjs';

const base='d0e7527ca8033bd805a6d7a8bb021eff62e87021';
const proof='e8df1757272cae3da1669b3e7ddb2e7bf65e8e02';
const [sha,group,gameRoot,out]=process.argv.slice(2);
assert.ok([base,proof].includes(sha));
const instance=mount(sha,'.');
try {
  const repo=execFileSync('git',['rev-parse','--show-toplevel'],{encoding:'utf8'}).trim();
  const dossier=join(instance.program,'qualification.tar');
  const tests=['tests/sic-cell-placement-positive-41.test.ts','tests/sic-sp80-two-lines.test.ts'];
  execFileSync('git',['-C',repo,'archive','--output='+dossier,proof,'scripts/sic-study-source-games.mjs',
    'docs/migration/native-campaigns-v46/tict-public-trace.json.gz','tests/fixtures/sic-sp80-public-returns.json.gz',...tests]);
  execFileSync('tar',['-xf',dossier,'-C',instance.program]);
  if(group==='auteur'){
    const report=execFileSync(process.execPath,['--test',...tests],{cwd:instance.program,encoding:'utf8',
      env:{...process.env,SIC_SP80_GAME_ROOT:gameRoot,SIC_SP80_ENGINE_ROOT:instance.program}});
    assert.match(report,/fail 0/);writeFileSync(out,report,{flag:'wx'});
  } else {
    const path=join(instance.program,'parcours.mjs');
    copyFileSync(new URL('parcours.mjs',import.meta.url),path);
    const {run}=await import(pathToFileURL(path));
    writeFileSync(out,JSON.stringify({sha,group,cases:await run(group,gameRoot)})+'\n',{flag:'wx'});
  }
} finally {instance.close();}
