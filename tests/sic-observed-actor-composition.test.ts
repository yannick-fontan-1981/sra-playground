import assert from 'node:assert/strict';
import test from 'node:test';
import { measureNativeObservation, publicFrameHash } from '../src/logos-engine/v6-native-observer.ts';
import { createObservedActorComposition } from '../src/sic/observed-actor-composition.ts';

type Point = readonly [number, number];
const same = (a: Point,b: Point) => a[0]===b[0] && a[1]===b[1];
const add = (a: Point,b: Point): Point => [a[0]+b[0],a[1]+b[1]];

function habitat(pitch: number, inks: readonly [number,number], commands: readonly [string,Point][],
  secondary: 'withdrawal' | 'activation', options: { rejectSelection?: boolean; duplicatePeer?: boolean; level?: number; offset?: Point } = {}) {
  const span = 12, alignment = 1, floor = 2, background = 3, cargoInk = 5, inset = 6;
  const marker = 7, destination = 8;
  const actorOrigins: Point[] = [[2,3],[2,7]];
  const actors=actorOrigins.map(p=>add(p,options.offset??[0,0]));
  const cargoOrigins: Point[] = [[4,3],[4,7]];
  const cargo=cargoOrigins.map(p=>add(p,options.offset??[0,0]));
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
    for(const p of [[10,2],[10,9]] as const)tile(p,(x,y)=>x===middle&&y===middle?floor:destination);
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