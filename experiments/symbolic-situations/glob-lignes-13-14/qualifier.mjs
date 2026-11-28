import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { mount } from '../ls19-ligne-90/montage.mjs';
import { animation, readSelection } from './animation.mjs';

const [sha,group,vendor,out,privateFile] = process.argv.slice(2);
const base='d0e7527ca8033bd805a6d7a8bb021eff62e87021', candidate='48aae7fc05ed8d8409b1aa3a05efa4fa9c65c06d';
assert.ok([base,candidate].includes(sha));
const suite={
  décisions:['nominal','reference','inertie','dependance','acces'],
  placement:['placement','cible'],
  réserve:['bornes','palier'],
};
assert.ok(suite[group]);
const registration = group==='réserve' ? readSelection(privateFile) : null;
const mountPoint=mount(sha,'.');
const repo=execFileSync('git',['rev-parse','--show-toplevel'],{encoding:'utf8'}).trim();
const basePath='experiments/sic-agenda-offres/', tranche=basePath+'glob-13-14/';
try {
  const archive=join(mountPoint.program,'operator.tar');
  execFileSync('git',['-C',repo,'archive','--output='+archive,candidate,basePath+'evaluateur-jeu.mjs',
    basePath+'frontiere-22-23/game.mjs',basePath+'moteur-reference.mjs',tranche,'public/python']);
  execFileSync('tar',['-xf',archive,'-C',mountPoint.program]);
  const path=join(mountPoint.program,tranche,'operateur.mjs');
  // Seule la présentation du retour et la référence de contrôle varient dans le transport opérateur.
  function replaceOnce(source,anchor,substitution){
    assert.equal(source.split(anchor).length,2);
    return source.replace(anchor,substitution);
  }
  let program=readFileSync(path,'utf8');
  program=replaceOnce(program,'after:{ref:e?.observation_ref','after:{ticket:ticket.id,family:e?.family,ref:e?.observation_ref');
  program=replaceOnce(program,"pending.ref+'-etranger'","steps[1].pre.ref");
  const anchor="if(act==='image_finale') next.frames=[next.frame];";
  program=replaceOnce(program,anchor,anchor+"\n      if(i===3 && card.variante) next.frames=globalThis.presentationOperateur(next.frames,card.variante);");
  const instrumented=join(mountPoint.program,tranche,'presentation-operateur.mjs');
  writeFileSync(instrumented,program);
  globalThis.presentationOperateur=(frames,variant)=>{
    const result=animation(frames,variant,registration);
    assert.equal(result.length,frames.length);
    assert.deepEqual(result[0],frames[0]);assert.deepEqual(result.at(-1),frames.at(-1));
    return result;
  };
  const {play,readCard}=await import(pathToFileURL(instrumented));
  const engine=pathToFileURL(mountPoint.program+'/').href;
  const results={};
  for(const name of suite[group]){
    const variant=group==='réserve';
    const card=await readCard(join(mountPoint.program,tranche,'public', (variant?'nominal':name)+'.json'));
    if(variant){card.variante=name;card.gestes=5;}
    results[name]=await play(engine,card,vendor);
  }
  writeFileSync(out,JSON.stringify({sha,group,results})+'\n',{flag:'wx'});
} finally {
  delete globalThis.presentationOperateur;
  mountPoint.close();
}
