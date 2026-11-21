import assert from 'node:assert/strict';
import test from 'node:test';
import {observeLandmarks, proposeLandmark, observePlacement, refreshedSelection} from '../src/sic/paired-landmark-placement.ts';
import {informationPriority} from '../src/sic/information-preference.ts';
import type {CursorTrial} from '../src/sic/marked-cursor-selection.ts';
import type {VisualLayout} from '../src/sic/witnessed-preview-transfer.ts';
import type {NativeObservation} from '../src/logos-engine/v6-native-types.ts';
import type {XY} from '../src/sic/access-terrain.ts';

const part=(x:number,y:number,form:string)=>({at:[x*2,y*2] as XY,box:[x,y,x,y] as const,form});
const rows=Array.from({length:8},()=>Array<number>(14).fill(0));
const o={available_action_refs:['ACTION1','ACTION2','ACTION3','ACTION4','ACTION6'],frame_hash:'now',observation_ref:'preparation'} as NativeObservation;
const left=part(4,3,'mark'),right=part(11,3,'mark');
const base:VisualLayout={mover:[part(3,3,'old')],peer:[part(9,3,'remote')],mark:[left,right]};
const motion={axes:{ACTION2:{x:{d:[2,0] as XY,count:3,last:'motion',first:'before'}}},sites:{},substrate:{0:4}};
const trial:CursorTrial={stage:'select',source:{box:[3,3,3,3],ink:2},target:{box:[9,3,9,3],ink:5},
  point:[9,3],offsets:[],ink:8,shape:'peer',command:'ACTION6:9,3',evidence:['motor'],
  contrast:{strategy:'motion_contrast',mode:'exploration',minimumOutcomes:2,motor:'ACTION2',baselineDelta:[1,0],
    evidence:'motor',outcomes:['previous_subject_moves','selected_subject_moves']}};

test('two different placements separate an immediate switch from a prepared one',()=>{
  const m=observeLandmarks(undefined,base,base,'first');
  const movement={mover:motion,selected:motion};
  const first=proposeLandmark(m,base,o,rows,movement,trial,100)!;
  assert.equal(first.command,'ACTION2');
  const parked={...base,mover:[part(4,3,'old')],mark:[right]};
  assert.equal(observePlacement(m,first,parked,undefined,undefined,base),'subject_covers_named_landmark');
  const select=proposeLandmark(m,parked,o,rows,movement,null,100)!;
  assert.equal(select.stage,'select_after_contact');
  const clicked=refreshedSelection(select,parked);
  assert.deepEqual(clicked.source.box,parked.mover[0]!.box);
  const switched={inactive:[part(4,3,'inactive')],selected:[part(9,3,'selected')],mark:[right]};
  observePlacement(m,select,switched,'selection_changed_pending_motor',clicked,parked);
  assert.equal(proposeLandmark(m,switched,o,rows,movement,null,100),undefined);
  const verified={...switched,selected:[part(10,3,'selected')]};
  observePlacement(m,undefined,verified,'new_cursor_moved_while_previous_cursor_stayed',{...clicked,stage:'verify'},switched);
  const second=proposeLandmark(m,verified,o,rows,movement,null,100)!;
  assert.equal(second.stage,'approach_with_partner_parked');
  assert.deepEqual(second.expected,right.at);
  assert.equal(proposeLandmark(m,{...verified,inactive:[part(5,3,'inactive')]},o,rows,movement,null,100),undefined);
});
test('a contradicted edge is not repeated and a moving landmark is discarded',()=>{
  const m=observeLandmarks(undefined,base,base,'first');
  const move=proposeLandmark(m,base,o,rows,{mover:motion},trial,100)!;
  observePlacement(m,move,base,undefined,undefined,base);
  assert.notEqual(proposeLandmark(m,base,o,rows,{mover:motion},null,100)?.command,move.command);
  observeLandmarks(m,base,{...base,mark:[part(3,5,'mark'),right]},'later');
  assert.equal(m.active,undefined);
  assert.equal(m.pairs.length,0);
});
test('the paired-arrival preference inherits motion contrasts and respects the declared minimum',()=>{
  const p={mode:'active',strategy:'paired_arrival',minimumOutcomes:2} as const;
  assert.equal(informationPriority({strategy:'motion_contrast',distinctOutcomes:2},p),1);
  assert.equal(informationPriority({strategy:'paired_arrival',distinctOutcomes:1},p),0);
  assert.equal(informationPriority({strategy:'paired_arrival',distinctOutcomes:2},{...p,strategy:'motion_contrast'}),0);
});
