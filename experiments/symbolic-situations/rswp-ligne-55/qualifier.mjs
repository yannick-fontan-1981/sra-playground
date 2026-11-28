import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,readFileSync,writeFileSync,rmSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';

const [version,vendor,destination]=process.argv.slice(2);
const sha={gel:'d0e7527ca8033bd805a6d7a8bb021eff62e87021',candidat:'f3051af812f4f7f74f0179a804a87753bffa5910'};
assert.ok(Object.hasOwn(sha,version));
const git=execFileSync('git',['rev-parse','--show-toplevel'],{encoding:'utf8'}).trim();
const temp=mkdtempSync(join(tmpdir(),'rswp-verif-'));
const out=resolve(destination),py=resolve(vendor),dir='experiments/sic-agenda-offres',sub='rswp-55';
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
  edit("'sans-effets','sans-relation'];","'sans-effets','sans-relation','retour-zone'];");
  edit('  let turn=1;','  let turn=1,lastScene=null;');
  edit('    const used=mutation?.changed??rows;','    lastScene=raw;\n    const used=mutation?.changed??rows;');
  edit("variant==='nominal'?16:variant==='stationnaire'?1:targetTurn-1",
    "variant==='nominal'?16:variant==='stationnaire'?1:targetTurn");
  edit("      present({board,actual}){return variant==='stationnaire'?{...board,frames:[board.frame]}:actual;}});",
    "      present({board,actual,i}){\n"+
    "        if(variant==='stationnaire')return {...board,frames:[board.frame]};\n"+
    "        if(variant!=='retour-zone'||i!==targetTurn-1)return actual;\n"+
    "        const [l,t,r,b]=lastScene.panels[panelIndex].room;\n"+
    "        const frame=actual.frame.map((row,y)=>row.map((v,x)=>l<=x&&x<=r&&t<=y&&y<=b?board.frame[y][x]:v));\n"+
    "        assert.equal(compare(frame,actual.frame,[l,t,r,b]).changed,21);\n"+
    "        return {...actual,frame,frames:[frame]};\n"+
    "      }});");
  writeFileSync(worker,script);
  const arms=[['nominal'],['stationnaire'],['sans-selection','sans-selection',4],
    ['effets-t8','sans-effets',8],['relation-t8','sans-relation',8,0],['zone-t8','retour-zone',8,0],
    ['effets-t16','sans-effets',16],['relation-t16','sans-relation',16,0],['zone-t16','retour-zone',16,0]];
  for(const [name,arm=name,turn,panel=0] of arms){
    const path=join(temp,'receipt.json');
    const extra=turn?['--tour',String(turn),'--panneau',String(panel)]:[];
    execFileSync(process.execPath,[worker,'--moteur',version,'--pyodide',py,'--variante',arm,...extra,'--recu',path],
      {env:{...process.env,SIC_OP_GIT:git},stdio:['ignore','ignore','inherit']});
    writeFileSync(join(out,version+'.'+name+'.json'),JSON.stringify({sha:sha[version],arm:name,...JSON.parse(readFileSync(path,'utf8'))})+'\n',{flag:'wx'});
  }
}finally{rmSync(temp,{recursive:true,force:true});}
