import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {mount} from '../ls19-ligne-90/montage.mjs';

const [sha,group,gameRoot,out]=process.argv.slice(2);
const parent='f710f2e13f252ca0ec1b7de7e25768e13a5e5bf4',candidat='51d983a7243289d2ebb2cef365dd536cbeaf59b1';
assert.ok([parent,candidat].includes(sha));
const work=mount(sha,'.');
try{
  const repo=execFileSync('git',['rev-parse','--show-toplevel'],{encoding:'utf8'}).trim();
  const tar=join(work.program,'qualification.tar'),test='tests/sic-keyd-line-38.test.ts';
  execFileSync('git',['-C',repo,'archive','--output='+tar,candidat,'scripts/sic-study-source-games.mjs',test]);
  execFileSync('tar',['-xf',tar,'-C',work.program]);
  if(group==='auteur'){
    const report=execFileSync(process.execPath,['--test',test],{cwd:work.program,encoding:'utf8',
      env:{...process.env,SIC_KEYD_GAME_ROOT:gameRoot,SIC_KEYD_ENGINE_ROOT:work.program}});
    assert.match(report,/fail 0/);
    writeFileSync(out,report,{flag:'wx'});
  }else{
    let path='experiments/symbolic-situations/skbn-ligne-38/parcours.mjs';
    let source=execFileSync('git',['-C',repo,'show','4efefe02:'+path],{encoding:'utf8'}).replaceAll('\r\n','\n');
    function edit(a,b){
      assert.equal(source.split(a).length,2);
      source=source.replace(a,b);
    }
    edit("['sansAccès','preuveÉtrangère','sansSignature'].includes(name)",
      "['sansAccès','preuveÉtrangère','finÉtrangère'].includes(name)");
    edit("    const target=name==='sansSignature'?6:9;","    const target=9;");
    edit('      const changed=[previous,premature];',
      "      const changed=name==='finÉtrangère'?[premature,rows.at(-3).ticket.ref]:[previous,premature];");
    edit('evidence:changed,before:previous,after:premature','evidence:changed,before:changed[0],after:changed[1]');
    edit("[['sansSignature',6],['sansAccès',9],['preuveÉtrangère',9]]",
      "[['sansAccès',10],['preuveÉtrangère',10],['finÉtrangère',10]]");
    const local=join(work.program,'parcours.mjs');
    writeFileSync(local,source);
    const {run}=await import(pathToFileURL(local));
    writeFileSync(out,JSON.stringify({sha,group,cases:await run(group,gameRoot)})+'\n',{flag:'wx'});
  }
}finally{work.close();}
