import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,readFileSync,writeFileSync,rmSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';

const [engine,vendor,target]=process.argv.slice(2);
const sha={gel:'d0e7527ca8033bd805a6d7a8bb021eff62e87021',candidat:'71e15295d2fd38996147a524e4b0cd63e2991cc5'};
assert.ok(Object.hasOwn(sha,engine));
const root=execFileSync('git',['rev-parse','--show-toplevel'],{encoding:'utf8'}).trim();
const temp=mkdtempSync(join(tmpdir(),'cwse-45-op-'));
const out=resolve(target),py=resolve(vendor);
const dir='experiments/sic-agenda-offres',alt='cwse-45';
mkdirSync(out,{recursive:true});
try{
  const tar=join(temp,'harnais.tar');
  const paths=['evaluateur-jeu.mjs','frontiere-22-23/game.mjs','moteur-reference.mjs',alt+'/operateur.mjs'];
  execFileSync('git',['-C',root,'archive','--output='+tar,sha.candidat,...paths.map(x=>dir+'/'+x)]);
  execFileSync('tar',['-xf',tar,'-C',temp]);
  const launcher=join(temp,dir,'moteur-reference.mjs');
  const transport=readFileSync(launcher,'utf8').replace("const root = new URL('../../', import.meta.url);","const root = process.env.SIC_45_GIT_ROOT;")
    .replace("cwd:fileURLToPath(root)","cwd:root");
  assert.ok(transport.includes("if(name==='candidat') return fn(root);"));
  writeFileSync(launcher,transport.replace("if(name==='candidat') return fn(root);",
    "if(name==='candidat') return withEngine('révision',fn);")+"\nversions.révision='"+sha.candidat+"';\n");
  const worker=join(temp,dir,alt,'operateur.mjs'),local=join(temp,dir,alt,'operateur-indep.mjs');
  let code=readFileSync(worker,'utf8').replaceAll('\r\n','\n');
  const edits=[
    ["'stationnaire','sans-effet'];","'stationnaire','sans-effet','référence','référence-point','station-route'];"],
    ["    }\n    return real;","      if(variant==='référence'&&turn===1||variant==='référence-point'&&turn===3)return foreign;\n    }\n    return real;"],
    ["const replaced=variant==='stationnaire'&&i===1;","const replaced=variant==='stationnaire'&&i===1||variant==='station-route'&&i===13;"],
    ["return {steps,next:issued(),stop:result.reason??null,lastCut:","return {steps,evaluations:[...guards.entries()],next:issued(),stop:result.reason??null,lastCut:"]
  ];
  for(const [a,b] of edits){assert.equal(code.split(a).length,2);code=code.replace(a,b);}
  writeFileSync(local,code);
  const arms=[['nominal',16],['priorite',2],['stationnaire',1],['sans-effet',4,'--tour','2','--commande','ACTION4'],
    ['référence',1],['référence-point',3],['station-route',13]];
  for(const [arm,limit,...extra] of arms){
    const file=join(temp,'receipt.json');
    execFileSync(process.execPath,[local,'--moteur',engine,'--pyodide',py,'--variante',arm,'--gestes',String(limit),...extra,'--recu',file],
      {env:{...process.env,SIC_45_GIT_ROOT:root},stdio:['ignore','ignore','inherit']});
    writeFileSync(join(out,engine+'.'+arm+'.json'),JSON.stringify({sha:sha[engine],arm,...JSON.parse(readFileSync(file,'utf8'))})+'\n',{flag:'wx'});
  }
}finally{rmSync(temp,{recursive:true,force:true});}
