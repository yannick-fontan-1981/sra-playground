import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync,readFileSync,writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { mount } from '../ls19-ligne-90/montage.mjs';

const [sha,group,gameRoot,out,selection]=process.argv.slice(2);
const base='d0e7527ca8033bd805a6d7a8bb021eff62e87021', candidate='14a185d909d3b3cb42fcc8584b841865b8ff6dd0';
assert.ok([base,candidate].includes(sha));
const work=mount(sha,'.');
try {
  const repo=execFileSync('git',['rev-parse','--show-toplevel'],{encoding:'utf8'}).trim();
  const tar=join(work.program,'qualification.tar');
  const test='tests/sic-wa30-contact-lines.test.ts';
  execFileSync('git',['-C',repo,'archive','--output='+tar,candidate,'scripts/sic-study-source-games.mjs',
    'docs/migration/native-campaigns-v54/baseline-wa30/wa30-public-trace.json.gz','tests/fixtures/sic-wa30-alternate-returns.json.gz',test]);
  execFileSync('tar',['-xf',tar,'-C',work.program]);
  if(group==='auteur'){
    const report=execFileSync(process.execPath,['--test',test],{cwd:work.program,encoding:'utf8',
      env:{...process.env,SIC_WA30_GAME_ROOT:gameRoot,SIC_WA30_ENGINE_ROOT:work.program}});
    assert.match(report,/fail 0/);writeFileSync(out,report,{flag:'wx'});
  } else {
    let seed;
    if(group==='réserve'){
      const bytes=readFileSync(selection);
      assert.equal(createHash('sha256').update(bytes).digest('hex'),'8c4fd44f34a86f26fda77fe1e7041677349015423a9f7ed3d481b2bef97a59dd');
      seed=Buffer.from(JSON.parse(bytes).seed,'hex');
    }
    const local=join(work.program,'parcours.mjs');
    copyFileSync(new URL('parcours.mjs',import.meta.url),local);
    const {run}=await import(pathToFileURL(local));
    writeFileSync(out,JSON.stringify({sha,group,cases:await run(group,gameRoot,seed)})+'\n',{flag:'wx'});
  }
} finally {work.close();}
