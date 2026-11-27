import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {copyFileSync,writeFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {join} from 'node:path';
import {isDeepStrictEqual as equal} from 'node:util';
import {mount} from '../ls19-ligne-90/montage.mjs';
import {dialogue} from '../g50t-ligne-23/dialogue.mjs';

export const candidate='0540f12425e9004dd63b3d701b9e4ea125c17482';
const blob=execFileSync('git',['show',candidate+':tests/fixtures/sic-point-contrasts-public.json.gz']);
assert.equal(createHash('sha256').update(blob).digest('hex'),'72ba64fea5d81508bda021561dcdc0b913360b36c8014e2824f10c9b55607c22');
const [sha,name,mode,receipt]=process.argv.slice(2),fixture=JSON.parse(gunzipSync(blob))[name];
const memory=['sans-positif','paires-connues'].includes(mode);
assert.ok(fixture && (memory || ['direct','lecture','dedans','dehors'].includes(mode)));
const altered=['dedans','dehors'].includes(mode);
const tree=mount(sha,'.'),turns=[];
let intervention=null;
try{
  copyFileSync(new URL('./moteur.mjs',import.meta.url),join(tree.program,'worker.mjs'));
  if(mode!=='direct')copyFileSync(new URL(memory?'./memoire.mjs':'./sonde.mjs',import.meta.url),join(tree.program,'sonde.mjs'));
  if(memory)writeFileSync(join(tree.program,'intervention.txt'),mode);
  await dialogue(['--permission','--allow-fs-read='+tree.program,'worker.mjs'],tree.program,async({send})=>{
    let observation=fixture.observations[0];
    const limit=memory?3:altered?4:fixture.commands.length;
    for(let i=0;i<=limit;i++){
      const d=await send(i?{observation}:{observation,budgets:fixture.budgets,sessionId:fixture.sessionId});
      turns.push(d);
      if(i===limit)break;
      const command=fixture.commands[i];
      if(!d.ticket || d.ticket.actionRef!=='ACTION'+command.id || !equal(d.ticket.data,command.data??{}))break;
      if(altered && i===3){
        const probe=d.diagnostic.findLast(p=>p.ref===d.ticket.observationRef);
        const selected=probe.alternatives.find(o=>equal(o.action.data,d.ticket.data));
        const keys=new Set(selected.pixels.map(String));
        const f=structuredClone(observation.frame);
        const inside=[d.ticket.data.x,d.ticket.data.y];assert.ok(keys.has(String(inside)));
        let outside;
        for(let dist=1;!outside && dist<f.length;dist++){
          outside=[[inside[0]+dist,inside[1]],[inside[0]-dist,inside[1]],[inside[0],inside[1]+dist],[inside[0],inside[1]-dist]]
            .find(([x,y])=>y>=0 && y<f.length && x>=0 && x<f[y].length && !keys.has(String([x,y])));
        }
        const [x,y]=mode==='dedans'?inside:outside;
        intervention={x,y,avant:f[y][x],apres:(f[y][x]+1)%16};
        f[y][x]=intervention.apres;
        observation={...observation,frame:f,frames:[f],stepIndex:i+1};
      }else observation=fixture.observations[i+1];
    }
  });
}finally{tree.close();}
writeFileSync(receipt,JSON.stringify({sha,name,mode,turns,intervention})+'\n',{flag:'wx'});
console.log(JSON.stringify({jeu:name,mode,observations:turns.length,contrastes:turns.flatMap((d,i)=>d.ticket && d.strategy==='point_contrast'?[i+1]:[]),
  refus:!turns.at(-1).ticket}));
process.exitCode=Number(turns.length!==(memory?4:altered?5:fixture.commands.length+1));
