import assert from 'node:assert/strict';
import test from 'node:test';
import {measureNativeObservation} from '../src/logos-engine/v6-native-observer.ts';
import {newCursorMemory,offerCursorTrial,recordCursorTrial} from '../src/sic/marked-cursor-selection.ts';
import {createPreparedEffects} from '../src/sic/test-prepared-effects.ts';
import {evidencedPlanGroup,recurrentExperimentGroup} from '../src/sic/experiment-arbitration.ts';
import {validateV6PublicObservation} from '../src/runtime/v6-agent-protocol.ts';
import {defaultRecoveryPack} from '../src/sic/active-recovery.ts';
import {readRecoveryRevision,recoveryRevision} from '../src/sic/recovery-pack.ts';

const palette=['#141414','#e36b28','#2674db','#fff','#292929','#f4df14'];

test('an exploration preference can test two control hypotheses on unfamiliar ground',async()=>{
  const first=board(),advanced=board(0,13,3,false,5),selected=board(1,13,3,false,5),moved=board(1,15,3,false,5);
  for (const rows of [first,advanced,selected]) rows[7]![19]=4;
  const [a,b,c,d]=await Promise.all([first,advanced,selected,moved].map((frame,i)=>observation(frame,i)));
  for (const [mode,minimumOutcomes,shouldOffer] of [['shadow',2,false],['active',3,false],['active',2,true]] as const) {
    const pack=recoveryRevision({...defaultRecoveryPack,solver:'sic-fallback',informationPreference:{strategy:'motion_contrast',mode,minimumOutcomes}});
    const family=createPreparedEffects(readRecoveryRevision(pack).configuration.informationPreference);
    await family.observePublicOutcome!(a!,b!,{action_ref:'ACTION4',data:{}},first,advanced);
    const solving=await family.proposeInGroup!(evidencedPlanGroup,b!,advanced,[],20,{});
    assert.ok(!solving?.cursorSelectionForecast);
    const plan=await family.proposeInGroup!(recurrentExperimentGroup,b!,advanced,[],20,{});
    const trial=plan?.cursorSelectionForecast;
    assert.equal(!!trial,shouldOffer);
    if(!trial)continue;
    assert.equal(plan.sicSituationCard.mode,'exploration');
    assert.equal(trial.projectedMove,undefined);
    assert.equal(trial.contrast.motor,'ACTION4');
    assert.deepEqual(trial.contrast.outcomes,['previous_subject_moves','selected_subject_moves']);
    await family.record!(b!,c!,plan.actions[0]!,advanced,selected,plan);
    const follow=await family.proposeInGroup!(evidencedPlanGroup,c!,selected,[],19,{});
    assert.equal(follow.actions[0]?.action_ref,'ACTION4');
    const receipt=await family.record!(c!,d!,follow.actions[0]!,selected,moved,follow);
    assert.equal(receipt.events[0]?.result,'new_cursor_moved_while_previous_cursor_stayed');
    const advance=await family.proposeInGroup!(evidencedPlanGroup,d!,moved,[],18,{});
    assert.equal(advance.cursorSelectionForecast.stage,'advance');
    assert.equal(advance.sicSituationCard.mode,'solving');
    assert.deepEqual(advance.cursorSelectionForecast.source.box,trial.source.box);
    const another=board(1,17,3,false,5),end=await observation(another,4);
    const applied=await family.record!(d!,end,advance.actions[0]!,moved,another,advance);
    assert.equal(applied.events[0]?.result,'advanced_selected_subject_preserving_previous_placement');
    assert.equal(family.state!().cursorSelection.pending,undefined);
  }
});
function board(active=0,right=13,mark=3,edge=false,first=3) {
  const rows=Array.from({length:20},()=>Array<number>(26).fill(0));
  for(const [i,left] of [first,right].entries()){
    for(let y=6;y<11;y++)rows[y]!.fill(i+1,left,left+5);
    if(i===active)rows[edge?6:8]![left+2]=mark;
  }
  return rows;
}
const observation=(rows:number[][],rev:number,controls=['ACTION1','ACTION4','ACTION6'])=>measureNativeObservation({
  frame_rows:rows,frame_packet:[rows],frame_hash:'hash'+JSON.stringify(rows),level:1,levels_completed:0,
  state:'NOT_FINISHED',step_index:rev,palette,available_action_refs:controls,
},rev,'test');

