/** Deterministic Warrior–Thief puzzles. No browser, solver, agent or network dependency. */
export type Point = Readonly<{x:number;y:number}>;
export type Direction = 'N'|'S'|'W'|'E';
export type MirrorFacing = 'NE'|'NW'|'SE'|'SW';
export type HeroKind = 'warrior'|'thief';
export interface Hero {readonly kind:HeroKind;readonly at:Point;readonly facing:Direction;readonly dead?:boolean}
export interface MirrorSpec {readonly at:Point;readonly facing:MirrorFacing}
export interface CircuitSpec {readonly id:string;readonly buttons:readonly Point[];readonly color?:number}
export interface GateSpec {readonly at:Point;readonly circuit:string;readonly direction:Direction;readonly closedWhen:'pressed'|'released'}
export interface PlatformSpec {readonly at:Point;readonly circuit:string;readonly activeWhen:'pressed'|'released'}
export interface LevelSpec {
  readonly id:string;readonly title:string;readonly rows:readonly string[];readonly facing?:Direction;
  /** SS10 rooms contain a Warrior and a Thief; omitted mode means duo. */
  readonly mode?:'duo';
  /** Coordinates before centering the rectangular map in the 20 by 20 grid. */
  readonly circuits?:readonly CircuitSpec[];readonly gates?:readonly GateSpec[];readonly mirrors?:readonly MirrorSpec[];readonly platforms?:readonly PlatformSpec[];
}
export interface World {
  readonly id:string;readonly title:string;readonly terrain:readonly string[];readonly heroes:readonly Hero[];
  readonly stones:readonly Point[];readonly monsters:readonly Point[];readonly supports:readonly Point[];
  readonly buttons:readonly Point[];readonly doors:readonly Point[];readonly goals:readonly Point[];
  readonly circuits:readonly CircuitSpec[];readonly gates:readonly GateSpec[];readonly mirrors:readonly MirrorSpec[];readonly platforms:readonly PlatformSpec[];
}
export interface State {
  readonly heroes:readonly Hero[];readonly active:number;readonly stones:readonly Point[];readonly monsters:readonly Point[];
  readonly supports:readonly Point[];readonly mirrors:readonly MirrorSpec[];readonly complete:boolean;readonly failed:boolean;
  readonly dead:boolean;readonly gateClosed?:readonly boolean[];readonly platformActive?:readonly boolean[];
}
export interface Observation {
  gameCode:string;frame:number[][];frames:number[][][];frameDurationsMs?:number[];
  state:'NOT_FINISHED'|'WIN'|'GAME_OVER';availableActionIds:number[];canUndo:boolean;canSelectLevel:boolean;
  level:number;levelCount:number;levelsCompleted:number;defaultFps:number;palette:string[];
}
export const GRID=Object.freeze({cells:20,cellPx:3,originPx:2,canvasPx:64});
export const PALETTE:readonly string[]=Object.freeze(['#ffffff','#cccccc','#999999','#777777','#333333','#000000','#e03bca','#f5a9c8','#ef4141','#2765d3','#43d9eb','#ffe14a','#f59e29','#8b5a2b','#50b848','#9e6bdb']);
export const VECTORS:Readonly<Record<Direction,Point>>=Object.freeze({N:{x:0,y:-1},S:{x:0,y:1},W:{x:-1,y:0},E:{x:1,y:0}});
const directionIds:Readonly<Record<number,Direction>>={1:'N',2:'S',3:'W',4:'E'};
const mirrorDigits:Readonly<Record<string,MirrorFacing>>={'1':'NE','2':'SE','3':'SW','4':'NW'};
export const equal=(a:Point,b:Point):boolean=>a.x===b.x&&a.y===b.y;
export const contains=(ps:readonly Point[],p:Point):boolean=>ps.some(q=>equal(q,p));
export const offset=(p:Point,d:Direction):Point=>({x:p.x+VECTORS[d].x,y:p.y+VECTORS[d].y});
export const inside=(p:Point):boolean=>Number.isInteger(p.x)&&Number.isInteger(p.y)&&p.x>=0&&p.y>=0&&p.x<20&&p.y<20;
export const terrainAt=(w:World,p:Point):string=>inside(p)?w.terrain[p.y*20+p.x]!:'#';
export const supported=(w:World,s:State,p:Point):boolean=>terrainAt(w,p)==='.'||contains(s.supports,p)||w.platforms.some((a,i)=>equal(a.at,p)&&platformActive(w,s,i));
export const cellToPixel=(p:Point):Point=>({x:2+p.x*3,y:2+p.y*3});
export const pixelToCell=(x:number,y:number):Point|null=>Number.isInteger(x)&&Number.isInteger(y)&&x>=2&&x<62&&y>=2&&y<62?{x:Math.floor((x-2)/3),y:Math.floor((y-2)/3)}:null;
const heroAt=(s:State,p:Point):boolean=>s.heroes.some(h=>!h.dead&&equal(h.at,p));
const weighted=(s:State,p:Point):boolean=>heroAt(s,p)||contains(s.stones,p)||contains(s.monsters,p)||s.mirrors.some(m=>equal(m.at,p));
export const doorsOpen=(w:World,s:State):boolean=>w.buttons.length>0&&w.buttons.every(p=>weighted(s,p));
export const circuitPressed=(w:World,s:State,id:string):boolean=>{
  const c=w.circuits.find(c=>c.id===id);
  return !!c&&c.buttons.every(p=>weighted(s,p)||w.gates.some((g,i)=>!!s.gateClosed?.[i]&&equal(g.at,p)));
};
export const gateClosed=(w:World,s:State,index:number):boolean=>{
  const g=w.gates[index];return !!g&&(s.gateClosed?.[index]??(circuitPressed(w,s,g.circuit)===(g.closedWhen==='pressed')));
};
export const platformActive=(w:World,s:State,index:number):boolean=>{
  const p=w.platforms[index];return !!p&&(s.platformActive?.[index]??(circuitPressed(w,s,p.circuit)===(p.activeWhen==='pressed')));
};
const hydraulicCell=(w:World,p:Point):boolean=>w.platforms.some(a=>equal(a.at,p));
const blocked=(w:World,s:State,p:Point):boolean=>terrainAt(w,p)==='#'||(contains(w.doors,p)&&!doorsOpen(w,s))||w.gates.some((g,i)=>equal(g.at,p)&&gateClosed(w,s,i));
const rayBlocked=(w:World,s:State,p:Point):boolean=>blocked(w,s,p)||s.mirrors.some(m=>equal(m.at,p));
const safeDoors=(w:World,s:State):boolean=>doorsOpen(w,s)||w.doors.every(p=>!weighted(s,p));
const keyOf=(p:Point):string=>`${p.x},${p.y}`;
const completed=(w:World,s:State):boolean=>!s.dead&&w.goals.every(p=>heroAt(s,p));

