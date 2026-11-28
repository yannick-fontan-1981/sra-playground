import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {copyFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {mount} from '../ls19-ligne-90/montage.mjs';

const [sha,group,gameRoot,out]=process.argv.slice(2);
const gel='d0e7527ca8033bd805a6d7a8bb021eff62e87021',candidat='fa126d653aa5e123f9de78c220e9e6129a6436a2';
assert.ok([gel,candidat].includes(sha));
const work=mount(sha,'.');
try {
  const repo=execFileSync('git',['rev-parse','--show-toplevel'],{encoding:'utf8'}).trim();
  const tar=join(work.program,'qualification.tar');
  const test='tests/sic-skbn-line-38.test.ts';
  execFileSync('git',['-C',repo,'archive','--output='+tar,candidat,'scripts/sic-study-source-games.mjs',
    test,'tests/v6-inventory-kernel.test.ts','tests/sic-inventory-route-plan.test.ts','tests/sic-inventory-route-observation.test.ts',
    'tests/fixtures/v6-inventory-family-reference.json.gz','tests/fixtures/v6-native-caller/hano-first-prefix.json']);
  execFileSync('tar',['-xf',tar,'-C',work.program]);
  if(group==='auteur'){
    const report=execFileSync(process.execPath,['--test',test,'tests/v6-inventory-kernel.test.ts',
      'tests/sic-inventory-route-plan.test.ts','tests/sic-inventory-route-observation.test.ts'],
      {cwd:work.program,encoding:'utf8',env:{...process.env,SIC_SKBN_GAME_ROOT:gameRoot,SIC_SKBN_ENGINE_ROOT:work.program}});
    assert.match(report,/fail 0/);
    writeFileSync(out,report,{flag:'wx'});
  }else{
    const local=join(work.program,'parcours.mjs');
    copyFileSync(new URL('parcours.mjs',import.meta.url),local);
    const {run}=await import(pathToFileURL(local));
    writeFileSync(out,JSON.stringify({sha,group,cases:await run(group,gameRoot)})+'\n',{flag:'wx'});
  }
}finally{work.close();}
