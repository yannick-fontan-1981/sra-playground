import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {mount} from '../ls19-ligne-90/montage.mjs';

const [sha,group,vendor,out]=process.argv.slice(2);
const gel='d0e7527ca8033bd805a6d7a8bb021eff62e87021',proof='6bfb8ccf9df3aa8597e74f0fd3f30a5744c55b35';
assert.ok([gel,proof].includes(sha));const m=mount(sha,'.');
try{
  const repo=execFileSync('git',['rev-parse','--show-toplevel'],{encoding:'utf8'}).trim();
  const head='experiments/sic-agenda-offres/',prefix=head+'regn-80/',base=pathToFileURL(m.program+'/');
  for(const [rev,files] of [[sha,['public/python']],[proof,[prefix,head+'frontiere-22-23/game.mjs',head+'evaluateur-jeu.mjs',head+'moteur-reference.mjs']]]){
    const tar=join(m.program,'export.tar');execFileSync('git',['-C',repo,'archive','--output='+tar,rev,...files]);execFileSync('tar',['-xf',tar,'-C',m.program]);
  }
  if(group==='auteur'){
    assert.equal(sha,proof);
    const privateGit=join(m.program,'reference.git');execFileSync('git',['clone','--bare','--quiet','--shared',repo,privateGit]);
    execFileSync('git',['--git-dir='+privateGit,'update-ref','--no-deref','HEAD',sha]);
    execFileSync(process.execPath,[join(m.program,prefix+'verifier.mjs'),'--pyodide',vendor,'--recu',out],{
      cwd:m.program,env:{...process.env,GIT_DIR:privateGit,GIT_WORK_TREE:m.program},timeout:1200000});
  }else{
    const {play}=await import(new URL(prefix+'operateur.mjs',base));
    const sets={budget:[['nominal',16,16],['large',16,600]],n1:[['retour3',6,16,3,'retirer_retour'],['question3',6,16,3,'retirer_questions']],
      n2:[['retour8',11,16,8,'retirer_retour'],['question8',11,16,8,'retirer_questions']]};
    assert.ok(sets[group]);const results={};
    for(const [name,gestes,budget,turn,type] of sets[group]){
      const card={version:'sic.regn/1',gestes,budget,...(turn?{intervention:{geste:turn,type}}:{})};
      results[name]={card,...await play(base.href,card,vendor)};
      console.log(JSON.stringify([name,results[name].steps.length,results[name].stop]));
    }
    writeFileSync(out,JSON.stringify({sha,results})+'\n',{flag:'wx'});
  }
}finally{m.close();}
