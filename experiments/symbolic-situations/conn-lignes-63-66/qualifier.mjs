import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {copyFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {mount} from '../ls19-ligne-90/montage.mjs';

const [sha,groupe,gameRoot,out]=process.argv.slice(2);
const gel='d0e7527ca8033bd805a6d7a8bb021eff62e87021',preuve='f8607d2ac0dac47900da3504365b3968a523a549';
assert.ok([gel,preuve].includes(sha));
const repo=execFileSync('git',['rev-parse','--show-toplevel'],{encoding:'utf8'}).trim(),m=mount(sha,repo);
try{
  const base=pathToFileURL(m.program+'/'),tar=join(m.program,'test.tar');
  const files=['scripts/sic-study-source-games.mjs','docs/migration/lot3i-evidence/final/conn-recurrent-series-session/conn-public-trace.json.gz'];
  if(groupe==='tests-auteur')files.push('tests/sic-conn-series-lines.test.ts','tests/fixtures/sic-conn-alternate-returns.json.gz');
  execFileSync('git',['-C',repo,'archive','--output='+tar,preuve,...files]);execFileSync('tar',['-xf',tar,'-C',m.program]);
  if(groupe==='tests-auteur'){
    const lines=execFileSync(process.execPath,['--test','tests/sic-conn-series-lines.test.ts'],{cwd:m.program,env:{...process.env,SIC_CONN_GAME_ROOT:gameRoot},encoding:'utf8',timeout:900000});
    assert.match(lines,/pass 7/);assert.match(lines,/fail 0/);writeFileSync(out,lines,{flag:'wx'});console.log('7/7');
  }else{
    copyFileSync(new URL('parcours.mjs',import.meta.url),join(m.program,'parcours.mjs'));
    const {run}=await import(new URL('parcours.mjs',base));
    const results=await run(groupe,gameRoot);
    writeFileSync(out,JSON.stringify({sha,groupe,results})+'\n',{flag:'wx'});
    console.log(JSON.stringify(Object.entries(results).map(([name,t])=>[name,t.length,t.at(-1).type])));
  }
}finally{m.close();}