test('a verified mark can survive a turn in place before an alternative motor reveals translation',async()=>{
  const first=board(), selected=board(1), turned=board(1,13,3,true), moved=board(1,18,3,true);
  const [a,b,c,d]=await Promise.all([first,selected,turned,moved].map((rows,i)=>observation(rows,i)));
  for(const enabled of [false,true]){
    const m=newCursorMemory();m.verifyPoseChange=enabled;
    const trial=offerCursorTrial(m,a!,first,true)!;
    assert.equal(recordCursorTrial(m,a!,b!,first,selected,trial.command,trial),'cursor_mark_transferred');
    const verify=m.pending!;
    const result=recordCursorTrial(m,b!,c!,selected,turned,verify.command,verify);
    assert.equal(result,enabled?'marked_subject_retained_try_another_motor':'cursor_control_unconfirmed');
    if(enabled){
      assert.equal(m.pending!.command,'ACTION4');
      assert.equal(recordCursorTrial(m,c!,d!,turned,moved,'ACTION4',m.pending),'new_cursor_moved_while_previous_cursor_stayed');
    }else assert.equal(m.pending,undefined);
  }
});

test('different silhouettes can compete for control before the second displacement is known',async()=>{
  function scene(first:number,second:number,selected=false) {
    const rows=Array.from({length:18},()=>Array<number>(32).fill(0));
    for(let y=5;y<8;y++)rows[y]!.fill(1,first,first+3);
    for(let y=5;y<8;y++)rows[y]!.fill(selected?5:2,second,second+2);
    rows[7]![second+2]=selected?5:2;
    return rows;
  }
  const frames=[scene(2,17),scene(5,17),scene(5,17,true),scene(5,19,true),scene(5,21,true)];
  const [a,b,c,d,e]=await Promise.all(frames.map((f,i)=>observation(f,i)));
  for(const mode of ['shadow','active'] as const){
    const f=createPreparedEffects({mode,strategy:'motion_contrast',minimumOutcomes:2});
    await f.observePublicOutcome!(a!,b!,{action_ref:'ACTION4',data:{}},frames[0]!,frames[1]!);
    const offer=await f.proposeInGroup!(recurrentExperimentGroup,b!,frames[1]!,[],12,{});
    if(mode==='shadow'){assert.ok(!offer?.cursorSelectionForecast);continue;}
    const t=offer?.cursorSelectionForecast;
    assert.equal(t?.basis,'motor_scale');assert.deepEqual(t.contrast.baselineDelta,[3,0]);
    assert.equal(t.projectedMove,undefined);assert.deepEqual(t.target.box,[17,5,19,7]);
    const clicked=await f.record!(b!,c!,offer.actions[0]!,frames[1]!,frames[2]!,offer);
    assert.equal(clicked.events[0]?.result,'selection_changed_pending_motor');
    const verify=await f.proposeInGroup!(evidencedPlanGroup,c!,frames[2]!,[],11,{});
    assert.equal(verify.actions[0].action_ref,'ACTION4');
    const observed=await f.record!(c!,d!,verify.actions[0]!,frames[2]!,frames[3]!,verify);
    assert.equal(observed.events[0].result,'new_cursor_moved_while_previous_cursor_stayed');
    const reuse=await f.proposeInGroup!(evidencedPlanGroup,d!,frames[3]!,[],10,{});
    assert.equal(reuse.cursorSelectionForecast.stage,'advance');
    const result=await f.record!(d!,e!,reuse.actions[0]!,frames[3]!,frames[4]!,reuse);
    assert.equal(result.events[0].result,'advanced_selected_subject_preserving_previous_placement');
  }
});

