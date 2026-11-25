import assert from 'node:assert/strict';
import test from 'node:test';
import { measureNativeObservation, publicFrameHash } from '../src/logos-engine/v6-native-observer.ts';
import { createSs06Backend } from '../src/games/sinking-star-ss06.ts';
import { createSs07Backend } from '../src/games/sinking-star-ss07.ts';
import { createObservedActorComposition } from '../src/sic/observed-actor-composition.ts';
import { relayGateClosed } from '../src/sic/observed-relay-plan.ts';
import { sicObservedMotionCycle } from '../src/logos-engine/v6-native-types.ts';

type Point = readonly [number, number];
const same = (a: Point,b: Point) => a[0]===b[0] && a[1]===b[1];
const add = (a: Point,b: Point): Point => [a[0]+b[0],a[1]+b[1]];

function habitat(pitch: number, inks: readonly number[], commands: readonly [string,Point][],
  secondary: 'withdrawal' | 'activation', options: { rejectSelection?: boolean; duplicatePeer?: boolean; level?: number; offset?: Point; hideGoals?: boolean; pressure?: Point; loadPositions?: readonly Point[]; idleSolo?:boolean; destinationGroups?:readonly (readonly Point[])[] } = {}) {
  const span = 12, alignment = 1, floor = 2, background = 3, cargoInk = 5, inset = 6;
  const marker = 7, destination = 8;
  const actorOrigins: Point[] = [[2,3],[2,7],[2,5]];
  const actors=actorOrigins.slice(0,inks.length).map(p=>add(p,options.offset??[0,0]));
  const cargoOrigins: Point[] = [[4,3],[4,7]];
  const cargo=(options.loadPositions??cargoOrigins).map(p=>add(p,options.offset??[0,0]));
  let active = 0, facing: Point = [0,-1], revision = 0;
  let present=new Set(actors.map((_,i)=>i));
  const contactCommand=commands.find(([name])=>name==='ACTION5') && !commands.find(([name])=>name==='ACTION4') ? 'ACTION4' : 'ACTION5';
  const available = [...commands.map(([name])=>name),contactCommand,'ACTION6'];
  const floorAt = ([x,y]:Point)=>x>=1&&x<=8&&y>=1&&y<=9;
  const observed = async () => {
    const edge=span*pitch+2, middle=(pitch-1)/2;
    const rows=Array.from({length:edge},()=>Array(edge).fill(background) as number[]);
    const tile=(p:Point, paint:(x:number,y:number)=>number)=>{
      for(let y=0;y<pitch;y++) for(let x=0;x<pitch;x++) {
        rows[p[1]*pitch+y+alignment]![p[0]*pitch+x+alignment]=paint(x,y);
      }
    };
    for(let y=0;y<span;y++) for(let x=0;x<span;x++) if(floorAt([x,y]))tile([x,y],()=>floor);
    const groups=options.destinationGroups??[[[10,2],[10,9]] as const];
    if(!options.hideGoals)for(const [index,group] of groups.entries())for(const p of group)
      tile(p,(x,y)=>x===middle&&y===middle?floor:destination+index*3);
    if(options.pressure)tile(options.pressure,(x,y)=>x===middle&&y===middle?marker:x===middle||y===middle?12:floor);
    for(const p of cargo)tile(p,(x,y)=>x===middle&&y===middle?inset:cargoInk);
    for(const [i,p] of actors.entries()){
      if(!present.has(i))continue;
      tile(p,(x,y)=>{
        if(x!==middle&&y!==middle)return floor;
        if(i===active&&!(options.idleSolo&&present.size===1)&&x===middle+facing[0]*middle&&y===middle+facing[1]*middle)return marker;
        return inks[i]!;
      });
    }
    if(options.duplicatePeer)tile([6,6],(x,y)=>x===middle||y===middle?inks[1]:floor);
    const level=options.level??1;
    const packet={frame_rows:rows, frame_hash:await publicFrameHash(rows), level, levels_completed:level-1,
      state:'NOT_FINISHED',available_action_refs:present.size===1?available.filter(action=>action!=='ACTION6'):available};
    return {packet, observation:await measureNativeObservation(packet,revision,'actor-fixture')};
  };
  const perform=(action: {action_ref:string;data:Readonly<Record<string,number>>})=>{
    revision++;
    const {action_ref, data}=action;
    if(action_ref==='ACTION6'){
      const address:Point=[Math.floor((data.x!-alignment)/pitch),Math.floor((data.y!-alignment)/pitch)];
      const index=actors.findIndex(p=>same(p,address));
      if(index>=0&&present.has(index)&&!options.rejectSelection)active=index;
      return;
    }
    const origin=actors[active]!;
    const dir=commands.find(([name])=>name===action_ref)?.[1];
    if(!dir){
      if(active===1&&secondary==='activation'){
        const adjacent=cargo.findIndex(p=>Math.abs(p[0]-origin[0])+Math.abs(p[1]-origin[1])===1);
        const load=cargo[adjacent];
        if(load) {
          const landing: Point = [load[0]+1,load[1]];
          if(floorAt(landing)&&!cargo.some(p=>same(p,landing))&&!actors.some(p=>same(p,landing)))cargo[adjacent]=landing;
        }
      }
      return;
    }
    facing=dir;
    const dest=add(origin,dir);
    if(!floorAt(dest)||actors.some((p,i)=>present.has(i)&&same(p,dest)))return;
    const load=cargo.findIndex(p=>same(p,dest));
    if(load>=0){
      const landing=add(dest,dir);
      if(active===1||!floorAt(landing)||cargo.some(p=>same(p,landing))||actors.some(p=>same(p,landing)))return;
      cargo[load]=landing;
    }else if(active===1&&secondary==='withdrawal'){
      const behind=add(origin,[-dir[0],-dir[1]]);
      const pulled=cargo.findIndex(p=>same(p,behind));
      if(pulled>=0)cargo[pulled]=origin;
    }
    actors[active]=dest;
  };
  return { observed, perform, setRoster(indices:number[]) {
    present=new Set(indices);
    if(!present.has(active))active=indices[0]!;
    revision++;
  } };
}

