import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,readFileSync,writeFileSync,rmSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';

const [version,vendor,destination]=process.argv.slice(2);
const sha={gel:'d0e7527ca8033bd805a6d7a8bb021eff62e87021',candidat:'b8902646b6c968f78e5512f62d1d641b0bd20dd0'};
assert.ok(Object.hasOwn(sha,version));
const git=execFileSync('git',['rev-parse','--show-toplevel'],{encoding:'utf8'}).trim();
const temp=mkdtempSync(join(tmpdir(),'colm-verif-'));
const out=resolve(destination),py=resolve(vendor),dir='experiments/sic-agenda-offres',sub='colm-59';
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
  edit("import {withEngine} from '../moteur-reference.mjs';",
    "import {withEngine} from '../moteur-reference.mjs';\nimport {loadGame} from '../frontiere-22-23/game.mjs';");
  edit("'trame-dupliquee','sans-reception'];","'trame-dupliquee','sans-reception','autre-action3','autre-action2'];");
  edit("  let removed=[];","  let removed=[],contrast=null;");
  edit("      present({board,actual,pre,i}){","      async present({board,actual,pre,i}){");
  edit("        if(variant==='trame-dupliquee')return {...actual,frames:[actual.frame,actual.frame]};",
    "        if(variant==='trame-dupliquee')return {...actual,frames:[actual.frame,actual.frame]};\n"+
    "        if(variant==='autre-action3'||variant==='autre-action2'){\n"+
    "          assert.equal(i,1);\n"+
    "          const alternate=await loadGame('COLM',vendor,engine),id=Number(variant.at(-1));\n"+
    "          assert.equal(digest(alternate.initial.frame),digest(board.frame));\n"+
    "          assert.ok(alternate.initial.availableActionIds.includes(id));\n"+
    "          const response=await alternate.step(id,{});\n"+
    "          contrast={from:digest(board.frame),command:'ACTION'+id,actualFrames:response.frames.length,\n"+
    "            alternative:digest(response.frame),kind:'return of a distinct command played from the same opening'};\n"+
    "          return response;\n"+
    "        }");
  edit('return {...r,removed};','return {...r,removed,contrast};');
  writeFileSync(worker,script);
  const relay=join(temp,dir,'rejouer-service.mjs');
  const run=readFileSync(relay,'utf8');
  assert.equal(run.split('const shown=present(').length,2);
  writeFileSync(relay,run.replace('const shown=present(','const shown=await present('));
  const arms=[['nominal'],['stationnaire-t1','stationnaire',1],['duplique-t1','trame-dupliquee',1],
    ['autre-t1-a3','autre-action3',1],['autre-t1-a2','autre-action2',1],['sans-reception-t3','sans-reception',3],
    ['stationnaire-t6','stationnaire',6],['sans-reception-t16','sans-reception',16]];
  for(const [name,arm=name,turn] of arms){
    const path=join(temp,'receipt.json');
    const extra=turn?['--tour',String(turn)]:[];
    execFileSync(process.execPath,[worker,'--moteur',version,'--pyodide',py,'--variante',arm,...extra,'--recu',path],
      {env:{...process.env,SIC_OP_GIT:git},stdio:['ignore','ignore','inherit']});
    writeFileSync(join(out,version+'.'+name+'.json'),JSON.stringify({sha:sha[version],arm:name,...JSON.parse(readFileSync(path,'utf8'))})+'\n',{flag:'wx'});
  }
}finally{rmSync(temp,{recursive:true,force:true});}
