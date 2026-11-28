import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,readFileSync,writeFileSync,rmSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';

const [version,vendor,destination]=process.argv.slice(2);
const sha={gel:'d0e7527ca8033bd805a6d7a8bb021eff62e87021',candidat:'dc9314cc1ebdfc4ac4888d5ad0e7bfa0fb62542f'};
assert.ok(Object.hasOwn(sha,version));
const git=execFileSync('git',['rev-parse','--show-toplevel'],{encoding:'utf8'}).trim();
const temp=mkdtempSync(join(tmpdir(),'ther-65-verif-'));
const out=resolve(destination),py=resolve(vendor),dir='experiments/sic-agenda-offres',sub='ther-65';
mkdirSync(out,{recursive:true});
try{
  const tar=join(temp,'ops.tar');
  const files=['rejouer-service.mjs','evaluateur-jeu.mjs','frontiere-22-23/game.mjs','moteur-reference.mjs',sub+'/operateur.mjs',sub+'/archive.mjs'];
  execFileSync('git',['-C',git,'archive','--output='+tar,sha.candidat,...files.map(x=>dir+'/'+x),
    'docs/migration/native-campaigns-v42/ther-four-level-public-trace.json.gz',
    'docs/migration/native-campaigns-v42/ther-four-levels.json','tests/fixtures/v6-rooted-quota-reference.json.gz']);
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
  edit("'stationnaire','soeur-modifiee'].includes(values.variante)",
    "'stationnaire','soeur-modifiee','stationnaire-coupe','sans-ajout','sans-coupe'].includes(values.variante)");
  edit("    const prior=this.currentState().quota_model,extended=native?.extendedMarkSupport===true;",
    "    const saved=this.model,remove=obs.revision===3&&['sans-ajout','sans-coupe'].includes(variant);\n"+
    "    if(remove){assert.ok(saved.addition_observed&&saved.cut_observed);this.model={...saved,\n"+
    "      [variant==='sans-ajout'?'addition_observed':'cut_observed']:false};}\n"+
    "    try {\n"+
    "    const prior=this.currentState().quota_model,extended=native?.extendedMarkSupport===true;");
  edit("prior:model(prior),support:","prior:model(prior),original:model(saved),support:");
  edit("    return p;\n  }));","    return p;\n    } finally { if(remove)this.model=saved; }\n  }));");
  edit("limit:variant==='nominal'?16:1,","limit:variant==='nominal'?16:variant==='stationnaire-coupe'?2:variant.startsWith('sans-')?3:1,");
  edit("        if(i!==1||variant==='nominal')return actual;",
    "        if(variant==='stationnaire-coupe'&&i===2)return {...board,frames:[board.frame]};\n"+
    "        if(i!==1||variant==='nominal'||variant.startsWith('sans-')||variant==='stationnaire-coupe')return actual;");
  writeFileSync(worker,script);
  const arms=['nominal','stationnaire','soeur-modifiee','stationnaire-coupe','sans-ajout','sans-coupe'];
  const archived=join(temp,dir,sub,'archive-run.mjs');
  writeFileSync(archived,"import {writeFileSync} from 'node:fs';\nimport {withEngine} from '../moteur-reference.mjs';\n"+
    "import {verifyArchive} from './archive.mjs';\n"+
    "await withEngine(process.argv[2],async engine=>writeFileSync(process.argv[3],JSON.stringify(await verifyArchive(engine))+'\\n'));\n");
  const archivePath=join(out,version+'.archive.json');
  execFileSync(process.execPath,[archived,version,archivePath],{env:{...process.env,SIC_OP_GIT:git},stdio:['ignore','ignore','inherit']});
  for(const arm of arms){
    const path=join(temp,'receipt.json');
    execFileSync(process.execPath,[worker,'--moteur',version,'--pyodide',py,'--variante',arm,'--recu',path],
      {env:{...process.env,SIC_OP_GIT:git},stdio:['ignore','ignore','inherit']});
    writeFileSync(join(out,version+'.'+arm+'.json'),JSON.stringify({sha:sha[version],arm,...JSON.parse(readFileSync(path,'utf8'))})+'\n',{flag:'wx'});
  }
}finally{rmSync(temp,{recursive:true,force:true});}
