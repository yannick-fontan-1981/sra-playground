import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {mock} from 'node:test';
import {parseArgs} from 'node:util';
import {digest,rejouerService} from '../rejouer-service.mjs';
import {withEngine} from '../moteur-reference.mjs';

const variants=['nominal','permute','stationnaire','sans-controles-retenus','sans-reutilisation'];
const contentDigest=value=>createHash('sha256').update(JSON.stringify(value,(_key,item)=>
  item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().map(k=>[k,item[k]])):item)).digest('hex');
const cacheView=c=>c&&{epoch:c.epoch,context:c.context_ref,refs:c.training_features.values.model_feature_rows.map(row=>row.model_ref),
  hash:contentDigest(c.training_features),featuresHash:digest(c.training_features.values.model_feature_rows.map(row=>
    [row.model_ref,row.features.map(f=>[f.feature_ref,f.value])])),controls:c.controls};
const sceneView=s=>s&&{context:s.context_ref,palette:s.palette,examples:s.panels.map(p=>({label:p.label,scale:p.scale,box:p.bbox,
  words:p.words.map(w=>w.values)})),query:s.query.words[0],queryScale:s.query.scale,buttons:s.buttons};
const inferenceView=i=>{
  const ind=i.induction,v=ind.values,roots=v.observation_compatible_version_space.map(p=>p.predicate_ref);
  const grammar=new Map((i.grammar??[]).map(node=>[node.node_ref,node]));
  const literal=root=>{
    const g=grammar.get(root),atom=g?.kind==='NOT'?grammar.get(g.child_refs[0]):g;
    return atom&&{kind:g.kind,feature:atom.feature_ref,comparator:atom.comparator,value:atom.value};
  };
  return {roots,tests:roots.map(literal),status:ind.status,complete:ind.domain_complete,cause:ind.cause,examined:ind.examined_count,
    predictions:[...new Set(v.label_predictions.map(p=>p.predicted_label_ref))],agreement:v.robust_answer_and_submission_agreement,
    modelUnique:v.unique_law_proved,release:v.classification_submission_authorized,created:v.predicted_training_example_created,
    training:cacheView(i.training_cache),reused:i.training_reused,native:i.native_composition?{status:i.native_composition.status,
      complete:i.native_composition.complete}:null,
    query:i.query_features.values.model_feature_rows[0]?.features.map(f=>[f.feature_ref,f.value])??[]};
};

function swapTokens(board,measure,swap,prior){
  const scene=measure(board.frame,prior),word=scene?.query.words[0];
  assert.ok(word);
  const [first,second]=swap;
  assert.ok(first<word.boxes.length&&second<word.boxes.length&&word.values[first]!==word.values[second]);
  const changed=board.frame.map(row=>[...row]);
  for(const [at,from] of [[first,second],[second,first]]){
    const [l,t,r,b]=word.boxes[at];
    for(let y=t;y<=b;y++)for(let x=l;x<=r;x++){
      assert.equal(changed[y][x],word.values[at]);
      changed[y][x]=word.values[from];
    }
  }
  const observed=measure(changed,prior);
  assert.ok(observed);
  const base=sceneView(scene),used=sceneView(observed),expected=[...base.query.values];
  [expected[first],expected[second]]=[expected[second],expected[first]];
  assert.deepEqual(used,{...base,query:{...base.query,values:expected}});
  return {shown:{...board,frame:changed,frames:[changed]},base,used,swap};
}