test('distinguishes a transported turn from turning in place during a control experiment',async()=>{
  const corner=[[0,0],[1,0],[2,0],[0,1],[0,2]],hook=[[0,0],[1,0],[2,0],[0,1],[1,1],[0,2]];
  function frame(first:number,second:number,turnA=false,turnB=false){
    const rows=Array.from({length:20},()=>Array<number>(35).fill(0));
    for(const [origin,ink,mask,turn] of [[first,1,corner,turnA],[second,2,hook,turnB]] as const){
      for(const [x,y] of mask)rows[6+(turn?x!:y!)]![origin+(turn?2-y!:x!)]=ink;
    }
    return rows;
  }
  const initial=frame(2,17),walk=frame(5,17,true),turnOnly=frame(5,17,true,true),transit=frame(5,20,true,true);
  const [a,b,c,d]=await Promise.all([initial,walk,turnOnly,transit].map((v,i)=>observation(v,i)));
  for(const [result,visible,expected] of [[c!,turnOnly,false],[d!,transit,true]] as const){
    const mem=newCursorMemory(),preference={mode:'active',strategy:'motion_contrast',minimumOutcomes:2} as const;
    recordCursorTrial(mem,a!,b!,initial,walk,'ACTION4');
    assert.equal(mem.motions.some(m=>m.box[0]===5),false);
    const t=offerCursorTrial(mem,b!,walk,false,true,preference)!;
    assert.deepEqual(t.target.box,[17,6,19,8]);
    assert.equal(recordCursorTrial(mem,b!,b!,walk,walk,t.command,t),'cursor_click_visually_unchanged');
    const verify=offerCursorTrial(mem,b!,walk)!;
    const receipt=recordCursorTrial(mem,b!,result,walk,visible,verify.command,verify);
    assert.equal(receipt==='new_cursor_moved_while_previous_cursor_stayed',expected);
    assert.equal(!!mem.verified,expected);
  }
});

test('repairs a blocked protected step and checks both subjects again',async()=>{
  const initial=board(),a=board(0,13,3,false,5),b=board(1,13,3,false,5),c=board(1,15,3,false,5);
  // An unfamiliar entry surface calls for the declarative information preference.
  for(const frame of [initial,a,b])frame[7]![19]=4;
  const [oa,ob,oc,od]=await Promise.all([initial,a,b,c].map((v,i)=>observation(v,i)));
  for(const parked of [true,false]){
    const f=createPreparedEffects({mode:'active',strategy:'motion_contrast',minimumOutcomes:2});
    await f.observePublicOutcome!(oa!,ob!,{action_ref:'ACTION4',data:{}},initial,a);
    const choose=await f.proposeInGroup!(recurrentExperimentGroup,ob!,a,[],10,{});
    await f.record!(ob!,oc!,choose.actions[0]!,a,b,choose);
    const verify=await f.proposeInGroup!(evidencedPlanGroup,oc!,b,[],9,{});
    await f.record!(oc!,od!,verify.actions[0]!,b,c,verify);
    const advance=await f.proposeInGroup!(evidencedPlanGroup,od!,c,[],8,{});
    const stuck=await f.record!(od!,od!,advance.actions[0]!,c,c,advance);
    assert.equal(stuck.events[0].result,'protected_advance_blocked_try_another_motor');
    const repair=await f.proposeInGroup!(evidencedPlanGroup,od!,c,[],7,{});
    assert.equal(repair.cursorSelectionForecast.stage,'reroute');
    assert.equal(repair.sicSituationCard.mode,'exploration');
    assert.equal(repair.actions[0].action_ref,'ACTION1');
    assert.deepEqual(repair.cursorSelectionForecast.triedMotors,['ACTION4']);
    assert.ok(repair.cursorSelectionForecast.repairOptions.length);
    const rows=c.map(r=>r.slice());
    for(let y=4;y<=10;y++)for(let x=15;x<=19;x++)rows[y]![x]=y<=8?c[y+2]![x]!:0;
    if(!parked)rows[6]![5]=0;
    const receipt=await f.record!(od!,await observation(rows,4),repair.actions[0]!,c,rows,repair);
    assert.equal(receipt.events[0].result,parked?'alternative_moved_selected_subject_preserving_previous_placement':'protected_advance_unconfirmed');
    assert.equal(f.state!().cursorSelection.pending,undefined);
  }
});

