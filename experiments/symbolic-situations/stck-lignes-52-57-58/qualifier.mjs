import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {budgets,candidat,gel,commande,monter,service} from './commun.mjs';
import {chronologie} from './chronologie.mjs';
const [sha,group,out,dir,selection]=process.argv.slice(2);assert.ok([gel,candidat].includes(sha));
const input=JSON.parse(gunzipSync(readFileSync(dir+'/observations.gz'))),live=JSON.parse(readFileSync(dir+'/jeu.json'));
const variants={décisions:['nominal','inchangé','sans-modèle'],ordre:['finale','premier-visible','premier-révélé'],réserve:['permutation']}[group];
let palette=[];
if(group==='réserve'){
  const b=readFileSync(selection);assert.ok(readFileSync(new URL('CONTRAT.md',import.meta.url),'utf8').includes(createHash('sha256').update(b).digest('hex')));
  palette=[9,Buffer.from(JSON.parse(b).seed,'hex')[0]&1?11:14];
}
const m=monter(sha),results=[];
try{
  for(const variant of variants){
    const cap=({nominal:16,inchangé:1,'sans-modèle':3,permutation:15})[variant]??13,turns=[];
    await service(m,variant,0,async({send})=>{
      for(let i=0;i<=cap;i++){
        let obs=input[i];
        if(variant==='inchangé' && i===1)obs={...obs,frame:input[0].frame,frames:[input[0].frame]};
        if(group==='ordre' && i===13){assert.deepEqual(obs.frames.at(-1),obs.frame);
          const frames=variant==='finale'?[obs.frame]:chronologie(input[12].frame,obs.frames,variant==='premier-révélé');
          obs={...obs,frames};
        }
        if(palette.length){
          const edit=f=>f.map(r=>r.map(v=>v===palette[0]?palette[1]:v===palette[1]?palette[0]:v));
          obs={...obs,frame:edit(obs.frame),frames:obs.frames.map(edit)};
        }
        const t=await send({observation:obs,budgets});turns.push(t);
        if(i===cap||!t.ticket)break;
        if(variant==='permutation' && JSON.stringify(commande(t))!==JSON.stringify(commande(live.nominal[i])))break;
        assert.deepEqual(commande(t),commande(live.nominal[i]));
      }
    });
    results.push({variant,turns,palette});const last=turns.at(-1);
    console.log(JSON.stringify([variant,turns.length,last.état,last.type,last.events.find(e=>e.ordre)?.ordre.map(o=>o.premier)]));
  }
}finally{m.close();}
writeFileSync(out,JSON.stringify({sha,results})+'\n',{flag:'wx'});