export function compileLevel(spec:LevelSpec):World {
  const width=spec.rows[0]?.length??0;
  if(!spec.id.trim()||!spec.title.trim()||!width||width>20||!spec.rows.length||spec.rows.length>20||spec.rows.some(r=>r.length!==width))throw new Error('A nonempty rectangular map of at most 20×20 cells is required.');
  if(spec.facing!==undefined&&!Object.hasOwn(VECTORS,spec.facing))throw new Error('Invalid facing.');
  if(spec.mode!==undefined&&spec.mode!=='duo')throw new Error('Invalid hero mode.');
  const ox=Math.floor((20-width)/2),oy=Math.floor((20-spec.rows.length)/2),terrain=Array<string>(400).fill('#');
  const heroes:Hero[]=[],stones:Point[]=[],monsters:Point[]=[],supports:Point[]=[],buttons:Point[]=[],doors:Point[]=[],goals:Point[]=[],drawnMirrors:MirrorSpec[]=[];
  spec.rows.forEach((r,y)=>[...r].forEach((c,x)=>{
    if(!'#.~WTombD*sg1234'.includes(c))throw new Error(`Unknown tile: ${c}`);
    const p=Object.freeze({x:x+ox,y:y+oy});terrain[p.y*20+p.x]='#~'.includes(c)?c:c==='s'?'~':'.';
    if(c==='W'||c==='T')heroes.push(Object.freeze({kind:c==='W'?'warrior':'thief',at:p,facing:spec.facing??'N'}));
    if(c==='o'||c==='*')stones.push(p);if(c==='m')monsters.push(p);if(c==='s')supports.push(p);
    if(c==='b'||c==='*')buttons.push(p);if(c==='D')doors.push(p);if(c==='g')goals.push(p);
    if(mirrorDigits[c])drawnMirrors.push(Object.freeze({at:p,facing:mirrorDigits[c]!}));
  }));
  if(heroes.length!==2||heroes.filter(h=>h.kind==='warrior').length!==1||heroes.filter(h=>h.kind==='thief').length!==1||goals.length!==2)throw new Error('SS10 requires one Warrior, one Thief and two destinations.');
  heroes.sort((a,b)=>a.kind==='warrior'?-1:b.kind==='warrior'?1:0);
  const convert=(p:Point,required='.') :Point=>{
    if(!Number.isInteger(p.x)||!Number.isInteger(p.y)||p.x<0||p.y<0||p.x>=width||p.y>=spec.rows.length)throw new Error('Device coordinates must be inside the source map.');
    const at={x:p.x+ox,y:p.y+oy};if(terrain[at.y*20+at.x]!==required)throw new Error(required==='~'?'Water platforms require a water cell.':'Devices require a floor cell.');return Object.freeze(at);
  };
  const mirrors=[...drawnMirrors,...(spec.mirrors??[]).map(m=>{
    if(!['NE','NW','SE','SW'].includes(m.facing))throw new Error('Invalid mirror facing.');return Object.freeze({at:convert(m.at),facing:m.facing});
  })];
  if(new Set(mirrors.map(m=>keyOf(m.at))).size!==mirrors.length)throw new Error('Mirror positions must be unique.');
  const ids=new Set<string>();
  const circuits=(spec.circuits??[]).map(c=>{
    if(!c.id.trim()||ids.has(c.id)||!c.buttons.length)throw new Error('Circuits require unique ids and buttons.');ids.add(c.id);
    if(c.color!==undefined&&(!Number.isInteger(c.color)||c.color<0||c.color>15))throw new Error('Circuit colors must be palette indices.');
    return Object.freeze({id:c.id,buttons:Object.freeze(c.buttons.map(p=>convert(p))),...(c.color!==undefined?{color:c.color}:{})});
  });
  const circuitButtons=circuits.flatMap(c=>c.buttons);
  if(new Set(circuitButtons.map(keyOf)).size!==circuitButtons.length)throw new Error('A button belongs to exactly one circuit.');
  if(circuits.length&&buttons.some(p=>!contains(circuitButtons,p)))throw new Error('Every drawn button must belong to a circuit.');
  for(const p of circuitButtons)if(!contains(buttons,p))buttons.push(p);
  const gates=(spec.gates??[]).map(g=>{
    if(!ids.has(g.circuit)||!Object.hasOwn(VECTORS,g.direction)||!['pressed','released'].includes(g.closedWhen))throw new Error('Invalid piston circuit, direction or activation mode.');
    return Object.freeze({...g,at:convert(g.at)});
  });
  if(new Set(gates.map(g=>keyOf(g.at))).size!==gates.length)throw new Error('Piston positions must be unique.');
  const platforms=(spec.platforms??[]).map(p=>{
    if(!ids.has(p.circuit)||!['pressed','released'].includes(p.activeWhen))throw new Error('Invalid water platform circuit or activation mode.');
    return Object.freeze({...p,at:convert(p.at,'~')});
  });
  if(new Set(platforms.map(p=>keyOf(p.at))).size!==platforms.length)throw new Error('Water platform positions must be unique.');
  for(const m of mirrors)if([...heroes.map(h=>h.at),...stones,...monsters,...supports,...goals].some(p=>equal(p,m.at)))throw new Error('A mirror cannot overlap an actor or a destination.');
  const legacyDoors=doors.filter(p=>!gates.some(g=>equal(g.at,p)));
  if(legacyDoors.length&&!buttons.length)throw new Error('Doors require a visible button.');
  return Object.freeze({id:spec.id,title:spec.title,terrain:Object.freeze(terrain),heroes:Object.freeze(heroes),stones:Object.freeze(stones),monsters:Object.freeze(monsters),supports:Object.freeze(supports),buttons:Object.freeze(buttons),doors:Object.freeze(legacyDoors),goals:Object.freeze(goals),circuits:Object.freeze(circuits),gates:Object.freeze(gates),mirrors:Object.freeze(mirrors),platforms:Object.freeze(platforms)});
}
export function initialState(w:World):State {
  const s:State={heroes:w.heroes.map(h=>({...h,at:{...h.at}})),active:0,stones:w.stones.map(p=>({...p})),monsters:w.monsters.map(p=>({...p})),supports:w.supports.map(p=>({...p})),mirrors:w.mirrors.map(m=>({...m,at:{...m.at}})),complete:false,failed:false,dead:false};
  if(!w.gates.length&&!w.platforms.length)return s;
  const settled=settleGates(w,{...s,gateClosed:w.gates.map(()=>false),...(w.platforms.length?{platformActive:w.platforms.map(()=>false)}:{})},[]);
  if(!settled.stable||settled.state.dead)throw new Error('Initial piston circuit is unstable or fatal.');return settled.state;
}
export interface Motion {readonly actor:'hero'|'stone'|'monster'|'mirror';readonly from:Point;readonly to:Point}
export interface MotionPhase {
  readonly kind:'walk'|'push'|'pull'|'reflect'|'piston'|'crush'|'gate'|'platform'|'combat';readonly before:State;readonly after:State;readonly moves:readonly Motion[];
  readonly gateIndex?:number;readonly paths?:readonly (readonly Point[])[];
}
export interface DetailedStep {
  readonly state:State;readonly phases:readonly MotionPhase[];
  /** Refusal feedback only: no movement, circuit settling or combat tick. */
  readonly blockedMirrorIndices?:readonly number[];
}
export interface ReflectionPlan {readonly moves:readonly Motion[];readonly paths:readonly (readonly Point[])[];readonly mirrorIndices:readonly number[]}
const actorAt=(s:State,p:Point):Motion['actor']|null=>heroAt(s,p)?'hero':contains(s.stones,p)?'stone':contains(s.monsters,p)?'monster':s.mirrors.some(m=>equal(m.at,p))?'mirror':null;
const mirrorArms:Readonly<Record<MirrorFacing,readonly [Direction,Direction]>>={NE:['N','E'],NW:['N','W'],SE:['S','E'],SW:['S','W']};
interface ReflectionAttempt {readonly plan:ReflectionPlan|null;readonly blockedMirrorIndices:readonly number[]}
function reflectionAttempt(w:World,s:State):ReflectionAttempt {
  const refusal=(indices:readonly number[]=[]):ReflectionAttempt=>({plan:null,blockedMirrorIndices:[...new Set(indices)].sort((a,b)=>a-b)});
  if(s.complete||s.dead)return refusal();
  const moves:Motion[]=[],paths:Point[][]=[],mirrorIndices:number[]=[],owners:number[][]=[];
  for(let mi=0;mi<s.mirrors.length;mi++){
    const mirror=s.mirrors[mi]!,arms=mirrorArms[mirror.facing];
    const candidates:{actor:Motion['actor'];from:Point;toDir:Direction;distance:number;path:Point[]}[]=[];
    for(let side=0;side<2;side++){
      const fromDir=arms[side]!,toDir=arms[1-side]!;let from=mirror.at;const path:Point[]=[mirror.at];
      for(let distance=1;distance<20;distance++){
        from=offset(from,fromDir);if(rayBlocked(w,s,from))break;path.push(from);
        const actor=actorAt(s,from);if(!actor)continue;
        candidates.push({actor,from,toDir,distance,path});break;
      }
    }
    // Choose by source distance before validating any destination. A farther
    // actor stays put and its blocked landing must not veto the nearer one.
    // Equal distances retain the symmetric exchange of the two facing actors.
    const nearest=Math.min(...candidates.map(c=>c.distance));
    for(const {actor,from,toDir,distance,path} of candidates){
      if(distance!==nearest)continue;
      let to=mirror.at;const destinationPath:Point[]=[];
      for(let d=0;d<distance;d++){
        to=offset(to,toDir);
        if(rayBlocked(w,s,to)){const obstruction=s.mirrors.findIndex(m=>equal(m.at,to));return refusal(obstruction<0?[]:[obstruction]);}
        destinationPath.push(to);
      }
      const previousIndex=moves.findIndex(m=>m.actor===actor&&equal(m.from,from)),previous=moves[previousIndex];
      if(previous&&!equal(previous.to,to))return refusal([...owners[previousIndex]!,mi]);
      if(!previous){moves.push({actor,from,to});owners.push([mi]);}else owners[previousIndex]!.push(mi);
      paths.push([...path].reverse().concat(destinationPath));if(!mirrorIndices.includes(mi))mirrorIndices.push(mi);
    }
  }
  if(!moves.length){
    // An intervening mirror can hide the only source. Diagnose it only after
    // the real planner found no transfer; it must never veto a valid nearer one.
    const obstructions:number[]=[];
    for(const mirror of s.mirrors){
      const candidates:{distance:number;blockers:number[]}[]=[];
      for(const direction of mirrorArms[mirror.facing]){
        let at=mirror.at;const blockers:number[]=[];
        for(let distance=1;distance<20;distance++){
          at=offset(at,direction);if(blocked(w,s,at))break;
          const index=s.mirrors.findIndex(m=>equal(m.at,at));
          if(index>=0){blockers.push(index);continue;}
          if(actorAt(s,at)){candidates.push({distance,blockers:[...blockers]});break;}
        }
      }
      const nearest=Math.min(...candidates.map(c=>c.distance));
      for(const c of candidates)if(c.distance===nearest)obstructions.push(...c.blockers);
    }
    return refusal(obstructions);
  }
  const destinations=new Map<string,number>();
  for(const [index,move] of moves.entries()){
    const other=destinations.get(keyOf(move.to));if(other!==undefined)return refusal([...owners[other]!,...owners[index]!]);destinations.set(keyOf(move.to),index);
    const occupant=actorAt(s,move.to);if(occupant&&!moves.some(m=>m.actor===occupant&&equal(m.from,move.to)))return refusal();
  }
  for(const path of paths)for(const p of path){
    const occupant=actorAt(s,p);if(occupant&&occupant!=='mirror'&&!moves.some(m=>m.actor===occupant&&equal(m.from,p)))return refusal();
  }
  return {plan:{moves,paths,mirrorIndices},blockedMirrorIndices:[]};
}
/** Author-only planner. Public observations contain its rendered pixels only. */
export function planReflection(w:World,s:State):ReflectionPlan|null{return reflectionAttempt(w,s).plan;}
/** Resolve water after position changes. Hydraulic cells wait until their circuits settle. */
function resolveBuoyancy(w:World,s:State,deferHydraulics:boolean):State {
  const supports=[...s.supports],stones:Point[]=[];
  const postponed=(p:Point)=>deferHydraulics&&hydraulicCell(w,p);
  for(const p of s.stones){if(terrainAt(w,p)==='~'&&!supported(w,{...s,supports},p)&&!postponed(p))supports.push(p);else stones.push(p);}
  const safe=(p:Point)=>supported(w,{...s,supports},p)||postponed(p);
  const heroes=s.heroes.map(h=>({...h,dead:!!h.dead||!safe(h.at)}));
  const monsters=s.monsters.filter(safe),mirrors=s.mirrors.filter(m=>safe(m.at));
  return {...s,heroes,stones,monsters,supports,mirrors,dead:heroes.some(h=>h.dead),failed:false};
}
function applyMotions(w:World,s:State,moves:readonly Motion[]):State {
  const target=(actor:Motion['actor'],p:Point)=>moves.find(m=>m.actor===actor&&equal(m.from,p))?.to??p;
  return resolveBuoyancy(w,{...s,heroes:s.heroes.map(h=>({...h,at:target('hero',h.at)})),stones:s.stones.map(p=>target('stone',p)),monsters:s.monsters.map(p=>target('monster',p)),mirrors:s.mirrors.map(m=>({...m,at:target('mirror',m.at)}))},true);
}
function moveStep(w:World,s:State,d:Direction):{state:State;moves:Motion[]}|null {
  const hero=s.heroes[s.active]!,to=offset(hero.at,d);if(blocked(w,s,to))return null;
  const moves:Motion[]=[{actor:'hero',from:hero.at,to}];
  if(hero.kind==='thief'){
    // Walking is the only cause of traction: exactly the adjacent rear actor
    // enters the vacated cell. A sideways departure leaves the old rear alone.
    if(actorAt(s,to))return null;
    const v=VECTORS[d],from={x:hero.at.x-v.x,y:hero.at.y-v.y},actor=actorAt(s,from);
    if(actor)moves.push({actor,from,to:hero.at});
  }else{
    // The Warrior pushes the complete consecutive file, with one atomic landing.
    let from=to,actor=actorAt(s,from);
    while(actor){const next=offset(from,d);if(blocked(w,s,next))return null;moves.push({actor,from,to:next});from=next;actor=actorAt(s,from);}
  }
  const next=applyMotions(w,s,moves);
  // A voluntary move cannot drown a companion or destroy a mirror. Presses and reflections can.
  if(next.dead||next.mirrors.length!==s.mirrors.length||moves.some(m=>(m.actor==='hero'||m.actor==='mirror')&&hydraulicCell(w,m.to)&&!supported(w,next,m.to)))return null;
  return {state:next,moves};
}
function firePiston(w:World,s:State,index:number):{state:State;phase:MotionPhase|null} {
  const gate=w.gates[index]!;if(!actorAt(s,gate.at))return {state:s,phase:null};
  const moves:Motion[]=[];let p=gate.at;
  for(let actor=actorAt(s,p);actor;actor=actorAt(s,p)){const to=offset(p,gate.direction);moves.push({actor,from:p,to});p=to;}
  if(moves.some(m=>blocked(w,s,m.to))){
    const actor=moves[0]!.actor;
    const heroes=actor==='hero'?s.heroes.map(h=>equal(h.at,gate.at)?{...h,dead:true}:h):s.heroes;
    const next:State={...s,heroes,dead:heroes.some(h=>h.dead),complete:false,
      stones:actor==='stone'?s.stones.filter(p=>!equal(p,gate.at)):s.stones,
      monsters:actor==='monster'?s.monsters.filter(p=>!equal(p,gate.at)):s.monsters,
      mirrors:actor==='mirror'?s.mirrors.filter(m=>!equal(m.at,gate.at)):s.mirrors};
    return {state:next,phase:{kind:'crush',before:s,after:next,moves:[],gateIndex:index}};
  }
  const next=applyMotions(w,s,moves);return {state:next,phase:{kind:'piston',before:s,after:next,moves,gateIndex:index}};
}
function settlePlatforms(w:World,start:State,phases:MotionPhase[]):State {
  if(!w.platforms.length)return start;
  const current=w.platforms.map((_,i)=>platformActive(w,start,i));
  const desired=w.platforms.map(p=>circuitPressed(w,start,p.circuit)===(p.activeWhen==='pressed'));
  const state=resolveBuoyancy(w,{...start,platformActive:desired},false);
  if(desired.some((v,i)=>v!==current[i])||state.stones.length!==start.stones.length||state.monsters.length!==start.monsters.length||state.mirrors.length!==start.mirrors.length||state.heroes.some((h,i)=>!!h.dead!==!!start.heroes[i]!.dead))phases.push({kind:'platform',before:start,after:state,moves:[]});
  return state;
}
function settleGates(w:World,start:State,phases:MotionPhase[]):{state:State;stable:boolean} {
  let state=start;const seen=new Set<string>();
  for(let round=0;round<64;round++){
    const current=w.gates.map((_,i)=>gateClosed(w,state,i));
    const desired=w.gates.map(g=>circuitPressed(w,state,g.circuit)===(g.closedWhen==='pressed'));
    if(desired.every((v,i)=>v===current[i]))return {state:settlePlatforms(w,state,phases),stable:true};
    const key=JSON.stringify([state.heroes,state.stones,state.monsters,state.mirrors,state.supports,current]);
    if(seen.has(key))return {state:start,stable:false};seen.add(key);
    const before=state;state={...state,gateClosed:desired};let fired=false;
    for(let i=0;i<w.gates.length;i++)if(desired[i]&&!current[i]){const r=firePiston(w,state,i);state=r.state;if(r.phase){phases.push(r.phase);fired=true;}}
    if(!fired)phases.push({kind:'gate',before,after:state,moves:[]});
    if(state.dead)return {state:settlePlatforms(w,state,phases),stable:true};
  }
  return {state:start,stable:false};
}
function resolveCombat(w:World,s:State):State {
  const adjacent=(a:Point,b:Point)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y)===1;
  const alive=s.monsters.filter(p=>supported(w,s,p));
  const heroes=s.heroes.map(h=>({...h,dead:!!h.dead||!supported(w,s,h.at)||alive.some(p=>adjacent(p,h.at))}));
  const monsters=alive.filter(p=>!alive.some(q=>adjacent(p,q)));
  if(heroes.every((h,i)=>!!h.dead===!!s.heroes[i]!.dead)&&monsters.length===s.monsters.length)return s;
  return {...s,heroes,dead:heroes.some(h=>h.dead),monsters,complete:false};
}
/** Click selection is presentation state, not a world tick. Invalid/refused turns do not trigger combat. */
export function stepDetailed(w:World,s:State,actionId:number,data?:Point):DetailedStep {
  if(!Number.isInteger(actionId)||actionId<1||actionId>6)throw new RangeError('SS10 accepts ACTION1–ACTION6.');
  if(actionId===6&&(!data||!Number.isInteger(data.x)||!Number.isInteger(data.y)||data.x<0||data.y<0||data.x>63||data.y>63))throw new RangeError('ACTION6 requires 64×64 canvas pixel coordinates.');
  if(s.complete||s.dead)return {state:s,phases:[]};
  if(actionId===6){const p=pixelToCell(data!.x,data!.y),active=p?s.heroes.findIndex(h=>!h.dead&&equal(h.at,p)):-1;return {state:active<0||active===s.active?s:{...s,active,failed:false},phases:[]};}
  const hero=s.heroes[s.active]!,direction=actionId===5?hero.facing:directionIds[actionId]!;
  const faced:State={...s,heroes:s.heroes.map((h,i)=>i===s.active?{...h,facing:direction}:h),failed:false};
  const refusal=():DetailedStep=>({state:{...faced,failed:true},phases:[]});
  let next:State,first:MotionPhase;
  if(actionId===5){const {plan,blockedMirrorIndices}=reflectionAttempt(w,s);if(!plan)return {...refusal(),...(blockedMirrorIndices.length?{blockedMirrorIndices}:{})};next=applyMotions(w,faced,plan.moves);first={kind:'reflect',before:s,after:next,moves:plan.moves,paths:plan.paths};}
  else {const result=moveStep(w,faced,direction);if(!result)return refusal();next=result.state;first={kind:result.moves.length>1?(hero.kind==='thief'?'pull':'push'):'walk',before:s,after:next,moves:result.moves};}
  if(!safeDoors(w,next))return refusal();
  const phases:MotionPhase[]=[first];
  for(let wave=0;wave<=s.monsters.length+1;wave++){
    if(w.gates.length||w.platforms.length){const settled=settleGates(w,next,phases);if(!settled.stable)return refusal();next=settled.state;}
    const fought=resolveCombat(w,next);if(fought===next)break;
    phases.push({kind:'combat',before:next,after:fought,moves:[]});const removed=fought.monsters.length<next.monsters.length;next=fought;if(!removed)break;
  }
  if(!safeDoors(w,next))return refusal();next={...next,complete:completed(w,next)};
  const last=phases.at(-1)!;phases[phases.length-1]={...last,after:next};return {state:next,phases};
}
export function stepWorld(w:World,s:State,actionId:number,data?:Point):State{return stepDetailed(w,s,actionId,data).state;}

