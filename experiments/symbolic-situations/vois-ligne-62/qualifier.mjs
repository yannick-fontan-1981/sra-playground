import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,readFileSync,writeFileSync,rmSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';

const [version,vendor,destination]=process.argv.slice(2);
const sha={gel:'d0e7527ca8033bd805a6d7a8bb021eff62e87021',candidat:'1391bd741ad11addfce68370db8969cd3d37b6b0'};
assert.ok(Object.hasOwn(sha,version));
const git=execFileSync('git',['rev-parse','--show-toplevel'],{encoding:'utf8'}).trim();
const temp=mkdtempSync(join(tmpdir(),'vois-62-verif-'));
const out=resolve(destination),py=resolve(vendor),dir='experiments/sic-agenda-offres',sub='vois-62';
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
  edit("'reference-retiree','reference-deplacee','reference-changee','stationnaire'].includes(values.variante)",
    "'reference-retiree','reference-deplacee','reference-changee','stationnaire','pion-retire'].includes(values.variante)");
  edit("        if(!['reference-retiree','reference-deplacee'].includes(variant))return board;",
    "        if(!['reference-retiree','reference-deplacee','pion-retire'].includes(variant))return board;");
  edit("        const changed=changeReference(board.frame,scene,measureReferencePopulation,variant==='reference-retiree');",
    "        if(variant==='pion-retire'){\n"+
    "          const pawn=scene.bodies.at(-1),[j,i]=pawn.cell,[oy,ox]=scene.offset;\n"+
    "          const [x,y]=[ox+i*scene.q,oy+j*scene.q],raster=structuredClone(board.frame);\n"+
    "          for(let py=y;py<y+scene.q-1;py++)for(let px=x;px<x+scene.q-1;px++){\n"+
    "            assert.equal(raster[py][px],pawn.appearance); raster[py][px]=scene.background;\n"+
    "          }\n"+
    "          assert.equal(measureReferencePopulation(raster),null);\n"+
    "          change={body:pawn.cell,from:[x,y],color:pawn.appearance,target:scene.target.map(t=>t.slice(0,2))};\n"+
    "          return {...board,frame:raster,frames:[raster]};\n"+
    "        }\n"+
    "        const changed=changeReference(board.frame,scene,measureReferencePopulation,variant==='reference-retiree');");
  writeFileSync(worker,script);
  const arms=['nominal','reference-retiree','reference-deplacee','pion-retire','stationnaire','reference-changee'];
  for(const arm of arms){
    const path=join(temp,'receipt.json');
    execFileSync(process.execPath,[worker,'--moteur',version,'--pyodide',py,'--variante',arm,'--recu',path],
      {env:{...process.env,SIC_OP_GIT:git},stdio:['ignore','ignore','inherit']});
    writeFileSync(join(out,version+'.'+arm+'.json'),JSON.stringify({sha:sha[version],arm,...JSON.parse(readFileSync(path,'utf8'))})+'\n',{flag:'wx'});
  }
}finally{rmSync(temp,{recursive:true,force:true});}
