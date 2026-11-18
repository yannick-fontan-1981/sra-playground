/** Deterministic Bard choreography puzzles. No browser, solver, agent or network dependency. */
export type Point = Readonly<{x: number; y: number}>;
export type Direction = 'N' | 'S' | 'W' | 'E';
export type MirrorFacing = 'NE' | 'NW' | 'SE' | 'SW';
/** Fixed one-sided mirrors: facing names the reflective quadrant. */
export interface MirrorSpec {readonly at: Point; readonly facing: MirrorFacing}
export interface CircuitSpec {readonly id: string; readonly buttons: readonly Point[]}
export interface GateSpec {
  readonly at: Point;
  readonly circuit: string;
  readonly direction: Direction;
  readonly closedWhen: 'pressed' | 'released';
}
export interface LevelSpec {
  readonly id: string;
  readonly title: string;
  readonly rows: readonly string[];
  readonly facing?: Direction;
  /** Coordinates are relative to rows, before centering in the 20 by 20 grid. */
  readonly circuits?: readonly CircuitSpec[];
  readonly gates?: readonly GateSpec[];
  readonly mirrors?: readonly MirrorSpec[];
}
export interface World {
  readonly id: string;
  readonly title: string;
  readonly terrain: readonly string[];
  readonly start: Point;
  readonly stones: readonly Point[];
  readonly monsters: readonly Point[];
  readonly supports: readonly Point[];
  readonly buttons: readonly Point[];
  readonly doors: readonly Point[];
  readonly goal: Point;
  readonly facing: Direction;
  readonly circuits: readonly CircuitSpec[];
  readonly gates: readonly GateSpec[];
  readonly mirrors: readonly MirrorSpec[];
}
export interface State {
  readonly hero: Point;
  readonly facing: Direction;
  readonly stones: readonly Point[];
  readonly monsters: readonly Point[];
  readonly supports: readonly Point[];
  readonly complete: boolean;
  readonly failed: boolean;
  readonly dead?: boolean;
  /** Explicit settled gate states also permit a closed gate to weigh on a button. */
  readonly gateClosed?: readonly boolean[];
}
export interface Observation {
  gameCode: string;
  frame: number[][];
  frames: number[][][];
  frameDurationsMs?: number[];
  state: 'NOT_FINISHED' | 'WIN' | 'GAME_OVER';
  availableActionIds: number[];
  canUndo: boolean;
  canSelectLevel: boolean;
  level: number;
  levelCount: number;
  levelsCompleted: number;
  defaultFps: number;
  palette: string[];
}
export const GRID = Object.freeze({cells: 20, cellPx: 3, originPx: 2, canvasPx: 64});
/** Same sixteen colour conventions as SS01. */
export const PALETTE: readonly string[] = Object.freeze([
  '#ffffff', '#cccccc', '#999999', '#777777', '#333333', '#000000',
  '#e03bca', '#f5a9c8', '#ef4141', '#2765d3', '#43d9eb', '#ffe14a',
  '#f59e29', '#8b5a2b', '#50b848', '#9e6bdb',
]);
export const VECTORS: Readonly<Record<Direction, Point>> = Object.freeze({
  N: {x: 0, y: -1}, S: {x: 0, y: 1}, W: {x: -1, y: 0}, E: {x: 1, y: 0},
});
const directionIds: Readonly<Record<number, Direction>> = {1: 'N', 2: 'S', 3: 'W', 4: 'E'};
export const equal = (a: Point, b: Point): boolean => a.x === b.x && a.y === b.y;
export const contains = (points: readonly Point[], p: Point): boolean => points.some(q => equal(p, q));
export const offset = (p: Point, d: Direction): Point => ({x: p.x + VECTORS[d].x, y: p.y + VECTORS[d].y});
export const inside = (p: Point): boolean => Number.isInteger(p.x) && Number.isInteger(p.y) && p.x >= 0 && p.y >= 0 && p.x < 20 && p.y < 20;
export const terrainAt = (w: World, p: Point): string => inside(p) ? w.terrain[p.y * 20 + p.x]! : '#';
export const doorsOpen = (w: World, s: State): boolean => w.buttons.length > 0 && w.buttons.every(p => (!s.dead && equal(p, s.hero)) || contains(s.stones, p) || contains(s.monsters, p));
export const supported = (w: World, s: State, p: Point): boolean => terrainAt(w, p) === '.' || contains(s.supports, p);
export const circuitPressed = (w: World, s: State, id: string): boolean => {
  const circuit = w.circuits.find(c => c.id === id);
  return !!circuit && circuit.buttons.every(p => (!s.dead && equal(p,s.hero)) || contains(s.stones,p)
    || contains(s.monsters,p) || w.gates.some((g,i) => !!s.gateClosed?.[i] && equal(g.at,p)));
};
export const gateClosed = (w: World, s: State, index: number): boolean => {
  const gate=w.gates[index];
  return !!gate && (s.gateClosed?.[index] ?? (circuitPressed(w,s,gate.circuit) === (gate.closedWhen === 'pressed')));
};
const blocked = (w: World, s: State, p: Point): boolean => terrainAt(w, p) === '#'
  || w.mirrors.some(m=>equal(m.at,p))
  || (contains(w.doors, p) && !doorsOpen(w, s)) || w.gates.some((g,i)=>equal(g.at,p)&&gateClosed(w,s,i));
