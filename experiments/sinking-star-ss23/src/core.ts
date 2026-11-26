/** Deterministic Merchant–Warrior–Wizard–Bard puzzles. No browser, solver, agent or network dependency. */
export type Point = Readonly<{x:number;y:number}>;
export type Direction = 'N'|'S'|'W'|'E';
export type MirrorFacing = 'NE'|'NW'|'SE'|'SW';
export type HeroKind = 'merchant'|'warrior'|'wizard'|'bard';
export interface Hero {readonly kind:HeroKind;readonly at:Point;readonly facing:Direction;readonly dead?:boolean}
export interface MirrorSpec {readonly at:Point;readonly facing:MirrorFacing}
export interface CircuitSpec {readonly id:string;readonly buttons:readonly Point[];readonly color?:number}
export interface GateSpec {readonly at:Point;readonly circuit:string;readonly direction:Direction;readonly closedWhen:'pressed'|'released'}
export interface PlatformSpec {readonly at:Point;readonly circuit:string;readonly activeWhen:'pressed'|'released'}
export interface LevelSpec {
  readonly id:string;readonly title:string;readonly rows:readonly string[];readonly facing?:Direction;
  /** SS23 rooms contain Merchant, Warrior, Wizard and Bard; omitted mode means quartet. */
  readonly mode?:'quartet';
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
  if(spec.mode!==undefined&&spec.mode!=='quartet')throw new Error('Invalid hero mode.');
  const ox=Math.floor((20-width)/2),oy=Math.floor((20-spec.rows.length)/2),terrain=Array<string>(400).fill('#');
  const heroes:Hero[]=[],stones:Point[]=[],monsters:Point[]=[],supports:Point[]=[],buttons:Point[]=[],doors:Point[]=[],goals:Point[]=[],drawnMirrors:MirrorSpec[]=[];
  spec.rows.forEach((r,y)=>[...r].forEach((c,x)=>{
    if(!'#.~MWZBombD*sg1234'.includes(c))throw new Error(`Unknown tile: ${c}`);
    const p=Object.freeze({x:x+ox,y:y+oy});terrain[p.y*20+p.x]='#~'.includes(c)?c:c==='s'?'~':'.';
    if(c==='M'||c==='W'||c==='Z'||c==='B')heroes.push(Object.freeze({kind:c==='M'?'merchant':c==='W'?'warrior':c==='Z'?'wizard':'bard',at:p,facing:spec.facing??'N'}));
    if(c==='o'||c==='*')stones.push(p);if(c==='m')monsters.push(p);if(c==='s')supports.push(p);
    if(c==='b'||c==='*')buttons.push(p);if(c==='D')doors.push(p);if(c==='g')goals.push(p);
    if(mirrorDigits[c])drawnMirrors.push(Object.freeze({at:p,facing:mirrorDigits[c]!}));
  }));
  if(heroes.length!==4||(['merchant','warrior','wizard','bard'] as const).some(kind=>heroes.filter(h=>h.kind===kind).length!==1)||goals.length!==4)throw new Error('SS23 requires one Merchant, one Warrior, one Wizard, one Bard and four destinations.');
  const roleOrder:Readonly<Record<HeroKind,number>>={merchant:0,warrior:1,wizard:2,bard:3};
  heroes.sort((a,b)=>roleOrder[a.kind]-roleOrder[b.kind]);
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
export interface Motion {readonly actor:'hero'|'stone'|'monster'|'mirror'|'support';readonly from:Point;readonly to:Point}
export interface MotionPhase {
  readonly kind:'walk'|'push'|'song'|'swap'|'reflect'|'piston'|'crush'|'gate'|'platform'|'combat'|'swap-loop';readonly before:State;readonly after:State;readonly moves:readonly Motion[];
  readonly gateIndex?:number;readonly paths?:readonly (readonly Point[])[];
}
export interface DetailedStep {
  readonly state:State;readonly phases:readonly MotionPhase[];
  /** Refusal feedback only: no movement, circuit settling or combat tick. */
  readonly blockedMirrorIndices?:readonly number[];
}
export interface ReflectionPlan {readonly moves:readonly Motion[];readonly paths:readonly (readonly Point[])[];readonly mirrorIndices:readonly number[]}
const actorAt=(s:State,p:Point):Exclude<Motion['actor'],'support'>|null=>heroAt(s,p)?'hero':contains(s.stones,p)?'stone':contains(s.monsters,p)?'monster':s.mirrors.some(m=>equal(m.at,p))?'mirror':null;
const mirrorArms:Readonly<Record<MirrorFacing,readonly [Direction,Direction]>>={NE:['N','E'],NW:['N','W'],SE:['S','E'],SW:['S','W']};
interface ReflectionAttempt {readonly plan:ReflectionPlan|null;readonly blockedMirrorIndices:readonly number[]}
function reflectionAttempt(w:World,s:State):ReflectionAttempt {
  const refusal=(indices:readonly number[]=[]):ReflectionAttempt=>({plan:null,blockedMirrorIndices:[...new Set(indices)].sort((a,b)=>a-b)});
  if(s.complete||s.dead)return refusal();
  const moves:Motion[]=[],paths:Point[][]=[],pathOwners:number[]=[],mirrorIndices:number[]=[],owners:number[][]=[],blockedMirrors:number[]=[];
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
      let to=mirror.at,obstructed=false;const destinationPath:Point[]=[];
      for(let d=0;d<distance;d++){
        to=offset(to,toDir);
        if(rayBlocked(w,s,to)){
          const obstruction=s.mirrors.findIndex(m=>equal(m.at,to));
          // A wall or closed door/press blocks the projecting mirror. A second
          // mirror retains the established warning on its obstructing back.
          blockedMirrors.push(obstruction<0?mi:obstruction);obstructed=true;break;
        }
        destinationPath.push(to);
      }
      if(obstructed)continue;
      const previousIndex=moves.findIndex(m=>m.actor===actor&&equal(m.from,from)),previous=moves[previousIndex];
      if(previous&&!equal(previous.to,to)){blockedMirrors.push(...owners[previousIndex]!,mi);continue;}
      if(!previous){moves.push({actor,from,to});owners.push([mi]);}else owners[previousIndex]!.push(mi);
      paths.push([...path].reverse().concat(destinationPath));pathOwners.push(mi);if(!mirrorIndices.includes(mi))mirrorIndices.push(mi);
    }
  }
  // Diagnose every independently blocked ray before refusing the global action.
  // The valid transfers collected above are never applied after any refusal.
  if(blockedMirrors.length)return refusal(blockedMirrors);
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
    const occupant=actorAt(s,move.to);if(occupant&&!moves.some(m=>m.actor===occupant&&equal(m.from,move.to)))return refusal(owners[index]);
  }
  for(const [index,path] of paths.entries())for(const p of path){
    const occupant=actorAt(s,p);if(occupant&&occupant!=='mirror'&&!moves.some(m=>m.actor===occupant&&equal(m.from,p)))return refusal([pathOwners[index]!]);
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
  return resolveBuoyancy(w,{...s,heroes:s.heroes.map(h=>({...h,at:target('hero',h.at)})),stones:s.stones.map(p=>target('stone',p)),monsters:s.monsters.map(p=>target('monster',p)),supports:s.supports.map(p=>target('support',p)),mirrors:s.mirrors.map(m=>({...m,at:target('mirror',m.at)}))},true);
}
export const inSongRange=(bard:Point,p:Point):boolean=>Math.max(Math.abs(bard.x-p.x),Math.abs(bard.y-p.y))<=2;
/** A blocked choir member stays put. A blocked Bard cancels the complete action. */
function songStep(w:World,s:State,d:Direction):{state:State;moves:Motion[]}|null {
  const bard=s.heroes[s.active]!,to=offset(bard.at,d);
  if(blocked(w,s,to))return null;
  const candidates:Motion[]=[{actor:'hero',from:bard.at,to}];
  for(const h of s.heroes)if(h.kind!=='bard'&&!h.dead&&inSongRange(bard.at,h.at)&&!blocked(w,s,offset(h.at,d)))candidates.push({actor:'hero',from:h.at,to:offset(h.at,d)});
  for(const [actor,points] of [['stone',s.stones],['monster',s.monsters],['support',s.supports]] as const){
    for(const from of points){
      const destination=offset(from,d);
      if(!inSongRange(bard.at,from)||blocked(w,s,destination))continue;
      // An occupied support anchors any hero; the Bard's landing anchors too.
      if(actor==='support'&&(heroAt(s,from)||equal(from,to)||terrainAt(w,destination)!=='~'))continue;
      candidates.push({actor,from,to:destination});
    }
  }
  const active=new Set(candidates);
  for(let changed=true;changed;){
    changed=false;
    for(const motion of active){
      if(motion.actor==='support'){
        if(contains(s.supports,motion.to)&&![...active].some(m=>m.actor==='support'&&equal(m.from,motion.to))){active.delete(motion);changed=true;}
      }else{
        const occupant=actorAt(s,motion.to);
        if(occupant&&![...active].some(m=>m.actor===occupant&&equal(m.from,motion.to))){active.delete(motion);changed=true;}
      }
    }
  }
  const moves=[...active];
  if(!moves.some(m=>m.actor==='hero'&&equal(m.from,bard.at)))return null;
  const next=applyMotions(w,s,moves);
  // Voluntary movement cannot drown any hero or withdraw a mirror's support.
  // Buoyancy is deferred on hydraulic cells for forced press cascades. Check
  // every song participant against the current supports before that cascade,
  // rather than checking only the Bard and overlooking its carried partner.
  // A later switch-induced platform withdrawal still resolves normally.
  if(next.dead||next.mirrors.length!==s.mirrors.length
    ||next.heroes.some(h=>!supported(w,next,h.at))
    ||next.mirrors.some(m=>!supported(w,next,m.at)))return null;
  return {state:next,moves};
}