async function study(game: ReturnType<typeof habitat>, secondInk: number, limit=55) {
  const family=createObservedActorComposition();
  const contact=new Set<string>();
  let actions=0, declinedSelections=0;
  while(actions<limit) {
    const before=await game.observed();
    const offer=await family.propose(before.observation,before.packet.frame_rows,[],limit-actions);
    if(!offer)break;
    for(const [i,command] of offer.actions.entries()) {
      const prior=await game.observed();
      const bound=await family.before(offer,i,prior.packet,prior.observation);
      if(!bound.admitted)break;
      game.perform(command);
      actions++;
      const after=await game.observed();
      const result=await family.after(offer,i,prior.observation,after.observation,prior.packet.frame_rows,after.packet.frame_rows);
      await family.record(prior.observation,after.observation,command,prior.packet.frame_rows,after.packet.frame_rows,offer,i,[]);
      if(command.action_ref==='ACTION6'&&result.matched===false)declinedSelections++;
      const role=family.state().roles[secondInk];
      for(const key of Object.keys(role?.effects??{}))contact.add(key);
      if(result.seal_prefix)break;
    }
    if(contact.size)break;
  }
  return {state:family.state(),contact,actions,declinedSelections};
}

const directions: readonly [string,Point][] = [
  ['ACTION1',[0,-1]],['ACTION2',[0,1]],['ACTION3',[-1,0]],['ACTION4',[1,0]],
];
const permuted: readonly [string,Point][] = [
  ['ACTION3',[0,-1]],['ACTION1',[0,1]],['ACTION5',[-1,0]],['ACTION2',[1,0]],
];

for(const fixture of [
  { pitch:3, inks:[6,14] as const, motors:directions, loop:['ACTION1','ACTION2'], across:'ACTION4' },
  { pitch:5, inks:[11,9] as const, motors:permuted, loop:['ACTION3','ACTION1'], across:'ACTION2' },
]) test('recovers a repeated displacement with actor pitch '+fixture.pitch,async()=>{
  const game=habitat(fixture.pitch,fixture.inks,fixture.motors,'activation',{pressure:[3,2]});
  const family=createObservedActorComposition();
  const entry=await game.observed();
  await family.propose(entry.observation,entry.packet.frame_rows,[],40);
  async function apply(action_ref:string){
    const before=await game.observed(),command={action_ref,data:{}};
    game.perform(command);
    const after=await game.observed();
    await family.observePublicOutcome!(before.observation,after.observation,command,before.packet.frame_rows,after.packet.frame_rows);
    return family.requestedStopReason!(after.observation);
  }
  await apply(fixture.loop[0]!);
  await apply(fixture.loop[0]!);
  for(let n=0;n<7;n++)assert.equal(await apply(fixture.loop[0]!),null);
  await apply(fixture.loop[1]!);
  await apply(fixture.across);
  for(let n=0;n<5;n++)assert.equal(await apply(fixture.loop[n%2]!),null);
  assert.equal(await apply(fixture.loop[1]!),sicObservedMotionCycle);
  const stopped=await game.observed();
  const recovery=family.stateAfterLevelReset!(entry.observation,entry.packet.frame_rows,undefined,sicObservedMotionCycle);
  assert.ok(recovery);
  assert.equal(family.requestedStopReason!(stopped.observation),sicObservedMotionCycle);
  family.restore(recovery);
  await family.propose(stopped.observation,stopped.packet.frame_rows,[],40);
  for(let n=0;n<6;n++)assert.equal(await apply(fixture.loop[n%2]!),null);
});

