import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,readFileSync,writeFileSync,rmSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';

const [version,vendor,destination]=process.argv.slice(2);
const sha={gel:'d0e7527ca8033bd805a6d7a8bb021eff62e87021',candidat:'fad120b559f52767208ba2620dd48b5a5f530dff'};
assert.ok(Object.hasOwn(sha,version));
const root=execFileSync('git',['rev-parse','--show-toplevel'],{encoding:'utf8'}).trim();
const temp=mkdtempSync(join(tmpdir(),'catl-50-op-'));
const out=resolve(destination),py=resolve(vendor);
const dir='experiments/sic-agenda-offres';
mkdirSync(out,{recursive:true});
try{
  const tar=join(temp,'harnais.tar');
  const paths=['rejouer-service.mjs','evaluateur-jeu.mjs','frontiere-22-23/game.mjs','moteur-reference.mjs','catl-50/operateur.mjs'];
  execFileSync('git',['-C',root,'archive','--output='+tar,sha.candidat,...paths.map(x=>dir+'/'+x)]);
  execFileSync('tar',['-xf',tar,'-C',temp]);
  const launcher=join(temp,dir,'moteur-reference.mjs');
  const mount=readFileSync(launcher,'utf8').replace("const root = new URL('../../', import.meta.url);","const root = process.env.SIC_50_GIT_ROOT;")
    .replace('cwd:fileURLToPath(root)','cwd:root');
  assert.ok(mount.includes("if(name==='candidat') return fn(root);"));
  writeFileSync(launcher,mount.replace("if(name==='candidat') return fn(root);",
    "if(name==='candidat') return withEngine('révision',fn);")+"\nversions.révision='"+sha.candidat+"';\n");
  const worker=join(temp,dir,'catl-50','operateur.mjs');
  const code=readFileSync(worker,'utf8');
  const anchor='        guards.set(obs.observation_ref,{live:labeledSequenceBefore(p,0,rows,meta),';
  assert.equal(code.split(anchor).length,2);
  writeFileSync(worker,code.replace(anchor,
    '        const [x,y] = [p.actions[0].data.x,p.actions[0].data.y];\n'+
    '        const replaced = rows.map(row=>[...row]);\n'+
    '        replaced[y][x] = (rows[y][x]+1)%16;\n'+
    '        guards.set(obs.observation_ref,{live:labeledSequenceBefore(p,0,rows,meta),\n'+
    '          replaced:labeledSequenceBefore(p,0,replaced,meta),'));
  const arms=[['nominal'],['stationnaire'],['sans-controles-retenus'],['sans-reutilisation'],
    ['n1-invariance','1','0,2'],['n2-extremites','9','0,3'],['n2-interieur','9','1,2']];
  for(const [name,turn,swap] of arms){
    const specific=turn?['--tour',turn,'--echanges',swap]:[];
    const file=join(temp,'receipt.json');
    execFileSync(process.execPath,[worker,'--moteur',version,'--pyodide',py,'--variante',turn?'permute':name,
      ...specific,'--recu',file],{env:{...process.env,SIC_50_GIT_ROOT:root},stdio:['ignore','ignore','inherit']});
    writeFileSync(join(out,version+'.'+name+'.json'),JSON.stringify({sha:sha[version],arm:name,...JSON.parse(readFileSync(file,'utf8'))})+'\n',{flag:'wx'});
  }
}finally{rmSync(temp,{recursive:true,force:true});}
