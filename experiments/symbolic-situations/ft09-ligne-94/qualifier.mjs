import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,readFileSync,writeFileSync,rmSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';

const [engine,vendor,target]=process.argv.slice(2);
const sha={gel:'d0e7527ca8033bd805a6d7a8bb021eff62e87021',candidat:'d0348ec1f1646259b9c95f0fa4a44dd0bb966025'};
assert.ok(Object.hasOwn(sha,engine));
const root=execFileSync('git',['rev-parse','--show-toplevel'],{encoding:'utf8'}).trim();
const temp=mkdtempSync(join(tmpdir(),'ft09-94-op-'));
const out=resolve(target),py=resolve(vendor);
const dir='experiments/sic-agenda-offres',alt='ft09-94';
mkdirSync(out,{recursive:true});
try{
  const tar=join(temp,'harnais.tar');
  const paths=['evaluateur-jeu.mjs','frontiere-22-23/game.mjs','moteur-reference.mjs',alt+'/operateur.mjs'];
  execFileSync('git',['-C',root,'archive','--output='+tar,sha.candidat,...paths.map(x=>dir+'/'+x)]);
  execFileSync('tar',['-xf',tar,'-C',temp]);
  const launcher=join(temp,dir,'moteur-reference.mjs');
  const transport=readFileSync(launcher,'utf8').replace("const root = new URL('../../', import.meta.url);","const root = process.env.SIC_94_GIT_ROOT;")
    .replace("cwd:fileURLToPath(root)","cwd:root");
  assert.ok(transport.includes("if(name==='candidat') return fn(root);"));
  writeFileSync(launcher,transport.replace("if(name==='candidat') return fn(root);",
    "if(name==='candidat') return withEngine('révision',fn);")+"\nversions.révision='"+sha.candidat+"';\n");
  const worker=join(temp,dir,alt,'operateur.mjs'),local=join(temp,dir,alt,'operateur-indep.mjs');
  let code=readFileSync(worker,'utf8').replaceAll('\r\n','\n');
  const edits=[
    ["'stationnaire','un-seul-effet'];","'stationnaire','un-seul-effet','sans-projection','fenêtre-2','fenêtre-3','fenêtre-4'];"],
    ["turn===1&&variant==='une-fenetre'?fields","turn===1&&(variant==='une-fenetre'||variant.startsWith('fenêtre-'))?fields"],
    ["const [kept]=f.groups.flatMap","const candidates=f.groups.flatMap"],
    [".map(([k])=>k)).sort();",".map(([k])=>k)).sort();\n      const kept=candidates[variant==='une-fenetre'?0:Number(variant.at(-1))-1];"],
    ["const replace=variant==='stationnaire'&&i===1;","const replace=variant==='stationnaire'&&i===1||variant==='sans-projection'&&i===3;"]
  ];
  for(const [a,b] of edits){assert.equal(code.split(a).length,2);code=code.replace(a,b);}
  writeFileSync(local,code);
  for(const arm of ['nominal','une-fenetre','fenêtre-2','fenêtre-3','fenêtre-4','sans-adresse','stationnaire','un-seul-effet','sans-projection']){
    const extra=arm==='sans-adresse'?['--point','38,38']:[];
    const file=join(temp,'receipt.json');
    execFileSync(process.execPath,[local,'--moteur',engine,'--pyodide',py,'--variante',arm,...extra,'--recu',file],
      {env:{...process.env,SIC_94_GIT_ROOT:root},stdio:['ignore','ignore','inherit']});
    writeFileSync(join(out,engine+'.'+arm+'.json'),JSON.stringify({sha:sha[engine],arm,...JSON.parse(readFileSync(file,'utf8'))})+'\n',{flag:'wx'});
  }
}finally{rmSync(temp,{recursive:true,force:true});}
