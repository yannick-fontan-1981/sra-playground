/** Deterministic pulling puzzles. No browser, solver, agent or network dependency. */
export type Point = Readonly<{x: number; y: number}>;
export type Direction = 'N' | 'S' | 'W' | 'E';
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
}
export interface World {
  readonly id: string;
  readonly title: string;
  readonly terrain: readonly string[];
  readonly start: Point;
  readonly stones: readonly Point[];
  readonly supports: readonly Point[];
  readonly buttons: readonly Point[];
  readonly doors: readonly Point[];
  readonly goal: Point;
  readonly facing: Direction;
  readonly circuits: readonly CircuitSpec[];
  readonly gates: readonly GateSpec[];
}
export interface State {
  readonly hero: Point;
  readonly facing: Direction;
  readonly stones: readonly Point[];
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
export const doorsOpen = (w: World, s: State): boolean => w.buttons.length > 0 && w.buttons.every(p => equal(p, s.hero) || contains(s.stones, p));
export const supported = (w: World, s: State, p: Point): boolean => terrainAt(w, p) === '.' || contains(s.supports, p);
export const circuitPressed = (w: World, s: State, id: string): boolean => {
  const circuit = w.circuits.find(c => c.id === id);
  return !!circuit && circuit.buttons.every(p => (!s.dead && equal(p,s.hero)) || contains(s.stones,p)
    || w.gates.some((g,i) => !!s.gateClosed?.[i] && equal(g.at,p)));
};
export const gateClosed = (w: World, s: State, index: number): boolean => {
  const gate=w.gates[index];
  return !!gate && (s.gateClosed?.[index] ?? (circuitPressed(w,s,gate.circuit) === (gate.closedWhen === 'pressed')));
};
const blocked = (w: World, s: State, p: Point): boolean => terrainAt(w, p) === '#'
  || (contains(w.doors, p) && !doorsOpen(w, s)) || w.gates.some((g,i)=>equal(g.at,p)&&gateClosed(w,s,i));
const safeDoors = (w: World, s: State): boolean => doorsOpen(w, s) || w.doors.every(p => !equal(p, s.hero) && !contains(s.stones, p));
export function compileLevel(spec: LevelSpec): World {
  const width = spec.rows[0]?.length ?? 0;
  if (!spec.id.trim() || !spec.title.trim() || !width || width > 20 || !spec.rows.length || spec.rows.length > 20 || spec.rows.some(r => r.length !== width)) throw new Error('A nonempty rectangular map of at most 20×20 cells is required.');
  if (spec.facing !== undefined && !Object.hasOwn(VECTORS, spec.facing)) throw new Error('Invalid facing.');
  const ox = Math.floor((20 - width) / 2), oy = Math.floor((20 - spec.rows.length) / 2);
  const terrain = Array<string>(400).fill('#');
  const starts: Point[] = [], stones: Point[] = [], supports: Point[] = [], buttons: Point[] = [], doors: Point[] = [], goals: Point[] = [];
  spec.rows.forEach((row, y) => [...row].forEach((c, x) => {
    if (!'#.~TobD*sg@'.includes(c)) throw new Error(`Unknown tile: ${c}`);
    const p = Object.freeze({x: x + ox, y: y + oy});
    terrain[p.y * 20 + p.x] = '#~'.includes(c) ? c : c === 's' ? '~' : '.';
    if (c === 'T' || c === '@') starts.push(p);
    if (c === 'o' || c === '*') stones.push(p);
    if (c === 's') supports.push(p);
    if (c === 'b' || c === '*' || c === '@') buttons.push(p);
    if (c === 'D') doors.push(p);
    if (c === 'g') goals.push(p);
  }));
  if (starts.length !== 1 || goals.length !== 1) throw new Error('SS03 requires one Thief and one destination.');
  const convert=(p: Point): Point => {
    if(!Number.isInteger(p.x)||!Number.isInteger(p.y)||p.x<0||p.x>=width||p.y<0||p.y>=spec.rows.length)throw new Error('Circuit coordinates must be inside the source map.');
    const at={x:p.x+ox,y:p.y+oy};
    if(terrain[at.y*20+at.x]!=='.')throw new Error('Circuit devices require a floor cell.');
    return Object.freeze(at);
  };
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
  const legacyDoors=doors.filter(p=>!gates.some(g=>equal(g.at,p)));
  if (legacyDoors.length && !buttons.length) throw new Error('Doors require a visible pressure button.');
  return Object.freeze({id: spec.id, title: spec.title, terrain: Object.freeze(terrain), start: starts[0]!, goal: goals[0]!, stones: Object.freeze(stones), supports: Object.freeze(supports), buttons: Object.freeze(buttons), doors: Object.freeze(legacyDoors), facing: spec.facing ?? 'N',circuits:Object.freeze(circuits),gates:Object.freeze(gates)});
}
export function initialState(w: World): State {
  const state: State={hero: {...w.start}, facing: w.facing, stones: w.stones.map(p => ({...p})), supports: w.supports.map(p => ({...p})), complete: false, failed: false};
  if(!w.gates.length)return state;
  const settled=settleGates(w,{...state,dead:false,gateClosed:w.gates.map(()=>false)},[]);
  if(!settled.stable)throw new Error('Initial piston circuit does not stabilize.');
  return settled.state;
}
export interface PullPlan {
  /** The single rear stone's start and the hero's vacated cell. */
  readonly from: Point;
  readonly to: Point;
  readonly heroTo: Point;
  readonly valid: boolean;
  readonly stones: readonly Point[];
  readonly destinations: readonly Point[];
}
/**
 * A Thief draws only the adjacent stone behind them while walking away.
 * There is no grabbing mode, pushing, propagation along a file or water fill:
 * the stone enters the supported cell that the hero has just vacated.
 * A door closing on either actor rejects the entire simultaneous movement.
 */
export function planPull(w: World, s: State, direction: Direction): PullPlan | null {
  if (s.complete || s.dead) return null;
  const d = VECTORS[direction];
  const from = {x: s.hero.x - d.x, y: s.hero.y - d.y};
  if (!contains(s.stones, from)) return null;
  const heroTo = offset(s.hero, direction), to = s.hero;
  const unobstructed = supported(w, s, heroTo) && !blocked(w, s, heroTo) && !contains(s.stones, heroTo);
  const candidate: PullPlan = {from, to, heroTo, valid: unobstructed, stones: [from], destinations: [to]};
  return {...candidate, valid: unobstructed && safeDoors(w, performPull(s, candidate))};
}
function performPull(s: State, plan: PullPlan): State {
  return {...s, hero: plan.heroTo,
    stones: s.stones.map(p => equal(p, plan.from) ? plan.to : p), failed: false};
}
export interface Motion {readonly actor:'hero'|'stone'; readonly from:Point; readonly to:Point}
export interface MotionPhase {
  readonly kind:'walk'|'pull'|'piston'|'crush'|'gate';
  readonly before:State; readonly after:State; readonly moves:readonly Motion[];
  readonly gateIndex?:number;
}
export interface DetailedStep {readonly state:State; readonly phases:readonly MotionPhase[]}
/** A closing piston pushes the complete contiguous file. Only its own occupant is crushed if blocked. */
function firePiston(w: World, s: State, index: number): {state:State; phase:MotionPhase|null} {
  const gate=w.gates[index]!;
  const occupant=(p: Point):'hero'|'stone'|null => !s.dead&&equal(s.hero,p)?'hero':contains(s.stones,p)?'stone':null;
  if(!occupant(gate.at))return {state:s,phase:null};
  const actors:{actor:'hero'|'stone';from:Point}[]=[];
  let tail=gate.at;
  for(let actor=occupant(tail);actor;actor=occupant(tail)){
    actors.push({actor,from:tail});tail=offset(tail,gate.direction);
  }
  if(actors.some(actor=>blocked(w,s,offset(actor.from,gate.direction)))){
    const first=actors[0]!;
    const next=first.actor==='hero'?{...s,dead:true,complete:false}:{...s,stones:s.stones.filter(p=>!equal(p,gate.at))};
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
    const key=JSON.stringify([state.hero,state.stones,state.supports,state.dead,current]);
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
/** The voluntary move and all forced piston moves remain separate, atomic presentation phases. */
export function stepDetailed(w: World, s: State, actionId: number): DetailedStep {
  if (!Number.isInteger(actionId) || actionId < 1 || actionId > 4) throw new RangeError('SS03 accepts ACTION1–ACTION4.');
  if (s.complete || s.dead) return {state:s,phases:[]};
  const direction = directionIds[actionId]!;
  let next: State = {...s, facing: direction, failed: false};
  const plan = planPull(w, s, direction);
  if (plan) {
    next = plan.valid ? performPull(next, plan) : {...next, failed: true};
  } else {
    const p = offset(s.hero, direction);
    const moved = {...next, hero: p};
    if (supported(w, s, p) && !blocked(w, s, p) && !contains(s.stones, p) && safeDoors(w, moved)) next = moved;
    else next = {...next, failed: true};
  }
  if(next.failed)return {state:next,phases:[]};
  const moves:Motion[]=[{actor:'hero',from:s.hero,to:next.hero}];
  if(plan?.valid)moves.push({actor:'stone',from:plan.from,to:plan.to});
  const phases:MotionPhase[]=[{kind:plan?.valid?'pull':'walk',before:s,after:next,moves}];
  if(w.gates.length){
    const settled=settleGates(w,next,phases);
    if(!settled.stable)return {state:{...s,facing:direction,failed:true},phases:[]};
    next=settled.state;
  }
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
function thiefSprite(facing: Direction): Sprite {
  const hero: (number|null)[][] = [[null,14,null],[14,14,14],[null,14,null]], d = VECTORS[facing];
  hero[1+d.y]![1+d.x] = 0;
  return hero;
}
const circuitColors:readonly number[]=[0,10,12,15,6,2,8,11];
const circuitColor=(w:World,id:string):number=>circuitColors[w.circuits.findIndex(c=>c.id===id)%circuitColors.length]!;
function pistonSprite(direction:Direction,closed:boolean,accent:number):Sprite {
  const sprite:(number|null)[][]=closed?[[7,7,7],[7,5,7],[7,7,7]]:[[7,null,7],[null,null,null],[7,null,7]];
  const tip=VECTORS[direction],side={x:-tip.y,y:tip.x};
  sprite[1+tip.y]![1+tip.x]=accent;
  sprite[1+side.y]![1+side.x]=accent;
  sprite[1-side.y]![1-side.x]=accent;
  return sprite;
}
function renderScene(w: World, s: State, stones: readonly Point[], hero: Point | null): number[][] {
  const frame = Array.from({length: 64}, () => Array<number>(64).fill(4));
  for (let y = 0; y < 20; y++) for (let x = 0; x < 20; x++) {
    const t = terrainAt(w, {x,y}), c = t === '#' ? 4 : t === '~' ? 9 : 3;
    stamp(frame, {x,y}, [[c,c,c],[c,c,c],[c,c,c]]);
  }
  for (const p of s.supports) stamp(frame, p, [[10,13,10],[13,10,13],[10,13,10]]);
  for (const p of w.buttons) {
    stamp(frame,p,cross(7));
    const circuit=w.circuits.find(c=>contains(c.buttons,p));
    if(circuit)stamp(frame,p,[[null,null,null],[null,circuitColor(w,circuit.id),null],[null,null,null]]);
  }
  for (const p of w.doors) stamp(frame, p, doorsOpen(w,s) ? [[7,null,7],[null,null,null],[7,null,7]] : square(7,5));
  w.gates.forEach((g,i)=>stamp(frame,g.at,pistonSprite(g.direction,gateClosed(w,s,i),circuitColor(w,g.circuit))));
  stamp(frame, w.goal, square(11));
  for (const p of stones) stamp(frame, p, square(13,5));
  if (hero) stamp(frame, hero, s.dead?[[8,5,8],[5,8,5],[8,5,8]]:thiefSprite(s.facing));
  for (const p of w.buttons) if (contains(stones,p) || (hero && equal(p,hero))) {
    const circuit=w.circuits.find(c=>contains(c.buttons,p)),accent=circuit?circuitColor(w,circuit.id):7;
    stamp(frame,p,[[accent,null,7],[null,null,null],[7,null,7]]);
  }
  if (contains(stones,w.goal)) stamp(frame,w.goal,[[11,null,11],[null,null,null],[11,null,11]]);
  return frame;
}
export function renderWorld(w: World, s: State): number[][] {
  return renderScene(w, s, s.stones, s.hero);
}
function phaseFrames(w:World,phase:MotionPhase):number[][][] {
  if(phase.kind!=='pull'&&phase.kind!=='piston')return [renderWorld(w,phase.after)];
  const movingStones=phase.moves.filter(m=>m.actor==='stone');
  const stationary=phase.before.stones.filter(p=>!movingStones.some(m=>equal(m.from,p)));
  const movingHero=phase.moves.some(m=>m.actor==='hero');
  const frames=[1,2].map(pixels=>{
    const frame=renderScene(w,phase.before,stationary,movingHero?null:phase.before.hero);
    for(const motion of phase.moves){
      const delta={x:motion.to.x-motion.from.x,y:motion.to.y-motion.from.y};
      if(Math.abs(delta.x)+Math.abs(delta.y)!==1)throw new Error('Every animation phase must move actors by exactly one cell.');
      const p={x:2+motion.from.x*3+delta.x*pixels,y:2+motion.from.y*3+delta.y*pixels};
      stampPixels(frame,p,motion.actor==='stone'?square(13,5):thiefSprite(phase.after.facing));
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
    durations.push(...(part.length===3?[60,80,40]:[40]));
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
export class PullPuzzleSession {
  private readonly worlds: readonly World[];
  private readonly gameCode: string;
  private index = 0;
  private completed = new Set<number>();
  private state: State;
  private history: Snapshot[] = [];
  constructor(levels: readonly LevelSpec[], gameCode = 'SS03') {
    if (!levels.length || new Set(levels.map(l=>l.id)).size !== levels.length || !/^[A-Z0-9]{4}$/.test(gameCode)) throw new Error('Unique levels and a four-character game code are required.');
    this.worlds = levels.map(compileLevel); this.gameCode = gameCode; this.state = initialState(this.worlds[0]!);
  }
  observe(): Observation {
    const frame = renderWorld(this.worlds[this.index]!,this.state);
    return {gameCode:this.gameCode,frame,frames:[frame],state:this.completed.size===this.worlds.length?'WIN':this.state.dead?'GAME_OVER':'NOT_FINISHED',availableActionIds:[1,2,3,4],canUndo:this.history.length>0,canSelectLevel:true,level:this.index+1,levelCount:this.worlds.length,levelsCompleted:this.completed.size,defaultFps:10,palette:[...PALETTE]};
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
