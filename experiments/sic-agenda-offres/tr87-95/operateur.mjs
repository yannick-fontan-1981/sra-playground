import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {mock} from 'node:test';
import {parseArgs} from 'node:util';
import {digest,rejouerService} from '../rejouer-service.mjs';
import {withEngine} from '../moteur-reference.mjs';

const glyphs=w=>w?.map(id=>id.slice(0,12))??null;
const pair=s=>s&&[glyphs(s[0]),s[1]];
const scene=s=>s&&{source:s.source,editable:s.editable,cursor:s.cursor,target:glyphs(s.target),
  rules:s.rule_count,derivations:s.parse_count,complete:s.bounded_derivations_complete};
const acquired=f=>({keys:[...f.verified].sort(),tried:[...f.tried].sort(),refs:[...f.refs],
  edits:[...f.editGraph].map(([k,edges])=>[k,[...edges].map(v=>glyphs(v))]),directions:[...f.focusDirections]});

export async function play(engine,variant,vendor){
  const {WordInterface,measureWordBoard,measureWordScene,wordGlyphs}=await import(new URL('src/logos-engine/v6-word-interface.ts',engine));
  const {geometricComponents}=await import(new URL('src/logos-engine/v6-native-observer.ts',engine));
  const family=WordInterface.prototype,propose=family.propose,record=family.record;
  const cuts=new Map(),records=new Map(),guards=new Map(),hooks=[mock.method(Date,'now',()=>1700000000000)];
  let turn=1,change=null;
  hooks.push(mock.method(family,'propose',async function(obs,rows,inputs,limit){
    const observed=measureWordBoard(obs,rows),layout=this.epoch===obs.level_epoch?this.scene:await measureWordScene(obs,rows);
    const pairs=observed&&await Promise.all(observed.table.map(async ([a,b])=>({types:[a.type,b.type],boxes:[a.box,b.box],
      words:[glyphs(await wordGlyphs(rows,a,observed.ink)),glyphs(await wordGlyphs(rows,b,observed.ink))]})));
    const pre={ref:obs.observation_ref,epoch:obs.level_epoch,input:digest(rows),available:obs.available_action_refs,
      table:pairs,scene:scene(layout),native:acquired(this),
      sourceWord:layout&&glyphs(await wordGlyphs(rows,layout.source,layout.ink))};
    const cut={pre,seal:digest(pre)};
    cuts.set(obs.observation_ref,cut);
    const p=await propose.call(this,obs,rows,variant==='ordre-entrees'&&turn===1?[...inputs].reverse():inputs,limit);
    cut.local=p?{command:p.actions[0],expected:pair(p.steps[0].expected_after)}:null;
    if(p){
      const packet={level:obs.level_epoch,levels_completed:obs.levels_completed,frame_rows:rows,available_action_refs:obs.available_action_refs};
      guards.set(obs.observation_ref,{live:await this.before(p,0,packet,obs),stale:await this.before(p,0,packet,{...obs,
        observation_ref:obs.observation_ref+':old'})});
    }
    return p;
  }));
  hooks.push(mock.method(family,'record',async function(b,a,cmd,first,second,p,i){
    const result=await record.call(this,b,a,cmd,first,second,p,i);
    records.set(a.observation_ref,{event:result,native:acquired(this),measured:b.level_epoch===a.level_epoch?pair(await this.read(second)):null});
    return result;
  }));
  function collapseTypes(rows){
    const parts=geometricComponents(rows);
    const obs={entities:parts.map(v=>({...v,palette_value:v.color}))},m=measureWordBoard(obs,rows);
    assert.ok(m?.table.length);
    const next=structuredClone(rows);
    const yCut=variant==='sans-types'?13:22;
    const rowsToChange=m.table.filter(([,right])=>right.box[0]===45&&right.box[1]===yCut);
    assert.equal(rowsToChange.length,1);
    change=rowsToChange.map(([left,right])=>{
      const [l,t,r,b]=right.box;
      let changed=0;
      for(let y=t;y<=b;y++)for(let x=l;x<=r;x++)if(next[y][x]===right.type){next[y][x]=left.type;changed++;}
      assert.ok(changed);
      return {box:right.box,from:right.type,to:left.type,changed,glyphInk:m.ink};
    });
    return next;
  }
  try{
    const result=await rejouerService({engine,vendor,gameCode:'TR87',sessionId:'tr87-95',
      limit:variant==='nominal'?16:1,reprise:true,entries:{cuts,records,guards},onTurn:i=>turn=i,
      initial(board){
        if(!['sans-types','type-temoin'].includes(variant))return board;
        const frame=collapseTypes(board.frame);
        return {...board,frame,frames:[frame]};
      },
      describe(p,i){
        const step=p.steps[i];
        return {plan:p.word_plan?{info:p.word_plan,before:pair(step.state),expected:pair(step.expected_after),
          path:p.actions.map(a=>a.action_ref),question:p.question.reason}:null};
      },
      present({board,actual,i}){
        if(variant==='stationnaire'&&i===1)return {...board,frames:[board.frame]};
        return actual;
      }});
    return {...result,change,cuts:[...cuts.values()]};
  }finally{for(const h of hooks.reverse())h.mock.restore();}
}

if(import.meta.main){
  const {values}=parseArgs({options:{source:{type:'string'},moteur:{type:'string',default:'candidat'},pyodide:{type:'string'},
    variante:{type:'string',default:'nominal'},recu:{type:'string'}}});
  assert.ok(['nominal','sans-types','type-temoin','ordre-entrees','stationnaire'].includes(values.variante));
  const go=e=>play(e,values.variante,resolve(values.pyodide));
  const r=values.source?await go(values.source):await withEngine(values.moteur,go);
  await writeFile(values.recu,JSON.stringify(r,null,2)+'\n');
  for(const s of r.steps)console.log(s.i,s.pre.level,s.pre.family,JSON.stringify(s.pre.command),s.after.record?.event?.status,
    s.after.matched,s.after.seal,s.after.levels);
  console.log('suite',r.next?.command,r.next?.family,r.stop,r.change);
}