type Sprite=readonly(readonly(number|null)[])[];
const cross=(c:number):Sprite=>[[null,c,null],[c,c,c],[null,c,null]];
const square=(c:number,m:number|null=null):Sprite=>[[c,c,c],[c,m,c],[c,c,c]];
function stampPixels(frame:number[][],p:Point,sprite:Sprite):void {
  sprite.forEach((r,y)=>r.forEach((v,x)=>{const px=p.x+x,py=p.y+y;if(v!==null&&px>=2&&px<62&&py>=2&&py<62)frame[py]![px]=v;}));
}
function stamp(frame:number[][],p:Point,sprite:Sprite):void{if(inside(p))stampPixels(frame,cellToPixel(p),sprite);}
const heroColor=(h:Hero):number=>h.kind==='warrior'?8:14;
function heroSprite(h:Hero,selected:boolean):Sprite {
  const c=heroColor(h),sprite:(number|null)[][]=[[null,c,null],[c,c,c],[null,c,null]];
  if(selected){const d=VECTORS[h.facing];sprite[1+d.y]![1+d.x]=0;}
  if(h.dead)return [[c,5,c],[5,8,5],[c,5,c]];return sprite;
}
const circuitColors:readonly number[]=[0,10,12,15,2,8,11,14];
const circuitColor=(w:World,id:string):number=>w.circuits.find(c=>c.id===id)?.color??circuitColors[w.circuits.findIndex(c=>c.id===id)%circuitColors.length]!;
function pistonSprite(d:Direction,closed:boolean,accent:number):Sprite {
  const spr:(number|null)[][]=closed?[[7,7,7],[7,5,7],[7,7,7]]:[[7,null,7],[null,null,null],[7,null,7]],tip=VECTORS[d],side={x:-tip.y,y:tip.x};
  spr[1+tip.y]![1+tip.x]=accent;spr[1+side.y]![1+side.x]=accent;spr[1-side.y]![1-side.x]=accent;return spr;
}
const platformSprite=(active:boolean,accent:number):Sprite=>active?[[7,7,7],[7,accent,7],[7,7,7]]:[[7,null,7],[null,accent,null],[7,null,7]];
const supportSprite:Sprite=[[10,13,10],[13,10,13],[10,13,10]];
const monsterSprite:Sprite=[[8,5,8],[5,8,5],[8,5,8]];
function mirrorSprite(f:MirrorFacing):Sprite {
  const spr:(number|null)[][]=Array.from({length:3},()=>Array<number|null>(3).fill(null));
  for(let y=0;y<3;y++)for(let x=0;x<3;x++){
    const slash=f==='NW'||f==='SE';if(slash?x+y===2:x===y)spr[y]![x]=0;
    else if(f==='NE'?y>x:f==='SW'?x>y:f==='NW'?x+y>2:x+y<2)spr[y]![x]=5;
  }return spr;
}
function renderScene(w:World,s:State,stones:readonly Point[]=s.stones,monsters:readonly Point[]=s.monsters,heroes:readonly Hero[]=s.heroes,mirrors:readonly MirrorSpec[]=s.mirrors,preview=false):number[][] {
  const f=Array.from({length:64},()=>Array<number>(64).fill(4));
  for(let y=0;y<20;y++)for(let x=0;x<20;x++){const t=terrainAt(w,{x,y}),c=t==='#'?4:t==='~'?9:3;stamp(f,{x,y},[[c,c,c],[c,c,c],[c,c,c]]);}
  w.platforms.forEach((p,i)=>stamp(f,p.at,platformSprite(platformActive(w,s,i),circuitColor(w,p.circuit))));
  for(const p of s.supports)stamp(f,p,supportSprite);
  for(const p of w.buttons){stamp(f,p,cross(7));const c=w.circuits.find(c=>contains(c.buttons,p));if(c)stamp(f,p,[[null,null,null],[null,circuitColor(w,c.id),null],[null,null,null]]);}
  for(const p of w.doors)stamp(f,p,doorsOpen(w,s)?[[7,null,7],[null,null,null],[7,null,7]]:square(7,5));
  w.gates.forEach((g,i)=>stamp(f,g.at,pistonSprite(g.direction,gateClosed(w,s,i),circuitColor(w,g.circuit))));
  for(const p of w.goals)stamp(f,p,((contains(w.doors,p)&&!doorsOpen(w,s))||w.gates.some((g,i)=>equal(g.at,p)&&gateClosed(w,s,i)))?[[11,null,11],[null,null,null],[11,null,11]]:square(11));
  if(preview)for(const m of planReflection(w,s)?.moves??[])stamp(f,m.to,m.actor==='hero'?cross(1):square(1));
  for(const p of stones)stamp(f,p,square(13,5));for(const p of monsters)stamp(f,p,monsterSprite);
  for(const h of heroes)stamp(f,h.at,heroSprite(h,s.heroes[s.active]?.kind===h.kind));
  for(const p of w.buttons)if(contains(stones,p)||contains(monsters,p)||heroes.some(h=>!h.dead&&equal(h.at,p))||mirrors.some(m=>equal(m.at,p))){
    const c=w.circuits.find(c=>contains(c.buttons,p)),accent=c?circuitColor(w,c.id):7;stamp(f,p,[[accent,null,7],[null,null,null],[7,null,7]]);
  }
  for(const p of w.goals)if(contains(stones,p)||contains(monsters,p))stamp(f,p,[[11,null,11],[null,null,null],[11,null,11]]);
  // Mirror diagonal and black back are above all circuit markings.
  for(const m of mirrors)stamp(f,m.at,mirrorSprite(m.facing));
  return f;
}
export function renderWorld(w:World,s:State):number[][]{return renderScene(w,s,s.stones,s.monsters,s.heroes,s.mirrors,true);}
function combatFrames(w:World,phase:MotionPhase):number[][][] {
  const before=phase.before,after=phase.after,adjacent=(a:Point,b:Point)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y)===1;
  const alive=before.monsters.filter(p=>supported(w,before,p));
  const hit=before.heroes.filter((h,i)=>!h.dead&&after.heroes[i]!.dead&&alive.some(p=>adjacent(p,h.at)));
  const attacks=alive.flatMap(from=>[...hit.filter(h=>adjacent(from,h.at)).map(h=>({from,to:h.at})),...alive.filter(to=>adjacent(from,to)).map(to=>({from,to}))]);
  const attackers=alive.filter(p=>attacks.some(a=>equal(a.from,p))),fallen=before.monsters.filter(p=>!contains(after.monsters,p)),stationary=before.monsters.filter(p=>!contains(attackers,p));
  const lunge=(p:Point,n:number):Point=>{const to=attacks.find(a=>equal(a.from,p))?.to,at=cellToPixel(p);return to?{x:at.x+Math.sign(to.x-p.x)*n,y:at.y+Math.sign(to.y-p.y)*n}:at;};
  const base=()=>renderScene(w,before,before.stones,stationary);
  const windup=base();for(const p of attackers)stampPixels(windup,lunge(p,-1),[[8,5,8],[5,0,5],[8,5,8]]);
  const strike=base();for(const p of attackers)stampPixels(strike,lunge(p,1),monsterSprite);
  const impact=base();for(const p of attackers)stampPixels(impact,lunge(p,1),monsterSprite);
  for(const {from,to} of attacks){const a=cellToPixel(from),b=cellToPixel(to);stampPixels(impact,{x:Math.round((a.x+b.x)/2),y:Math.round((a.y+b.y)/2)},[[null,8,null],[8,0,8],[null,8,null]]);}
  for(const h of hit)stamp(impact,h.at,[[8,0,8],[0,heroColor(h),0],[8,0,8]]);
  const dissolve=renderScene(w,before,after.stones,after.monsters,before.heroes.filter(h=>!hit.some(q=>q.kind===h.kind)));
  for(const p of fallen)stamp(dissolve,p,[[8,null,8],[null,2,null],[8,null,8]]);
  for(const h of hit){const c=heroColor(h);stamp(dissolve,h.at,[[c,null,c],[null,8,null],[c,null,c]]);}
  return [windup,strike,impact,dissolve,renderWorld(w,after)];
}
function phaseFrames(w:World,phase:MotionPhase):number[][][] {
  if(phase.kind==='combat')return combatFrames(w,phase);
  if(phase.kind==='platform'){
    const after=renderScene(w,phase.after);
    const frames=[1,2].map(rows=>{
      const frame=renderScene(w,phase.before);
      for(const p of w.platforms){const at=cellToPixel(p.at);for(let y=3-rows;y<3;y++)for(let x=0;x<3;x++)frame[at.y+y]![at.x+x]=after[at.y+y]![at.x+x]!;}
      return frame;
    });return [...frames,renderWorld(w,phase.after)];
  }
  const before=phase.before,stationaryStones=before.stones.filter(p=>!phase.moves.some(m=>m.actor==='stone'&&equal(m.from,p))),stationaryMonsters=before.monsters.filter(p=>!phase.moves.some(m=>m.actor==='monster'&&equal(m.from,p))),stationaryHeroes=before.heroes.filter(h=>!phase.moves.some(m=>m.actor==='hero'&&equal(m.from,h.at))),stationaryMirrors=before.mirrors.filter(m=>!phase.moves.some(q=>q.actor==='mirror'&&equal(q.from,m.at)));
  if(phase.kind==='reflect'){
    const flash=renderScene(w,before);
    for(const path of phase.paths??[])for(let i=1;i<path.length;i++){const a=path[i-1]!,b=path[i]!,dx=Math.sign(b.x-a.x),dy=Math.sign(b.y-a.y);for(let p=0;p<=3;p++){const x=3+a.x*3+dx*p,y=3+a.y*3+dy*p;if(x>=2&&x<62&&y>=2&&y<62)flash[y]![x]=10;}}
    const transfer=renderScene(w,before,stationaryStones,stationaryMonsters,stationaryHeroes,stationaryMirrors);
    for(const m of phase.moves){const h=before.heroes.find(h=>equal(h.at,m.from)),c=m.actor==='hero'&&h?heroColor(h):m.actor==='stone'?13:8;stamp(flash,m.from,m.actor==='hero'?cross(0):square(c,0));stamp(transfer,m.to,m.actor==='hero'?cross(1):square(1,m.actor==='stone'?13:8));}
    return [flash,transfer,renderWorld(w,phase.after)];
  }
  if(!['walk','push','pull','piston'].includes(phase.kind))return [renderWorld(w,phase.after)];
  const frames=[1,2].map(pixels=>{
    const f=renderScene(w,before,stationaryStones,stationaryMonsters,stationaryHeroes,stationaryMirrors);
    for(const m of phase.moves){const delta={x:m.to.x-m.from.x,y:m.to.y-m.from.y};if(Math.abs(delta.x)+Math.abs(delta.y)!==1)throw new Error('A move phase translates one cell.');
      const at=cellToPixel(m.from),p={x:at.x+delta.x*pixels,y:at.y+delta.y*pixels};
      const h=before.heroes.find(h=>equal(h.at,m.from)),mirror=before.mirrors.find(q=>equal(q.at,m.from));
      const sprite=m.actor==='hero'&&h?heroSprite({...h,facing:phase.after.heroes.find(q=>q.kind===h.kind)!.facing},before.heroes[before.active]!.kind===h.kind):m.actor==='mirror'&&mirror?mirrorSprite(mirror.facing):m.actor==='stone'?square(13,5):monsterSprite;
      stampPixels(f,p,sprite);
    }return f;
  });return [...frames,renderWorld(w,phase.after)];
}
function presentation(w:World,detail:DetailedStep):{frames:number[][][];durations:number[]} {
  if(detail.blockedMirrorIndices?.length){
    const normal=()=>renderWorld(w,detail.state),red=()=>{
      const frame=normal();
      // Warn on the black backing (5); preserve the white reflective diagonal (0).
      for(const index of detail.blockedMirrorIndices!){const mirror=detail.state.mirrors[index];if(mirror)stamp(frame,mirror.at,mirrorSprite(mirror.facing).map(row=>row.map(pixel=>pixel===5?8:pixel)));}
      return frame;
    };
    return {frames:[red(),normal(),red(),normal()],durations:[110,70,110,0]};
  }
  if(!detail.phases.length)return {frames:[renderWorld(w,detail.state)],durations:[0]};
  const frames:number[][][]=[],durations:number[]=[];
  for(const phase of detail.phases){const part=phaseFrames(w,phase);frames.push(...part);durations.push(...(phase.kind==='combat'?[80,90,100,110,40]:part.length===3?(phase.kind==='reflect'?[70,90,40]:[60,80,40]):[40]));}
  durations[durations.length-1]=0;return {frames,durations};
}
export function transitionFrames(w:World,before:State,after:State,action:number,data?:Point):number[][][]{const r=presentation(w,stepDetailed(w,before,action,data));r.frames[r.frames.length-1]=renderWorld(w,after);return r.frames;}
interface Snapshot {index:number;completed:number[];state:State}
export class DuoPuzzleSession {
  private readonly worlds:readonly World[];private readonly gameCode:string;private index=0;private completed=new Set<number>();private state:State;private history:Snapshot[]=[];
  constructor(levels:readonly LevelSpec[],gameCode='SS10') {
    if(!levels.length||new Set(levels.map(l=>l.id)).size!==levels.length||!/^[A-Z0-9]{4}$/.test(gameCode))throw new Error('Unique levels and a four-character game code are required.');
    // Validate every initial circuit before accepting a campaign. A later level can
    // be syntactically valid yet have an unstable or immediately fatal press.
    const worlds=levels.map(compileLevel),starts=worlds.map(initialState);
    this.worlds=worlds;this.gameCode=gameCode;this.state=starts[0]!;
  }
  observe():Observation {
    const frame=renderWorld(this.worlds[this.index]!,this.state);return {gameCode:this.gameCode,frame,frames:[frame],state:this.completed.size===this.worlds.length?'WIN':this.state.dead?'GAME_OVER':'NOT_FINISHED',availableActionIds:[1,2,3,4,5,6],canUndo:this.history.length>0,canSelectLevel:true,level:this.index+1,levelCount:this.worlds.length,levelsCompleted:this.completed.size,defaultFps:10,palette:[...PALETTE]};
  }
  action(actionId:number,data?:Point):Observation {
    const world=this.worlds[this.index]!,before=this.state,detail=stepDetailed(world,before,actionId,data),next=detail.state;
    const changed=JSON.stringify(next)!==JSON.stringify(before);
    if(!changed&&!detail.phases.length&&!detail.blockedMirrorIndices?.length)return this.observe();
    // A warning can be replayed, but must not consume an Undo step.
    if(changed&&!detail.blockedMirrorIndices?.length)this.history.push({index:this.index,completed:[...this.completed],state:before});
    this.state=next;const {frames,durations}=presentation(world,detail);
    if(next.complete){this.completed.add(this.index);const i=this.worlds.findIndex((_,i)=>!this.completed.has(i));if(i!==-1){this.index=i;this.state=initialState(this.worlds[this.index]!);}}
    const observation=this.observe();if(this.state!==next){durations[durations.length-1]=100;frames.push(observation.frame);durations.push(0);}return {...observation,frames,frameDurationsMs:durations};
  }
  nextHero():Observation {const h=this.state.heroes[(this.state.active+1)%this.state.heroes.length]!;const p=cellToPixel(h.at);return this.action(6,{x:p.x+1,y:p.y+1});}
  undo():Observation {const s=this.history.pop();if(s){this.index=s.index;this.completed=new Set(s.completed);this.state=s.state;}return this.observe();}
  reset():Observation {
    const state=initialState(this.worlds[this.index]!);
    this.completed.delete(this.index);this.state=state;this.history=[];return this.observe();
  }
  restart():Observation {
    const state=initialState(this.worlds[0]!);
    this.index=0;this.completed.clear();this.state=state;this.history=[];return this.observe();
  }
  selectLevel(level:number):Observation {
    if(!Number.isInteger(level)||level<1||level>this.worlds.length)throw new RangeError('Invalid level.');
    const index=level-1,state=initialState(this.worlds[index]!);
    this.index=index;this.completed.delete(index);this.state=state;this.history=[];return this.observe();
  }
}
