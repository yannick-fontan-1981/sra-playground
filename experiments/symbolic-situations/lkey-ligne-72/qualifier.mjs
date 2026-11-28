import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {copyFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {mount} from '../ls19-ligne-90/montage.mjs';

const [version,vendor,out]=process.argv.slice(2);
const versions={gel:'d0e7527ca8033bd805a6d7a8bb021eff62e87021',candidat:'d67284e820e8d1987da055096732fc257c679f3f'};
assert.ok(Object.hasOwn(versions,version));
const transport='01f8fd39e4f0813cdb273b4914d9d1cdc6a74b9b';
const work=mount(versions[version],'.');
try{
  const git=execFileSync('git',['rev-parse','--show-toplevel'],{encoding:'utf8'}).trim();
  const tar=join(work.program,'qualification.tar'),base='experiments/sic-agenda-offres';

  const files=['rejouer-service.mjs','evaluateur-jeu.mjs','frontiere-22-23/game.mjs'].map(f=>base+'/'+f);
  execFileSync('git',['-C',git,'archive','--output='+tar,transport,...files,'public/python']);
  execFileSync('tar',['-xf',tar,'-C',work.program]);
  const local=join(work.program,base,'operateur-lkey.mjs');
  copyFileSync(new URL('parcours.mjs',import.meta.url),local);
  const {play}=await import(pathToFileURL(local));
  mkdirSync(out,{recursive:true});
  for(const arm of ['nominal','sans-relation','sans-mode','ordre-inverse']){
    const r=await play(arm,vendor);
    writeFileSync(join(out,version+'.'+arm+'.json'),JSON.stringify({sha:versions[version],arm,...r})+'\n',{flag:'wx'});
  }
}finally{work.close();}
