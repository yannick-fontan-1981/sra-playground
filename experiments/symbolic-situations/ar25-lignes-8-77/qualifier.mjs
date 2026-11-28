import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {mount} from '../ls19-ligne-90/montage.mjs';

const [sha,group,vendor,out,selection]=process.argv.slice(2);
const base='d0e7527ca8033bd805a6d7a8bb021eff62e87021', candidate='f6ff40f5e6c870ab5f897eaccdd1d43873944c5c';
assert.ok([base,candidate].includes(sha));
const groups={nominal:[['nominal',16],['reprise-reflet',16]],
  contrôles:[['autre-calibrage',4],['retrait-calibrage',4],['preuve-reflet',5],['retrait-reflet',5]],
  réserve:[['retour-contenant',4],['partiel-reflet',4]]};
assert.ok(groups[group]);
let inside;
if(group==='réserve'){
  const bytes=readFileSync(selection);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),'8a7774914594ae2163fd45666f8fa7680a71251ea80c2a5b6402067d60668941');
  inside=(Buffer.from(JSON.parse(bytes).seed,'hex')[0]&1)===0;
}
const instance=mount(sha,'.');
try{
  const repo=execFileSync('git',['rev-parse','--show-toplevel'],{encoding:'utf8'}).trim();
  const tar=join(instance.program,'operator.tar'),exp='experiments/sic-agenda-offres/';
  execFileSync('git',['-C',repo,'archive','--output='+tar,candidate,exp+'evaluateur-jeu.mjs',exp+'frontiere-22-23/game.mjs',
    exp+'moteur-reference.mjs',exp+'ar25-8-77','public/python']);
  execFileSync('tar',['-xf',tar,'-C',instance.program]);
  const original=join(instance.program,exp,'ar25-8-77','operateur.mjs');
  let code=readFileSync(original,'utf8');
  const replace=(anchor,value)=>{
    assert.equal(code.split(anchor).length,2,anchor);
    code=code.replace(anchor,value);
  };
  replace("'retour-reflet','reprise-reflet'","'retour-reflet','reprise-reflet','partiel-reflet','retrait-calibrage'");
  replace("if(turn===1&&variant==='autre-calibrage')return select.call(this,offered.slice(1));",
    "if(turn===1&&variant==='retrait-calibrage')return null;\n      if(turn===1&&variant==='autre-calibrage')return select.call(this,offered.slice(1));");
  replace("variant==='retour-reflet'&&i===4","['retour-reflet','partiel-reflet'].includes(variant)&&i===4");
  replace("const shown=replace?{...actual,frame:board.frame,frames:[board.frame]}:actual;",`let bbox;
      let shown=replace?{...actual,frame:board.frame,frames:actual.frames.map(()=>board.frame)}:actual;
      if(i===4&&variant==='partiel-reflet'){
        const world=pre.reflectionPlan?.before, body=world?.bodies[0];
        if(body?.length && world.phase && world.pitch){
          const low=[0,1].map(k=>world.phase[k]+world.pitch*Math.min(...body.map(p=>p[k])));
          const high=[0,1].map(k=>world.phase[k]+world.pitch*(1+Math.max(...body.map(p=>p[k]))));
          bbox=[low,high];
          const edit=frame=>frame.map((row,y)=>row.map((pixel,x)=>{
            const inBox=x>=low[0]&&x<high[0]&&y>=low[1]&&y<high[1];
            return inBox===${Boolean(inside)}?pixel:board.frame[y][x];
          }));
          shown={...actual,frame:edit(actual.frame),frames:actual.frames.map(edit)};
        }
      }
      function changed(a,b){
        return a.reduce((n,row,y)=>n+row.reduce((m,p,x)=>m+Number(p!==b[y][x]),0),0);
      }`);
  replace('const after={ref:e.observation_ref','const after={ticket:ticket.id,owner:e.family,ref:e.observation_ref');
  replace('presented:digest(shown.frame),actual:digest(actual.frame),',
    'presented:digest(shown.frame),actual:digest(actual.frame),pixels:{real:changed(board.frame,actual.frame),served:changed(board.frame,shown.frame)},bbox,');
  replace("if(variant==='retour-contenant'||variant==='retour-reflet'){",
    "if(['retour-contenant','retour-reflet','partiel-reflet'].includes(variant)){");
  const adapted=join(dirname(original),'observations-operateur.mjs');writeFileSync(adapted,code);
  const {play}=await import(pathToFileURL(adapted));
  const engine=pathToFileURL(instance.program+'/').href, results={};
  for(const [name,length] of groups[group])results[name]=await play(engine,name,length,vendor);
  writeFileSync(out,JSON.stringify({sha,group,results})+'\n',{flag:'wx'});
}finally{instance.close();}
