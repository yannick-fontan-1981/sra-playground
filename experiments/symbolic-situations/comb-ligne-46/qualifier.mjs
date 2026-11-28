import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,readFileSync,writeFileSync,rmSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';

const [engine,vendor,target,suite]=process.argv.slice(2);
const sha={gel:'d0e7527ca8033bd805a6d7a8bb021eff62e87021',candidat:'07e70e95d36a9c9543927fda8dc1a9193a011fdd'};
assert.ok(Object.hasOwn(sha,engine));
const root=execFileSync('git',['rev-parse','--show-toplevel'],{encoding:'utf8'}).trim();
const temp=mkdtempSync(join(tmpdir(),'comb-46-op-'));
const out=resolve(target),py=resolve(vendor);
const dir='experiments/sic-agenda-offres',alt='comb-46';
mkdirSync(out,{recursive:true});
try{
  const tar=join(temp,'harnais.tar');
  const paths=['rejouer-service.mjs','evaluateur-jeu.mjs','frontiere-22-23/game.mjs','moteur-reference.mjs',alt+'/operateur.mjs'];
  execFileSync('git',['-C',root,'archive','--output='+tar,sha.candidat,...paths.map(x=>dir+'/'+x)]);
  execFileSync('tar',['-xf',tar,'-C',temp]);
  const launcher=join(temp,dir,'moteur-reference.mjs');
  const transport=readFileSync(launcher,'utf8').replace("const root = new URL('../../', import.meta.url);","const root = process.env.SIC_46_GIT_ROOT;")
    .replace("cwd:fileURLToPath(root)","cwd:root");
  assert.ok(transport.includes("if(name==='candidat') return fn(root);"));
  writeFileSync(launcher,transport.replace("if(name==='candidat') return fn(root);",
    "if(name==='candidat') return withEngine('révision',fn);")+"\nversions.révision='"+sha.candidat+"';\n");
  const worker=join(temp,dir,alt,'operateur.mjs'),local=join(temp,dir,alt,'operateur-indep.mjs');
  let code=readFileSync(worker,'utf8').replaceAll('\r\n','\n');
  const edits=[
    ["'multifactoriel','petite-reserve'];","'multifactoriel','petite-reserve','contre-exemple','multifactoriel-n2','contre-exemple-n2'];"],
    ["    const events=record.call(this,b,cmd,a,rows,later,p,index);",
      "    if(variant==='contre-exemple'&&a.revision===3||variant==='contre-exemple-n2'&&a.revision===9){\n"+
      "      const witness=JSON.parse(process.env.SIC_46_CONFLIT),old=this.productState;\n"+
      "      assert.deepEqual([old.epoch,old.geometry_ref],[witness.epoch,witness.geometry]);\n"+
      "      assert.equal(old.counterexamples.length,0);\n"+
      "      assert.equal(witness.counterexamples.length,1);\n"+
      "      this.productState={...old,counterexamples:witness.counterexamples,evidence:[...old.evidence,...witness.counterexamples[0].evidence]};\n"+
      "    }\n"+
      "    const events=record.call(this,b,cmd,a,rows,later,p,index);"],
    ["variant==='nominal'?16:scoped?targetTurn-1:1",
      "variant==='nominal'?16:variant==='contre-exemple'?3:variant==='multifactoriel-n2'?5:variant==='contre-exemple-n2'?10:scoped?targetTurn-1:1"],
    ["present({board,actual,pre})","present({board,actual,pre,i})"],
    ["if(variant!=='multifactoriel')return actual;\n        const another=opening.controls",
      "if(variant!=='multifactoriel'&&!(variant==='multifactoriel-n2'&&i===5))return actual;\n"+
      "        const panel=variant==='multifactoriel-n2'?measureProductPanel(board.frame):opening;\n        const another=panel.controls"]
  ];
  for(const [a,b] of edits){assert.equal(code.split(a).length,2);code=code.replace(a,b);}
  writeFileSync(local,code);
  const continued=[['multifactoriel-n2'],['contre-exemple-n2']];
  const arms=suite==='suite'?continued:[['nominal'],['catalogue-incomplet'],['stationnaire'],['multifactoriel'],
    ['sans-arete','3'],['petite-reserve','7'],['contre-exemple'],...continued];
  for(const [arm,turn] of arms){
    const extra=turn?['--tour',turn]:[];
    const trace={'contre-exemple':'multifactoriel','contre-exemple-n2':'multifactoriel-n2'}[arm];
    const contradiction=trace?JSON.parse(readFileSync(join(out,engine+'.'+trace+'.json'),'utf8')).steps.at(-1).after.record.state:null;
    const file=join(temp,'receipt.json');
    execFileSync(process.execPath,[local,'--moteur',engine,'--pyodide',py,'--variante',arm,...extra,'--recu',file],
      {env:{...process.env,SIC_46_GIT_ROOT:root,SIC_46_CONFLIT:contradiction?JSON.stringify(contradiction):''},stdio:['ignore','ignore','inherit']});
    writeFileSync(join(out,engine+'.'+arm+'.json'),JSON.stringify({sha:sha[engine],arm,...JSON.parse(readFileSync(file,'utf8'))})+'\n',{flag:'wx'});
  }
}finally{rmSync(temp,{recursive:true,force:true});}
