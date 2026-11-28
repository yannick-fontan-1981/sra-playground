import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { mount } from '../ls19-ligne-90/montage.mjs';

const [sha,group,root,output,selection] = process.argv.slice(2);
const base='d0e7527ca8033bd805a6d7a8bb021eff62e87021', candidate='bb4a99b5ba41531eb70f1dccb6a97a919cefec56';
assert.ok([base,candidate].includes(sha));
const m=mount(sha,'.');
try {
  const repo=execFileSync('git',['rev-parse','--show-toplevel'],{encoding:'utf8'}).trim();
  const archive=join(m.program,'transport.tar');
  execFileSync('git',['-C',repo,'archive','--output='+archive,candidate,'scripts/sic-study-source-games.mjs',
    'tests/sic-sp80-two-lines.test.ts','tests/fixtures/sic-sp80-public-returns.json.gz']);
  execFileSync('tar',['-xf',archive,'-C',m.program]);
  if (group==='auteur') {
    const report=execFileSync(process.execPath,['--test','tests/sic-sp80-two-lines.test.ts'],{cwd:m.program,encoding:'utf8',
      env:{...process.env,SIC_SP80_GAME_ROOT:root,SIC_SP80_ENGINE_ROOT:m.program}});
    assert.match(report,/fail 0/);writeFileSync(output,report,{flag:'wx'});
  } else {
    let seed;
    if (group==='substitution') {
      const bytes=readFileSync(selection);
      assert.equal(createHash('sha256').update(bytes).digest('hex'),'7045e0253e4ed6cb4d60d05d62e1b146415324375767be392955cf29bf9165e1');
      seed=Buffer.from(JSON.parse(bytes).seed,'hex');
    }
    const local=join(m.program,'parcours.mjs');
    copyFileSync(new URL('parcours.mjs',import.meta.url),local);
    const {run}=await import(pathToFileURL(local));
    writeFileSync(output,JSON.stringify({sha,group,results:await run(group,root,seed)})+'\n',{flag:'wx'});
  }
} finally {m.close();}
