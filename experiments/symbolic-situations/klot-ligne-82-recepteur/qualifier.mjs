import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {mount} from '../ls19-ligne-90/montage.mjs';

const [sha,group,gameRoot,destination]=process.argv.slice(2);
const parent='03fba8c827c9a4725d1fda343695fe6e9fbb533d',candidat='37983796259ab45f3366364896a72c55752e332d';
assert.ok([parent,candidat].includes(sha));
const work=mount(sha,'.');
try{
  const repo=execFileSync('git',['rev-parse','--show-toplevel'],{encoding:'utf8'}).trim();
  const tar=join(work.program,'qualification.tar'),test='tests/sic-klot-line-82.test.ts';
  execFileSync('git',['-C',repo,'archive','--output='+tar,candidat,'scripts/sic-study-source-games.mjs',test]);
  execFileSync('tar',['-xf',tar,'-C',work.program]);
  if(group==='auteur'){
    const report=execFileSync(process.execPath,['--test',test],{cwd:work.program,encoding:'utf8',
      env:{...process.env,SIC_KLOT_GAME_ROOT:gameRoot,SIC_KLOT_ENGINE_ROOT:work.program}});
    assert.match(report,/fail 0/);
    writeFileSync(destination,report,{flag:'wx'});
  }else{
    const path='experiments/symbolic-situations/klot-ligne-82/parcours.mjs';
    let source=execFileSync('git',['-C',repo,'show','575d1cbe:'+path],{encoding:'utf8'}).replaceAll('\r\n','\n');
    const edit=(a,b)=>{assert.equal(source.split(a).length,2);source=source.replace(a,b);};
    edit('moveOther(game,stock,current,plan,direction)','moveOther(game,stock,current,plan,direction,turn)');
    edit('stock.slice(0,7)','stock.slice(0,turn-2)');
    edit("name==='autreRécepteur'){","name.startsWith('autreRécepteur')){");
    edit('moveOther(game,stock,prior,plan,previous.actionRef)',
      'moveOther(game,stock,prior,plan,previous.actionRef,i)');
    edit("      let reply=await service.handle","      if(i===target&&name==='deuxPasBonsujet'){\n"+
      "        assert.equal(previous.actionRef,'ACTION1');\n"+
      "        const actual=action(game,previous);\n"+
      "        shown=toV6PublicObservation(actual,i);\n"+
      "        alternate={expected:plan.scene.bodies[plan.active].key,extra:previous.actionRef};\n"+
      "      }\n      let reply=await service.handle");
    edit("['autreRécepteur',9,9]","['autreRécepteur7',7,7],['autreRécepteur9',9,9],['deuxPasBonsujet',7,7]");
    const local=join(work.program,'parcours.mjs');
    writeFileSync(local,source);
    const {run}=await import(pathToFileURL(local));
    writeFileSync(destination,JSON.stringify({sha,group,cases:await run(group,gameRoot)})+'\n',{flag:'wx'});
  }
}finally{work.close();}