test('follows the rotated body within a marked footprint and checks a step past the recovered site',async()=>{
  function scene(top:number,turned:boolean,onlyMark=false){
    const rows=Array.from({length:18},()=>Array<number>(30).fill(0));
    for(let y=4;y<=6;y++)rows[y]!.fill(1,4,7);
    const shape=turned?[[1,0],[1,1],[1,2],[0,0]]:[[0,0],[1,0],[2,0],[0,1]];
    for(const [x,y] of shape)rows[top+y!]![15+x!]=2;
    rows[top+2]![onlyMark?17:15]=3;
    return rows;
  }
  const first=scene(8,false),turned=scene(5,true),extended=scene(2,true);
  const [a,b,c]=await Promise.all([first,turned,extended].map((r,i)=>observation(r,i)));
  const trial={source:{box:[4,4,6,6],ink:1},target:{box:[15,8,17,10],ink:2},point:[16,8],
    priorBox:[15,5,17,7],offsets:[[0,2]],ink:3,shape:'different-bodies',stage:'reroute',command:'ACTION1',evidence:[],feedback:true} as const;
  const memory=newCursorMemory();
  const repair={...trial,source:{...trial.source},target:{...trial.target},evidence:[],offsets:[trial.offsets[0]]};
  assert.equal(recordCursorTrial(memory,a!,b!,first,turned,'ACTION1',repair),'alternative_returned_to_previous_placement');
  const step=offerCursorTrial(memory,b!,turned)!;
  assert.ok(step.beyondReturn);assert.equal(step.command,'ACTION1');
  assert.equal(recordCursorTrial(memory,b!,c!,turned,extended,'ACTION1',step),'continued_alternative_preserving_previous_placement');
  assert.equal(memory.pending,undefined);
  const blink=scene(8,false,true);
  const other=newCursorMemory();
  assert.equal(recordCursorTrial(other,a!,await observation(blink,1),first,blink,'ACTION1',repair),'protected_advance_unconfirmed');
  assert.equal(other.pending,undefined);
});

test('defers a click based on incompatible movement scales until the current exploration stalls',async()=>{
  function scene(d:number){
    const r=Array.from({length:24},()=>Array<number>(48).fill(0));
    for(let y=3;y<7;y++)r[y]!.fill(1,2+4*d,6+4*d);
    for(let y=12;y<15;y++)r[y]!.fill(2,6+2*d,9+2*d);
    for(let y=8;y<12;y++)r[y]!.fill(5,30,34);
    return r;
  }
  const first=scene(0),second=scene(1),a=await observation(first,0),b=await observation(second,1);
  const memory=newCursorMemory(),preference={mode:'active',strategy:'motion_contrast',minimumOutcomes:2} as const;
  recordCursorTrial(memory,a,b,first,second,'ACTION4');
  assert.equal(offerCursorTrial(memory,b,second,false,true,preference),null);
  recordCursorTrial(memory,b,b,second,second,'ACTION1');
  assert.equal(offerCursorTrial(memory,b,second,false,true,preference),null);
  recordCursorTrial(memory,b,b,second,second,'ACTION4');
  assert.equal(offerCursorTrial(memory,b,second,false,true,preference)?.basis,'motor_scale');
});

