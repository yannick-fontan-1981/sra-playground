import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,readFileSync,writeFileSync,rmSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';

const [engine,vendor,target]=process.argv.slice(2);
const gel='d0e7527ca8033bd805a6d7a8bb021eff62e87021';
const correctif='4946cf0297734b9464fc52256af6fb27846f3bad';
const harnais='1cf241c7625a1e76e4aa4828a50e0ec7ee2d099f';
assert.ok(['gel','stations'].includes(engine));
const root=execFileSync('git',['rev-parse','--show-toplevel'],{encoding:'utf8'}).trim();
const temp=mkdtempSync(join(tmpdir(),'sk48-64-op-'));
const out=resolve(target),py=resolve(vendor);
const dir='experiments/sic-agenda-offres', alt='sk48-64';
mkdirSync(out,{recursive:true});
try {
  const tar=join(temp,'harnais.tar');
  const dependencies=['evaluateur-jeu.mjs','frontiere-22-23/game.mjs','moteur-reference.mjs',alt+'/operateur.mjs'];
  execFileSync('git',['-C',root,'archive','--output='+tar,harnais,...dependencies.map(x=>dir+'/'+x)]);
  execFileSync('tar',['-xf',tar,'-C',temp]);
  const launcher=join(temp,dir,'moteur-reference.mjs');
  writeFileSync(launcher,readFileSync(launcher,'utf8').replace("const root = new URL('../../', import.meta.url);","const root = process.env.SIC_64_GIT_ROOT;").replace("cwd:fileURLToPath(root)","cwd:root"));
  const worker=join(temp,dir,alt,'operateur.mjs');
  const frozen=readFileSync(worker,'utf8');
  const swaps=[
    ['function recolor(board){','function recolor(board, lhs=9, rhs=14){'],
    ['v===9?14:v===14?9:v','v===lhs?rhs:v===rhs?lhs:v'],
    ['[palette[9],palette[14]]=[palette[14],palette[9]]','[palette[lhs],palette[rhs]]=[palette[rhs],palette[lhs]]'],
    ["'sans-effet','palette'].includes","'sans-effet','palette','banc'].includes"],
    ["const display=variant==='palette'?recolor:b=>b;","const display=variant==='palette'?b=>recolor(b):variant==='banc'?b=>recolor(b,8,13):b=>b;"]
  ];
  let withBank=frozen;
  for(const [from,to] of swaps){
    assert.equal(withBank.split(from).length,2);
    withBank=withBank.replace(from,to);
  }
  const bank=join(temp,dir,alt,'banc.mjs');
  writeFileSync(bank,withBank);
  for(const arm of ['nominal','priorite','stationnaire','sans-effet','palette','banc']){
    const raw=join(temp,'receipt.json');
    execFileSync(process.execPath,[arm==='banc'?bank:worker,'--moteur',engine,'--pyodide',py,'--variante',arm,'--recu',raw],
      {env:{...process.env,SIC_64_GIT_ROOT:root},stdio:['ignore','ignore','inherit']});
    writeFileSync(join(out,engine+'.'+arm+'.json'),JSON.stringify({sha:engine==='gel'?gel:correctif,arm,...JSON.parse(readFileSync(raw,'utf8'))})+'\n',{flag:'wx'});
  }
} finally {rmSync(temp,{recursive:true,force:true});}
