import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {copyFileSync,readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {mount} from '../ls19-ligne-90/montage.mjs';

const [sha,group,gameRoot,destination]=process.argv.slice(2);
const gel='d0e7527ca8033bd805a6d7a8bb021eff62e87021',candidat='735b5e7d9fc3d3b426588e4d619187d925d269f0';
assert.ok([gel,candidat].includes(sha));
const work=mount(sha,'.');
try{
  const repo=execFileSync('git',['rev-parse','--show-toplevel'],{encoding:'utf8'}).trim();
  const tar=join(work.program,'qualification.tar'),test='tests/sic-tria-line-79.test.ts';
  execFileSync('git',['-C',repo,'archive','--output='+tar,candidat,'scripts/sic-study-source-games.mjs',test]);
  execFileSync('tar',['-xf',tar,'-C',work.program]);
  if(group==='auteur'){
    const report=execFileSync(process.execPath,['--test',test],{cwd:work.program,encoding:'utf8',
      env:{...process.env,SIC_TRIA_GAME_ROOT:gameRoot,SIC_TRIA_ENGINE_ROOT:work.program}});
    assert.match(report,/fail 0/);writeFileSync(destination,report,{flag:'wx'});
  }else{
    const source=readFileSync(join(work.program,test),'utf8').replaceAll('\r\n','\n');
    const a=source.indexOf('function overlayMovedParticipant('),b=source.indexOf("\ntest('79 changes participant");
    assert.ok(a>=0&&b>a);
    writeFileSync(join(work.program,'placement.ts'),"import type {V6PublicObservation as Packet} from './src/runtime/v6-agent-protocol.ts';\n"+
      source.slice(a,b)+'\nexport {overlayMovedParticipant};\n');
    const local=join(work.program,'parcours.mjs');
    copyFileSync(new URL('parcours.mjs',import.meta.url),local);
    const {run}=await import(pathToFileURL(local));
    writeFileSync(destination,JSON.stringify({sha,group,cases:await run(group,gameRoot)})+'\n',{flag:'wx'});
  }
}finally{work.close();}