test('distinguishes a pushing role from a withdrawal interaction on a differently scaled board', async () => {
  const result=await study(habitat(5,[11,9],permuted,'withdrawal'),9);
  assert.ok(result.state.roles[11]?.capacity>=1);
  assert.ok(result.state.selections[9]);
  assert.ok([...result.contact].some(key=>key.startsWith('test_displacement_on_withdrawal:')));
});

test('discovers the interaction of an independent command for another selectable actor', async () => {
  const result=await study(habitat(3,[9,10],directions,'activation'),10);
  assert.ok(result.state.roles[9]?.capacity>=1);
  assert.ok(result.state.selections[10]);
  assert.ok(result.contact.has('test_unmeasured_command_near_object:ACTION5'), JSON.stringify({actions:result.actions,contact:[...result.contact],roles:result.state.roles, directions:result.state.directions.map(d=>[d.action,d.axis])}));
});

test('a click that fails to transfer the selection never proves a second role', async () => {
  const result=await study(habitat(3,[9,10],directions,'activation',{rejectSelection:true}),10,30);
  assert.ok(result.declinedSelections>0);
  assert.equal(result.state.selections[10],undefined);
  assert.equal(result.contact.size,0);
});


test('equally plausible matches do not establish a unique second actor', async () => {
  const variant=habitat(3,[9,10],directions,'activation',{duplicatePeer:true});
  const {observation,packet}=await variant.observed();
  const family=createObservedActorComposition();
  assert.equal(await family.propose(observation,packet.frame_rows,[],20),null);
});

test('rebinds verified roles after the same motifs change positions on the next level', async () => {
  const prior=await study(habitat(3,[9,10],directions,'activation'),10);
  const next=habitat(3,[9,10],directions,'activation',{level:2,offset:[1,-1]});
  const {observation,packet}=await next.observed();
  const family=createObservedActorComposition();
  family.restore(prior.state);
  const proposal=await family.propose(observation,packet.frame_rows,[],45);
  assert.ok(proposal);
  assert.notEqual(proposal.offer.kind,'calibrate_actor_action');
  assert.ok(family.state().roles[9]?.capacity>=1);
  assert.ok(family.state().roles[10]?.effects['test_unmeasured_command_near_object:ACTION5']);
  const guard=await family.before(proposal,0,packet,observation);
  assert.equal(guard.admitted,true);
  next.perform(proposal.actions[0]!);
  const returned=await next.observed();
  assert.notEqual((await family.after(proposal,0,observation,returned.observation,packet.frame_rows,returned.packet.frame_rows)).matched,false);
});
for(const fixture of [{pitch:3,inks:[9,10] as const,motors:directions},
  {pitch:5,inks:[11,9] as const,motors:permuted}])test('a role can disappear and return with pitch '+fixture.pitch,async()=>{
  const {pitch,inks,motors}=fixture;
  const prior=await study(habitat(pitch,inks,motors,'activation'),inks[1]);
  const returnedEvidence=Object.values(prior.state.transfer!.roles[String(inks[1])]!.effects);
  assert.ok(returnedEvidence.length);
  const board=habitat(pitch,inks,motors,'activation',{level:2,offset:[1,-1],idleSolo:pitch===5});
  const family=createObservedActorComposition();
  family.restore(prior.state);
  board.setRoster([0]);
  const first=await board.observed();
  const plan=await family.propose(first.observation,first.packet.frame_rows,[],25);
  assert.ok(plan&&plan.offer.kind!=='calibrate_actor_action');
  assert.equal((await family.before(plan,0,first.packet,first.observation)).admitted,true);
  assert.deepEqual(family.state().shape?.inks,[inks[0]]);
  assert.ok(family.state().roles[inks[0]]?.capacity);
  assert.deepEqual(Object.values(family.state().transfer!.roles[String(inks[1])]!.effects),returnedEvidence);
  board.perform(plan.actions[0]!);
  const moved=await board.observed();
  assert.equal((await family.after(plan,0,first.observation,moved.observation,first.packet.frame_rows,moved.packet.frame_rows)).matched,true);
  board.setRoster([0,1]);
  const reunited=await board.observed();
  await family.propose(reunited.observation,reunited.packet.frame_rows,[],25);
  assert.equal(family.state().shape?.inks.length,2);
  assert.deepEqual(Object.values(family.state().roles[inks[1]]!.effects),returnedEvidence);
  board.setRoster([1]);
  const remaining=await board.observed();
  await family.propose(remaining.observation,remaining.packet.frame_rows,[],25);
  assert.deepEqual(family.state().shape?.inks,[inks[1]]);
  assert.ok(family.state().transfer!.roles[String(inks[0])]?.capacity);
  const replacement=await habitat(pitch,[inks[0],15],motors,'activation',{level:3,offset:[1,-1]}).observed();
  await family.propose(replacement.observation,replacement.packet.frame_rows,[],25);
  assert.ok(family.state().roles[inks[0]]?.capacity);
  assert.ok(!family.state().roles[15]?.contact);
  assert.deepEqual(Object.values(family.state().transfer!.roles[String(inks[1])]!.effects),returnedEvidence);
  const ambiguous=habitat(pitch,inks,motors,'activation',{level:4,duplicatePeer:true});
  ambiguous.setRoster([1]);
  const duplicate=await ambiguous.observed();
  assert.equal(await family.propose(duplicate.observation,duplicate.packet.frame_rows,[],25),null);
});

