import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {copyFileSync,readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {mount} from '../ls19-ligne-90/montage.mjs';
const [sha,group,gameRoot,out,selection]=process.argv.slice(2),proof='c3f24fb80a39604bf99686f7c0725b175c2628dd';
assert.ok([proof,'d0e7527ca8033bd805a6d7a8bb021eff62e87021'].includes(sha));const m=mount(sha,'.');
try{
  const repo=execFileSync('git',['rev-parse','--show-toplevel'],{encoding:'utf8'}).trim(),tar=join(m.program,'transport.tar');
  const trace='docs/migration/native-campaigns-v52/final/gare-public-trace.json.gz';
  execFileSync('git',['-C',repo,'archive','--output='+tar,proof,trace,'tests/fixtures/sic-gare-alternate-returns.json.gz','scripts/sic-study-source-games.mjs','tests/sic-gare-framed-lines.test.ts']);
  execFileSync('tar',['-xf',tar,'-C',m.program]);
  if(group==='auteur'){
    const output=execFileSync(process.execPath,['--test','tests/sic-gare-framed-lines.test.ts'],{cwd:m.program,env:{...process.env,SIC_GARE_GAME_ROOT:gameRoot},encoding:'utf8',timeout:900000});
    assert.match(output,/pass 8/);assert.match(output,/fail 0/);writeFileSync(out,output,{flag:'wx'});
  }else{
    let seed;
    if(group==='réserve'){
      const bytes=readFileSync(selection);
      assert.ok(readFileSync(new URL('CONTRAT.md',import.meta.url),'utf8').includes(createHash('sha256').update(bytes).digest('hex')));
      seed=Buffer.from(JSON.parse(bytes).seed,'hex');
    }
    copyFileSync(new URL('parcours.mjs',import.meta.url),join(m.program,'parcours.mjs'));
    const {run}=await import(new URL('parcours.mjs',pathToFileURL(m.program+'/')));
    writeFileSync(out,JSON.stringify({sha,group,results:await run(group,gameRoot,seed)})+'\n',{flag:'wx'});
  }
}finally{m.close();}
