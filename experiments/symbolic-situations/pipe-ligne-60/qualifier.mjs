import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {copyFileSync,mkdtempSync,readFileSync,writeFileSync,rmSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';

const [sha,vendor,destination,group='complet']=process.argv.slice(2);
assert.match(sha,/^[0-9a-f]{40}$/);
const repo=execFileSync('git',['rev-parse','--show-toplevel'],{encoding:'utf8'}).trim();
assert.equal(execFileSync('git',['rev-parse',sha+'^{commit}'],{encoding:'utf8'}).trim(),sha);
const temp=mkdtempSync(join(tmpdir(),'pipe-verif-')),out=resolve(destination),py=resolve(vendor);
const dir='experiments/sic-agenda-offres',transportSource='b8902646b6c968f78e5512f62d1d641b0bd20dd0';
mkdirSync(out,{recursive:true});
try{
  const tar=join(temp,'ops.tar');
  const files=['rejouer-service.mjs','evaluateur-jeu.mjs','frontiere-22-23/game.mjs','moteur-reference.mjs'];
  execFileSync('git',['-C',repo,'archive','--output='+tar,transportSource,...files.map(x=>dir+'/'+x)]);
  execFileSync('tar',['-xf',tar,'-C',temp]);
  const launcher=join(temp,dir,'moteur-reference.mjs');
  const mount=readFileSync(launcher,'utf8').replace("const root = new URL('../../', import.meta.url);","const root = process.env.SIC_PIPE_REPO;")
    .replace('cwd:fileURLToPath(root)','cwd:root');
  writeFileSync(launcher,mount+"\nversions.revision='"+sha+"';\n");
  const relay=join(temp,dir,'rejouer-service.mjs');
  const run=readFileSync(relay,'utf8');
  assert.equal(run.split('const shown=present(').length,2);
  writeFileSync(relay,run.replace('const shown=present(','const shown=await present('));
  const worker=join(temp,dir,'parcours.mjs');
  copyFileSync(new URL('parcours.mjs',import.meta.url),worker);
  const sets={nominal:['nominal'],variantes:['stationnaire','autrePièce','sansMéthode','preuveÉtrangère'],
    prolongation:['extérieur']};
  const arms=group==='complet'?Object.values(sets).flat():sets[group];
  assert.ok(arms);
  for(const arm of arms){
    const file=join(temp,'receipt.json');
    execFileSync(process.execPath,[worker,arm,py,file],{env:{...process.env,SIC_PIPE_REPO:repo},stdio:['ignore','ignore','inherit']});
    writeFileSync(join(out,sha.slice(0,8)+'.'+arm+'.json'),JSON.stringify({sha,arm,...JSON.parse(readFileSync(file,'utf8'))})+'\n',{flag:'wx'});
  }
}finally{rmSync(temp,{recursive:true,force:true});}