test('the exploration family proposes a matching piece, records the transferred mark and verifies the actual new mover',async()=>{
  const family=createPreparedEffects(),a=board(),b=board(1),c=board(1,15);
  const oa=await observation(a,0),ob=await observation(b,1),oc=await observation(c,2);
  const make=(group:string,o:typeof oa,r:number[][])=>family.proposeInGroup!(group,o,r,[],30,{});
  const click=await make(recurrentExperimentGroup,oa,a);
  assert.equal(click?.cursorSelectionForecast?.stage,'select');
  assert.deepEqual(click.actions,[{action_ref:'ACTION6',data:{x:15,y:8}}]);
  assert.ok(click.steps?.[0]?.point_binding);
  const first=await family.record!(oa,ob,click.actions[0]!,a,b,click);
  assert.equal(first.events[0]?.result,'cursor_mark_transferred');
  const probe=await make(evidencedPlanGroup,ob,b);
  assert.equal(probe?.cursorSelectionForecast?.stage,'verify');
  const receipt=await family.record!(ob,oc,probe.actions[0]!,b,c,probe);
  assert.equal(receipt.events[0]?.result,'new_cursor_moved_while_previous_cursor_stayed');
  assert.ok(family.state!().cursorSelection.verified);
});

test('uses the rendered colors when two games assign different RGB values to the same index',async()=>{
  const rows=board(),o=await observation(rows,0);
  const dim=[...palette];dim[3]='#222';
  assert.equal(offerCursorTrial(newCursorMemory(),{...o,palette:dim},rows,true),null);
  const frame=Array.from({length:64},()=>Array<number>(64).fill(0));
  const packet={frame,frames:[frame],availableActionIds:[6],state:'NOT_FINISHED',level:1,levelsCompleted:0,stepIndex:0,palette:dim};
  assert.deepEqual(validateV6PublicObservation(packet).palette,dim.map(v=>v.toUpperCase()));
  assert.throws(()=>validateV6PublicObservation({...packet,palette:['private metadata']}));
});

test('a peer with a measured landing surface offers an immediately testable motor',async()=>{
  const m=newCursorMemory(),start=board(0,13,3,false,2),rows=board();
  for(const frame of [start,rows]){
    for(let y=6;y<11;y++)frame[y]!.fill(2,20,25);
    frame[8]![18]=4;
    frame[5]!.fill(4,19,25);
  }
  const o=await observation(rows,1);
  recordCursorTrial(m,await observation(start,0),o,start,rows,'ACTION4');
  const trial=offerCursorTrial(m,o,rows,false,true);
  assert.deepEqual(trial?.point,[22,8]);
  assert.deepEqual(trial?.projectedMove,{command:'ACTION4',delta:[1,0],evidence:o.observation_ref});
  rows[8]![25]=4;
  assert.equal(offerCursorTrial(m,o,rows,false,true),null);
});

test('a refuted visual prediction can still be followed by a motor test of the two surviving bodies',async()=>{
  const m=newCursorMemory(),start=board(0,13,3,false,2),a=board(),b=board(),c=board(0,15);
  b[2]![3]=5;c[2]![3]=5;
  for(let y=6;y<11;y++){b[y]!.fill(5,13,18);c[y]!.fill(5,15,20);}
  const oa=await observation(a,1),ob=await observation(b,2);
  recordCursorTrial(m,await observation(start,0),oa,start,a,'ACTION4');
  const click=offerCursorTrial(m,oa,a)!;
  assert.equal(recordCursorTrial(m,oa,ob,a,b,click.command),'cursor_mark_prediction_refuted');
  const motor=offerCursorTrial(m,ob,b)!;
  assert.equal(motor.command,'ACTION4');
  assert.equal(motor.target.ink,5);
  assert.equal(recordCursorTrial(m,ob,await observation(c,3),b,c,motor.command,motor),'new_cursor_moved_while_previous_cursor_stayed');
  assert.ok(m.verified);assert.equal(m.verified.mark,undefined);
  const removed=board();for(let y=6;y<11;y++)removed[y]!.fill(0,13,18);
  const fresh=newCursorMemory();recordCursorTrial(fresh,await observation(start,0),oa,start,a,'ACTION4');
  recordCursorTrial(fresh,oa,await observation(removed,2),a,removed,click.command,click);
  assert.equal(fresh.pending,undefined);
});