export async function play(engine,variant,vendor,targetTurn,swap){
  assert.ok(variants.includes(variant));
  const permutation=variant==='permute';
  assert.ok(!permutation||Number.isInteger(targetTurn)&&targetTurn>0&&swap?.length===2&&swap.every(i=>Number.isInteger(i)&&i>=0));
  const prefix='src/logos-engine/v6-labeled-sequence-';
  const {LabeledSequenceMemory,labeledSequenceBefore}=await import(new URL(prefix+'access.ts',engine));
  const {measureLabeledSequence}=await import(new URL(prefix+'observation.ts',engine));
  const family=LabeledSequenceMemory.prototype,cuts=new Map(),records=new Map(),guards=new Map();
  const propose=family.proposeLabeled,record=family.record;
  const hooks=[mock.method(Date,'now',()=>1700000000000)];
  let turn=1,contrast=null,controlCache=null;
  const permute=board=>{
    const {shown,...entry}=swapTokens(board,measureLabeledSequence,swap,controlCache);
    contrast=entry;
    return shown;
  };
  hooks.push(mock.method(family,'proposeLabeled',function(obs,rows,inputs,limit,config,deadline,now,base,native){
    const prior=this.cache,noControls=turn===2&&variant==='sans-controles-retenus',
      noReuse=turn===2&&variant==='sans-reutilisation';
    if(noControls||noReuse){
      assert.ok(prior);
      this.cache=noControls?{...prior,controls:[]}:{...prior,context_ref:prior.context_ref+':recompute'};
    }
    try{
      const usable=this.cache?.epoch===obs.level_epoch?this.cache:null,
        scene=measureLabeledSequence(rows,usable?.controls??null);
      const pre=structuredClone({ref:obs.observation_ref,epoch:obs.level_epoch,input:digest(rows),available:obs.available_action_refs,
        examples:sceneView(scene),reference:cacheView(prior),used:cacheView(usable),recent:this.events.slice(-1).map(e=>({ref:e.after_ref,
          before:e.before_frame,after:e.after_frame,command:e.command})),syntax:native?.composedPredicates===true?'atomic_or_composed':'atomic'});
      const cut={pre,seal:digest(pre)};
      cuts.set(obs.observation_ref,cut);
      const p=propose.call(this,obs,rows,inputs,limit,config,deadline,now,base,native);
      cut.result=p?{status:p.status,reason:p.reason??null}:null;
      if(p?.labeled_sequence_plan){
        const meta={epoch:obs.level_epoch,score:obs.levels_completed,observation_ref:obs.observation_ref,available:obs.available_action_refs};
        guards.set(obs.observation_ref,{live:labeledSequenceBefore(p,0,rows,meta),
          stale:labeledSequenceBefore(p,0,rows,{...meta,observation_ref:meta.observation_ref+':old'})});
      }
      return p;
    }finally{if(noControls||noReuse)this.cache=prior;}
  }));
  hooks.push(mock.method(family,'record',function(...args){
    const events=record.apply(this,args);
    if(events.length){
      const e=events[0];
      controlCache=e.cache.controls;
      records.set(e.after_ref,structuredClone({...e,cache:cacheView(e.cache)}));
    }
    return events;
  }));
  try{
    const r=await rejouerService({engine,vendor,gameCode:'CATL',sessionId:'catl-50',entries:{cuts,records,guards},
      limit:variant==='nominal'?16:variant==='stationnaire'?1:permutation?targetTurn-1:2,reprise:variant!=='nominal',
      onTurn:i=>turn=i,initial:board=>permutation&&targetTurn===1?permute(board):board,
      describe(p,index){
        const plan=p.labeled_sequence_plan;
        return {plan:plan?{label:plan.label,button:plan.button,step:p.steps[index],scope:plan.scope,
          inference:inferenceView(plan.inference)}:null};
      },
      present({board,actual,i}){
        if(variant==='stationnaire')return {...board,frames:[board.frame]};
        if(permutation&&i===targetTurn-1)return permute(actual);
        return actual;
      }});
    return {...r,contrast};
  }finally{for(const h of hooks.reverse())h.mock.restore();}
}

if(import.meta.main){
  const {values}=parseArgs({options:{source:{type:'string'},moteur:{type:'string',default:'candidat'},pyodide:{type:'string'},
    variante:{type:'string',default:'nominal'},tour:{type:'string'},echanges:{type:'string'},recu:{type:'string'}}});
  const run=e=>play(e,values.variante,resolve(values.pyodide),Number(values.tour),values.echanges?.split(',').map(Number));
  const r=values.source?await run(values.source):await withEngine(values.moteur,run);
  await writeFile(values.recu,JSON.stringify(r,null,2)+'\n');
  for(const s of r.steps)console.log(s.i,s.pre.level,s.pre.kind,JSON.stringify(s.pre.command),s.after.matched,s.after.levels);
  if(r.stop)console.log(r.stop);
}