const safeDoors = (w: World, s: State): boolean => doorsOpen(w, s) || w.doors.every(p => (s.dead||!equal(p, s.hero)) && !contains(s.stones, p) && !contains(s.monsters,p));
export function compileLevel(spec: LevelSpec): World {
  const width = spec.rows[0]?.length ?? 0;
  if (!spec.id.trim() || !spec.title.trim() || !width || width > 20 || !spec.rows.length || spec.rows.length > 20 || spec.rows.some(r => r.length !== width)) throw new Error('A nonempty rectangular map of at most 20×20 cells is required.');
  if (spec.facing !== undefined && !Object.hasOwn(VECTORS, spec.facing)) throw new Error('Invalid facing.');
  const ox = Math.floor((20 - width) / 2), oy = Math.floor((20 - spec.rows.length) / 2);
  const terrain = Array<string>(400).fill('#');
  const starts: Point[] = [], stones: Point[] = [], monsters: Point[] = [], supports: Point[] = [], buttons: Point[] = [], doors: Point[] = [], goals: Point[] = [];
  spec.rows.forEach((row, y) => [...row].forEach((c, x) => {
    if (!'#.~BombD*sg@'.includes(c)) throw new Error(`Unknown tile: ${c}`);
    const p = Object.freeze({x: x + ox, y: y + oy});
    terrain[p.y * 20 + p.x] = '#~'.includes(c) ? c : c === 's' ? '~' : '.';
    if (c === 'B' || c === '@') starts.push(p);
    if (c === 'o' || c === '*') stones.push(p);
    if (c === 'm') monsters.push(p);
    if (c === 's') supports.push(p);
    if (c === 'b' || c === '*' || c === '@') buttons.push(p);
    if (c === 'D') doors.push(p);
    if (c === 'g') goals.push(p);
  }));
  if (starts.length !== 1 || goals.length !== 1) throw new Error('SS05 requires one Bard and one destination.');
  const convert=(p: Point): Point => {
    if(!Number.isInteger(p.x)||!Number.isInteger(p.y)||p.x<0||p.x>=width||p.y<0||p.y>=spec.rows.length)throw new Error('Circuit coordinates must be inside the source map.');
    const at={x:p.x+ox,y:p.y+oy};
    if(terrain[at.y*20+at.x]!=='.')throw new Error('Circuit devices require a floor cell.');
    return Object.freeze(at);
  };
  const mirrors=(spec.mirrors??[]).map(m=>{
    if(!['NE','NW','SE','SW'].includes(m.facing))throw new Error('Invalid mirror facing.');
    return Object.freeze({at:convert(m.at),facing:m.facing});
  });
  if(new Set(mirrors.map(m=>m.at.y*20+m.at.x)).size!==mirrors.length)throw new Error('Mirror positions must be unique.');
  const ids=new Set<string>();
  const circuits=(spec.circuits??[]).map(c=>{
    if(!c.id.trim()||ids.has(c.id)||!c.buttons.length)throw new Error('Circuits require unique ids and at least one button.');
    ids.add(c.id);return Object.freeze({id:c.id,buttons:Object.freeze(c.buttons.map(convert))});
  });
  const circuitButtons=circuits.flatMap(c=>c.buttons);
  if(new Set(circuitButtons.map(p=>p.y*20+p.x)).size!==circuitButtons.length)throw new Error('A pressure button belongs to exactly one circuit.');
  if(circuits.length&&buttons.some(p=>!contains(circuitButtons,p)))throw new Error('Every drawn button must belong to a circuit.');
  for(const p of circuitButtons)if(!contains(buttons,p))buttons.push(p);
  const gates=(spec.gates??[]).map(g=>{
    if(!ids.has(g.circuit)||!Object.hasOwn(VECTORS,g.direction)||!['pressed','released'].includes(g.closedWhen))throw new Error('Invalid piston circuit, direction or activation mode.');
    return Object.freeze({...g,at:convert(g.at)});
  });
  if(new Set(gates.map(g=>g.at.y*20+g.at.x)).size!==gates.length)throw new Error('Piston positions must be unique.');
  for(const m of mirrors)if([...starts,...stones,...monsters,...supports,...buttons,...doors,...goals,...gates.map(g=>g.at)].some(p=>equal(p,m.at)))throw new Error('Mirrors cannot overlap actors, goals or circuit devices.');
  const legacyDoors=doors.filter(p=>!gates.some(g=>equal(g.at,p)));
  if (legacyDoors.length && !buttons.length) throw new Error('Doors require a visible pressure button.');
  return Object.freeze({id: spec.id, title: spec.title, terrain: Object.freeze(terrain), start: starts[0]!, goal: goals[0]!, stones: Object.freeze(stones), monsters: Object.freeze(monsters), supports: Object.freeze(supports), buttons: Object.freeze(buttons), doors: Object.freeze(legacyDoors), facing: spec.facing ?? 'N',circuits:Object.freeze(circuits),gates:Object.freeze(gates),mirrors:Object.freeze(mirrors)});
}
export function initialState(w: World): State {
  const state: State={hero: {...w.start}, facing: w.facing, stones: w.stones.map(p => ({...p})), monsters: w.monsters.map(p=>({...p})), supports: w.supports.map(p => ({...p})), complete: false, failed: false, dead:false};
  if(!w.gates.length)return state;
  const settled=settleGates(w,{...state,dead:false,gateClosed:w.gates.map(()=>false)},[]);
  if(!settled.stable)throw new Error('Initial piston circuit does not stabilize.');
  return settled.state;
}
export interface Motion {readonly actor:'hero'|'stone'|'monster'|'support'; readonly from:Point; readonly to:Point}
export interface MotionPhase {
  readonly kind:'walk'|'song'|'reflect'|'piston'|'crush'|'gate'|'combat';
  readonly before:State; readonly after:State; readonly moves:readonly Motion[];
  readonly gateIndex?:number;
  readonly paths?:readonly (readonly Point[])[];
}
export interface DetailedStep {readonly state:State; readonly phases:readonly MotionPhase[]}
export interface ReflectionPlan {readonly moves:readonly Motion[]; readonly paths:readonly (readonly Point[])[]; readonly mirrorIndices:readonly number[]}
const keyOf=(p:Point):string=>`${p.x},${p.y}`;
export const inSongRange=(hero:Point,p:Point):boolean=>Math.max(Math.abs(hero.x-p.x),Math.abs(hero.y-p.y))<=2;
/** The two rays leave the white side of the diagonal. Mirrors themselves never move. */
const mirrorArms:Readonly<Record<MirrorFacing,readonly [Direction,Direction]>>={NE:['N','E'],NW:['N','W'],SE:['S','E'],SW:['S','W']};
const actorAt=(s:State,p:Point):Motion['actor']|null=>!s.dead&&equal(s.hero,p)?'hero':contains(s.stones,p)?'stone':contains(s.monsters,p)?'monster':null;
/** Author-only reflection planner; observations expose only its rendered pixels. */
export function planReflection(w:World,s:State):ReflectionPlan|null {
  if(s.complete||s.dead)return null;
  const moves:Motion[]=[],paths:Point[][]=[],mirrorIndices:number[]=[];
  for(let mi=0;mi<w.mirrors.length;mi++){
    const mirror=w.mirrors[mi]!,arms=mirrorArms[mirror.facing];
    for(let side=0;side<2;side++){
      const sourceDirection=arms[side]!,destinationDirection=arms[1-side]!;
      let from=mirror.at;
      const path:Point[]=[mirror.at];
      for(let distance=1;distance<20;distance++){
        from=offset(from,sourceDirection);
        if(blocked(w,s,from))break;
        path.push(from);
        const actor=actorAt(s,from);
        if(!actor)continue;
        let to=mirror.at;
        const destinationPath:Point[]=[];
        for(let d=0;d<distance;d++){
          to=offset(to,destinationDirection);
          if(blocked(w,s,to))return null;
          destinationPath.push(to);
        }
        const previous=moves.find(m=>m.actor===actor&&equal(m.from,from));
        if(previous&&!equal(previous.to,to))return null; // The solo game never duplicates actors.
        if(!previous)moves.push({actor,from,to});
        paths.push([...path.reverse(),...destinationPath]);
        if(!mirrorIndices.includes(mi))mirrorIndices.push(mi);
        break;
      }
    }
  }
  if(!moves.length)return null;
  const destinations=new Set<string>();
  for(const move of moves){
    const key=keyOf(move.to);
    if(destinations.has(key))return null;
    destinations.add(key);
    const occupant=actorAt(s,move.to);
    if(occupant&&!moves.some(m=>m.actor===occupant&&equal(m.from,move.to)))return null;
  }
  // A nearer actor on a destination arm must be one of this same simultaneous reflection.
  for(const path of paths)for(const p of path){
    const occupant=actorAt(s,p);
    if(occupant&&!moves.some(m=>m.actor===occupant&&equal(m.from,p)))return null;
  }
  return {moves,paths,mirrorIndices};
}
/** Translate actors, then turn newly submerged crates into platforms. */
function applyMotions(w:World,s:State,moves:readonly Motion[]):State {
  const target=(actor:Motion['actor'],p:Point)=>moves.find(m=>m.actor===actor&&equal(m.from,p))?.to??p;
  const supports=s.supports.map(p=>target('support',p));
  const stones:Point[]=[];
  for(const p of s.stones){
    const to=target('stone',p);
    if(terrainAt(w,to)==='~'&&!contains(supports,to))supports.push(to);
    else stones.push(to);
  }
  const monsters=s.monsters.map(p=>target('monster',p)).filter(p=>terrainAt(w,p)==='.'||contains(supports,p));
  const hero=target('hero',s.hero);
  return {...s,hero,stones,monsters,supports,failed:false,dead:!!s.dead||!(terrainAt(w,hero)==='.'||contains(supports,hero))};
}
/** A blocked choir member anchors in place. A blocked Bard cancels the entire turn. */
function songStep(w:World,s:State,direction:Direction):{state:State;moves:Motion[]}|null {
  const heroTo=offset(s.hero,direction);
  if(blocked(w,s,heroTo))return null;
  const candidates:Motion[]=[{actor:'hero',from:s.hero,to:heroTo}];
  for(const [actor,points] of [['stone',s.stones],['monster',s.monsters],['support',s.supports]] as const){
    for(const from of points){
      const to=offset(from,direction);
      if(!inSongRange(s.hero,from)||blocked(w,s,to))continue;
      if(actor==='support'&&(equal(from,s.hero)||equal(from,heroTo)||terrainAt(w,to)!=='~'))continue;
      candidates.push({actor,from,to});
    }
  }
  const active=new Set(candidates);
  for(let changed=true;changed;){
    changed=false;
    for(const move of active){
      if(move.actor==='support'){
        if(contains(s.supports,move.to)&&![...active].some(m=>m.actor==='support'&&equal(m.from,move.to))){active.delete(move);changed=true;}
      }else{
        const occupant=actorAt(s,move.to);
        if(occupant&&![...active].some(m=>m.actor===occupant&&equal(m.from,move.to))){active.delete(move);changed=true;}
      }
    }
  }
  const moves=[...active];
  if(!moves.some(m=>m.actor==='hero'))return null;
  const next=applyMotions(w,{...s,facing:direction},moves);
  if(next.dead)return null; // Voluntary walking cannot step into unsupported water.
  return {state:next,moves};
}
/** A closing piston pushes the complete contiguous file. Only its own occupant is crushed if blocked. */
function firePiston(w: World, s: State, index: number): {state:State; phase:MotionPhase|null} {
  const gate=w.gates[index]!;
  const occupant=(p: Point):'hero'|'stone'|'monster'|null => !s.dead&&equal(s.hero,p)?'hero':contains(s.stones,p)?'stone':contains(s.monsters,p)?'monster':null;
  if(!occupant(gate.at))return {state:s,phase:null};
  const actors:{actor:'hero'|'stone'|'monster';from:Point}[]=[];
  let tail=gate.at;
  for(let actor=occupant(tail);actor;actor=occupant(tail)){
    actors.push({actor,from:tail});tail=offset(tail,gate.direction);
  }
  if(actors.some(actor=>blocked(w,s,offset(actor.from,gate.direction)))){
    const first=actors[0]!;
    const next=first.actor==='hero'?{...s,dead:true,complete:false}:first.actor==='stone'?{...s,stones:s.stones.filter(p=>!equal(p,gate.at))}:{...s,monsters:s.monsters.filter(p=>!equal(p,gate.at))};
    return {state:next,phase:{kind:'crush',before:s,after:next,moves:[],gateIndex:index}};
  }
  const moves:Motion[]=actors.map(a=>({...a,to:offset(a.from,gate.direction)}));
  const water=terrainAt(w,tail)==='~'&&!contains(s.supports,tail);
  const last=actors.at(-1)!;
  const movingHero=moves.find(m=>m.actor==='hero');
  const next:State={...s,
    hero:movingHero?.to??s.hero,
    stones:s.stones.flatMap(p=>{
      const move=moves.find(m=>m.actor==='stone'&&equal(m.from,p));
      if(!move)return [p];
      return water&&equal(move.to,tail)?[]:[move.to];
    }),
    monsters:s.monsters.flatMap(p=>{
      const move=moves.find(m=>m.actor==='monster'&&equal(m.from,p));
      if(!move)return [p];
      return water&&equal(move.to,tail)?[]:[move.to];
    }),
    supports:water&&last.actor==='stone'?[...s.supports,tail]:s.supports,
    dead:!!s.dead||(water&&last.actor==='hero'),failed:false,
  };
  return {state:next,phase:{kind:'piston',before:s,after:next,moves,gateIndex:index}};
}
/** Re-evaluate circuits after every wave of movement; a closed gate can itself hold a plate. */
function settleGates(w: World, start: State, phases: MotionPhase[]): {state:State; stable:boolean} {
  let state=start;
  const seen=new Set<string>();
  for(let round=0;round<64;round++){
    const current=w.gates.map((_,i)=>gateClosed(w,state,i));
    const desired=w.gates.map(g=>circuitPressed(w,state,g.circuit)===(g.closedWhen==='pressed'));
    if(desired.every((v,i)=>v===current[i]))return {state,stable:true};
    const key=JSON.stringify([state.hero,state.stones,state.monsters,state.supports,state.dead,current]);
    if(seen.has(key))return {state:start,stable:false};
    seen.add(key);
    const before=state;
    state={...state,gateClosed:desired};
    let fired=false;
    for(let i=0;i<w.gates.length;i++)if(desired[i]&&!current[i]){
      const result=firePiston(w,state,i);state=result.state;
      if(result.phase){phases.push(result.phase);fired=true;}
    }
    if(!fired)phases.push({kind:'gate',before,after:state,moves:[]});
    if(state.dead)return {state,stable:true};
  }
  return {state:start,stable:false};
}
/** Monsters are static. Their orthogonal attacks are simultaneous after all presses settle. */
function resolveCombat(w:World,s:State):State {
  const adjacent=(a:Point,b:Point)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y)===1;
  const alive=s.monsters.filter(p=>supported(w,s,p));
  const dead=!!s.dead||!supported(w,s,s.hero)||alive.some(p=>adjacent(p,s.hero));
  const monsters=alive.filter(p=>!alive.some(q=>adjacent(p,q)));
  if(dead===!!s.dead&&monsters.length===s.monsters.length)return s;
  return {...s,dead,monsters,complete:false};
}
/** Directions walk and sing together; ACTION5 reflects without singing. */
export function stepDetailed(w: World, s: State, actionId: number): DetailedStep {
  if (!Number.isInteger(actionId) || actionId < 1 || actionId > 5) throw new RangeError('SS05 accepts ACTION1–ACTION5.');
  if (s.complete || s.dead) return {state:s,phases:[]};
  const direction=actionId===5?s.facing:directionIds[actionId]!;
  const refusal=():DetailedStep=>({state:{...s,facing:direction,failed:true},phases:[]});
  let next:State;
  let first:MotionPhase;
  if(actionId===5){
    const plan=planReflection(w,s);
    if(!plan)return refusal();
    next=applyMotions(w,s,plan.moves);
    first={kind:'reflect',before:s,after:next,moves:plan.moves,paths:plan.paths};
  }else{
    const result=songStep(w,s,direction);
    if(!result)return refusal();
    next=result.state;
    first={kind:result.moves.length>1?'song':'walk',before:s,after:next,moves:result.moves};
  }
  if(!safeDoors(w,next))return refusal();
  const phases:MotionPhase[]=[first];
  // Death releases plates; resulting presses settle before the next combat wave.
  for(let wave=0;wave<=s.monsters.length+1;wave++){
    if(w.gates.length){
      const settled=settleGates(w,next,phases);
      if(!settled.stable)return refusal();
      next=settled.state;
    }
    const fought=resolveCombat(w,next);
    if(fought===next)break;
    phases.push({kind:'combat',before:next,after:fought,moves:[]});
    const removed=fought.monsters.length<next.monsters.length;
    next=fought;
    if(!removed)break;
  }
  if(!safeDoors(w,next))return refusal();
  next={...next,complete:!next.dead&&equal(next.hero,w.goal)};
  const last=phases.at(-1)!;
  phases[phases.length-1]={...last,after:next};
  return {state:next,phases};
}
/** Public author API retains the original deterministic single-state result. */
export function stepWorld(w: World, s: State, actionId: number): State {return stepDetailed(w,s,actionId).state;}
type Sprite = readonly (readonly (number | null)[])[];
const cross = (c: number): Sprite => [[null,c,null],[c,c,c],[null,c,null]];
const square = (c: number, middle: number | null = null): Sprite => [[c,c,c],[c,middle,c],[c,c,c]];
function stampPixels(frame: number[][], p: Point, sprite: Sprite): void {
  sprite.forEach((row, y) => row.forEach((v, x) => {
    const px = p.x + x, py = p.y + y;
    if (v !== null && px >= 2 && px < 62 && py >= 2 && py < 62) frame[py]![px] = v;
  }));
}
function stamp(frame: number[][], p: Point, sprite: Sprite): void {
  if (!inside(p)) return;
  stampPixels(frame, {x: 2 + p.x * 3, y: 2 + p.y * 3}, sprite);
}
function bardSprite(facing: Direction): Sprite {
  const hero: (number|null)[][] = [[null,6,null],[6,6,6],[null,6,null]], d = VECTORS[facing];
  hero[1+d.y]![1+d.x] = 0;
  return hero;
}
const circuitColors:readonly number[]=[0,10,12,15,2,8,11,14];
const circuitColor=(w:World,id:string):number=>circuitColors[w.circuits.findIndex(c=>c.id===id)%circuitColors.length]!;
function pistonSprite(direction:Direction,closed:boolean,accent:number):Sprite {
  const sprite:(number|null)[][]=closed?[[7,7,7],[7,5,7],[7,7,7]]:[[7,null,7],[null,null,null],[7,null,7]];
  const tip=VECTORS[direction],side={x:-tip.y,y:tip.x};
  sprite[1+tip.y]![1+tip.x]=accent;
  sprite[1+side.y]![1+side.x]=accent;
  sprite[1-side.y]![1-side.x]=accent;
  return sprite;
}
const supportSprite:Sprite=[[10,13,10],[13,10,13],[10,13,10]];
const monsterSprite:Sprite=[[8,5,8],[5,8,5],[8,5,8]];
function mirrorSprite(facing:MirrorFacing):Sprite {
  const mirror:(number|null)[][]=Array.from({length:3},()=>Array<number|null>(3).fill(null));
  for(let y=0;y<3;y++)for(let x=0;x<3;x++){
    const slash=facing==='NW'||facing==='SE';
    if(slash?x+y===2:x===y)mirror[y]![x]=0;
    else if(facing==='NE'?y>x:facing==='SW'?x>y:facing==='NW'?x+y>2:x+y<2)mirror[y]![x]=5;
  }
  return mirror;
}
function renderScene(w: World, s: State, stones: readonly Point[], monsters:readonly Point[], hero: Point | null, preview=false): number[][] {
  const frame = Array.from({length: 64}, () => Array<number>(64).fill(4));
  for (let y = 0; y < 20; y++) for (let x = 0; x < 20; x++) {
    const t = terrainAt(w, {x,y}), c = t === '#' ? 4 : t === '~' ? 9 : 3;
    stamp(frame, {x,y}, [[c,c,c],[c,c,c],[c,c,c]]);
  }
  if(hero&&!s.dead){
    for(const dx of [-2,2])for(const dy of [-2,2]){
      const p={x:hero.x+dx,y:hero.y+dy};
      if(terrainAt(w,p)==='.'&&!blocked(w,s,p)&&!contains(w.buttons,p)&&!equal(p,w.goal)&&!contains(stones,p)&&!contains(monsters,p)){
        const x=2+p.x*3+(dx<0?0:2),y=2+p.y*3+(dy<0?0:2);
        if(x>=2&&x<62&&y>=2&&y<62)frame[y]![x]=2;
      }
    }
  }
  if(preview)for(const m of planReflection(w,s)?.moves??[])stamp(frame,m.to,square(1));
  for (const p of s.supports) stamp(frame, p, supportSprite);
  for (const m of w.mirrors) stamp(frame,m.at,mirrorSprite(m.facing));
  for (const p of w.buttons) {
    stamp(frame,p,cross(7));
    const circuit=w.circuits.find(c=>contains(c.buttons,p));
    if(circuit)stamp(frame,p,[[null,null,null],[null,circuitColor(w,circuit.id),null],[null,null,null]]);
  }
  for (const p of w.doors) stamp(frame, p, doorsOpen(w,s) ? [[7,null,7],[null,null,null],[7,null,7]] : square(7,5));
  w.gates.forEach((g,i)=>stamp(frame,g.at,pistonSprite(g.direction,gateClosed(w,s,i),circuitColor(w,g.circuit))));
  const goalClosed=(contains(w.doors,w.goal)&&!doorsOpen(w,s))||w.gates.some((g,i)=>equal(g.at,w.goal)&&gateClosed(w,s,i));
  stamp(frame,w.goal,goalClosed?[[11,null,11],[null,null,null],[11,null,11]]:square(11));
  for (const p of stones) stamp(frame, p, square(13,5));
  for (const p of monsters) stamp(frame,p,monsterSprite);
  if (hero) stamp(frame, hero, s.dead?monsterSprite:bardSprite(s.facing));
  for (const p of w.buttons) if (contains(stones,p)||contains(monsters,p)||(hero&&equal(p,hero))) {
    const circuit=w.circuits.find(c=>contains(c.buttons,p)),accent=circuit?circuitColor(w,circuit.id):7;
    stamp(frame,p,[[accent,null,7],[null,null,null],[7,null,7]]);
  }
  if (contains(stones,w.goal)||contains(monsters,w.goal)) stamp(frame,w.goal,[[11,null,11],[null,null,null],[11,null,11]]);
  return frame;
}
export function renderWorld(w: World, s: State): number[][] {
  return renderScene(w, s, s.stones, s.monsters, s.hero, true);
}
function phaseFrames(w:World,phase:MotionPhase):number[][][] {
  const stationaryStones=phase.before.stones.filter(p=>!phase.moves.some(m=>m.actor==='stone'&&equal(m.from,p)));
  const stationaryMonsters=phase.before.monsters.filter(p=>!phase.moves.some(m=>m.actor==='monster'&&equal(m.from,p)));
  const stationarySupports=phase.before.supports.filter(p=>!phase.moves.some(m=>m.actor==='support'&&equal(m.from,p)));
  const movingHero=phase.moves.some(m=>m.actor==='hero');
  if(phase.kind==='reflect'){
    const flash=renderScene(w,phase.before,phase.before.stones,phase.before.monsters,phase.before.hero);
    for(const path of phase.paths??[]){
      for(let i=1;i<path.length;i++){
        const a=path[i-1]!,b=path[i]!,dx=Math.sign(b.x-a.x),dy=Math.sign(b.y-a.y);
        for(let p=0;p<=3;p++){
          const x=3+a.x*3+dx*p,y=3+a.y*3+dy*p;
          if(x>=2&&x<62&&y>=2&&y<62)flash[y]![x]=10;
        }
      }
    }
    const transfer=renderScene(w,phase.before,stationaryStones,stationaryMonsters,movingHero?null:phase.before.hero);
    for(const motion of phase.moves){
      stamp(flash,motion.from,square(motion.actor==='hero'?6:motion.actor==='stone'?13:8,0));
      stamp(transfer,motion.to,square(1,motion.actor==='hero'?6:motion.actor==='stone'?13:8));
    }
    return [flash,transfer,renderWorld(w,phase.after)];
  }
  if(!['walk','song','piston'].includes(phase.kind))return [renderWorld(w,phase.after)];
  const frames=[1,2].map(pixels=>{
    const frame=renderScene(w,{...phase.before,supports:stationarySupports},stationaryStones,stationaryMonsters,movingHero?null:phase.before.hero);
    // Ground is drawn first, then actors, even when a platform and its rider move together.
    for(const motion of [...phase.moves].sort((a,b)=>(a.actor==='support'?-1:0)-(b.actor==='support'?-1:0))){
      const delta={x:motion.to.x-motion.from.x,y:motion.to.y-motion.from.y};
      if(Math.abs(delta.x)+Math.abs(delta.y)!==1)throw new Error('Walking, song and piston phases move exactly one cell.');
      const p={x:2+motion.from.x*3+delta.x*pixels,y:2+motion.from.y*3+delta.y*pixels};
      stampPixels(frame,p,motion.actor==='stone'?square(13,5):motion.actor==='monster'?monsterSprite:motion.actor==='support'?supportSprite:bardSprite(phase.after.facing));
    }
    return frame;
  });
  return [...frames,renderWorld(w,phase.after)];
}
function presentation(w:World,detail:DetailedStep):{frames:number[][][];durations:number[]} {
  if(!detail.phases.length)return {frames:[renderWorld(w,detail.state)],durations:[0]};
  const frames:number[][][]=[],durations:number[]=[];
  for(const phase of detail.phases){
    const part=phaseFrames(w,phase);frames.push(...part);
    durations.push(...(part.length===3?(phase.kind==='reflect'?[70,90,40]:[60,80,40]):[40]));
  }
  durations[durations.length-1]=0;
  return {frames,durations};
}
/** Each forced push is a separate three-frame phase; intermediates never advance game logic. */
export function transitionFrames(w: World, before: State, after: State, action: number): number[][][] {
  const result=presentation(w,stepDetailed(w,before,action));
  result.frames[result.frames.length-1]=renderWorld(w,after);
  return result.frames;
}
interface Snapshot {index: number; completed: number[]; state: State}
export class BardPuzzleSession {
  private readonly worlds: readonly World[];
  private readonly gameCode: string;
  private index = 0;
  private completed = new Set<number>();
  private state: State;
  private history: Snapshot[] = [];
  constructor(levels: readonly LevelSpec[], gameCode = 'SS05') {
    if (!levels.length || new Set(levels.map(l=>l.id)).size !== levels.length || !/^[A-Z0-9]{4}$/.test(gameCode)) throw new Error('Unique levels and a four-character game code are required.');
    this.worlds = levels.map(compileLevel); this.gameCode = gameCode; this.state = initialState(this.worlds[0]!);
  }
  observe(): Observation {
    const frame = renderWorld(this.worlds[this.index]!,this.state);
    return {gameCode:this.gameCode,frame,frames:[frame],state:this.completed.size===this.worlds.length?'WIN':this.state.dead?'GAME_OVER':'NOT_FINISHED',availableActionIds:[1,2,3,4,5],canUndo:this.history.length>0,canSelectLevel:true,level:this.index+1,levelCount:this.worlds.length,levelsCompleted:this.completed.size,defaultFps:10,palette:[...PALETTE]};
  }
  action(actionId: number): Observation {
    const world=this.worlds[this.index]!,before=this.state,detail=stepDetailed(world,before,actionId),next=detail.state;
    if (JSON.stringify(next)===JSON.stringify(before)) return this.observe();
    this.history.push({index:this.index,completed:[...this.completed],state:before}); this.state=next;
    const {frames,durations}=presentation(world,detail);
    if (next.complete) {
      this.completed.add(this.index);
      const nextIndex=this.worlds.findIndex((_,i)=>!this.completed.has(i));
      if (nextIndex!==-1) {this.index=nextIndex;this.state=initialState(this.worlds[this.index]!);}
    }
    const observation=this.observe();
    if (this.state!==next) {durations[durations.length-1]=100;frames.push(observation.frame);durations.push(0);}
    return {...observation,frames,frameDurationsMs:durations};
  }
  undo(): Observation {
    const snapshot=this.history.pop();
    if (snapshot) {this.index=snapshot.index;this.completed=new Set(snapshot.completed);this.state=snapshot.state;}
    return this.observe();
  }
  reset(): Observation {this.completed.delete(this.index);this.state=initialState(this.worlds[this.index]!);this.history=[];return this.observe();}
  restart(): Observation {this.index=0;this.completed.clear();return this.reset();}
  selectLevel(level: number): Observation {
    if (!Number.isInteger(level)||level<1||level>this.worlds.length) throw new RangeError('Invalid level.');
    this.index=level-1;return this.reset();
  }
}
