import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,readFileSync,writeFileSync,rmSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';

const [version,vendor,destination]=process.argv.slice(2);
const sha={gel:'d0e7527ca8033bd805a6d7a8bb021eff62e87021',candidat:'c9737d9831a703611422fcf03af83e39dbfdc6d6'};
assert.ok(Object.hasOwn(sha,version));
const git=execFileSync('git',['rev-parse','--show-toplevel'],{encoding:'utf8'}).trim();
const temp=mkdtempSync(join(tmpdir(),'craf-73-verif-'));
const out=resolve(destination),py=resolve(vendor),dir='experiments/sic-agenda-offres',sub='craf-73';
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
  edit("'stationnaire','produit-substitue'].includes(values.variante)",
    "'stationnaire','produit-substitue','sans-conversion','operande-restaure'].includes(values.variante)");
  edit("        if(variant!=='produit-substitue'||i!==target)return actual;",
    "        if(variant==='sans-conversion'&&i===target)return {...board,frames:[board.frame]};\n"+
    "        if(variant==='operande-restaure'&&i===target){\n"+
    "          const old=scene(board.frame,owner.config), now=scene(actual.frame,owner.config);\n"+
    "          const gone=old.glyphs.filter(g=>g.solid&&!now.glyphs.some(h=>same(g,h)));\n"+
    "          assert.ok(gone.length>=2);\n"+
    "          const g=gone[0], [l,t,r,d]=g.box, raster=structuredClone(actual.frame);\n"+
    "          for(let y=t;y<=d;y++)for(let x=l;x<=r;x++)raster[y][x]=board.frame[y][x];\n"+
    "          assert.notEqual(measureDiagramTransition(frame(board.frame),frame(raster)),1);\n"+
    "          change={box:g.box,value:g.value};\n"+
    "          return {...actual,frame:raster,frames:[raster]};\n"+
    "        }\n"+
    "        if(variant!=='produit-substitue'||i!==target)return actual;");
  writeFileSync(worker,script);
  const arms=['nominal','sans-guide','stationnaire','produit-substitue','sans-conversion','operande-restaure'];
  for(const arm of arms){
    const path=join(temp,'receipt.json');
    execFileSync(process.execPath,[worker,'--moteur',version,'--pyodide',py,'--variante',arm,'--tour','5','--recu',path],
      {env:{...process.env,SIC_OP_GIT:git},stdio:['ignore','ignore','inherit']});
    writeFileSync(join(out,version+'.'+arm+'.json'),JSON.stringify({sha:sha[version],arm,...JSON.parse(readFileSync(path,'utf8'))})+'\n',{flag:'wx'});
  }
}finally{rmSync(temp,{recursive:true,force:true});}