async function playArrangement(game:ReturnType<typeof habitat>,family:ReturnType<typeof createObservedActorComposition>,until:number) {
  for(let trial=0;trial<60;trial++){
    const first=await game.observed();
    const proposal=await family.propose(first.observation,first.packet.frame_rows,[],70);
    assert.ok(proposal);
    assert.equal(proposal.offer.kind,'test_complete_destination_arrangement');
    let executed=0;
    for(const [index,action] of proposal.actions.entries()){
      const before=await game.observed();
      assert.equal((await family.before(proposal,index,before.packet,before.observation)).admitted,true);
      game.perform(action);executed++;
      const after=await game.observed();
      const result=await family.after(proposal,index,before.observation,after.observation,before.packet.frame_rows,after.packet.frame_rows);
      await family.record(before.observation,after.observation,action,before.packet.frame_rows,after.packet.frame_rows,proposal,index,[]);
      assert.ok(result.matched);
      if(result.seal_prefix)break;
    }
    assert.ok(executed);
    if(trial===0)assert.equal(Object.keys(family.state().arrangements??{}).length,0,'A partial position or a selection is not a set trial');
    if(Object.keys(family.state().arrangements??{}).length===until)return;
  }
  assert.fail('Reachable complete arrangements were not exhausted');
}

test('tries all reachable assignments for two equally sized destination groups',async()=>{
  const prior=await study(habitat(3,[9,10],directions,'activation'),10);
  const family=createObservedActorComposition();
  family.restore(prior.state);
  const game=habitat(3,[9,10],directions,'activation',{
    level:2,loadPositions:[],destinationGroups:[[[3,3],[3,7]],[[4,3],[4,7]]],
  });
  await playArrangement(game,family,4);
  const placements=Object.keys(family.state().arrangements!);
  assert.equal(new Set(placements.map(key=>JSON.parse(key).map(([,cell]:[number,string])=>cell).sort().join('|'))).size,2);
});

test('treats the positions of three known actors as one common criterion',async()=>{
  const first=await study(habitat(5,[9,10],permuted,'activation'),10);
  const additional=await study(habitat(5,[9,14],permuted,'activation'),14);
  first.state.transfer!.roles['14']=additional.state.transfer!.roles['14']!;
  const family=createObservedActorComposition();
  family.restore(first.state);
  const game=habitat(5,[9,10,14],permuted,'activation',{
    level:2,loadPositions:[],destinationGroups:[[[3,3],[3,7],[3,5]]],
  });
  await playArrangement(game,family,1);
  assert.equal(JSON.parse(Object.keys(family.state().arrangements!)[0]!).length,3);
});

const mirroredPresentations = [
  {name:'horizontal reflection, new colors and reordered inputs', flipX:true, flipY:false, colors:3, inputs:[3,5,2,1,4], alternateOccupant:false},
  {name:'vertical reflection, a changed occupant motif and a different interaction command', flipX:false, flipY:true, colors:7, inputs:[5,2,4,3,1], alternateOccupant:true},
] as const;

