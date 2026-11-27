import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {copyFileSync,readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {gunzipSync} from 'node:zlib';
import {mount} from '../ls19-ligne-90/montage.mjs';
import {dialogue} from '../g50t-ligne-23/dialogue.mjs';
const [sha,group,out,selection]=process.argv.slice(2),hash=b=>createHash('sha256').update(b).digest('hex');
const blob=execFileSync('git',['show','1aaafe36:tests/fixtures/sic-cavity-direction-as66-public.json.gz']);
assert.equal(hash(blob),'1043016c6a19a2f9d835cfc5a2ad52125f6e77cf0d310b258bd1de57bdd3c608');
const fixture=JSON.parse(gunzipSync(blob)),results=[];
let dx=0;
if(group==='réserve'){
  const bytes=readFileSync(selection);assert.ok(readFileSync(new URL('CONTRAT.md',import.meta.url),'utf8').includes(hash(bytes)));
  dx=(Buffer.from(JSON.parse(bytes).seed,'hex')[0]&1)?1:-1;
}
function adjusted(obs,variant){
  const src=obs.frame,f=structuredClone(src);
  if(dx){
    for(let y=6;y<=53;y++){
      assert.equal(src[y][dx===1?55:8],15);
      for(let x=8;x<=55;x++){const from=x-dx;f[y][x]=from>=8&&from<=55?src[y][from]:15;}
    }
    assert.deepEqual(f.flat().toSorted(),src.flat().toSorted());
  }else if(variant==='corps'){assert.equal(f[26][48],11);f[26][48]=15;}
  else if(variant==='cavité'){
    let erased=0;
    for(let y=34;y<=45;y++)for(let x=12;x<=19;x++)if(f[y][x]===0){f[y][x]=15;erased++;}
    assert.equal(erased,80);
  }else return obs;
  return {...obs,frame:f,frames:[f]};
}
const groups={parcours:['historique','autre'],développement:['corps','cavité','neuve','périmée'],réserve:['neuve','périmée']};
const eng=mount(sha,'.');
try{
  copyFileSync(new URL('moteur.mjs',import.meta.url),join(eng.program,'worker.mjs'));
  for(const variant of groups[group]){
    const turns=[],limit={historique:9,autre:7,corps:5,cavité:5,neuve:6,périmée:6}[variant];
    await dialogue(['--permission','--allow-fs-read='+eng.program,'worker.mjs',variant],eng.program,async({send})=>{
      let observation=fixture.observations[0];
      for(let i=0;i<=limit;i++){
        const r=await send({observation,sessionId:fixture.sessionId,...(i?{}:{budgets:fixture.budgets})});turns.push(r);
        if(i===limit)break;
        const alternate=variant==='autre' && i>=5;
        const id=alternate?[4,2][i-5]:fixture.commands[i].id;
        assert.equal(r.commande.actionRef,'ACTION'+id);
        if(i===5 && ['neuve','périmée'].includes(variant)){
          observation={...observation,frames:[observation.frame],stepIndex:fixture.observations[6].stepIndex};
        }else observation=alternate?fixture.alternateReturns[i-5]:fixture.observations[i+1];
        if(i===4)observation=adjusted(observation,variant);
      }
    });
    results.push({variant,turns});
  }
}finally{eng.close();}
writeFileSync(out,JSON.stringify({sha,results})+'\n',{flag:'wx'});
console.log(JSON.stringify(results.map(x=>[x.variant,x.turns.at(-1).état,x.turns.at(-1).kind,x.turns.at(-1).raison])));
