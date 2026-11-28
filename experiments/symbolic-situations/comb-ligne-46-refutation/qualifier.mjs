import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,readFileSync,writeFileSync,rmSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';

const [version,vendor,destination]=process.argv.slice(2);
const sha={gel:'d0e7527ca8033bd805a6d7a8bb021eff62e87021',candidat:'24e9743683b22b2256104d9f4de2c84abb1a1de3'};
assert.ok(Object.hasOwn(sha,version));
const git=execFileSync('git',['rev-parse','--show-toplevel'],{encoding:'utf8'}).trim();
const temp=mkdtempSync(join(tmpdir(),'comb-verif-'));
const out=resolve(destination),py=resolve(vendor),dir='experiments/sic-agenda-offres',sub='comb-contre-exemple-46';
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
  edit("locale:10,'locale-contredite':9,ancienne:9,etrangere:4};",
    "locale:10,'locale-contredite':9,ancienne:9,etrangere:4,'locale-incomplete':9};");
  edit("locale:9,'locale-contredite':9,ancienne:9,etrangere:4};",
    "locale:9,'locale-contredite':9,ancienne:9,etrangere:4,'locale-incomplete':9};");
  edit("['locale','locale-contredite','ancienne'].includes(variant)",
    "['locale','locale-contredite','ancienne','locale-incomplete'].includes(variant)");
  edit("const fixtureEdge=direct?[seed.local]:[];","const fixtureEdge=direct?[variant==='locale-incomplete'?seed.partial:seed.local]:[];");
  writeFileSync(worker,script);
  const seedPath=join(temp,'seed.json');
  const shared=join(out,'preuves-candidat.json');
  function replay(arm,seed){
    const path=join(temp,'receipt.json');
    writeFileSync(seedPath,JSON.stringify(seed));
    execFileSync(process.execPath,[worker,'--moteur',version,'--pyodide',py,'--variante',arm,'--amorce',seedPath,'--recu',path],
      {env:{...process.env,SIC_OP_GIT:git},stdio:['ignore','ignore','inherit']});
    const result=JSON.parse(readFileSync(path,'utf8'));
    writeFileSync(join(out,version+'.'+arm+'.json'),JSON.stringify({sha:sha[version],arm,...result})+'\n',{flag:'wx'});
    return result;
  }
  if(version==='candidat'){
    const nominal=replay('nominal',null).steps;
    const c1=replay('capture-n1',null).steps.at(-1).after.record;
    const c2=replay('capture-n2',null).steps.at(-1).after.record;
    const ce=replay('capture-exacte',null).steps.at(-1).after.record;
    const edges=nominal[9].after.record.edges;
    const local=edges.find(e=>e.factor===1&&e.before.toString()==='4,4,11');
    const partial=edges.find(e=>e.factor===1&&e.before.toString()==='9,4,4');
    assert.ok(local&&partial);
    writeFileSync(shared,JSON.stringify({n1:c1,n2:c2,exact:ce,local,partial}));
  }else replay('nominal',null);
  const seed=JSON.parse(readFileSync(shared,'utf8'));
  for(const arm of ['contradiction-n1','contradiction-n2','locale','locale-contredite','ancienne','etrangere','locale-incomplete'])
    replay(arm,seed);
}finally{rmSync(temp,{recursive:true,force:true});}