export interface SwapPlan {
  readonly from:Point;readonly to:Point;readonly target:'hero'|'stone'|'monster';
  /** The target ray excludes the Wizard origin and includes its first target. Author-only. */
  readonly path:readonly Point[];readonly reflections:number;
}
const mirrorTurns:Readonly<Record<MirrorFacing,Partial<Record<Direction,Direction>>>>={
  NE:{S:'E',W:'N'},NW:{S:'W',E:'N'},SE:{N:'E',W:'S'},SW:{N:'W',E:'S'},
};
/** Wizard targeting can bend through several white faces. This is independent of
 * ACTION5's per-mirror geometric reflection, which never relays through a mirror. */
export function traceSwap(w:World,s:State,direction:Direction):{plan:SwapPlan|null;loop:boolean;loopPath?:readonly Point[]} {
  const hero=s.heroes[s.active]!;
  if(s.complete||s.dead||hero.kind!=='wizard')return {plan:null,loop:false};
  const path:Point[]=[],seen=new Set<string>();let p=hero.at,d=direction,reflections=0;
  // Retain the complete ordered circuit for presentation, including its origin.
  const loop=()=>({plan:null,loop:true,loopPath:[hero.at,...path]});
  for(let i=0;i<1600;i++){
    const key=`${p.x},${p.y},${d}`;
    if(seen.has(key))return loop();seen.add(key);p=offset(p,d);
    if(blocked(w,s,p))return {plan:null,loop:false};path.push(p);
    const mirror=s.mirrors.find(m=>equal(m.at,p));
    if(mirror){const turn=mirrorTurns[mirror.facing][d];if(!turn)return {plan:null,loop:false};d=turn;reflections++;continue;}
    if(equal(p,hero.at))return loop();
    const actor=actorAt(s,p);
    if(actor&&actor!=='mirror')return {plan:{from:hero.at,to:p,target:actor,path,reflections},loop:false};
  }
  return loop();
}
export function planSwap(w:World,s:State,direction:Direction):SwapPlan|null{return traceSwap(w,s,direction).plan;}
/** Only the active hero's voluntary step invokes its power. */
function moveStep(w:World,s:State,d:Direction):{state:State;moves:Motion[]}|null {
  const hero=s.heroes[s.active]!,to=offset(hero.at,d);if(blocked(w,s,to))return null;
  const moves:Motion[]=[{actor:'hero',from:hero.at,to}],front=actorAt(s,to);
  if(hero.kind==='merchant'){
    if(front){const landing=offset(to,d);if(blocked(w,s,landing)||actorAt(s,landing))return null;moves.push({actor:front,from:to,to:landing});}
  }else if(hero.kind==='warrior'){
    let from=to,actor=front;
    while(actor){const next=offset(from,d);if(blocked(w,s,next))return null;moves.push({actor,from,to:next});from=next;actor=actorAt(s,from);}
  }else if(front)return null; // A targetless Wizard walks; transported partners never activate a power.
  const next=applyMotions(w,s,moves);
  // Voluntary handling cannot drown any hero or strand a mirror, including on
  // an already withdrawn hydraulic platform. Later press cascades are forced.
  if(next.dead||next.mirrors.length!==s.mirrors.length
    ||moves.some(m=>(m.actor==='hero'||m.actor==='mirror')&&!supported(w,next,m.to)))return null;
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
/** Settle switches, water and simultaneous contact combat to a fixed point.
 * Every monster can disappear once, so the contact-wave bound is finite.
 */
function settleContacts(w:World,start:State,phases:MotionPhase[]):{state:State;stable:boolean} {
  let state=start;
  for(let wave=0;wave<=start.monsters.length+1;wave++){
    if(w.gates.length||w.platforms.length){const settled=settleGates(w,state,phases);if(!settled.stable)return {state:start,stable:false};state=settled.state;}
    const fought=resolveCombat(w,state);if(fought===state)break;
    phases.push({kind:'combat',before:state,after:fought,moves:[]});
    const removed=fought.monsters.length<state.monsters.length;state=fought;if(!removed)break;
  }
  return {state,stable:true};
}
/** Click selection is presentation state, not a world tick. Invalid/refused turns do not trigger combat. */
export function stepDetailed(w:World,s:State,actionId:number,data?:Point):DetailedStep {
  if(!Number.isInteger(actionId)||actionId<1||actionId>6)throw new RangeError('SS23 accepts ACTION1–ACTION6.');
  if(actionId===6&&(!data||!Number.isInteger(data.x)||!Number.isInteger(data.y)||data.x<0||data.y<0||data.x>63||data.y>63))throw new RangeError('ACTION6 requires 64×64 canvas pixel coordinates.');
  if(s.complete||s.dead)return {state:s,phases:[]};
  if(actionId===6){const p=pixelToCell(data!.x,data!.y),active=p?s.heroes.findIndex(h=>!h.dead&&equal(h.at,p)):-1;return {state:active<0||active===s.active?s:{...s,active,failed:false},phases:[]};}
  const hero=s.heroes[s.active]!,direction=actionId===5?hero.facing:directionIds[actionId]!;
  const faced:State={...s,heroes:s.heroes.map((h,i)=>i===s.active?{...h,facing:direction}:h),failed:false};
  let reflectingMirrors:readonly number[]=[];
  const refusal=(loopPath?:readonly Point[]):DetailedStep=>{
    const state:State={...faced,failed:true};
    return {state,phases:loopPath?[{kind:'swap-loop',before:s,after:state,moves:[],paths:[loopPath]}]:[],...(reflectingMirrors.length?{blockedMirrorIndices:reflectingMirrors}:{})};
  };
  let next:State,first:MotionPhase;
  if(actionId===5){const {plan,blockedMirrorIndices}=reflectionAttempt(w,s);if(!plan)return {...refusal(),...(blockedMirrorIndices.length?{blockedMirrorIndices}:{})};reflectingMirrors=plan.mirrorIndices;next=applyMotions(w,faced,plan.moves);first={kind:'reflect',before:s,after:next,moves:plan.moves,paths:plan.paths};}
  else {
    const aim=hero.kind==='wizard'?traceSwap(w,faced,direction):{plan:null,loop:false};
    if(aim.loop)return refusal(aim.loopPath);
    if(aim.plan){
      const plan=aim.plan,moves:Motion[]=[{actor:'hero',from:plan.from,to:plan.to},{actor:plan.target,from:plan.to,to:plan.from}];
      next=applyMotions(w,faced,moves);first={kind:'swap',before:s,after:next,moves,paths:[[plan.from,...plan.path]]};
    }else{
      const result=hero.kind==='bard'?songStep(w,faced,direction):moveStep(w,faced,direction);if(!result)return refusal();next=result.state;
      first={kind:result.moves.length>1?(hero.kind==='bard'?'song':'push'):'walk',before:s,after:next,moves:result.moves};
    }
  }
  if(!safeDoors(w,next))return refusal();
  const phases:MotionPhase[]=[first];
  // Only the player's powers and circuit presses transport monsters. After
  // those physical movements, settle water and simultaneous contact combat
  // before checking goals; no autonomous movement follows the action.
  const settled=settleContacts(w,next,phases);if(!settled.stable)return refusal();next=settled.state;
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
const heroColor=(h:Hero):number=>h.kind==='merchant'?12:h.kind==='warrior'?8:h.kind==='wizard'?15:6;
function heroSprite(h:Hero,selected:boolean):Sprite {
  const c=heroColor(h),sprite:(number|null)[][]=[[null,c,null],[c,c,c],[null,c,null]];
  if(selected){const d=VECTORS[h.facing];sprite[1+d.y]![1+d.x]=0;}
  if(h.dead)return [[c,5,c],[5,8,5],[c,5,c]];return sprite;
}
const circuitColors:readonly number[]=[0,10,12,15,2,8,11,14];
const circuitColor=(w:World,id:string):number=>w.circuits.find(c=>c.id===id)?.color??circuitColors[w.circuits.findIndex(c=>c.id===id)%circuitColors.length]!;
function pistonSprite(d:Direction,closed:boolean,accent:number):Sprite {
  const spr:(number|null)[][]=closed?[[7,7,7],[7,5,7],[7,7,7]]:[[7,3,7],[3,3,3],[7,3,7]],tip=VECTORS[d],side={x:-tip.y,y:tip.x};
  spr[1+tip.y]![1+tip.x]=accent;spr[1+side.y]![1+side.x]=accent;spr[1-side.y]![1-side.x]=accent;return spr;
}
const buttonSprite=(accent:number):Sprite=>[[3,7,3],[7,accent,7],[3,7,3]];
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
function renderScene(w:World,s:State,stones:readonly Point[]=s.stones,monsters:readonly Point[]=s.monsters,heroes:readonly Hero[]=s.heroes,mirrors:readonly MirrorSpec[]=s.mirrors,preview=false,supports:readonly Point[]=s.supports,movingAura?:Point):number[][] {
  const f=Array.from({length:64},()=>Array<number>(64).fill(4));
  for(let y=0;y<20;y++)for(let x=0;x<20;x++){const t=terrainAt(w,{x,y}),c=t==='#'?4:t==='~'?9:3;stamp(f,{x,y},[[c,c,c],[c,c,c],[c,c,c]]);}
  const selected=s.heroes[s.active],bard=selected?.kind==='bard'&&!selected.dead?heroes.find(h=>h.kind==='bard'&&!h.dead):undefined;
  const aura=selected?.kind==='bard'&&!selected.dead?(movingAura??(bard?cellToPixel(bard.at):undefined)):undefined;
  if(aura&&!s.dead){
    // Draw the 5×5 dotted perimeter before every device and actor glyph.
    const left=aura.x-6,top=aura.y-6;
    for(let d=0;d<=14;d+=2)for(const [x,y] of [[left+d,top],[left+d,top+14],[left,top+d],[left+14,top+d]]){
      if(x!>=2&&x!<62&&y!>=2&&y!<62)f[y!]![x!]=6;
    }
  }
  w.platforms.forEach((p,i)=>stamp(f,p.at,platformSprite(platformActive(w,s,i),circuitColor(w,p.circuit))));
  for(const p of supports)stamp(f,p,supportSprite);
  for(const p of w.buttons){const c=w.circuits.find(c=>contains(c.buttons,p));stamp(f,p,buttonSprite(c?circuitColor(w,c.id):7));}
  for(const p of w.doors)stamp(f,p,doorsOpen(w,s)?[[7,null,7],[null,null,null],[7,null,7]]:square(7,5));
  w.gates.forEach((g,i)=>{
    const closed=gateClosed(w,s,i);
    // Open presses expose their plate; a closed press is an opaque gate.
    if(closed||!contains(w.buttons,g.at))stamp(f,g.at,pistonSprite(g.direction,closed,circuitColor(w,g.circuit)));
  });
  for(const p of w.goals)stamp(f,p,((contains(w.doors,p)&&!doorsOpen(w,s))||w.gates.some((g,i)=>equal(g.at,p)&&gateClosed(w,s,i)))?[[11,null,11],[null,null,null],[11,null,11]]:square(11));
  if(preview)for(const m of planReflection(w,s)?.moves??[])stamp(f,m.to,m.actor==='hero'?cross(1):square(1));
  for(const p of stones)stamp(f,p,square(13,5));for(const p of monsters)stamp(f,p,monsterSprite);
  for(const h of heroes)stamp(f,h.at,heroSprite(h,s.heroes[s.active]?.kind===h.kind));
  for(const p of w.buttons)if(contains(stones,p)||contains(monsters,p)||heroes.some(h=>!h.dead&&equal(h.at,p))||mirrors.some(m=>equal(m.at,p))){
    const c=w.circuits.find(c=>contains(c.buttons,p)),accent=c?circuitColor(w,c.id):7;stamp(f,p,[[accent,null,7],[null,null,null],[7,null,7]]);
  }
  for(const p of w.goals)if(contains(stones,p)||contains(monsters,p))stamp(f,p,[[11,null,11],[null,null,null],[11,null,11]]);
  // The diagonal and black back stay above every plate/circuit marking.
  // Moving mirror sprites are likewise stamped after the background scene.
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
  if(phase.kind==='swap-loop'){
    const state=phase.after,hero=state.heroes[state.active]!,path=phase.paths?.[0]??[hero.at];
    const ends=path.flatMap((p,i)=>i>0&&state.mirrors.some(m=>equal(m.at,p))?[i]:[]);
    if(ends.at(-1)!==path.length-1)ends.push(path.length-1);
    const frames=ends.map(end=>{
      const frame=renderWorld(w,state);
      // Illuminate each complete segment cumulatively, in ray traversal order.
      for(let i=1;i<=end;i++){
        const a=path[i-1]!,b=path[i]!,dx=Math.sign(b.x-a.x),dy=Math.sign(b.y-a.y);
        for(let n=0;n<=3;n++){const x=3+a.x*3+dx*n,y=3+a.y*3+dy*n;if(x>=2&&x<62&&y>=2&&y<62)frame[y]![x]=15;}
      }
      // The ray never obscures a white diagonal or the black back. Highlight
      // only the newly reached mirror's three transparent front-face pixels.
      for(const m of state.mirrors)stamp(frame,m.at,mirrorSprite(m.facing));
      const arrival=state.mirrors.find(m=>equal(m.at,path[end]!));
      if(arrival)stamp(frame,arrival.at,mirrorSprite(arrival.facing).map(row=>row.map(c=>c===null?10:c)));
      stamp(frame,hero.at,heroSprite(hero,true));return frame;
    });
    // Two white pulses at the unchanged origin, separated by its normal violet
    // cursor. The final clean frame also removes every temporary path pixel.
    for(const pulse of [true,false,true,false]){const frame=renderWorld(w,state);if(pulse)stamp(frame,hero.at,cross(0));frames.push(frame);}
    return frames;
  }
  if(phase.kind==='platform'){
    const after=renderScene(w,phase.after);
    const frames=[1,2].map(rows=>{
      const frame=renderScene(w,phase.before);
      for(const p of w.platforms){const at=cellToPixel(p.at);for(let y=3-rows;y<3;y++)for(let x=0;x<3;x++)frame[at.y+y]![at.x+x]=after[at.y+y]![at.x+x]!;}
      return frame;
    });return [...frames,renderWorld(w,phase.after)];
  }
  const before=phase.before,stationaryStones=before.stones.filter(p=>!phase.moves.some(m=>m.actor==='stone'&&equal(m.from,p))),stationaryMonsters=before.monsters.filter(p=>!phase.moves.some(m=>m.actor==='monster'&&equal(m.from,p))),stationaryHeroes=before.heroes.filter(h=>!phase.moves.some(m=>m.actor==='hero'&&equal(m.from,h.at))),stationaryMirrors=before.mirrors.filter(m=>!phase.moves.some(q=>q.actor==='mirror'&&equal(q.from,m.at)));
  if(phase.kind==='reflect'||phase.kind==='swap'){
    const flash=renderScene(w,before);
    for(const path of phase.paths??[])for(let i=1;i<path.length;i++){const a=path[i-1]!,b=path[i]!,dx=Math.sign(b.x-a.x),dy=Math.sign(b.y-a.y);for(let p=0;p<=3;p++){const x=3+a.x*3+dx*p,y=3+a.y*3+dy*p;if(x>=2&&x<62&&y>=2&&y<62)flash[y]![x]=phase.kind==='swap'?15:10;}}
    const transfer=renderScene(w,before,stationaryStones,stationaryMonsters,stationaryHeroes,stationaryMirrors);
    for(const m of phase.moves){const h=before.heroes.find(h=>equal(h.at,m.from)),c=m.actor==='hero'&&h?heroColor(h):m.actor==='stone'?13:8;stamp(flash,m.from,m.actor==='hero'?cross(0):square(c,0));stamp(transfer,m.to,m.actor==='hero'?cross(1):square(1,m.actor==='stone'?13:8));}
    return [flash,transfer,renderWorld(w,phase.after)];
  }
  if(!['walk','push','song','piston'].includes(phase.kind))return [renderWorld(w,phase.after)];
  const frames=[1,2].map(pixels=>{
    const stationarySupports=before.supports.filter(p=>!phase.moves.some(m=>m.actor==='support'&&equal(m.from,p)));
    const bard=before.heroes.find(h=>h.kind==='bard'),bardMove=bard?phase.moves.find(m=>m.actor==='hero'&&equal(m.from,bard.at)):undefined;
    const aura=bardMove?{x:2+bardMove.from.x*3+(bardMove.to.x-bardMove.from.x)*pixels,y:2+bardMove.from.y*3+(bardMove.to.y-bardMove.from.y)*pixels}:undefined;
    const f=renderScene(w,before,stationaryStones,stationaryMonsters,stationaryHeroes,stationaryMirrors,false,stationarySupports,aura);
    for(const m of [...phase.moves].sort((a,b)=>+(b.actor==='support')-+(a.actor==='support'))){const delta={x:m.to.x-m.from.x,y:m.to.y-m.from.y};if(Math.abs(delta.x)+Math.abs(delta.y)!==1)throw new Error('A move phase translates one cell.');
      const at=cellToPixel(m.from),p={x:at.x+delta.x*pixels,y:at.y+delta.y*pixels};
      const h=before.heroes.find(h=>equal(h.at,m.from)),mirror=before.mirrors.find(q=>equal(q.at,m.from));
      const sprite=m.actor==='hero'&&h?heroSprite({...h,facing:phase.after.heroes.find(q=>q.kind===h.kind)!.facing},before.heroes[before.active]!.kind===h.kind):m.actor==='mirror'&&mirror?mirrorSprite(mirror.facing):m.actor==='stone'?square(13,5):m.actor==='support'?supportSprite:monsterSprite;
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
  for(const phase of detail.phases){const part=phaseFrames(w,phase);frames.push(...part);durations.push(...(phase.kind==='swap-loop'?[...Array<number>(part.length-5).fill(90),100,100,80,100,0]:phase.kind==='combat'?[80,90,100,110,40]:part.length===3?((phase.kind==='reflect'||phase.kind==='swap')?[70,90,40]:[60,80,40]):[40]));}
  durations[durations.length-1]=0;return {frames,durations};
}
export function transitionFrames(w:World,before:State,after:State,action:number,data?:Point):number[][][]{const r=presentation(w,stepDetailed(w,before,action,data));r.frames[r.frames.length-1]=renderWorld(w,after);return r.frames;}
interface Snapshot {index:number;completed:number[];state:State}
export class QuartetPuzzleSession {
  private readonly worlds:readonly World[];private readonly gameCode:string;private index=0;private completed=new Set<number>();private state:State;private history:Snapshot[]=[];
  constructor(levels:readonly LevelSpec[],gameCode='SS23') {
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