test('requires an available click, a salient mark and a matching silhouette',async()=>{
  const m=newCursorMemory(),r=board();
  assert.equal(offerCursorTrial(m,await observation(r,0,['ACTION1']),r,true),null);
  const dark=board(0,13,4);
  assert.equal(offerCursorTrial(m,await observation(dark,1),dark,true),null);
  const none=board(-1);
  assert.equal(offerCursorTrial(m,await observation(none,2),none,true),null);
  const different=board();for(let y=6;y<11;y++)different[y]![13]=0;
  assert.equal(offerCursorTrial(m,await observation(different,3),different,true),null);
  const edge=board(0,13,5,true);
  assert.equal(offerCursorTrial(m,await observation(edge,4),edge,true)?.stage,'select');
});

test('a refused click or a moving mark alone does not establish motor control',async()=>{
  const a=board(),b=board(1),oa=await observation(a,0),ob=await observation(b,1);
  const m=newCursorMemory(),click=offerCursorTrial(m,oa,a,true)!;
  recordCursorTrial(m,oa,oa,a,a,click.command,click);
  assert.equal(m.verified,undefined);
  assert.equal(offerCursorTrial(m,oa,a,true),null);
  const n=newCursorMemory();
  recordCursorTrial(n,oa,ob,a,b,click.command,click);
  const first=offerCursorTrial(n,ob,b)!;
  assert.equal(recordCursorTrial(n,ob,ob,b,b,first.command,first),'cursor_move_blocked_try_another_direction');
  const next=offerCursorTrial(n,ob,b)!;assert.notEqual(first.command,next.command);
  const blink=board(1);blink[8]![15]=2;blink[8]![16]=3;
  assert.equal(recordCursorTrial(n,ob,await observation(blink,2),b,blink,next.command,next),'cursor_control_unconfirmed');
  assert.equal(n.verified,undefined);
});

test('learns from an ordinary click and move while leaving the other family in control',async()=>{
  const m=newCursorMemory(),a=board(),b=board(0,13,3,false,5),c=board(1,13,3,false,5),d=board(1,15,3,false,5);
  const [oa,ob,oc,od]=await Promise.all([a,b,c,d].map((r,i)=>observation(r,i)));
  recordCursorTrial(m,oa!,ob!,a,b,'ACTION4');
  const receipt=recordCursorTrial(m,ob!,oc!,b,c,'ACTION6:15,8');
  assert.equal(receipt,'cursor_mark_transferred');
  assert.equal(offerCursorTrial(m,oc!,c,true),null);
  assert.equal(recordCursorTrial(m,oc!,od!,c,d,'ACTION4'),'new_cursor_moved_while_previous_cursor_stayed');
  assert.ok(m.verified);
});

test('can hypothesize from an attached dot outside an otherwise identical silhouette',async()=>{
  const rows=board(-1);rows[5]![5]=5;
  const trial=offerCursorTrial(newCursorMemory(),await observation(rows,0),rows,true);
  assert.equal(trial?.stage,'select');
  assert.deepEqual(trial.offsets,[[2,-1]]);
  assert.deepEqual(trial.point,[15,8]);
});

test('a known choice of body can be useful again at a new site with a measurable consequence',async()=>{
  const memory=newCursorMemory(),before=board(),selected=board(1),moved=board(1,15);
  const [a,b,c]=await Promise.all([before,selected,moved].map((rows,i)=>observation(rows,i)));
  const select=offerCursorTrial(memory,a!,before,true)!;
  recordCursorTrial(memory,a!,b!,before,selected,select.command,select);
  const verify=offerCursorTrial(memory,b!,selected)!;
  recordCursorTrial(memory,b!,c!,selected,moved,'ACTION4',verify);
  assert.equal(memory.established?.length,1);
  const prior=board(0,17,3,false,2),fresh=board(0,17);
  const here=await observation(fresh,4);
  recordCursorTrial(memory,await observation(prior,3),here,prior,fresh,'ACTION4');
  const next=offerCursorTrial(memory,here,fresh,false,true);
  assert.deepEqual(next?.point,[19,8]);
  assert.deepEqual(next?.projectedMove?.delta,[1,0]);
  assert.equal(offerCursorTrial(memory,await observation(before,5),before,false,true),null);
});
