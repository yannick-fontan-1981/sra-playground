import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,readFileSync,writeFileSync,rmSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';

const [engine,vendor,target]=process.argv.slice(2);
const sha={gel:'d0e7527ca8033bd805a6d7a8bb021eff62e87021',candidat:'fab19fba7cc5e5ac5cd79da53c81fb3ab23b492a'};
assert.ok(Object.hasOwn(sha,engine));
const root=execFileSync('git',['rev-parse','--show-toplevel'],{encoding:'utf8'}).trim();
const temp=mkdtempSync(join(tmpdir(),'weav-43-op-'));
const out=resolve(target),py=resolve(vendor);
const dir='experiments/sic-agenda-offres',alt='weav-43';
mkdirSync(out,{recursive:true});
try{
  const tar=join(temp,'harnais.tar');
  const paths=['evaluateur-jeu.mjs','frontiere-22-23/game.mjs','moteur-reference.mjs',alt+'/operateur.mjs'];
  execFileSync('git',['-C',root,'archive','--output='+tar,sha.candidat,...paths.map(x=>dir+'/'+x)]);
  execFileSync('tar',['-xf',tar,'-C',temp]);
  const launcher=join(temp,dir,'moteur-reference.mjs');
  const transport=readFileSync(launcher,'utf8').replace("const root = new URL('../../', import.meta.url);","const root = process.env.SIC_43_GIT_ROOT;")
    .replace("cwd:fileURLToPath(root)","cwd:root");
  assert.ok(transport.includes("if(name==='candidat') return fn(root);"));
  writeFileSync(launcher,transport.replace("if(name==='candidat') return fn(root);",
    "if(name==='candidat') return withEngine('révision',fn);")+"\nversions.révision='"+sha.candidat+"';\n");
  const worker=join(temp,dir,alt,'operateur.mjs'),local=join(temp,dir,alt,'operateur-indep.mjs');
  let code=readFileSync(worker,'utf8').replaceAll('\r\n','\n');
  const edits=[
    ["'sans-paire'];","'sans-paire','ancienne-référence'];"],
    ["noPair=turn===selectedTurn&&variant==='sans-paire';",
      "noPair=turn===selectedTurn&&variant==='sans-paire',wrong=turn===selectedTurn&&variant==='ancienne-référence';"],
    ["    if(noPair){assert.equal(pairs.length,1);this.pairs=[];}","    if(noPair){assert.equal(pairs.length,1);this.pairs=[];}\n"+
      "    if(wrong){assert.equal(pairs.length,1);assert.ok(firstAdvance&&!pairs[0].evidence.includes(firstAdvance.ref));\n"+
      "      this.pairs=[{...pairs[0],evidence:[firstAdvance.ref,...pairs[0].evidence.slice(1)]}];}"],
    ["if(noPair)this.pairs=pairs;","if(noPair||wrong)this.pairs=pairs;"],
    ["variant==='nominal'?16:variant==='stationnaire'?selectedTurn:selectedTurn-1","variant==='nominal'?16:selectedTurn"]
  ];
  for(const [a,b] of edits){assert.equal(code.split(a).length,2);code=code.replace(a,b);}
  writeFileSync(local,code);
  const arms=[['nominal','nominal',1],['stationnaire-t1','stationnaire',1],['stationnaire-t2','stationnaire',2],
    ['sans-progression','sans-progression',3],['sans-paire','sans-paire',7],['ancienne-référence','ancienne-référence',7]];
  for(const [arm,variant,turn] of arms){
    const extra=['--tour',String(turn)];
    const file=join(temp,'receipt.json');
    execFileSync(process.execPath,[local,'--moteur',engine,'--pyodide',py,'--variante',variant,...extra,'--recu',file],
      {env:{...process.env,SIC_43_GIT_ROOT:root},stdio:['ignore','ignore','inherit']});
    writeFileSync(join(out,engine+'.'+arm+'.json'),JSON.stringify({sha:sha[engine],arm,...JSON.parse(readFileSync(file,'utf8'))})+'\n',{flag:'wx'});
  }
}finally{rmSync(temp,{recursive:true,force:true});}