for(const presentation of mirroredPresentations)test('reuses traction, coordinates reflectors and transports an independent subject with '+presentation.name,async()=>{
  const game=createSs07Backend(),family=createObservedActorComposition();
  let board=await game.dispatch({type:'load',code:'SS07',level:1}), revision=0;
  let inherited=false, rejectedUnchangedMirror=false, rejectedUnseenGate=false, rejectedWrongGate=false;
  let verifiedThird=false, completedBeforeSubject=0, transfers=0, pressedWithSubject=false, rejectedMissingSubjectPreview=false, rejectedStaticSubject=false;
  const show=async()=>{
    let frame=board.frame.map(row=>[...row]);
    if(board.level===6&&presentation.alternateOccupant){
      // Change the independent subject's interior and outline, including its
      // visible interior under the pressed marker. Keep the environment real.
      for(let y=2;y<62;y+=3)for(let x=2;x<62;x+=3){
        const inner=[[1,0],[0,1],[1,1],[2,1],[1,2]] as const;
        if(!inner.every(([dx,dy],i)=>frame[y+dy]![x+dx]===(i===2?8:5)))continue;
        const plain=[[0,0],[2,0],[0,2],[2,2]].every(([dx,dy])=>frame[y+dy]![x+dx]===8);
        for(const [i,[dx,dy]] of inner.entries())frame[y+dy]![x+dx]=[5,8,8,15,5][i]!;
        if(plain)frame[y]![x+2]=15;
      }
    }
    frame=frame.map(row=>row.map(value=>(value+presentation.colors)%16));
    if(presentation.flipX)frame=frame.map(row=>row.reverse());
    if(presentation.flipY)frame.reverse();
    const packet={frame_rows:frame,frame_hash:await publicFrameHash(frame),level:board.level,levels_completed:board.levelsCompleted,
      state:board.state,available_action_refs:board.availableActionIds.map(id=>'ACTION'+id)};
    return {packet,observation:await measureNativeObservation(packet,revision,'withdrawal-campaign')};
  };
  while((!verifiedThird&&board.level<=3||board.level===6)&&revision<240){
    const first=await show(), level=board.level;
    const offer=await family.propose(first.observation,first.packet.frame_rows,[],240-revision);
    assert.ok(offer,`Missing composition at level ${level}, after ${revision} actions`);
    if(level>=2){
      assert.notEqual(offer.offer.kind,'calibrate_actor_action');
      assert.equal(offer.offer.destinations?.length,2);
      inherited ||= Object.values(family.state().roles).some(role=>/:epoch:1:revision:/.test(role.pull??''));
    }
    let issued=0;
    for(const [index,action] of offer.actions.entries()){
      const before=await show(), step=offer.steps[index]!;
      if(!(await family.before(offer,index,before.packet,before.observation)).admitted)break;
      const relay=step.relay, field=family.state().relayField;
      const subjectLanding=level===6&&relay?.after.subjects?.find(cell=>!relay.before.subjects?.includes(cell));
      const subjectSource=level===6&&relay?.before.subjects?.find(cell=>!relay.after.subjects?.includes(cell));
      if(relay&&typeof subjectLanding==='number'&&typeof subjectSource==='number'){
        assert.equal(offer.offer.kind,'compose_subject_with_linked_control');
        assert.ok(offer.actions.some(action=>action.action_ref==='ACTION'+(presentation.inputs.findIndex(id=>id===5)+1)));
        const rows=before.packet.frame_rows.map(row=>[...row]);
        const {pitch,phase,floor}=family.state().shape!;
        const x=phase[0]+subjectLanding%64*pitch,y=phase[1]+Math.floor(subjectLanding/64)*pitch;
        for(let dy=0;dy<pitch;dy++)for(let dx=0;dx<pitch;dx++)rows[y+dy]![x+dx]=floor;
        assert.equal((await family.before(offer,index,{...before.packet,frame_rows:rows},before.observation)).admitted,false);
        rejectedMissingSubjectPreview=true;
      }
      const slot=Number(action.action_ref.slice(6));
      const point=slot===6?{x:presentation.flipX?63-action.data.x!:action.data.x!,y:presentation.flipY?63-action.data.y!:action.data.y!}:undefined;
      board=await game.dispatch({type:'action',actionId:slot===6?6:presentation.inputs[slot-1]!,...(point?{data:point}:{})});
      revision++;
      issued++;
      const after=await show();
      const verdict=await family.after(offer,index,before.observation,after.observation,before.packet.frame_rows,after.packet.frame_rows);
      if(relay&&typeof subjectLanding==='number'&&typeof subjectSource==='number'){
        assert.ok(verdict.matched,'The predicted independent subject must move and match its landing');
        transfers++;
        if(field?.settleSubjectOnControl&&subjectLanding===field.plate){
          assert.ok(field.gates.some(gate=>relayGateClosed(gate,relay.before,field.plate)&&!relayGateClosed(gate,relay.after,field.plate)));
          pressedWithSubject=true;
        }
        const rows=after.packet.frame_rows.map(row=>[...row]);
        const {pitch,phase}=family.state().shape!;
        const x=phase[0]+subjectSource%64*pitch,y=phase[1]+Math.floor(subjectSource/64)*pitch;
        for(let dy=0;dy<pitch;dy++)for(let dx=0;dx<pitch;dx++)rows[y+dy]![x+dx]=before.packet.frame_rows[y+dy]![x+dx]!;
        const refused=await family.after(offer,index,before.observation,after.observation,before.packet.frame_rows,rows);
        assert.equal(refused.matched,false);
        assert.equal(refused.seal_prefix,true);
        rejectedStaticSubject=true;
      }
      if(level===3&&board.level===3&&verdict.matched&&relay&&field?.linkedControls&&(!rejectedUnseenGate||!rejectedWrongGate)){
        const gate=field.gates.find(gate=>relayGateClosed(gate,relay.before,field.plate)!==relayGateClosed(gate,relay.after,field.plate)
          && ![...relay.after.actors,...relay.after.reflectors,...relay.after.loads,...relay.projected].includes(gate.cell));
        if(gate){
          const {pitch,phase,floor}=family.state().shape!;
          const x=phase[0]+gate.cell%64*pitch,y=phase[1]+Math.floor(gate.cell/64)*pitch;
          for(const missing of [true,false]){
            const rows=after.packet.frame_rows.map(row=>[...row]);
            for(let dy=0;dy<pitch;dy++)for(let dx=0;dx<pitch;dx++)
              rows[y+dy]![x+dx]=missing?floor:before.packet.frame_rows[y+dy]![x+dx]!;
            const refused=await family.after(offer,index,before.observation,after.observation,before.packet.frame_rows,rows);
            assert.equal(refused.matched,false);
            assert.equal(refused.seal_prefix,true);
            if(missing)rejectedUnseenGate=true;
            else rejectedWrongGate=true;
          }
        }
      }
      if(level===2&&!rejectedUnchangedMirror&&verdict.matched&&step.relay&&step.relay.before.reflectors[0]!==step.relay.after.reflectors[0]){
        const {pitch,phase,floor}=family.state().shape!, rows=after.packet.frame_rows.map(row=>[...row]);
        const coords=(cell:number)=>[phase[0]+cell%64*pitch,phase[1]+Math.floor(cell/64)*pitch] as const;
        const [oldX,oldY]=coords(step.relay.before.reflectors[0]!),[newX,newY]=coords(step.relay.after.reflectors[0]!);
        for(let y=0;y<pitch;y++)for(let x=0;x<pitch;x++){
          rows[oldY+y]![oldX+x]=before.packet.frame_rows[oldY+y]![oldX+x]!;
          rows[newY+y]![newX+x]=floor;
        }
        const refused=await family.after(offer,index,before.observation,after.observation,before.packet.frame_rows,rows);
        assert.equal(refused.matched,false);
        assert.equal(refused.seal_prefix,true);
        rejectedUnchangedMirror=true;
      }
      await family.record(before.observation,after.observation,action,before.packet.frame_rows,after.packet.frame_rows,offer,index,[]);
      if(level===2&&board.level===3){
        const traction=Object.values(family.state().roles).find(role=>role.pull)!;
        assert.match(traction.effects.move_reflector_by_withdrawal??'',/:epoch:2:revision:/);
        assert.match(traction.effects.leave_reflector_in_place_by_transfer??'',/:epoch:2:revision:/);
        assert.match(traction.effects.leave_reflector_in_place_by_turning??'',/:epoch:2:revision:/);
      }
      if(level===3&&board.level===4){
        assert.equal(board.levelsCompleted,3);
        const traction=Object.values(family.state().roles).find(role=>role.pull)!;
        assert.match(traction.effects.move_reflector_by_withdrawal??'',/:epoch:3:revision:/);
        assert.match(traction.effects.leave_reflector_in_place_by_transfer??'',/:epoch:3:revision:/);
        verifiedThird=true;
        // Isolate this transfer test from the two intervening puzzle layouts.
        board=await game.dispatch({type:'selectLevel',level:6});
        completedBeforeSubject=board.levelsCompleted;
        break;
      }
      if(verdict.seal_prefix)break;
    }
    assert.ok(issued,'The first command must be bound to the current scene');
  }
  assert.ok(board.levelsCompleted>completedBeforeSubject);
  assert.ok(verifiedThird&&inherited&&rejectedUnchangedMirror&&rejectedUnseenGate&&rejectedWrongGate);
  assert.ok(transfers>=2&&pressedWithSubject&&rejectedMissingSubjectPreview&&rejectedStaticSubject);
});

