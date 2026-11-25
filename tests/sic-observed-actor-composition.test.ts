import assert from 'node:assert/strict';
import test from 'node:test';
import { measureNativeObservation, publicFrameHash } from '../src/logos-engine/v6-native-observer.ts';
import { createSs06Backend } from '../src/games/sinking-star-ss06.ts';
import { createObservedActorComposition } from '../src/sic/observed-actor-composition.ts';
import { sicObservedMotionCycle } from '../src/logos-engine/v6-native-types.ts';

type Point = readonly [number, number];
const same = (a: Point,b: Point) => a[0]===b[0] && a[1]===b[1];
const add = (a: Point,b: Point): Point => [a[0]+b[0],a[1]+b[1]];

function habitat(pitch: number, inks: readonly [number,number], commands: readonly [string,Point][],
  secondary: 'withdrawal' | 'activation', options: { rejectSelection?: boolean; duplicatePeer?: boolean; level?: number; offset?: Point; hideGoals?: boolean; pressure?: Point; loadPositions?: readonly Point[] } = {}) {
  const span = 12, alignment = 1, floor = 2, background = 3, cargoInk = 5, inset = 6;
  const marker = 7, destination = 8;
  const actorOrigins: Point[] = [[2,3],[2,7]];
  const actors=actorOrigins.map(p=>add(p,options.offset??[0,0]));
  const cargoOrigins: Point[] = [[4,3],[4,7]];
  const cargo=(options.loadPositions??cargoOrigins).map(p=>add(p,options.offset??[0,0]));
  let active = 0, facing: Point = [0,-1], revision = 0;
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
    if(!options.hideGoals)for(const p of [[10,2],[10,9]] as const)tile(p,(x,y)=>x===middle&&y===middle?floor:destination);
    if(options.pressure)tile(options.pressure,(x,y)=>x===middle&&y===middle?marker:x===middle||y===middle?12:floor);
    for(const p of cargo)tile(p,(x,y)=>x===middle&&y===middle?inset:cargoInk);
    for(const [i,p] of actors.entries()){
      tile(p,(x,y)=>{
        if(x!==middle&&y!==middle)return floor;
        if(i===active&&x===middle+facing[0]*middle&&y===middle+facing[1]*middle)return marker;
        return inks[i]!;
      });
    }
    if(options.duplicatePeer)tile([6,6],(x,y)=>x===middle||y===middle?inks[1]:floor);
    const level=options.level??1;
    const packet={frame_rows:rows, frame_hash:await publicFrameHash(rows), level, levels_completed:level-1,
      state:'NOT_FINISHED',available_action_refs:available};
    return {packet, observation:await measureNativeObservation(packet,revision,'actor-fixture')};
  };
  const perform=(action: {action_ref:string;data:Readonly<Record<string,number>>})=>{
    revision++;
    const {action_ref, data}=action;
    if(action_ref==='ACTION6'){
      const address:Point=[Math.floor((data.x!-alignment)/pitch),Math.floor((data.y!-alignment)/pitch)];
      const index=actors.findIndex(p=>same(p,address));
      if(index>=0&&!options.rejectSelection)active=index;
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
    if(!floorAt(dest)||actors.some(p=>same(p,dest)))return;
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
  return { observed, perform };
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
const mirroredPresentations = [
  {name:'horizontal reflection, new colors and reordered inputs', flipX:true, flipY:false, colors:3, inputs:[3,5,2,1,4], alternateOccupant:false},
  {name:'vertical reflection, a changed occupant motif and a different interaction command', flipX:false, flipY:true, colors:7, inputs:[5,2,4,3,1], alternateOccupant:true},
] as const;

for (const presentation of mirroredPresentations) test('reuses both roles for a joint transfer with '+presentation.name, async () => {
  const game = createSs06Backend();
  const family = createObservedActorComposition();
  let board = await game.dispatch({type:'load',code:'SS06',level:1});
  let revision=0, firstSecondLevelOffer='', joint=false, chain=false, pressure=false, extension=false, sharedCircuit=false;
  let releases=0, missingProjectionChecked=false;
  let heldGate=false, preparedFooting=false, rejectedMissingFooting=false;
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
  while(board.level<=7 && revision<480){
    const {packet,observation}=await show();
    const proposal=await family.propose(observation,packet.frame_rows,[],480-revision);
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
    let issued=0;
    for(const [index,command] of proposal.actions.entries()){
      const first=await show();
      const binding=await family.before(proposal,index,first.packet,first.observation);
      if(!binding.admitted)break;
      const transfer=proposal.steps[index]!.controlTransfer;
      const relay=proposal.steps[index]!.relay;
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
  assert.equal(board.levelsCompleted,7);
  assert.equal(releases,2);
  assert.ok(missingProjectionChecked);
  assert.ok(heldGate&&preparedFooting&&rejectedMissingFooting);
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
