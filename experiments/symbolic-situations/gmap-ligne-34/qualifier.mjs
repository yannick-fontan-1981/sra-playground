import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,readFileSync,writeFileSync,rmSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';

const [engine,vendor,target,only]=process.argv.slice(2);
const sha={gel:'d0e7527ca8033bd805a6d7a8bb021eff62e87021',candidat:'9c71cd820b59ef3456455b637a0a062abe1d03d0'};
assert.ok(Object.hasOwn(sha,engine));
const root=execFileSync('git',['rev-parse','--show-toplevel'],{encoding:'utf8'}).trim();
const temp=mkdtempSync(join(tmpdir(),'gmap-34-op-'));
const out=resolve(target),py=resolve(vendor);
const dir='experiments/sic-agenda-offres',alt='gmap-34';
mkdirSync(out,{recursive:true});
try{
  const tar=join(temp,'harnais.tar');
  const paths=['evaluateur-jeu.mjs','frontiere-22-23/game.mjs','moteur-reference.mjs',alt+'/operateur.mjs',alt+'/contraste.mjs'];
  execFileSync('git',['-C',root,'archive','--output='+tar,sha.candidat,...paths.map(x=>dir+'/'+x),'docs/migration/lot9a-evidence/reference-01/reference.json.gz']);
  execFileSync('tar',['-xf',tar,'-C',temp]);
  const launcher=join(temp,dir,'moteur-reference.mjs');
  const transport=readFileSync(launcher,'utf8').replace("const root = new URL('../../', import.meta.url);","const root = process.env.SIC_34_GIT_ROOT;")
    .replace("cwd:fileURLToPath(root)","cwd:root");
  assert.ok(transport.includes("if(name==='candidat') return fn(root);"));
  writeFileSync(launcher,transport.replace("if(name==='candidat') return fn(root);",
    "if(name==='candidat') return withEngine('révision',fn);")+"\nversions.révision='"+sha.candidat+"';\n");
  const worker=join(temp,dir,alt,'operateur.mjs'),local=join(temp,dir,alt,'operateur-indep.mjs');
  let code=readFileSync(worker,'utf8').replaceAll('\r\n','\n');
  const edits=[
    ["'sans-localisation','sans-permission'];","'sans-localisation','sans-permission','inverse-localisation','inverse-commune','inverse-cohérente'];"],
    ["uncertain=turn===2&&variant==='sans-localisation'","uncertain=turn===2&&['sans-localisation','inverse-localisation'].includes(variant),inverse=turn===5&&['inverse-commune','inverse-cohérente'].includes(variant)"],
    ["this.positions=[this.chart.origin,...this.positions];","this.positions=variant==='inverse-localisation'?[...this.positions,this.chart.origin]:[this.chart.origin,...this.positions];"],
    ["    if(permission){","    if(inverse){assert.equal(this.positions.length,2);this.positions=[...this.positions].reverse();}\n    if(permission){"],
    ["if(uncertain)Object.assign","if(uncertain||inverse)Object.assign"],
    ["variant==='sans-permission'?4:3","variant==='sans-permission'?4:variant.startsWith('inverse-')&&variant!=='inverse-localisation'?5:3"],
    ["    const live=before.call(this,p,i,packet,obs);",
      "    const original=this.positions;\n    if(turn===5&&variant==='inverse-cohérente')this.positions=[...original].reverse();\n    try{\n    const live=before.call(this,p,i,packet,obs);"],
    ["    return live;","    return live;\n    }finally{this.positions=original;}"],
    ["return {steps,stop:r.reason??null,next:issued()};",
      "return {steps,stop:r.reason??null,next:issued(),lastCut:[...cuts.values()].at(-1)??null,lastCheck:[...checks.entries()].at(-1)??null};"]
  ];
  for(const [a,b] of edits){assert.equal(code.split(a).length,2);code=code.replace(a,b);}
  writeFileSync(local,code);
  const contrast=join(temp,dir,alt,'contraste-indep.mjs');
  writeFileSync(contrast,`import {publicContrast} from './contraste.mjs';
import {withEngine} from '../moteur-reference.mjs';
const result=await withEngine(process.argv[2],publicContrast);
console.log(JSON.stringify(result));\n`);
  if(!only){
    const receipt=execFileSync(process.execPath,[contrast,engine],{env:{...process.env,SIC_34_GIT_ROOT:root},encoding:'utf8'});
    writeFileSync(join(out,engine+'.contraste.json'),receipt,{flag:'wx'});
  }
  const arms=['nominal','sans-repere','stationnaire','sans-localisation','inverse-localisation','sans-permission','inverse-commune','inverse-cohérente'];
  const selected=only?.split(',')??arms;
  assert.ok(selected.every(arm=>arms.includes(arm)));
  for(const arm of selected){
    const file=join(temp,'receipt.json');
    execFileSync(process.execPath,[local,'--moteur',engine,'--pyodide',py, '--variante',arm,'--recu',file],
      {env:{...process.env,SIC_34_GIT_ROOT:root},stdio:['ignore','ignore','inherit']});
    writeFileSync(join(out,engine+'.'+arm+'.json'),JSON.stringify({sha:sha[engine],arm,...JSON.parse(readFileSync(file,'utf8'))})+'\n',{flag:'wx'});
  }
}finally{rmSync(temp,{recursive:true,force:true});}
