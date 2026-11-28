import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {mount} from '../ls19-ligne-90/montage.mjs';

const [sha,group,vendor,out,selection]=process.argv.slice(2);
const base='d0e7527ca8033bd805a6d7a8bb021eff62e87021', candidate='19ffd927b588257ce54cf1a35c166ce41ecebf5b';
assert.ok([base,candidate].includes(sha));
const groups={nominal:[['nominal',16]],contrôles:[['sans-offre-9',3],['retour-9',1],['sans-acquis-9',3]],
  réserve:[['composante',1]]};
assert.ok(groups[group]);
let byte;
if(group==='réserve'){
  const bytes=readFileSync(selection);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),'f058fcc33782baceb4c6415343a58225a4d1734bc218062aae3446d793cac92a');
  byte=Buffer.from(JSON.parse(bytes).seed,'hex')[0];
}
const instance=mount(sha,'.');
try{
  const repo=execFileSync('git',['rev-parse','--show-toplevel'],{encoding:'utf8'}).trim();
  const tar=join(instance.program,'operator.tar'),exp='experiments/sic-agenda-offres/';
  execFileSync('git',['-C',repo,'archive','--output='+tar,candidate,exp+'evaluateur-jeu.mjs',exp+'frontiere-22-23/game.mjs',
    exp+'moteur-reference.mjs',exp+'spor-9-56','public/python']);
  execFileSync('tar',['-xf',tar,'-C',instance.program]);
  const source=join(instance.program,exp,'spor-9-56','operateur.mjs');
  let code=readFileSync(source,'utf8');
  const replace=(anchor,value)=>{
    assert.equal(code.split(anchor).length,2,anchor);code=code.replace(anchor,value);
  };
  replace("let shown=replace?{...actual,frame:board.frame,frames:[board.frame]}:actual;",`let shown=replace?{...actual,frame:board.frame,frames:actual.frames.map(()=>board.frame)}:actual;
      const delta=(a,b)=>b.flatMap((row,y)=>row.flatMap((p,x)=>p===a[y][x]?[]:[[x,y]]));
      const physical=delta(board.frame,actual.frame), components=[];
      if(variant==='composante'&&i===1&&physical.length){
        const pending=new Set(physical.map(String));
        for(const seed of physical){
          if(!pending.delete(String(seed)))continue;
          const cells=[seed];
          for(const [x,y] of cells)for(const next of [[x+1,y],[x-1,y],[x,y+1],[x,y-1]]){
            if(pending.delete(String(next)))cells.push(next);
          }
          components.push(cells);
        }
        const kept=new Set(components[${byte??0}%components.length].map(String));
        const image=f=>f.map((row,y)=>row.map((p,x)=>kept.has(String([x,y]))?p:board.frame[y][x]));
        shown={...actual,frame:image(actual.frame),frames:actual.frames.map(image)};
      }`);
  replace('const after={ref:e.observation_ref','const after={ticket:ticket.id,owner:e.family,ref:e.observation_ref');
  replace('shown:digest(shown.frame),physical:digest(actual.frame),removed,',
    'shown:digest(shown.frame),physical:digest(actual.frame),removed,pixels:{real:physical.length,shown:delta(board.frame,shown.frame).length},components:components.map(c=>c.length),images:shown.frames.length,');
  replace("if(variant==='retour-9')while","if(['retour-9','composante'].includes(variant))while");
  const adapted=join(dirname(source),'observations-operateur.mjs');writeFileSync(adapted,code);
  const {play}=await import(pathToFileURL(adapted));
  const engine=pathToFileURL(instance.program+'/').href, results={};
  for(const [name,length] of groups[group])results[name]=await play(engine,name,length,vendor);
  writeFileSync(out,JSON.stringify({sha,group,results})+'\n',{flag:'wx'});
}finally{instance.close();}