for (const presentation of mirroredPresentations) test('reuses both roles for a joint transfer with '+presentation.name, async () => {
  const game = createSs06Backend();
  const family = createObservedActorComposition();
  let board = await game.dispatch({type:'load',code:'SS06',level:1});
  let revision=0, firstSecondLevelOffer='', joint=false, chain=false, pressure=false, extension=false, sharedCircuit=false;
  let releases=0, missingProjectionChecked=false;
  let heldGate=false, preparedFooting=false, rejectedMissingFooting=false;
  let loadedBoth=false, withheldWithoutPreview=false;
  const show = async () => {
    let frame=board.frame.map(row=>[...row]);
    if(board.level===6&&presentation.alternateOccupant){
      // Change the subject motif while preserving the pressure mark at the corners.
      for(let y=3;y<61;y+=3)for(let x=3;x<61;x+=3){
        if(frame[y]![x]===8&&frame[y-1]![x]===5&&frame[y+1]![x]===5
          &&frame[y]![x-1]===5&&frame[y]![x+1]===5){
          frame[y]![x]=14;
          frame[y]![x+1]=4;
        }
      }
    }
    frame=frame.map(row=>row.map(value=>(value+presentation.colors)%16));
    if(presentation.flipX)frame=frame.map(row=>row.reverse());
    if(presentation.flipY)frame.reverse();
    const packet={frame_rows:frame,frame_hash:await publicFrameHash(frame),level:board.level,
      levels_completed:board.levelsCompleted,state:board.state,available_action_refs:board.availableActionIds.map(id=>'ACTION'+id)};
    return {packet,observation:await measureNativeObservation(packet,revision,'shifted-campaign')};
  };
  while(board.state!=='WIN' && board.level<=8 && revision<600){
    const {packet,observation}=await show();
    const proposal=await family.propose(observation,packet.frame_rows,[],600-revision);
    assert.ok(proposal,'Missing proposal after '+revision+' actions, level '+board.level);
    if(board.level===2) {
      if (!firstSecondLevelOffer) firstSecondLevelOffer=proposal.offer.kind;
      assert.notEqual(proposal.offer.kind,'calibrate_actor_action');
      joint ||= proposal.offer.kind==='compose_simultaneous_observed_transfers';
    }
    if(board.level===3){
      assert.notEqual(proposal.offer.kind,'calibrate_actor_action');
      chain ||= proposal.offer.kind==='test_reachable_chain_composition';
      pressure ||= proposal.offer.kind==='test_reachable_pressure_composition';
    }
    if(board.level===4)extension ||= proposal.offer.kind==='test_extended_chain_capacity';
    if(board.level===5){
      assert.notEqual(proposal.offer.kind,'calibrate_actor_action');
      sharedCircuit ||= proposal.offer.kind==='execute_joint_transport_through_observed_open_gates';
    }
    if(board.level>=6)assert.notEqual(proposal.offer.kind,'calibrate_actor_action');
    if(board.level===7)heldGate ||= proposal.offer.kind==='hold_relay_gate_with_observed_load';
    if(board.level===8){
      assert.equal(family.state().shape?.inks.length,1);
      assert.equal(Object.keys(family.state().transfer!.roles).length,2);
    }
    let issued=0;
    for(const [index,command] of proposal.actions.entries()){
      const first=await show();
      const binding=await family.before(proposal,index,first.packet,first.observation);
      if(!binding.admitted)break;
      const transfer=proposal.steps[index]!.controlTransfer;
      const relay=proposal.steps[index]!.relay;
      const platform=proposal.steps[index]!.platform;
      const loadedControls=platform?.projected.filter(cell=>platform.after.loads.includes(cell)
        &&family.state().platformField?.platforms.some(mark=>mark.control===cell))??[];
      if(loadedControls.length>1&&!withheldWithoutPreview){
        const {shape,projectionInk}=family.state(), position=loadedControls[0]!;
        const left=shape!.phase[0]+(position%64)*shape!.pitch, top=shape!.phase[1]+Math.floor(position/64)*shape!.pitch;
        const rows=first.packet.frame_rows.map(row=>[...row]);
        for(let y=top;y<top+shape!.pitch;y++)for(let x=left;x<left+shape!.pitch;x++){
          if(rows[y]![x]===projectionInk)rows[y]![x]=shape!.floor;
        }
        const withoutPreview={...first.packet,frame_rows:rows,frame_hash:await publicFrameHash(rows)};
        assert.equal((await family.before(proposal,index,withoutPreview,first.observation)).admitted,false);
        withheldWithoutPreview=true;
      }
      const newFooting=board.level===7?relay?.after.supports.find(cell=>!relay.before.supports.includes(cell)):undefined;
      if(transfer&&!missingProjectionChecked){
        const {shape,projectionInk}=family.state();
        const [x,y]=transfer.destination.split(',').map(Number);
        const [left,top]=[shape!.phase[0]+x!*shape!.pitch,shape!.phase[1]+y!*shape!.pitch];
        const rows=first.packet.frame_rows.map(row=>[...row]);
        for(let j=top;j<top+shape!.pitch;j++)for(let i=left;i<left+shape!.pitch;i++){
          if(rows[j]![i]===projectionInk)rows[j]![i]=shape!.floor;
        }
        const withoutProjection={...first.packet,frame_rows:rows,frame_hash:await publicFrameHash(rows)};
        assert.equal((await family.before(proposal,index,withoutProjection,first.observation)).admitted,false);
        const noEffect=await family.after(proposal,index,first.observation,first.observation,first.packet.frame_rows,first.packet.frame_rows);
        assert.equal(noEffect.matched,false);
        assert.equal(noEffect.seal_prefix,true);
        missingProjectionChecked=true;
      }
      const slot=Number(command.action_ref.slice(6));
      const point=slot===6?{x:presentation.flipX?63-command.data.x!:command.data.x!,y:presentation.flipY?63-command.data.y!:command.data.y!}:undefined;
      board=await game.dispatch({type:'action',actionId:slot===6?6:presentation.inputs[slot-1]!,...(point?{data:point}:{})});
      revision++;
      issued++;
      const second=await show();
      const result=await family.after(proposal,index,first.observation,second.observation,first.packet.frame_rows,second.packet.frame_rows);
      if(transfer&&result.matched)releases++;
      if(loadedControls.length>1&&result.matched)loadedBoth=true;
      if(newFooting!==undefined&&result.matched){
        preparedFooting=true;
        if(!rejectedMissingFooting){
          const {pitch,phase}=family.state().shape!;
          const left=phase[0]+(newFooting%64)*pitch,top=phase[1]+Math.floor(newFooting/64)*pitch;
          const rows=second.packet.frame_rows.map(row=>[...row]);
          for(let y=top;y<top+pitch;y++)for(let x=left;x<left+pitch;x++)rows[y]![x]=first.packet.frame_rows[y]![x]!;
          const withoutFooting=await family.after(proposal,index,first.observation,second.observation,first.packet.frame_rows,rows);
          assert.equal(withoutFooting.matched,false);
          assert.equal(withoutFooting.seal_prefix,true);
          rejectedMissingFooting=true;
        }
      }
      await family.record(first.observation,second.observation,command,first.packet.frame_rows,second.packet.frame_rows,proposal,index,[]);
      if(result.seal_prefix)break;
    }
    assert.ok(issued,'A proposed prefix must admit its first action at level '+board.level+' after '+revision+' commands ('+proposal.offer.kind+')');
  }
  assert.equal(firstSecondLevelOffer,'prepare_transfer_by_moving_reflector');
  assert.ok(joint);
  assert.equal(board.levelsCompleted,8);
  assert.equal(releases,2);
  assert.ok(missingProjectionChecked);
  assert.ok(heldGate&&preparedFooting&&rejectedMissingFooting);
  assert.ok(loadedBoth&&withheldWithoutPreview);
  assert.ok(chain&&pressure&&extension&&sharedCircuit);
});

