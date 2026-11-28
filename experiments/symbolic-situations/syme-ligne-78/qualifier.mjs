import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,readFileSync,writeFileSync,rmSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';

const [version,vendor,destination,group]=process.argv.slice(2);
const sha={gel:'d0e7527ca8033bd805a6d7a8bb021eff62e87021',candidat:'85194a499e1b81c4c26e418efbd171bf469d00d1'};
assert.ok(Object.hasOwn(sha,version));
const git=execFileSync('git',['rev-parse','--show-toplevel'],{encoding:'utf8'}).trim();
const temp=mkdtempSync(join(tmpdir(),'syme-78-verif-'));
const out=resolve(destination),py=resolve(vendor),dir='experiments/sic-agenda-offres',sub='syme-78';
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
  edit("'retour-contraire','autre-reference'].includes(values.variante)",
    "'retour-contraire','autre-reference','autre-reference-jouee'].includes(values.variante)");
  edit("if(variant==='autre-reference'){","if(['autre-reference','autre-reference-jouee'].includes(variant)){");
  edit("    const pre={ref:obs.observation_ref,epoch:obs.level_epoch,input:digest(rows),fields:fields.map(field),hypotheses,",
    "    const pre={ref:obs.observation_ref,epoch:obs.level_epoch,input:digest(rows),fields:fields.map(field),hypotheses,\n"+
    "      sample:fields.map(f=>f.ys.map(y=>f.xs.map(x=>rows[y][x]))),");
  edit("'autre-reference-jouee'].includes(values.variante)", "'autre-reference-jouee','inventaire','temoin-etroit'].includes(values.variante)");
  edit("limit:synthetic||variant==='autre-reference'?0:variant==='nominal'?16:1,",
    "limit:synthetic||['autre-reference','inventaire','temoin-etroit'].includes(variant)?0:variant==='nominal'?16:1,");
  edit("        if(!synthetic)return board;",
    "        if(variant==='temoin-etroit'){\n"+
    "          const frame=structuredClone(board.frame), x=29, y=27;\n"+
    "          const before=frame[y][x], to=before===8?9:8;\n"+
    "          for(let v=y;v<y+5;v++)for(let u=x;u<x+5;u++){\n"+
    "            assert.equal(frame[v][u],before);frame[v][u]=to;\n"+
    "          }\n"+
    "          change={cell:[x,y],from:before,to};\n"+
    "          return {...board,frame,frames:[frame]};\n"+
    "        }\n"+
    "        if(!synthetic)return board;");
  writeFileSync(worker,script);
  const arms=group==='inventaire'?['inventaire','temoin-etroit','ambigu','contraste-clair']:['nominal','autre-reference','autre-reference-jouee','retour-contraire','ambigu','contraste-clair'];
  for(const arm of arms){
    const path=join(temp,'receipt.json');
    execFileSync(process.execPath,[worker,'--moteur',version,'--pyodide',py,'--variante',arm,'--recu',path],
      {env:{...process.env,SIC_OP_GIT:git},stdio:['ignore','ignore','inherit']});
    writeFileSync(join(out,version+'.'+arm+'.json'),JSON.stringify({sha:sha[version],arm,...JSON.parse(readFileSync(path,'utf8'))})+'\n',{flag:'wx'});
  }
}finally{rmSync(temp,{recursive:true,force:true});}
