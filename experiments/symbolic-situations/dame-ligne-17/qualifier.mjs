import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,readFileSync,writeFileSync,rmSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';

const [version,vendor,destination]=process.argv.slice(2);
const sha={gel:'d0e7527ca8033bd805a6d7a8bb021eff62e87021',candidat:'775f40c5505add040d3b1c1aac5aba8d0dd0a027'};
assert.ok(Object.hasOwn(sha,version));
const git=execFileSync('git',['rev-parse','--show-toplevel'],{encoding:'utf8'}).trim();
const temp=mkdtempSync(join(tmpdir(),'dame-17-verif-'));
const out=resolve(destination),py=resolve(vendor),dir='experiments/sic-agenda-offres',sub='dame-17';
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
  edit("'victime-preservee'].includes(values.variante)",
    "'victime-preservee','sans-relation-n1','sans-relation-n2'].includes(values.variante)");
  edit("    const p=await propose.call(this,obs,rows,inputs,limit);",
    "    const remove=variant==='sans-relation-n1'&&obs.revision===3||variant==='sans-relation-n2'&&obs.revision===8;\n"+
    "    const saved=this.relations;\n"+
    "    if(remove){assert.ok(Object.keys(saved).length);this.relations={};}\n"+
    "    cut.relationsServies=remove?{}:pre.memory.relations;\n"+
    "    let p;\n"+
    "    try{p=await propose.call(this,obs,rows,inputs,limit);}finally{if(remove)this.relations=saved;}");
  edit("['sans-invitation','une-invitation'].includes(variant)?1:2,reprise:true",
    "variant==='sans-relation-n2'?9:variant==='sans-relation-n1'?3:['sans-invitation','une-invitation'].includes(variant)?2:3,reprise:true");
  const arms=['nominal','une-invitation','sans-invitation','victime-preservee','sans-relation-n1','sans-relation-n2'];
  writeFileSync(worker,script);
  for(const arm of arms){
    const path=join(temp,'receipt.json');
    execFileSync(process.execPath,[worker,'--moteur',version,'--pyodide',py,'--variante',arm,'--recu',path],
      {env:{...process.env,SIC_OP_GIT:git},stdio:['ignore','ignore','inherit']});
    writeFileSync(join(out,version+'.'+arm+'.json'),JSON.stringify({sha:sha[version],arm,...JSON.parse(readFileSync(path,'utf8'))})+'\n',{flag:'wx'});
  }
}finally{rmSync(temp,{recursive:true,force:true});}