test('tests an accessible pressure composition even with no recognized destinations', async () => {
  const learned=await study(habitat(3,[9,10],directions,'activation'),10);
  const pressure:Point=[3,5];
  const game=habitat(3,[9,10],directions,'activation',{level:2,hideGoals:true,pressure});
  const family=createObservedActorComposition();
  family.restore(learned.state);
  const {packet,observation}=await game.observed();
  const proposal=await family.propose(observation,packet.frame_rows,[],30);
  assert.ok(proposal);
  assert.equal(proposal.offer.kind,'test_reachable_pressure_composition');
  assert.equal(family.state().goals.length,0);
  const expected=proposal.offer.test!;
  assert.ok(!family.state().guarded.includes(expected));
  for(const [i,command] of proposal.actions.entries()){
    const before=await game.observed();
    assert.equal((await family.before(proposal,i,before.packet,before.observation)).admitted,true);
    game.perform(command);
    const after=await game.observed();
    await family.record(before.observation,after.observation,command,before.packet.frame_rows,after.packet.frame_rows,proposal,i,[]);
    if(i<proposal.actions.length-1)assert.ok(!family.state().guarded.includes(expected),'Approach must not close the experiment');
  }
  assert.ok(family.state().guarded.includes(expected),'The actual contact closes the experiment');
});

