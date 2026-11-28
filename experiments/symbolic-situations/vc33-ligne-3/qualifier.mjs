import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {copyFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {mount} from '../ls19-ligne-90/montage.mjs';

const [sha,groupe,gameRoot,out]=process.argv.slice(2);
const gel='d0e7527ca8033bd805a6d7a8bb021eff62e87021',candidate='f489393bb15a1ce775a3904ee97a216d40db026f';
assert.ok([gel,candidate].includes(sha));const m=mount(sha,'.');
try{
  const repo=execFileSync('git',['rev-parse','--show-toplevel'],{encoding:'utf8'}).trim();
  const tar=join(m.program,'transport.tar');
  execFileSync('git',['-C',repo,'archive','--output='+tar,candidate,'scripts/sic-study-source-games.mjs','tests/fixtures/sic-vc33-line3.json.gz','tests/sic-vc33-line3.test.ts']);
  execFileSync('tar',['-xf',tar,'-C',m.program]);
  if(groupe==='tests-auteur'){
    const args=['--test',...(sha===gel?['--test-name-pattern=VC33 releases the 16|stationary return|fixed marker disappears']:[]),'tests/sic-vc33-line3.test.ts'];
    const lines=execFileSync(process.execPath,args,{cwd:m.program,env:{...process.env,SIC_VC33_GAME_ROOT:gameRoot,SIC_VC33_ENGINE_ROOT:m.program},encoding:'utf8',timeout:900000});
    assert.ok(lines.includes('pass '+(sha===gel?3:6)));assert.match(lines,/fail 0/);writeFileSync(out,lines,{flag:'wx'});
  }else{
    copyFileSync(new URL('parcours.mjs',import.meta.url),join(m.program,'parcours.mjs'));
    const {run}=await import(new URL('parcours.mjs',pathToFileURL(m.program+'/')));
    writeFileSync(out,JSON.stringify({sha,groupe,results:await run(groupe,gameRoot)})+'\n',{flag:'wx'});
  }
}finally{m.close();}
