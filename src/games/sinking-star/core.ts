/** Standalone, deterministic SS01 rules. No agent, DOM, Python or network imports. */
export type Direction = 'N' | 'S' | 'W' | 'E';
export type MirrorFace = 'NE' | 'SE' | 'SW' | 'NW';
export type Position = Readonly<{ x: number; y: number }>;
export interface MerchantRules {
  readonly pushStones: boolean;
  readonly movableMirrors: boolean;
  readonly globalReflection: boolean;
  readonly allowParty: boolean;
}
export interface LevelSpec {
  readonly id: string;
  readonly title: string;
  readonly rows: readonly string[];
  readonly facing: Direction;
  readonly rules?: Partial<MerchantRules>;
}
export interface Stone extends Position { readonly reflectable?: boolean }
export interface Mirror extends Position { readonly face: MirrorFace }
export interface World {
  readonly id: string;
  readonly title: string;
  readonly tiles: readonly string[];
  readonly mirrors: readonly Mirror[];
  readonly start: Position;
  readonly companions: readonly Position[];
  readonly rocks: readonly Stone[];
  readonly sunken: readonly Position[];
  readonly buttons: readonly Position[];
  readonly doors: readonly Position[];
  readonly goal: Position;
  readonly goals: readonly Position[];
  readonly facing: Direction;
  readonly rules: MerchantRules;
}
export interface WorldState {
  /** Selected merchant. Others are present from reset: never created by a power. */
  readonly hero: Position;
  readonly others: readonly Position[];
  readonly rocks: readonly Stone[];
  readonly sunken: readonly Position[];
  readonly mirrors: readonly Mirror[];
  readonly facing: Direction;
  readonly complete: boolean;
  readonly failed: boolean;
}
export interface PilotObservation {
  gameCode: string;
  frame: number[][];
  frames: number[][][];
  frameDurationsMs?: number[];
  state: 'NOT_FINISHED' | 'WIN';
  availableActionIds: number[];
  canUndo: boolean;
  canSelectLevel: boolean;
  level: number;
  levelCount: number;
  levelsCompleted: number;
  defaultFps: number;
  palette: string[];
}
export const GRID = Object.freeze({ cells: 20, cellPx: 3, originPx: 2, canvasPx: 64 });
export const PALETTE: readonly string[] = Object.freeze([
  '#ffffff', '#cccccc', '#999999', '#777777', '#333333', '#000000',
  '#e03bca', '#f5a9c8', '#ef4141', '#2765d3', '#43d9eb', '#ffe14a',
  '#f59e29', '#8b5a2b', '#50b848', '#9e6bdb',
]);
/** v2 defaults are retained only to replay historical regression fixtures. */
const LEGACY_RULES: MerchantRules = Object.freeze({pushStones:false, movableMirrors:false, globalReflection:false, allowParty:false});
export const MERCHANT_RULES: MerchantRules = Object.freeze({pushStones:true, movableMirrors:true, globalReflection:true, allowParty:true});
const DELTA: Record<Direction, Position> = {N:{x:0,y:-1},S:{x:0,y:1},W:{x:-1,y:0},E:{x:1,y:0}};
const ACTION_DIRECTION: Record<number, Direction> = {1:'N',2:'S',3:'W',4:'E'};
const FACES: Record<string, MirrorFace> = {'1':'NE','2':'SE','3':'SW','4':'NW'};
const ARMS: Record<MirrorFace, readonly Direction[]> = {NE:['N','E'],SE:['S','E'],SW:['S','W'],NW:['N','W']};
const same = (a:Position,b:Position):boolean => a.x===b.x && a.y===b.y;
const inside = (p:Position):boolean => Number.isInteger(p.x)&&Number.isInteger(p.y)&&p.x>=0&&p.x<20&&p.y>=0&&p.y<20;
const tile = (w:World,p:Position):string => inside(p)?w.tiles[p.y*20+p.x]!:'#';
const along = (p:Position,d:Direction,n=1):Position => ({x:p.x+DELTA[d].x*n,y:p.y+DELTA[d].y*n});
export const merchants = (s:WorldState): readonly Position[] => [s.hero,...s.others];
const mirrorAt = (s:WorldState,p:Position):boolean => s.mirrors.some(m=>same(m,p));
const rockAt = (s:WorldState,p:Position):boolean => s.rocks.some(r=>same(r,p));
const merchantAt = (s:WorldState,p:Position):boolean => merchants(s).some(m=>same(m,p));
const sunkenAt = (s:WorldState,p:Position):boolean => s.sunken.some(r=>same(r,p));
const doorAt = (w:World,p:Position):boolean => w.doors.some(d=>same(d,p));
export function buttonsPressed(w:World,s:WorldState):boolean {
  return w.buttons.length>0 && w.buttons.every(p=>merchantAt(s,p)||rockAt(s,p));
}
const solid = (w:World,s:WorldState,p:Position):boolean => tile(w,p)==='#'||mirrorAt(s,p)||(doorAt(w,p)&&!buttonsPressed(w,s));
const supported = (w:World,s:WorldState,p:Position):boolean => tile(w,p)==='.'||sunkenAt(s,p);
const floor = (w:World,s:WorldState,p:Position):boolean => supported(w,s,p)&&!solid(w,s,p);
const doorsSafe = (w:World,s:WorldState):boolean => buttonsPressed(w,s)||w.doors.every(p=>!merchantAt(s,p)&&!rockAt(s,p)&&!mirrorAt(s,p));
const completed = (w:World,s:WorldState):boolean => w.goals.every(g=>merchantAt(s,g));
export function cellToPixel(p:Position):Position {
  if(!inside(p))throw new RangeError('Cell outside the 20 x 20 grid.');
  return {x:2+p.x*3,y:2+p.y*3};
}
export function pixelToCell(x:number,y:number):Position|null {
  if(!Number.isInteger(x)||!Number.isInteger(y)||x<2||y<2||x>=62||y>=62)return null;
  return {x:Math.floor((x-2)/3),y:Math.floor((y-2)/3)};
}
export function compileLevel(spec:LevelSpec):World {
  const height=spec.rows.length,width=spec.rows[0]?.length??0;
  if(!spec.id.trim()||width<1||height<1||width>20||height>20||spec.rows.some(r=>r.length!==width)||!Object.hasOwn(DELTA,spec.facing))throw new Error('Invalid rectangular level or direction.');
  const rules=Object.freeze({...LEGACY_RULES,...spec.rules});
  if(Object.values(rules).some(v=>typeof v!=='boolean'))throw new Error('Rules must be boolean.');
  const ox=Math.floor((20-width)/2),oy=Math.floor((20-height)/2),tiles:string[]=Array(400).fill('#');
  const mirrors:Mirror[]=[], starts:Position[]=[], rocks:Stone[]=[],sunken:Position[]=[],buttons:Position[]=[],doors:Position[]=[],goals:Position[]=[];
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const c=spec.rows[y]![x]!;
    if(!'#.~Mmg1234ocbD*@s'.includes(c))throw new Error(`Unknown map symbol: ${c}`);
    const p=Object.freeze({x:ox+x,y:oy+y});
    tiles[p.y*20+p.x]='#~'.includes(c)?c:c==='s'?'~':'.';
    if(c==='M'||c==='m'||c==='@')starts.push(p);
    if(c==='g')goals.push(p);
    if(c==='o'||c==='*')rocks.push(p);
    if(c==='c')rocks.push(Object.freeze({...p,reflectable:false}));
    if(c==='s')sunken.push(p);
    if(c==='b'||c==='*'||c==='@')buttons.push(p);
    if(c==='D')doors.push(p);
    if(FACES[c])mirrors.push(Object.freeze({...p,face:FACES[c]!}));
  }
  if(!starts.length||!goals.length||!mirrors.length||starts.length!==goals.length||(!rules.allowParty&&starts.length!==1))throw new Error('One destination per merchant and at least one mirror required.');
  return Object.freeze({id:spec.id,title:spec.title,tiles:Object.freeze(tiles),mirrors:Object.freeze(mirrors),start:starts[0]!,companions:Object.freeze(starts.slice(1)),rocks:Object.freeze(rocks),sunken:Object.freeze(sunken),buttons:Object.freeze(buttons),doors:Object.freeze(doors),goal:goals[0]!,goals:Object.freeze(goals),facing:spec.facing,rules});
}
export function initialState(w:World):WorldState {
  return {hero:{...w.start},others:w.companions.map(p=>({...p})),rocks:w.rocks.map(p=>({...p})),sunken:w.sunken.map(p=>({...p})),mirrors:w.mirrors.map(m=>({...m})),facing:w.facing,complete:false,failed:false};
}
function rayDistance(origin:Position,p:Position,d:Direction):number|null {
  const dx=p.x-origin.x,dy=p.y-origin.y,v=DELTA[d],n=dx*v.x+dy*v.y;
  return n>0&&dx===n*v.x&&dy===n*v.y?n:null;
}
function rayClear(w:World,s:WorldState,o:Position,d:Direction,n:number):boolean {
  for(let i=1;i<=n;i++){
    const p=along(o,d,i);
    if(solid(w,s,p)||(i<n&&(rockAt(s,p)||(w.rules.globalReflection&&merchantAt(s,p)))))return false;
  }
  return true;
}
interface GeometricTarget {target:Position; mirror:Mirror; clear:boolean}
function geometricTargets(w:World,s:WorldState,source:Position):GeometricTarget[]{
  const out:GeometricTarget[]=[];
  for(const m of s.mirrors){
    const arms=ARMS[m.face];
    for(let i=0;i<2;i++){
      const d=rayDistance(m,source,arms[i]!);
      if(d!==null&&rayClear(w,s,m,arms[i]!,d)){
        const target=along(m,arms[1-i]!,d);
        if(inside(target))out.push({target,mirror:m,clear:rayClear(w,s,m,arms[1-i]!,d)});
      }
    }
  }
  return out;
}
function reflectedState(s:WorldState,target:Position):WorldState {
  return {...s,hero:target,rocks:s.rocks.map(p=>same(p,target)?{...p,...s.hero}:p)};
}
export function mirrorCandidates(w:World,s:WorldState):Position[]{
  return geometricTargets(w,s,s.hero).filter(c=>c.clear&&floor(w,s,c.target)&&doorsSafe(w,reflectedState(s,c.target))).map(c=>c.target);
}
type EntityKind='merchant'|'stone';
interface Entity {kind:EntityKind; index:number; at:Position}
interface Transfer extends Entity {to:Position; mirror:Mirror}
const entities = (s:WorldState):Entity[] => [
  ...merchants(s).map((at,index)=>({kind:'merchant' as const,index,at})),
  ...s.rocks.flatMap((at,index)=>at.reflectable===false?[]:[{kind:'stone' as const,index,at}]),
];
function globalTransfers(w:World,s:WorldState):Transfer[]{
  const all=entities(s), proposed:Transfer[]=[];
  for(const e of all){
    const geometry=geometricTargets(w,s,e.at);
    // Ambiguity is not resolved by whichever mirror happened to be stored first.
    if(geometry.length!==1)continue;
    const c=geometry[0]!;
    if(!c.clear||solid(w,s,c.target)||s.rocks.some(r=>same(r,c.target)&&r.reflectable===false))continue;
    if(e.kind==='merchant'&&!supported(w,s,c.target))continue;
    proposed.push({...e,to:c.target,mirror:c.mirror});
  }
  // Reflective exchanges are simultaneous. An occupied endpoint must move back
  // through the same mirror; unrelated stationary occupants never disappear.
  return proposed.filter(p=>{
    if(proposed.filter(q=>same(q.to,p.to)).length!==1)return false;
    const occupant=all.find(e=>same(e.at,p.to));
    if(!occupant)return true;
    return proposed.some(q=>q.kind===occupant.kind&&q.index===occupant.index&&same(q.to,p.at)&&same(q.mirror,p.mirror));
  });
}
function applyTransfers(w:World,s:WorldState,plans:readonly Transfer[]):WorldState {
  const people=merchants(s).map(p=>({...p})),rocks:Stone[]=[],sunken=[...s.sunken];
  for(const p of plans)if(p.kind==='merchant')people[p.index]={...p.to};
  s.rocks.forEach((r,index)=>{
    const p=plans.find(p=>p.kind==='stone'&&p.index===index),target=p?.to??r;
    if(tile(w,target)==='~'&&!sunkenAt(s,target)){sunken.push({...target});}
    else rocks.push({...r,...target});
  });
  return {...s,hero:people[0]!,others:people.slice(1),rocks,sunken};
}
export interface ReflectionPreview {from:Position;to:Position;valid:boolean;kind:EntityKind}
/** Author/render helper. Only its pixels, never these semantic fields, leave observe(). */
export function reflectionPreviews(w:World,s:WorldState):ReflectionPreview[]{
  if(s.complete)return [];
  const all=w.rules.globalReflection?entities(s):[{kind:'merchant' as const,index:0,at:s.hero}];
  const proposed=w.rules.globalReflection?globalTransfers(w,s):[];
  const transfers=doorsSafe(w,applyTransfers(w,s,proposed))?proposed:[];
  const legacy= w.rules.globalReflection?[]:mirrorCandidates(w,s);
  return all.flatMap(e=>geometricTargets(w,s,e.at).map(c=>({from:e.at,to:c.target,kind:e.kind,
    valid:w.rules.globalReflection?transfers.some(t=>t.kind===e.kind&&t.index===e.index&&same(t.to,c.target))
      :legacy.length===1&&same(legacy[0]!,c.target)})));
}
function move(w:World,s:WorldState,d:Direction):WorldState {
  let next:WorldState={...s,facing:d};
  const target=along(s.hero,d);
  if(s.others.some(p=>same(p,target)))return next;
  const stone=s.rocks.findIndex(p=>same(p,target)),mi=s.mirrors.findIndex(p=>same(p,target));
  if(stone>=0&&w.rules.pushStones){
    const beyond=along(target,d);
    if(!solid(w,s,beyond)&&!merchantAt(s,beyond)&&!rockAt(s,beyond)){
      const sinks=tile(w,beyond)==='~'&&!sunkenAt(s,beyond);
      next={...next,hero:target,rocks:s.rocks.flatMap((p,i)=>i===stone?(sinks?[]:[{...p,...beyond}]):[p]),sunken:sinks?[...s.sunken,beyond]:s.sunken};
    }
  }else if(mi>=0&&w.rules.movableMirrors){
    const beyond=along(target,d);
    if(floor(w,s,beyond)&&!merchantAt(s,beyond)&&!rockAt(s,beyond))next={...next,hero:target,mirrors:s.mirrors.map((m,i)=>i===mi?{...m,...beyond}:m)};
  }else if(floor(w,s,target)&&!rockAt(s,target))next={...next,hero:target};
  return doorsSafe(w,next)?next:{...s,facing:d};
}
/** Pure transition: selection is ACTION6 with pixel coordinates, not a world tick. */
export function stepWorld(w:World,s:WorldState,actionId:number,data?:Position):WorldState {
  if(!Number.isInteger(actionId)||actionId<1||actionId>6||(actionId===6&&!s.others.length))throw new RangeError('SS01 actions: 1 to 5; 6 when several merchants are present.');
  if(actionId===6&&(!data||!Number.isInteger(data.x)||!Number.isInteger(data.y)||data.x<0||data.x>63||data.y<0||data.y>63))throw new RangeError('ACTION6 requires canvas pixel coordinates.');
  if(s.complete)return s;
  let next:WorldState={...s,failed:false};
  if(actionId===6){
    const p=pixelToCell(data!.x,data!.y),i=p?s.others.findIndex(o=>same(o,p)):-1;
    if(i<0)return s;
    return {...next,hero:s.others[i]!,others:s.others.map((o,j)=>j===i?s.hero:o)};
  }
  const d=ACTION_DIRECTION[actionId];
  if(d)next=move(w,next,d);
  else if(w.rules.globalReflection){
    const plans=globalTransfers(w,s),moved=applyTransfers(w,next,plans);
    next=plans.length&&doorsSafe(w,moved)?moved:{...next,failed:true};
  }else{
    const candidates=mirrorCandidates(w,s);
    next=candidates.length===1?reflectedState(next,candidates[0]!):{...next,failed:true};
  }
  return {...next,complete:completed(w,next)};
}
type Sprite=readonly(readonly(number|null)[])[];
function stamp(frame:number[][],p:Position,sprite:Sprite):void {
  if(!inside(p))return;
  const q=cellToPixel(p);
  sprite.forEach((r,y)=>r.forEach((c,x)=>{if(c!==null)frame[q.y+y]![q.x+x]=c;}));
}
const CROSS=(c:number):Sprite=>[[null,c,null],[c,c,c],[null,c,null]];
const ghost=(kind:EntityKind,c:number,center:number|null=null):Sprite=>kind==='stone'?[[c,c,c],[c,center,c],[c,c,c]]:[[null,c,null],[c,center??c,c],[null,c,null]];
export function renderWorld(w:World,s:WorldState,preview=true):number[][] {
  const f=Array.from({length:64},()=>Array<number>(64).fill(4));
  for(let y=0;y<20;y++)for(let x=0;x<20;x++){
    const t=tile(w,{x,y}),c=t==='#'?4:t==='~'?9:3;
    stamp(f,{x,y},[[c,c,c],[c,c,c],[c,c,c]]);
  }
  for(const m of s.mirrors)for(const arm of ARMS[m.face])for(let n=1;n<20;n++){
    const p=along(m,arm,n);
    if(solid(w,s,p))break;
    const c=s.failed?8:10;
    stamp(f,p,DELTA[arm].x?[[null,null,null],[c,c,c],[null,null,null]]:[[null,c,null],[null,c,null],[null,c,null]]);
    if(rockAt(s,p)||(w.rules.globalReflection&&merchantAt(s,p)))break;
  }
  for(const p of s.sunken)stamp(f,p,[[10,13,10],[13,10,13],[10,13,10]]);
  for(const p of w.buttons)stamp(f,p,CROSS(7));
  for(const p of w.doors)stamp(f,p,buttonsPressed(w,s)?[[7,null,7],[null,null,null],[7,null,7]]:[[7,7,7],[7,5,7],[7,7,7]]);
  for(const m of s.mirrors){
    let spr:(number|null)[][]=[[5,5,0],[5,0,null],[0,null,null]];
    for(let n=0;n<{SE:0,SW:1,NW:2,NE:3}[m.face];n++)spr=spr[0]!.map((_,x)=>spr.map(r=>r[x]!).reverse());
    stamp(f,m,spr);
  }
  for(const g of w.goals)stamp(f,g,[[11,11,11],[11,null,11],[11,11,11]]);
  for(const p of s.rocks)stamp(f,p,[[13,13,13],[13,p.reflectable===false?13:5,13],[13,13,13]]);
  for(const p of s.others)stamp(f,p,CROSS(12));
  const hero:(number|null)[][]=[[null,12,null],[12,12,12],[null,12,null]],d=DELTA[s.facing];
  hero[1+d.y]![1+d.x]=0;stamp(f,s.hero,hero);
  for(const p of w.buttons)if(merchantAt(s,p)||rockAt(s,p))stamp(f,p,[[7,null,7],[null,null,null],[7,null,7]]);
  for(const g of w.goals)if(rockAt(s,g))stamp(f,g,[[11,null,11],[null,null,null],[11,null,11]]);
  if(preview)for(const p of reflectionPreviews(w,s)){
    if(p.kind==='stone'){
      // A crate ghost keeps its square outline. Its center stays transparent,
      // including over water or an occupied endpoint; red center means blocked.
      stamp(f,p.to,[[1,1,1],[1,p.valid?null:8,1],[1,1,1]]);
    }else if(merchantAt(s,p.to)||rockAt(s,p.to)){
      stamp(f,p.to,[[null,null,null],[null,p.valid?1:8,null],[null,null,null]]);
    }else stamp(f,p.to,[[null,1,null],[1,p.valid?1:8,1],[null,1,null]]);
  }
  return f;
}
/** Presentation-only frames. A transition is already fully committed before playback. */
export function teleportFrames(w:World,before:WorldState,after:WorldState):number[][][]{
  let transfers:Transfer[]=[];
  if(!after.failed){
    if(w.rules.globalReflection)transfers=globalTransfers(w,before);
    else if(!same(before.hero,after.hero)){
      transfers=[{kind:'merchant',index:0,at:before.hero,to:after.hero,mirror:before.mirrors[0]!}];
      const index=before.rocks.findIndex(p=>same(p,after.hero));
      if(index>=0)transfers.push({kind:'stone',index,at:after.hero,to:before.hero,mirror:before.mirrors[0]!});
    }
  }
  if(!transfers.length)return [renderWorld(w,after)];
  const pulse=renderWorld(w,before,false),fade=renderWorld(w,before,false),arrival=renderWorld(w,after,false),settle=renderWorld(w,after,false);
  for(const p of transfers){
    stamp(pulse,p.at,ghost(p.kind,0)); stamp(pulse,p.to,ghost(p.kind,1));
    stamp(fade,p.at,ghost(p.kind,1,0));
    stamp(fade,p.to,ghost(p.kind,10,0));
    stamp(arrival,p.to,ghost(p.kind,1,0));
    stamp(settle,p.to,[[null,null,null],[null,p.kind==='merchant'?12:13,null],[null,null,null]]);
  }
  return [pulse,fade,arrival,settle,renderWorld(w,after)];
}
interface Snapshot {index:number;completed:number[];state:WorldState}
export class SinkingStarSession {
  private readonly worlds:readonly World[];
  private index=0;
  private completed=new Set<number>();
  private state:WorldState;
  private history:Snapshot[]=[];
  constructor(levels:readonly LevelSpec[]){
    if(!levels.length||new Set(levels.map(l=>l.id)).size!==levels.length)throw new Error('Unique nonempty levels required.');
    this.worlds=levels.map(compileLevel);this.state=initialState(this.worlds[0]!);
  }
  observe():PilotObservation {
    const frame=renderWorld(this.worlds[this.index]!,this.state);
    return {gameCode:'SS01',frame,frames:[frame],state:this.completed.size===this.worlds.length?'WIN':'NOT_FINISHED',availableActionIds:this.state.others.length?[1,2,3,4,5,6]:[1,2,3,4,5],canUndo:this.history.length>0,canSelectLevel:true,level:this.index+1,levelCount:this.worlds.length,levelsCompleted:this.completed.size,defaultFps:8,palette:[...PALETTE]};
  }
  action(actionId:number,data?:Position):PilotObservation {
    const world=this.worlds[this.index]!,before=this.state,next=stepWorld(world,before,actionId,data);
    if(JSON.stringify(next)===JSON.stringify(before))return this.observe();
    this.history.push({index:this.index,completed:[...this.completed],state:before});this.state=next;
    const frames=actionId===5?teleportFrames(world,before,next):[renderWorld(world,next)];
    if(next.complete){
      this.completed.add(this.index);
      const nextIndex=this.worlds.findIndex((_,i)=>!this.completed.has(i));
      if(nextIndex!==-1){this.index=nextIndex;this.state=initialState(this.worlds[this.index]!);}
    }
    const observation=this.observe();
    if(frames.length>1){
      const durations=[45,55,55,55,0];
      if(this.state!==next){durations[durations.length-1]=70;frames.push(observation.frame);durations.push(0);}
      return {...observation,frames,frameDurationsMs:durations};
    }
    return observation;
  }
  /** Manual shortcut for the same ACTION6 that a click sends. */
  nextMerchant():PilotObservation {
    if(!this.state.others.length)return this.observe();
    const p=cellToPixel(this.state.others[0]!);return this.action(6,{x:p.x+1,y:p.y+1});
  }
  undo():PilotObservation {
    const s=this.history.pop();if(s){this.index=s.index;this.completed=new Set(s.completed);this.state=s.state;}
    return this.observe();
  }
  reset():PilotObservation {this.completed.delete(this.index);this.state=initialState(this.worlds[this.index]!);this.history=[];return this.observe();}
  restart():PilotObservation {this.index=0;this.completed.clear();return this.reset();}
  selectLevel(level:number):PilotObservation {
    if(!Number.isInteger(level)||level<1||level>this.worlds.length)throw new RangeError('Invalid level.');
    this.index=level-1;return this.reset();
  }
}
