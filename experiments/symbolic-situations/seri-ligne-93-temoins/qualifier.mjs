import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {copyFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {mount} from '../ls19-ligne-90/montage.mjs';

const [sha,group,gameRoot,destination]=process.argv.slice(2);
const gel='d0e7527ca8033bd805a6d7a8bb021eff62e87021',candidat='eb5611b3ff76409fbd67680ac29a5f6a17586422';
assert.ok([gel,candidat].includes(sha));
const work=mount(sha,'.');
try{
  const repo=execFileSync('git',['rev-parse','--show-toplevel'],{encoding:'utf8'}).trim();
  const tar=join(work.program,'qualification.tar'),test='tests/sic-seri-line-93.test.ts';
  execFileSync('git',['-C',repo,'archive','--output='+tar,candidat,'scripts/sic-study-source-games.mjs',test,'tests/v6-visual-sequences.test.ts','tests/fixtures/v6-sequence-reference.json','reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/morphology_policy/visual_sequences','reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v5/capabilities/visual_sequence.py']);
  execFileSync('tar',['-xf',tar,'-C',work.program]);
  if(group==='auteur'){
    const report=execFileSync(process.execPath,['--test',test,'tests/v6-visual-sequences.test.ts'],{cwd:work.program,encoding:'utf8',
      env:{...process.env,SIC_SERI_GAME_ROOT:gameRoot,SIC_SERI_ENGINE_ROOT:work.program}});
    assert.match(report,/fail 0/);writeFileSync(destination,report,{flag:'wx'});
  }else{
    const local=join(work.program,'parcours.mjs');
    copyFileSync(new URL('parcours.mjs',import.meta.url),local);
    const {run}=await import(pathToFileURL(local));
    writeFileSync(destination,JSON.stringify({sha,group,cases:await run(group,gameRoot)})+'\n',{flag:'wx'});
  }
}finally{work.close();}
