import assert from 'node:assert/strict';
import test from 'node:test';
import {measureNativeObservation} from '../src/logos-engine/v6-native-observer.ts';
import {newCursorMemory,offerCursorTrial,recordCursorTrial} from '../src/sic/marked-cursor-selection.ts';
import {createPreparedEffects} from '../src/sic/test-prepared-effects.ts';
import {evidencedPlanGroup,recurrentExperimentGroup} from '../src/sic/experiment-arbitration.ts';
import {validateV6PublicObservation} from '../src/runtime/v6-agent-protocol.ts';

const palette=['#141414','#e36b28','#2674db','#fff','#292929','#f4df14'];
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
