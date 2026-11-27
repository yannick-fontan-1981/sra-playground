import { execFileSync,spawn } from 'node:child_process';
import { mkdtempSync,mkdirSync,copyFileSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join,dirname } from 'node:path';
import { createInterface } from 'node:readline';
import { once } from 'node:events';

export function mount(sha,repo,folder=tmpdir()){
  repo=execFileSync('git',['-C',repo,'rev-parse','--show-toplevel'],{encoding:'utf8'}).trim();
  if(!/^[a-f0-9]{40}$/.test(sha) || execFileSync('git',['-C',repo,'rev-parse',sha+'^{commit}'],{encoding:'utf8'}).trim()!==sha) throw Error('SHA Git complet requis');
  const dir=mkdtempSync(join(folder,'vue-native-'));
  function close() {
    if(dirname(dir)!==folder) throw Error('Dossier temporaire invalide');
    rmSync(dir,{recursive:true,force:true,maxRetries:3});
  }
  try{
    const source='reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/';
    const tar=join(dir,'sources.tar'), program=join(dir,'programme');
    mkdirSync(program);
    execFileSync('git',['-C',repo,'archive','--output='+tar,sha,'src','package.json',
      source+'laya_proto/common_frontier_policy.drm.json',source+'laya_proto/composition_target_tree.json',
      source+'morphology_policy/strategy.drm'],{windowsHide:true});
    execFileSync('tar',['-xf',tar,'-C',program],{windowsHide:true});
    copyFileSync(new URL('./worker.mjs',import.meta.url),join(program,'worker.mjs'));
    return {program,close};
  }catch(e){close();throw e;}
}
export async function run(game,program) {
  const child=spawn(process.execPath,['--permission','--allow-fs-read='+program,'worker.mjs'],
    {cwd:program,env:{},stdio:['pipe','pipe','pipe'],windowsHide:true});
  const done=once(child,'close');
  const read=createInterface({input:child.stdout})[Symbol.asyncIterator]();
  let err='';child.stderr.on('data',b=>{err=(err+b).slice(-900);});
  const timer=setTimeout(()=>child.kill(),90000);
  const turns=[];let obs=game.initial;
  try {
    for(let i=0;i<=game.length;i++){
      child.stdin.write(JSON.stringify(i?{observation:obs}:{observation:obs,budgets:game.budgets})+'\n');
      const r=await read.next();
      if(r.done) throw Error('Moteur interrompu '+err);
      const answer=JSON.parse(r.value);turns.push(answer);
      if(i===game.length) break;
      obs=game.advance(i,answer.command);
      if(!obs) break;
    }
  }finally{child.stdin.end();await done;clearTimeout(timer);}
  return turns;
}
