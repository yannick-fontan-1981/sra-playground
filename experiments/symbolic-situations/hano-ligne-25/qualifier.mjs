import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync,readFileSync,writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { mount } from '../ls19-ligne-90/montage.mjs';

const [sha,group,gameRoot,out,selection]=process.argv.slice(2);
const base='d0e7527ca8033bd805a6d7a8bb021eff62e87021', candidate='f768bac6c4c9c34d230b63fe6cec39663164b6ae';
assert.ok([base,candidate].includes(sha));
const work=mount(sha,'.');
try {
  const repo=execFileSync('git',['rev-parse','--show-toplevel'],{encoding:'utf8'}).trim();
  const tar=join(work.program,'qualification.tar');
  const test='tests/sic-hano-line-25.test.ts';
  execFileSync('git',['-C',repo,'archive','--output='+tar,candidate,'scripts/sic-study-source-games.mjs',
    'tests/fixtures/sic-hano-public-returns.json.gz',test]);
  execFileSync('tar',['-xf',tar,'-C',work.program]);
  if(group==='auteur'){
    const report=execFileSync(process.execPath,['--test',test],{cwd:work.program,encoding:'utf8',
      env:{...process.env,SIC_HANO_GAME_ROOT:gameRoot,SIC_HANO_ENGINE_ROOT:work.program}});
    assert.match(report,/fail 0/);writeFileSync(out,report,{flag:'wx'});
  } else {
    let seed;
    if(group==='réserve'){
      const bytes=readFileSync(selection);
      assert.equal(createHash('sha256').update(bytes).digest('hex'),'6ba0f1d6fd173b4b66372eac45a421735b8cfa864f8032baedaef025d1a85cc3');
      seed=Buffer.from(JSON.parse(bytes).seed,'hex');
    }
    const local=join(work.program,'parcours.mjs');
    copyFileSync(new URL('parcours.mjs',import.meta.url),local);
    const {run}=await import(pathToFileURL(local));
    writeFileSync(out,JSON.stringify({sha,group,cases:await run(group,gameRoot,seed)})+'\n',{flag:'wx'});
  }
} finally {work.close();}
