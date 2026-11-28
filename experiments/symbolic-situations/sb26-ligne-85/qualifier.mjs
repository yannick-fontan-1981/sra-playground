import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,readFileSync,writeFileSync,rmSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';

const [version,vendor,destination,group='complet']=process.argv.slice(2);
const sha={gel:'d0e7527ca8033bd805a6d7a8bb021eff62e87021',candidat:'4e1760327c1aea9031654e7de7c26da3ae19cf7b'};
assert.ok(Object.hasOwn(sha,version));
const git=execFileSync('git',['rev-parse','--show-toplevel'],{encoding:'utf8'}).trim();
const temp=mkdtempSync(join(tmpdir(),'sb26-85-verif-'));
const out=resolve(destination),py=resolve(vendor),dir='experiments/sic-agenda-offres',sub='sb26-85';
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
  edit("'ordre-entrees','autre-contenu'].includes(values.variante)",
    "'ordre-entrees','autre-contenu','depot-absent','ordre-reference-joue'].includes(values.variante)");
  edit("variant==='autre-contenu'?5:3","['autre-contenu','depot-absent'].includes(variant)?5:['ordre-entrees','ordre-reference-joue'].includes(variant)?4:3");
  edit("if(variant!=='ordre-reference')return board;","if(!variant.startsWith('ordre-reference'))return board;");
  edit("if(variant==='ordre-reference'&&i<=3)","if(variant.startsWith('ordre-reference')&&i<=3)");
  edit("present({actual,pre,i}){","present({actual,board,pre,i}){");
  edit("if(variant!=='autre-contenu'||edited||pre.plan?.op!=='place')return actual;",
    "if(!['autre-contenu','depot-absent'].includes(variant)||edited||pre.plan?.op!=='place')return actual;");
  edit("        recolor(frame,pre.plan.box,from,to);",
    "        if(variant==='depot-absent'){\n"+
    "          const [l,t,r,b]=pre.plan.box;\n"+
    "          for(let y=t;y<=b;y++)for(let x=l;x<=r;x++)frame[y][x]=board.frame[y][x];\n"+
    "        } else recolor(frame,pre.plan.box,from,to);");
  edit("change={index,from,to,box:pre.plan.box,turn:i};","change={index,from,to:variant==='depot-absent'?null:to,box:pre.plan.box,turn:i};");
  writeFileSync(worker,script);
  assert.ok(['complet','depot-permute'].includes(group));
  const arms=group==='depot-permute'?['ordre-reference-joue']:
    ['nominal','ordre-reference','ordre-entrees','autre-contenu','depot-absent','ordre-reference-joue'];
  for(const arm of arms){
    const path=join(temp,'receipt.json');
    execFileSync(process.execPath,[worker,'--moteur',version,'--pyodide',py,'--variante',arm,'--recu',path],
      {env:{...process.env,SIC_OP_GIT:git},stdio:['ignore','ignore','inherit']});
    writeFileSync(join(out,version+'.'+arm+'.json'),JSON.stringify({sha:sha[version],arm,...JSON.parse(readFileSync(path,'utf8'))})+'\n',{flag:'wx'});
  }
}finally{rmSync(temp,{recursive:true,force:true});}
