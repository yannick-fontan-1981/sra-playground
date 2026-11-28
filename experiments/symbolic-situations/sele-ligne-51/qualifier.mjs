import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,readFileSync,writeFileSync,rmSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';

const [version,vendor,destination]=process.argv.slice(2);
const sha={gel:'d0e7527ca8033bd805a6d7a8bb021eff62e87021',candidat:'77df94e33aa8bae8ecc7f81c8b57e062943dffa6'};
assert.ok(Object.hasOwn(sha,version));
const git=execFileSync('git',['rev-parse','--show-toplevel'],{encoding:'utf8'}).trim();
const temp=mkdtempSync(join(tmpdir(),'sele-verif-'));
const out=resolve(destination),py=resolve(vendor),dir='experiments/sic-agenda-offres',sub='sele-51';
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
  edit("'decoration-contradictoire','sans-trames'];","'decoration-contradictoire','sans-trames','bornes','ordre-inverse'];");
  edit("variant==='long'||variant==='sans-trames'&&targetTurn>16;",
    "variant==='long'||(['sans-trames','bornes','ordre-inverse'].includes(variant)&&targetTurn>16);");
  edit("variant==='sans-trames'?targetTurn:variant==='stationnaire'?1:10",
    "['sans-trames','bornes','ordre-inverse'].includes(variant)?targetTurn:variant==='stationnaire'?1:10");
  const reduced="        if(variant==='sans-trames'&&i===targetTurn)return {...actual,frames:[actual.frame]};";
  edit(reduced,reduced+"\n"+
    "        if(variant==='bornes'&&i===targetTurn)return {...actual,frames:[actual.frames[0],actual.frame]};\n"+
    "        if(variant==='ordre-inverse'&&i===targetTurn){\n"+
    "          const f=actual.frames; assert.equal(f.length,25);\n"+
    "          return {...actual,frames:[...f.slice(0,5),...f.slice(12,16),...f.slice(10,12),...f.slice(5,10),...f.slice(16)]};\n"+
    "        }");
  writeFileSync(worker,script);
  const arms=[['nominal'],['long'],['stationnaire'],['decoration-contradictoire'],
    ['finale-t4','sans-trames',4],['bornes-t4','bornes',4],['finale-t18','sans-trames',18],['ordre-t18','ordre-inverse',18]];
  for(const [name,arm=name,turn] of arms){
    const path=join(temp,'receipt.json');
    const extra=turn?['--tour',String(turn)]:[];
    execFileSync(process.execPath,[worker,'--moteur',version,'--pyodide',py,'--variante',arm,...extra,'--recu',path],
      {env:{...process.env,SIC_OP_GIT:git},stdio:['ignore','ignore','inherit']});
    writeFileSync(join(out,version+'.'+name+'.json'),JSON.stringify({sha:sha[version],arm:name,...JSON.parse(readFileSync(path,'utf8'))})+'\n',{flag:'wx'});
  }
}finally{rmSync(temp,{recursive:true,force:true});}
