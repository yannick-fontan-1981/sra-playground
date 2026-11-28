import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,readFileSync,writeFileSync,rmSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';

const [engine,vendor,target]=process.argv.slice(2);
const sha={gel:'d0e7527ca8033bd805a6d7a8bb021eff62e87021',candidat:'dfc144ce46139e887d0f48fff9ae3ac2d42d3c3d'};
assert.ok(Object.hasOwn(sha,engine));
const root=execFileSync('git',['rev-parse','--show-toplevel'],{encoding:'utf8'}).trim();
const temp=mkdtempSync(join(tmpdir(),'pola-33-op-'));
const out=resolve(target),py=resolve(vendor);
const dir='experiments/sic-agenda-offres',alt='pola-33';
mkdirSync(out,{recursive:true});
try{
  const tar=join(temp,'harnais.tar');
  const paths=['evaluateur-jeu.mjs','frontiere-22-23/game.mjs','moteur-reference.mjs',alt+'/operateur.mjs',alt+'/contraste.mjs'];
  execFileSync('git',['-C',root,'archive','--output='+tar,sha.candidat,...paths.map(x=>dir+'/'+x),'tests/fixtures/v6-axial-question-reference.json.gz']);
  execFileSync('tar',['-xf',tar,'-C',temp]);
  const launcher=join(temp,dir,'moteur-reference.mjs');
  const transport=readFileSync(launcher,'utf8').replace("const root = new URL('../../', import.meta.url);","const root = process.env.SIC_33_GIT_ROOT;")
    .replace("cwd:fileURLToPath(root)","cwd:root");
  assert.ok(transport.includes("if(name==='candidat') return fn(root);"));
  writeFileSync(launcher,transport.replace("if(name==='candidat') return fn(root);",
    "if(name==='candidat') return withEngine('révision',fn);")+"\nversions.révision='"+sha.candidat+"';\n");
  const worker=join(temp,dir,alt,'operateur.mjs'),local=join(temp,dir,alt,'operateur-indep.mjs');
  let code=readFileSync(worker,'utf8').replaceAll('\r\n','\n');
  const edits=[
    ["'stationnaire','sans-methode'];","'stationnaire','sans-methode','stationnaire-n2'];"],
    ["variant==='stationnaire'?4:variant", "variant==='stationnaire'?4:variant==='stationnaire-n2'?8:variant"],
    ["const replace=variant==='stationnaire'&&i===4;","const replace=variant==='stationnaire'&&i===4||variant==='stationnaire-n2'&&i===8;"]
  ];
  for(const [a,b] of edits){assert.equal(code.split(a).length,2);code=code.replace(a,b);}
  writeFileSync(local,code);
  const contrast=join(temp,dir,alt,'contraste-indep.mjs');
  writeFileSync(contrast,`import {publicContrast} from './contraste.mjs';
import {withEngine} from '../moteur-reference.mjs';
const result=await withEngine(process.argv[2],publicContrast);
console.log(JSON.stringify(result));\n`);
  const receipt=execFileSync(process.execPath,[contrast,engine],{env:{...process.env,SIC_33_GIT_ROOT:root},encoding:'utf8'});
  writeFileSync(join(out,engine+'.contraste.json'),receipt,{flag:'wx'});
  for(const arm of ['nominal','sans-attestation','axe-perpendiculaire','stationnaire','sans-methode','stationnaire-n2']){
    const extra=arm==='axe-perpendiculaire'?['--pair','41,25']:[];
    const file=join(temp,'receipt.json');
    execFileSync(process.execPath,[local,'--moteur',engine,'--pyodide',py, '--variante',arm,...extra,'--recu',file],
      {env:{...process.env,SIC_33_GIT_ROOT:root},stdio:['ignore','ignore','inherit']});
    writeFileSync(join(out,engine+'.'+arm+'.json'),JSON.stringify({sha:sha[engine],arm,...JSON.parse(readFileSync(file,'utf8'))})+'\n',{flag:'wx'});
  }
}finally{rmSync(temp,{recursive:true,force:true});}
