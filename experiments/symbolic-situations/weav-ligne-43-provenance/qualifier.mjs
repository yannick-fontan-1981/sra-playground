import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,readFileSync,writeFileSync,rmSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';

const [version,vendor,destination]=process.argv.slice(2);
const sha={gel:'d0e7527ca8033bd805a6d7a8bb021eff62e87021',candidat:'b01ca9bfde92510eb622a105e1f1470c796dc8e0'};
assert.ok(Object.hasOwn(sha,version));
const git=execFileSync('git',['rev-parse','--show-toplevel'],{encoding:'utf8'}).trim();
const temp=mkdtempSync(join(tmpdir(),'weav-verif-'));
const out=resolve(destination),py=resolve(vendor),dir='experiments/sic-agenda-offres',sub='weav-provenance-43';
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
  edit("'sans-recu','epoque'];","'sans-recu','epoque','portee','journal-portee'];");
  edit("      if(variant==='ancienne-reference')this.pairs=[bad];",
    "      const badScope={...pairs[0],epoch:pairs[0].epoch+1};\n"+
    "      if(variant==='portee')this.pairs=[badScope];\n      else if(variant==='ancienne-reference')this.pairs=[bad];");
  edit("variant==='journal-altere'&&event.kind==='crossed_prefix_pair'?bad:event",
    "event.kind==='crossed_prefix_pair'&&variant==='journal-portee'?badScope:"+
    "variant==='journal-altere'&&event.kind==='crossed_prefix_pair'?bad:event");
  writeFileSync(worker,script);
  const arms=['nominal','ancienne-reference','portee','journal-intact','journal-altere','journal-portee','sans-paire','sans-recu','epoque'];
  for(const arm of arms){
    const path=join(temp,'receipt.json');
    execFileSync(process.execPath,[worker,'--moteur',version,'--pyodide',py,'--variante',arm,'--recu',path],
      {env:{...process.env,SIC_OP_GIT:git},stdio:['ignore','ignore','inherit']});
    writeFileSync(join(out,version+'.'+arm+'.json'),JSON.stringify({sha:sha[version],arm,...JSON.parse(readFileSync(path,'utf8'))})+'\n',{flag:'wx'});
  }
}finally{rmSync(temp,{recursive:true,force:true});}
