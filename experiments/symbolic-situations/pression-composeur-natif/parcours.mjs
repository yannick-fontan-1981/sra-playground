import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {measureNativeObservation} from '../src/logos-engine/v6-native-observer.ts';
import {createGameDispatcher} from '../src/runtime/native-game-dispatcher.ts';
import {createSicPublicInputExploration} from '../src/sic/public-input-exploration.ts';
import {assessPressurePlan,choosePressureReserve,observePressureReserve,retainPressureReserve} from '../src/sic/observed-pressure-reserve.ts';
import {annotateTravelMarks,observedTravelActor,observeTravel} from '../src/sic/observed-travel-frontier.ts';

const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const cases=[
  {prefix:[1,2,3,4,2,4,1,1,1,1,3,3,3,2], closure:14, crossing:6, ink:0},
  {prefix:[1,3,1,1,3,2,4,2,2,2,4,4], closure:6, crossing:12, ink:5},
];
const command=id=>({action_ref:'ACTION'+id,data:{}});
const planView=p=>p?{actions:p.actions.map(x=>x.action_ref),pressure:p.pressurePlan?.goal??null}:null;

async function play(spec){
  const game=createGameDispatcher(async()=>{throw Error('Jeu natif requis');});
  let board=await game.dispatch({type:'load',code:'SS05',level:1});
  let model,travel,seq=0;
  const inputs=board.availableActionIds.map(command);
  const rows=()=>board.frame.map(row=>row.map(x=>(x+spec.ink)%16));
  const note=(image,state=board)=>measureNativeObservation({frame_rows:image,frame_hash:digest(image),
    level:state.level,levels_completed:state.levelsCompleted,state:state.state,
    available_action_refs:inputs.map(x=>x.action_ref)},seq+1,'operator-pressure-reserve');

  async function step(cmd,plan,id='return:'+String(seq+1)){
    const before=rows();
    board=await game.dispatch({type:'action',actionId:Number(cmd.action_ref.slice(6))});
    seq++;
    const after=rows();
    if(!board.levelsCompleted){
      if(plan)assert.equal(assessPressurePlan(model,travel,after,plan),true);
      travel=annotateTravelMarks(observeTravel(travel,before,after,cmd,id),before);
      model=observePressureReserve(model,travel,before,after,cmd,id,plan);
    }
    return {before,after};
  }
  for(const action of spec.prefix)await step(command(action));
  assert.equal(model.gate.closedRef,'return:'+spec.closure);
  assert.equal(model.bridge.ref,'return:'+spec.crossing);
  assert.equal(model.shortage,'return:'+spec.prefix.length);

  board=await game.dispatch({type:'reset'});
  model=retainPressureReserve(model);
  const actor=observedTravelActor(travel,rows());
  travel={...travel,actor,visited:[actor],supports:[],tested:{},altered:[],controls:[],completed:[],switches:{},stalled:0};

  const family=createSicPublicInputExploration(),start=family.state();
  const restore=(obs,m=model,t=travel)=>family.restore(structuredClone({...start,epoch:obs.level_epoch,pressureReserve:m,travel:t}));
  const open=await note(rows());
  const saved=model,checkpoint=rows();
  restore(open,{...saved,gate:{...saved.gate,closedRef:undefined}});
  const without=await family.propose(open,checkpoint,inputs,45);
  assert.equal(without?.pressurePlan,undefined);
  let fallback=null;
  if(without?.actions[0]){
    const fallbackAction=without.actions[0];
    const issued=family.before(without,0,{frame_rows:checkpoint},open);
    assert.equal(issued.admitted,true);
    const fresh=createGameDispatcher(async()=>{throw Error('Jeu natif requis');});
    const nativeBefore=await fresh.dispatch({type:'load',code:'SS05',level:1});
    const palette=image=>image.map(row=>row.map(x=>(x+spec.ink)%16));
    assert.equal(digest(palette(nativeBefore.frame)),digest(checkpoint));
    const observed=await fresh.dispatch({type:'action',actionId:Number(fallbackAction.action_ref.slice(6))});
    const actual=palette(observed.frame);
    fallback={command:fallbackAction.action_ref,admitted:issued.admitted,return:digest(actual),
      changed:digest(actual)!==digest(checkpoint),levels:observed.levelsCompleted,
      actor:observedTravelActor(travel,actual)};
  }
  const irrelevant=saved.refs.find(ref=>![saved.gate.closedRef,saved.gate.openRef,saved.bridge.ref].includes(ref));
  assert.ok(irrelevant);
  restore(open,{...saved,refs:saved.refs.filter(x=>x!==irrelevant)});
  const other=await family.propose(open,checkpoint,inputs,45);
  assert.ok(other?.pressurePlan);
  restore(open);
  const restored=await family.propose(open,checkpoint,inputs,45);
  assert.ok(restored?.pressurePlan);
  assert.deepEqual(restored.actions,other.actions);
  assert.deepEqual(restored.pressurePlan.expected,other.pressurePlan.expected);
  assert.ok(restored.pressurePlan.evidence.includes(saved.gate.closedRef));
  const evidenceTest={closed:saved.gate.closedRef,without:planView(without),restored:planView(restored),
    control:planView(other),fallback,sameBoard:digest(checkpoint)};
  const route=[];
  let negative;
  for(let i=0;i<45&&!board.levelsCompleted;i++){
    const before=rows(),oldBoard=board,obs=await note(before);
    restore(obs);
    const p=await family.propose(obs,before,inputs,45-i);
    assert.ok(p?.pressurePlan);
    const plan=p.pressurePlan;
    const guard=family.before(p,0,{frame_rows:before},obs);
    assert.equal(guard.admitted,true);
    const previous=model,previousTravel=travel;
    const {after}=await step(plan.command,plan);
    const row={index:i+1,command:plan.command.action_ref,goal:plan.goal,target:plan.target,expected:plan.expected,
      evidence:plan.evidence,guard:guard.reason,return:digest(after),levels:board.levelsCompleted};
    if(!board.levelsCompleted){
      const observedAfter=await note(after);
      const gate=await family.after(p,0,obs,observedAfter,before,after);
      assert.deepEqual([gate.matched,gate.seal_prefix,gate.reason],[true,true,'pressure_projection_confirmed']);
      row.match=gate.reason;
      if(i===0){
        assert.notEqual(digest(before),digest(after));
        const bogus=await note(before,oldBoard);
        const negativeReturn=await family.after(p,0,obs,bogus,before,before);
        assert.deepEqual([negativeReturn.matched,negativeReturn.seal_prefix,negativeReturn.reason],[false,true,'pressure_projection_contradicted']);
        const denied=observePressureReserve(previous,previousTravel,before,before,plan.command,bogus.observation_ref,plan);
        assert.deepEqual(denied.refs,previous.refs);
        assert.deepEqual(denied.gate,previous.gate);
        assert.deepEqual(denied.bridge,previous.bridge);
        assert.equal(denied.refused.length,previous.refused.length+1);
        const alternative=choosePressureReserve(denied,previousTravel,before,inputs);
        assert.notEqual(alternative?.command.action_ref,plan.command.action_ref);
        negative={trueReturn:digest(after),shown:digest(before),command:plan.command.action_ref,
          result:negativeReturn.reason,rejected:denied.refused.at(-1),next:alternative?.command.action_ref??null,references:denied.refs.length};
      }
    }
    route.push(row);
  }
  assert.equal(board.levelsCompleted,1);
  assert.equal(route.length,32);
  assert.ok(negative);
  assert.deepEqual([...new Set(route.map(x=>x.goal))],['reserve_weight','build_crossing','cross_to_exit']);
  return {closure:spec.closure,crossing:spec.crossing,ink:spec.ink,prefix:spec.prefix.length,evidenceTest,negative,
    first:route[0].command,actions:route.length,confirmations:route.filter(x=>x.match).length,sha:digest(route),route};
}
const result=[];
for(const spec of cases)result.push(await play(spec));
console.log(JSON.stringify(result));
