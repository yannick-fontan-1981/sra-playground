import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,readFileSync,writeFileSync,rmSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';

const [version,vendor,destination]=process.argv.slice(2);
const sha={gel:'d0e7527ca8033bd805a6d7a8bb021eff62e87021',candidat:'4f39c40869cdb3c2881d4fef01d3a7eafaf196dd'};
assert.ok(Object.hasOwn(sha,version));
const git=execFileSync('git',['rev-parse','--show-toplevel'],{encoding:'utf8'}).trim();
const temp=mkdtempSync(join(tmpdir(),'hole-74-verif-'));
const out=resolve(destination),py=resolve(vendor),dir='experiments/sic-agenda-offres',sub='hole-74';
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
  edit("'stationnaire','exterieur'].includes(values.variante)",
    "'stationnaire','exterieur','poche-jouee','poche-coherente','pixel-neutre'].includes(values.variante)");
  edit("variant==='poche-ouverte'?7:6","variant==='poche-ouverte'?7:['poche-jouee','poche-coherente','pixel-neutre'].includes(variant)?8:6");
  edit("        if(variant==='poche-ouverte'&&i>=5){",
    "        if(variant==='pixel-neutre'&&i>=5){\n"+
    "          const frame=structuredClone(actual.frame), x=0, y=0;\n"+
    "          change??={point:[x,y],before:frame[y][x],after:(frame[y][x]+1)%16};\n"+
    "          assert.equal(frame[y][x],change.before);frame[y][x]=change.after;\n"+
    "          return {...actual,frame,frames:[frame]};\n        }\n"+
    "        if(['poche-ouverte','poche-jouee','poche-coherente'].includes(variant)&&i>=5){\n"+
    "          if(variant==='poche-jouee'&&i===8)return actual;");
  const arms=['nominal','stationnaire','exterieur','poche-ouverte','poche-jouee','poche-coherente','pixel-neutre'];
  writeFileSync(worker,script);
  for(const arm of arms){
    const path=join(temp,'receipt.json');
    execFileSync(process.execPath,[worker,'--moteur',version,'--pyodide',py,'--variante',arm,'--recu',path],
      {env:{...process.env,SIC_OP_GIT:git},stdio:['ignore','ignore','inherit']});
    writeFileSync(join(out,version+'.'+arm+'.json'),JSON.stringify({sha:sha[version],arm,...JSON.parse(readFileSync(path,'utf8'))})+'\n',{flag:'wx'});
  }
}finally{rmSync(temp,{recursive:true,force:true});}
