import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,readFileSync,writeFileSync,rmSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';

const [version,vendor,destination]=process.argv.slice(2);
const sha={gel:'d0e7527ca8033bd805a6d7a8bb021eff62e87021',candidat:'01f8fd39e4f0813cdb273b4914d9d1cdc6a74b9b'};
assert.ok(Object.hasOwn(sha,version));
const git=execFileSync('git',['rev-parse','--show-toplevel'],{encoding:'utf8'}).trim();
const temp=mkdtempSync(join(tmpdir(),'recr-70-verif-'));
const out=resolve(destination),py=resolve(vendor),dir='experiments/sic-agenda-offres',sub='recr-70';
mkdirSync(out,{recursive:true});
try{
  const tar=join(temp,'ops.tar');
  const files=['rejouer-service.mjs','evaluateur-jeu.mjs','frontiere-22-23/game.mjs','moteur-reference.mjs',sub+'/operateur.mjs'];
  execFileSync('git',['-C',git,'archive','--output='+tar,sha.candidat,...files.map(x=>dir+'/'+x)]);
  execFileSync('tar',['-xf',tar,'-C',temp]);
  const transport=join(temp,dir,'moteur-reference.mjs');
  const launcher=readFileSync(transport,'utf8').replace("const root = new URL('../../', import.meta.url);","const root = process.env.SIC_OP_GIT;")
    .replace('cwd:fileURLToPath(root)','cwd:root');
  assert.ok(launcher.includes("if(name==='candidat') return fn(root);"));
  writeFileSync(transport,launcher.replace("if(name==='candidat') return fn(root);",
    "if(name==='candidat') return withEngine('révision',fn);")+"\nversions.révision='"+sha.candidat+"';\n");
  const worker=join(temp,dir,sub,'operateur.mjs');
  let script=readFileSync(worker,'utf8').replaceAll('\r\n','\n');
  function edit(oldText,newText){
    assert.equal(script.split(oldText).length,2);
    script=script.replace(oldText,newText);
  }
  edit("'ordre-permute','sans-ajout'].includes(values.variante)",
    "'ordre-permute','sans-ajout','permutation-jouee'].includes(values.variante)");
  edit("limit:variant==='nominal'?16:target,", "limit:variant==='nominal'?16:variant==='permutation-jouee'?target+1:target,");
  writeFileSync(worker,script);
  const arms=[['nominal',2],['ordre-permute',2],['permutation-jouee',2],['sans-ajout',2]];
  for(const [arm,tour] of arms){
    const path=join(temp,'receipt.json');
    execFileSync(process.execPath,[worker,'--moteur',version,'--pyodide',py,'--variante',arm,'--tour',String(tour),'--recu',path],
      {env:{...process.env,SIC_OP_GIT:git},stdio:['ignore','ignore','inherit']});
    writeFileSync(join(out,version+'.'+arm+'.json'),JSON.stringify({sha:sha[version],arm,...JSON.parse(readFileSync(path,'utf8'))})+'\n',{flag:'wx'});
  }
}finally{rmSync(temp,{recursive:true,force:true});}