test('a refused longer row does not overwrite an observed lower bound or consume other poses', async () => {
  const learned=await study(habitat(3,[9,10],directions,'activation'),10);
  const retained=learned.state.transfer!.roles['9']!;
  retained.capacity=2;
  const game=habitat(3,[9,10],directions,'activation',
    {level:2,hideGoals:true,loadPositions:[[3,3],[4,3],[5,3]]});
  const family=createObservedActorComposition();
  family.restore(learned.state);
  const first=await game.observed();
  const proposal=await family.propose(first.observation,first.packet.frame_rows,[],20);
  assert.ok(proposal);
  assert.equal(proposal.offer.kind,'test_extended_chain_capacity');
  assert.equal(proposal.actions.length,1);
  assert.equal((await family.before(proposal,0,first.packet,first.observation)).admitted,true);
  game.perform(proposal.actions[0]!);
  const next=await game.observed();
  await family.record(first.observation,next.observation,proposal.actions[0]!,first.packet.frame_rows,next.packet.frame_rows,proposal,0,[]);
  const memory=family.state();
  assert.equal(memory.roles[9]?.capacity,2);
  assert.ok(memory.guarded.includes(proposal.offer.test!));
  const alternate=await family.propose(next.observation,next.packet.frame_rows,[],19);
  assert.ok(alternate);
  assert.notEqual(alternate.offer.test,proposal.offer.test);
});
