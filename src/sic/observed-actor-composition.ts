import { ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeCommand, NativeExecution, NativeFamily, NativeObservation, NativeRows } from '../logos-engine/v6-native-types.ts';
import { findRelayPlan, type RelayModel, type RelayState, type RelayStep } from './observed-relay-plan.ts';
import { sicNeedId } from './need-identity.ts';

export const observedActorCompositionId = 'sic_observed_actor_composition';

type Point = readonly [number, number];
type Cell = string;
type Actor = { ink: number; cell: Cell; marker: number | null };
type Shape = { pitch: number; phase: Point; mask: number[]; inks: number[]; floor: number; backing: number };
type Direction = { action: string; axis: Point; evidence: string };
// Capacity is the length of a witnessed displacement, a lower bound.
type Role = { moved: boolean; contact: boolean; capacity: number; effects: Record<string, string>; controls?: Direction[] };
type SupportLaw = { medium: string; pattern: string[]; evidence: string };
type RoleTransfer = { interface: string; motif: string; roles: Record<string, Role>; directions: Direction[]; trigger?: string; gateReaction?: string; projectionColor?: string; support?: SupportLaw };
type History = {
  epoch: number; shape?: Shape; directions: Direction[]; roles: Record<number, Role>; selections: Record<number, string>; transfer?: RoleTransfer;
  guarded: string[]; goals: Cell[]; plates: Cell[]; supports: Record<Cell,string>; trigger?: string; gates: Record<Cell,{accent:number;open:boolean}>; switches: Record<Cell,number>;
  lastPush?: { ink: number; direction: string; object: Cell };
  obstruction?: { ink: number; stance: Cell; object: Cell };
  projectionInk?: number; relayField?: RelayField; relay?: RelayStep[]; relayChecked: string[]; relayLoads?: number[]; seenChain?: boolean; seenPlate?: boolean;
};
type Tile = { pixels: number[]; uniform: boolean; passable: boolean; object: boolean; plate: boolean;
  mirror: Point[] | null; preview: boolean; gate: {accent:number;open:boolean}|null; plateAccent: number|null };
type Scene = { actors: Actor[]; active: Actor; tiles: Map<Cell, Tile>; goals: Cell[]; plates: Cell[] };
type Step = { action: NativeCommand; from: Cell; actor: number; to?: Cell; tile?: string; select?: number; contact?: Cell; relay?: RelayStep; expectedActors?: {ink:number;from:Cell;to:Cell}[] };
type Offer = { ink: number; steps: Step[]; kind: string; score: number; test?: string; target?: Cell };
type Proposal = ReturnType<typeof proposed>;
type Path = { cell: Cell; route: Step[] };
const cardinal: readonly Point[] = [[0,-1], [0,1], [-1,0], [1,0]];
const key = (p: Point): Cell => p.join(',');
const point = (cell: Cell): Point => cell.split(',').map(Number) as unknown as Point;
const next = (cell: Cell, [dx,dy]: Point): Cell => {
  const [x,y] = point(cell);
  return key([x+dx,y+dy]);
};
const distance = (a: Cell, b: Cell) => {
  const [x,y] = point(a), [u,v] = point(b);
  return Math.abs(x-u)+Math.abs(y-v);
};
const tileKey = (tile: Tile | undefined) => tile?.pixels.join(',') ?? '';
const color = (o: NativeObservation, ink: number) => o.palette?.[ink] ?? String(ink);
const command = (action_ref: string): NativeCommand => ({ action_ref, data: {} });
const isDirectional = (direction: Direction, name: string) => direction.action === name;

function supported(scene: Scene, h: History, cell: Cell) {
  const bound=h.supports[cell], tile=scene.tiles.get(cell);
  if(!bound||!tile)return false;
  if(bound===tileKey(tile))return true;
  if(!tile.preview||h.projectionInk===undefined)return false;
  const imprint=bound.split(',').map(Number), ink=h.projectionInk;
  // A display-only prediction can hide part of an established foothold.
  // Its visible substrate must still match the observed support.
  return tile.pixels.some((value,i)=>value!==ink&&value===imprint[i])
    && tile.pixels.every((value,i)=>value===ink||value===imprint[i]);
}

function observedDirections(h: History, actor: number) {
  const overrides=h.roles[actor]?.controls??[];
  return [...overrides,...h.directions.filter(base=>
    !overrides.some(own=>own.action===base.action||key(own.axis)===key(base.axis)))];
}

function backingColor(rows: NativeRows) {
  const last=rows[rows.length-1]!;
  const edges=[...rows[0]!,...last,...rows.flatMap(row=>[row[0]!,row[row.length-1]!])];
  const counts=new Map<number,number>();
  for(const pixel of edges)counts.set(pixel,(counts.get(pixel)??0)+1);
  return [...counts].sort((a,b)=>b[1]-a[1])[0]![0];
}
function readTile(rows: NativeRows, x: number, y: number, pitch: number) {
  return Array.from({length:pitch*pitch}, (_,i) => rows[y+Math.floor(i/pitch)]![x+i%pitch]!);
}

function motif(pixels: number[], mask: number[], markedFloor?: number) {
  const inside = new Set(mask);
  const outside = pixels.filter((_,i) => !inside.has(i));
  if (!outside.length) return null;
  const floor = markedFloor??outside[0]!;
  if (markedFloor===undefined && outside.some(value => value!==floor)) return null;
  const values = mask.map(i => pixels[i]!);
  const ink = values.find(value => values.filter(other => other===value).length >= values.length-1);
  if (ink===undefined || ink===floor || values.includes(floor)) return null;
  const accent = values.findIndex(value => value!==ink);
  return {ink, floor, marker:accent<0?null:mask[accent]!};
}

function spotPair(o: NativeObservation, rows: NativeRows): Shape | undefined {
  if (!o.available_action_refs.includes('ACTION6') || o.available_action_refs.length<5) return;
  const proposals = new Map<string, Shape>();
  for (const part of o.entities) {
    const [x,y,right,bottom] = part.bbox, pitch = right-x+1;
    if (part.rectangular || pitch<3 || pitch>7 || pitch%2===0 || pitch!==bottom-y+1 || part.area<pitch+1) continue;
    const pixels = readTile(rows,x,y,pitch);
    const mask = pixels.flatMap((ink,i) => ink===part.palette_value?[i]:[]);
    if (mask.length!==part.area || mask.length>=pixels.length-2
      || mask.some(index => !mask.includes(pixels.length-1-index))) continue;
    const anchor = motif(pixels,mask);
    if (!anchor || anchor.marker!==null) continue;
    const phase: Point = [x%pitch,y%pitch], peers: number[] = [];
    let anchors = 0;
    for(let v=phase[1];v+pitch<=rows.length;v+=pitch) for(let u=phase[0];u+pitch<=rows[0]!.length;u+=pitch) {
      const other = motif(readTile(rows,u,v,pitch),mask);
      if (!other || other.floor!==anchor.floor) continue;
      if (other.ink===anchor.ink && other.marker===null) anchors++;
      if (other.ink!==anchor.ink && other.marker!==null) {
        const [mx,my] = [other.marker%pitch,Math.floor(other.marker/pitch)], center = (pitch-1)/2;
        if ((mx===center)!==(my===center)) peers.push(other.ink);
      }
    }
    if (anchors!==1 || peers.length!==1) continue;
    const inks = [anchor.ink,peers[0]!].sort((a,b)=>a-b);
    const backing = backingColor(rows);
    proposals.set(JSON.stringify([pitch,phase,mask,inks]),{pitch,phase,mask,inks,floor:anchor.floor,backing});
  }
  return proposals.size===1 ? proposals.values().next().value : undefined;
}

function diagonalAperture(pixels: number[], pitch: number, floor: number): Point[] | null {
  for (const side of [-1,1]) for (const reflection of [-1,1]) {
    const groups = [new Set<number>(),new Set<number>(),new Set<number>()];
    for (const [index,value] of pixels.entries()) {
      const x = index%pitch, y = Math.floor(index/pitch);
      const signed = (reflection===1?x-y:pitch-1-x-y)*side;
      groups[Math.sign(signed)+1]!.add(value);
    }
    if (groups.some(group=>group.size!==1) || !groups[2]!.has(floor)
      || groups[0]!.has(floor) || groups[1]!.has(floor) || [...groups[0]!].some(x=>groups[1]!.has(x))) continue;
    return [[reflection*side,0],[0,-side]];
  }
  return null;
}

function decode(rows: NativeRows, shape: Shape, history: History): Scene | null {
  const {pitch,phase,mask,floor,inks} = shape, actors: Actor[] = [], tiles = new Map<Cell,Tile>();
  const solidColors = new Map<number,Cell[]>();
  const mid = Math.floor(pitch*pitch/2);
  for(let y=phase[1];y+pitch<=rows.length;y+=pitch) for(let x=phase[0];x+pitch<=rows[0]!.length;x+=pitch){
    const cell = key([(x-phase[0])/pitch,(y-phase[1])/pitch]), pixels=readTile(rows,x,y,pitch), body=motif(pixels,mask,history.plates.includes(cell)||history.supports[cell]?floor:undefined);
    const uniform=pixels.every(value=>value===pixels[0]);
    if(body && inks.includes(body.ink)) actors.push({ink:body.ink,cell,marker:body.marker});
    const edge = pixels.filter((_,i)=>i%pitch===0 || i%pitch===pitch-1 || i<pitch || i>=pitch*(pitch-1));
    // A preview can cover a switch and retain its original centre pigment.
    const overlay=history.projectionInk!==undefined&&edge.every(value=>value===history.projectionInk);
    const object=!overlay&&!uniform && edge.every(value=>value===edge[0]) && edge[0]!==floor && pixels[mid]!==edge[0] && pixels[mid]!==floor;
    const mirror=!object&&!uniform ? diagonalAperture(pixels,pitch,floor) : null;
    const onBoard=pixels.filter(value=>value===floor).length;
    const plate=!mirror&&!object && (!body||body.marker===mid) && onBoard>=pixels.length-mask.length
      && mask.every(index=>pixels[index]!==floor)
      && pixels.filter((_,i)=>!mask.includes(i)).every(value=>value===floor);
    const preview=overlay||!!(body && !inks.includes(body.ink) && body.marker===null && (body.floor===floor||history.goals.includes(cell)));
    const gate=gateMark(pixels,pitch,floor);
    tiles.set(cell,{pixels,uniform,
      passable:gate?gate.open:onBoard>=Math.ceil(pixels.length/2)||preview||plate,object,plate,mirror,preview,gate,plateAccent:plate?pixels[mid]!:null});
    const outline = edge.every(value => value===edge[0]) && edge[0]!==floor && pixels[mid]===floor;
    if ((uniform||outline) && pixels[0]!==floor && pixels[0]!==shape.backing) {
      const list = solidColors.get(pixels[0]!) ?? [];
      list.push(cell);
      solidColors.set(pixels[0]!,list);
    }
  }
  const active=actors.filter(actor=>actor.marker!==null);
  if(actors.length!==inks.length || active.length!==1 || new Set(actors.map(a=>a.ink)).size!==inks.length) return null;
  const repeated=[...solidColors.values()].filter(cells=>cells.length===actors.length);
  const outlines=repeated.filter(cells=>cells.some(cell=>!tiles.get(cell)?.uniform));
  const candidateGoals=outlines.length?outlines:repeated.filter(cells=>distance(cells[0]!,cells[1]!)>1);
  const goals=history.goals.length ? history.goals : candidateGoals.length===1 ? candidateGoals[0]! : [];
  const plates=[...new Set([...history.plates,...[...tiles].filter(([,tile])=>tile.plate).map(([cell])=>cell)])];
  return {actors,active:active[0]!,tiles,goals,plates};
}

function markerAxis(marker: number | null, pitch: number): Point | null {
  if (marker===null) return null;
  const center=(pitch-1)/2, x=marker%pitch-center, y=Math.floor(marker/pitch)-center;
  return (x===0)!==(y===0)?[Math.sign(x),Math.sign(y)]:null;
}

function address(cell: Cell, shape: Shape): NativeCommand {
  const [x,y]=point(cell), {pitch,phase}=shape, middle=(pitch-1)/2;
  return {action_ref:'ACTION6',data:{x:phase[0]+pitch*x+middle,y:phase[1]+pitch*y+middle}};
}

function walks(scene: Scene, h: History, actor: Actor): Map<Cell,Path> {
  const start = {cell:actor.cell,route:[]};
  const paths = new Map<Cell,Path>([[actor.cell,start]]);
  for (const {cell,route} of paths.values()) for (const direction of observedDirections(h,actor.ink)) {
    const dest=next(cell,direction.axis), tile=scene.tiles.get(dest);
    if (paths.has(dest) || !tile || tile.object || tile.mirror || scene.actors.some(a=>a.cell===dest)
      || !(tile.passable||scene.goals.includes(dest)||supported(scene,h,dest))
      || h.guarded.includes(JSON.stringify([actor.ink,cell,direction.action,tileKey(tile)]))) continue;
    paths.set(dest,{cell:dest,route:[...route,{action:command(direction.action),from:cell,to:dest,actor:actor.ink,tile:tileKey(tile)}]});
  }
  return paths;
}

function transferTarget(scene: Scene, source: Cell, mirror: Cell, [first,second]: Point[]) {
  const [x,y]=point(source), [u,v]=point(mirror);
  for(const [into,out] of [[first!,second!],[second!,first!]] as const) {
    const length = (x-u)*into[0]+(y-v)*into[1];
    if (length<1 || x!==u+into[0]*length || y!==v+into[1]*length) continue;
    let origin=mirror, destination=mirror, possible=true;
    for(let i=0;i<length;i++){
      origin=next(origin,into);
      destination=next(destination,out);
      const aperture=scene.tiles.get(origin), landing=scene.tiles.get(destination);
      if (!aperture || !landing || aperture.object || landing.object || (origin!==source && scene.actors.some(actor=>actor.cell===origin))
        || scene.actors.some(actor=>actor.cell===destination)) {possible=false;break;}
    }
    if(possible) return destination;
  }
}

function gateMark(pixels: number[], pitch: number, floor: number) {
  const center=Math.floor(pixels.length/2), frame=pixels[0]!;
  const corners=[0,pitch-1,pixels.length-pitch,pixels.length-1];
  if(frame===floor || pixels[center]===frame || corners.some(i=>pixels[i]!==frame)) return null;
  const sides=[-pitch,pitch,-1,1].map(offset=>pixels[center+offset]!);
  const accent=sides.find(value=>value!==frame && value!==floor&&sides.filter(v=>v===value).length===3);
  if(accent===undefined) return null;
  const open=pixels[center]===floor&&sides.includes(floor);
  if(!open&&!sides.includes(frame)) return null;
  return {accent,open};
}

type Alignment = { mirror: Cell; placement: Cell; stance: Cell; destination: Cell; cost: number };
const portable = (tile: Tile | undefined) => !!tile && (tile.object || tile.mirror!==null);
function verifiedExtendedPush(before: Scene,after: Scene,first:Cell,axis:Point){
  let count=0;
  for(let from=first;portable(before.tiles.get(from));from=next(from,axis)){
    const initial=before.tiles.get(from)!,to=next(from,axis),moved=after.tiles.get(to);
    if(initial.mirror){
      if(!moved?.mirror||JSON.stringify(initial.mirror)!==JSON.stringify(moved.mirror))return false;
    }else if(!moved?.object) return false;
    count++;
  }
  return count>1;
}

const background = (tile: Tile | undefined, shape: Shape) => !tile || tile.uniform&&tile.pixels[0]===shape.backing;

function rays(placement: Cell, stance: Cell, destination: Cell, axes: Point[]) {
  const length=distance(placement,stance);
  for(const [a,b] of [[axes[0]!,axes[1]!],[axes[1]!,axes[0]!]] as const){
    const projected:Cell[]=[];
    let from=placement,to=placement;
    for(let k=0;k<length;k++){
      from=next(from,a);
      to=next(to,b);
      projected.push(from,to);
    }
    if(from===stance&&to===destination&&length) return projected;
  }
  return null;
}

function alignments(scene: Scene, h: History) {
  const mirrors=[...scene.tiles].filter(([,tile])=>tile.mirror);
  if(mirrors.length<2||scene.goals.length!==2) return null;
  // A fixed support or switch is a stronger staging point than an arbitrary
  // square on a ray. It can keep a circuit engaged during a second approach.
  const stances=scene.plates.length>=scene.goals.length?scene.plates:
    [...scene.tiles].filter(([cell,tile])=>tile.passable && !portable(tile)&&!scene.goals.includes(cell)).map(([cell])=>cell);
  const options=scene.goals.map(destination=>mirrors.flatMap(([mirror,tile])=>stances.flatMap(stance=>{
    const [sx,sy]=point(stance), [dx,dy]=point(destination);
    if(stance===destination||Math.abs(sx-dx)!==Math.abs(sy-dy)) return [];
    return [key([dx,sy]),key([sx,dy])].flatMap(placement=>{
      const substrate=scene.tiles.get(placement);
      const projection=rays(placement,stance,destination,tile.mirror!);
      if(!projection || background(substrate,h.shape!)
        || !(placement===mirror||substrate?.passable||substrate?.object)
        || projection.some(cell=>background(scene.tiles.get(cell),h.shape!))) return [];
      return [{mirror,placement,stance,destination,cost:distance(mirror,placement)*4+
        Math.min(...scene.actors.map(a=>distance(a.cell,stance)))}];
    });
  })));
  let best: [Alignment,Alignment] | null=null;
  for(const a of options[0]!) for(const b of options[1]!){
    if(a.mirror===b.mirror||a.stance===b.stance||a.placement===b.placement)continue;
    if(!best||a.cost+b.cost<best[0].cost+best[1].cost)best=[a,b];
  }
  return best;
}

function pairedTransfer(scene: Scene, h: History, o: NativeObservation): Offer | undefined {
  const pairs=alignments(scene,h);
  if(!pairs) return;
  const routes=scene.actors.map(actor=>walks(scene,h,actor));
  const offers:Offer[]=[];
  const active=scene.active;
  const add=(actor:Actor, steps:Step[], kind:string, score:number, test?:string,target?:Cell)=>{
    const selection=actor.ink!==active.ink;
    if(!steps.length||selection&&h.guarded.includes(JSON.stringify([active.ink,active.cell,'ACTION6',actor.ink])))return;
    const switchStep:Step={action:address(actor.cell,h.shape!),from:active.cell,actor:active.ink,select:actor.ink};
    offers.push({ink:actor.ink,steps:selection?[switchStep,...steps]:steps,kind,score:score-steps.length-(selection?4:0),
      ...(test?{test}:{}),...(target?{target}:{})});
  };
  const ready=pairs.every(pair=>pair.mirror===pair.placement && scene.actors.some(actor=>actor.cell===pair.stance)
    && scene.tiles.get(pair.destination)?.preview);
  if(ready){
    const expectedActors=pairs.map(pair=>({ink:scene.actors.find(actor=>actor.cell===pair.stance)!.ink,from:pair.stance,to:pair.destination}));
    const input=h.trigger?[h.trigger]:o.available_action_refs.filter(ref=>ref!=='ACTION6'&&!h.directions.some(d=>d.action===ref));
    for(const action of input){
      const test=JSON.stringify([action,expectedActors]);
      if(!h.guarded.includes(test))add(active,[{action:command(action),from:active.cell,actor:active.ink,expectedActors}],
        'compose_simultaneous_observed_transfers',900,test);
    }
  }
  for(const pair of pairs){
    if(pair.mirror!==pair.placement){
      for(const [index,actor] of scene.actors.entries()){
        if(pairs.some(other=>other!==pair&&other.stance===actor.cell))continue;
        for(const dir of observedDirections(h,actor.ink)){
          const opposite:Point=[-dir.axis[0],-dir.axis[1]];
          const stance=next(pair.mirror,opposite), movedMirror=next(pair.mirror,dir.axis);
          const route=routes[index]!.get(stance)?.route;
          if(!route||distance(movedMirror,pair.placement)>=distance(pair.mirror,pair.placement))continue;
          let landing=movedMirror,n=1;
          while(portable(scene.tiles.get(landing))){landing=next(landing,dir.axis);n++;}
          const tile=scene.tiles.get(landing);
          if(background(tile,h.shape!)||tile?.gate&&!tile.gate.open||scene.actors.some(a=>a.cell===landing)
            || n>1&&actor.ink in h.roles&&h.roles[actor.ink]!.capacity<n)continue;
          // The reflector itself needs footing even when a displaced load can
          // change medium. Never use an unsupported reflector as a probe.
          if(!scene.tiles.get(movedMirror)?.passable&&!portable(scene.tiles.get(movedMirror)))continue;
          const test=JSON.stringify([actor.ink,stance,dir.action,pair.mirror,tileKey(tile)]);
          if(!h.guarded.includes(test))add(actor,[...route,{action:command(dir.action),from:stance,actor:actor.ink,
            tile:tileKey(scene.tiles.get(pair.mirror))}],'prepare_transfer_by_moving_reflector',650,test,pair.mirror);
        }
      }
      continue;
    }
    if(!scene.actors.some(actor=>actor.cell===pair.stance)){
      for(const [index,actor] of scene.actors.entries()){
        if(pairs.some(other=>other!==pair&&other.stance===actor.cell))continue;
        const route=routes[index]!.get(pair.stance)?.route;
        if(route) add(actor,route,'occupy_stance_for_joint_transfer',550);
      }
    }
  }
  if(!ready&&pairs.every(pair=>pair.mirror===pair.placement&&scene.actors.some(actor=>actor.cell===pair.stance))){
    for(const pair of pairs){
      const mirror=scene.tiles.get(pair.mirror)?.mirror;
      if(!mirror||scene.tiles.get(pair.destination)?.preview)continue;
      for(const blocker of rays(pair.mirror,pair.stance,pair.destination,mirror)??[]){
        const gate=h.gates[blocker];
        if(!gate||!scene.tiles.get(blocker)?.object)continue;
        const controller=scene.actors.find(actor=>h.switches[actor.cell]===gate.accent);
        if(!controller)continue;
        const paths=routes[scene.actors.indexOf(controller)]!;
        const test=JSON.stringify(['release_linked_gate',controller.cell,blocker,tileKey(scene.tiles.get(blocker))]);
        if(h.guarded.includes(test))continue;
        for(const {cell,route} of paths.values()){
          if(route.length!==1||scene.plates.includes(cell))continue;
          add(controller,route,'verify_gate_release_on_blocking_object',720,test,blocker);
        }
      }
    }
  }
  return offers.sort((a,b)=>b.score-a.score)[0];
}


function draft(scene: Scene, h: History, o: NativeObservation): Offer | undefined {
  const {active}=scene;
  const role = h.roles[active.ink];
  const parked=new Set(scene.actors.filter(a=>scene.goals.includes(a.cell)).map(a=>a.ink));
  const openGoals=scene.goals.filter(cell=>!scene.actors.some(a=>a.cell===cell));
  const aim = (cell:Cell) => Math.min(40,...openGoals.map(goal=>distance(cell,goal)));
  const offers: Offer[]=[];
  const inputs = o.available_action_refs.filter(x=>x!=='ACTION6');
  for(const actor of scene.actors) {
    if (parked.has(actor.ink)) continue;
    const selection = actor.ink===active.ink?[]:[{action:address(actor.cell,h.shape!),from:active.cell,actor:active.ink,select:actor.ink}];
    const blockedSelection = h.guarded.includes(JSON.stringify([active.ink,active.cell,'ACTION6',actor.ink]));
    if(selection.length&&blockedSelection) continue;
    const bestKnown = h.roles[actor.ink];
    const paths = walks(scene,h,actor);
    const add=(steps:Step[], kind:string, score:number, test?:string, target?:Cell)=>offers.push({
      ink:actor.ink,steps:[...selection,...steps],kind,score:score-selection.length*24,...(test?{test}:{}),...(target?{target}:{}),
    });
    for(const goal of openGoals) {
      const route=paths.get(goal)?.route;
      if (route?.length) add(route,'bring_actor_to_unoccupied_destination',1000-route.length);
    }
    for(const {cell,route} of paths.values()) {
      for(const direction of observedDirections(h,actor.ink)) {
        const cargo=next(cell,direction.axis), tile=scene.tiles.get(cargo);
        if(!tile?.object || scene.plates.includes(cargo)) continue;
        let end=next(cargo,direction.axis), count=1;
        while(scene.tiles.get(end)?.object){end=next(end,direction.axis);count++;}
        const landing=scene.tiles.get(end);
        if(!landing || scene.actors.some(a=>a.cell===end) || landing.mirror || (landing.uniform&&landing.pixels[0]===h.shape!.backing)
         ) continue;
        const test=JSON.stringify([actor.ink,cell,direction.action,tileKey(tile),count,tileKey(landing)]);
        if (h.guarded.includes(test)) continue;
        const pressure=scene.plates.includes(end);
        const medium=!landing.passable&&!supported(scene,h,end)&&!scene.goals.includes(end);
        const continues=h.lastPush?.ink===actor.ink&&h.lastPush.direction===direction.action&&h.lastPush.object===cargo;
        const probe=!bestKnown?.contact;
        const guide=aim(cargo)-aim(end);
        if(!probe && !pressure && !medium && !continues && guide<=0) continue;
        const relevance=probe?90:0;
        add([...route,{action:command(direction.action),from:cell,actor:actor.ink,tile:tileKey(tile)}],
          pressure?'compose_object_with_stationary_mark':count>1?'contrast_capacity_at_a_row_of_objects':'test_reachable_object_contact',
          200+relevance+(pressure?160:0)+(medium?80:0)+(pressure||medium?guide*4:guide*2)
          +(count>1?70:0)+(continues?45:0)-route.length*7,test,cargo);
      }
      if(!bestKnown?.contact || openGoals.some(goal=>distance(goal,cell)<=2)) {
        for(const axis of cardinal){
          const adjacent=next(cell,axis), object=scene.tiles.get(adjacent);
          if(!object?.object || scene.plates.includes(adjacent))continue;
          const contrast=h.obstruction?.ink===actor.ink&&h.obstruction.stance===cell&&h.obstruction.object===adjacent?140:0;
          const retreat=observedDirections(h,actor.ink).find(dir=>dir.axis[0]===-axis[0]&&dir.axis[1]===-axis[1]);
          const away=retreat?next(cell,retreat.axis):null;
          const local=away?scene.tiles.get(away):undefined;
          if(retreat&&away&&local?.passable&&!local.object&&!local.mirror&&!scene.actors.some(peer=>peer.cell===away)){
            const test=JSON.stringify([actor.ink,cell,retreat.action,'withdraw',tileKey(object)]);
            if(!h.guarded.includes(test))add([...route,{action:command(retreat.action),from:cell,actor:actor.ink,contact:adjacent,tile:tileKey(object)}],
              'test_displacement_on_withdrawal',225+contrast-route.length*6,test,adjacent);
          }
          for(const action of inputs.filter(name=>!h.directions.some(dir=>isDirectional(dir,name)))){
            const test=JSON.stringify([actor.ink,cell,action,'contact',tileKey(object)]);
            if(!h.guarded.includes(test))add([...route,{action:command(action),from:cell,actor:actor.ink,contact:adjacent,tile:tileKey(object)}],
              'test_unmeasured_command_near_object',215+contrast-route.length*6,test,adjacent);
          }
        }
      }
      for(const [mirror, aperture] of scene.tiles) {
        if(!aperture.mirror) continue;
        const target=transferTarget(scene,cell,mirror,aperture.mirror);
        if(!target || aim(target)>=aim(cell) || !(scene.tiles.get(target)?.passable||supported(scene,h,target)||scene.goals.includes(target))) continue;
        const gain=aim(cell)-aim(target), rendered=scene.tiles.get(target)?.preview && cell===actor.cell;
        if (route.length && !rendered) {
          add(route,'approach_a_visible_transfer_alignment',540+gain*3-route.length*4);
        } else if(rendered){
          for(const action of h.trigger?[h.trigger]:inputs.filter(name=>!h.directions.some(d=>isDirectional(d,name)))) {
            const test=JSON.stringify([actor.ink,cell,action,target]);
            if (!h.guarded.includes(test)) add([{action:command(action),from:cell,actor:actor.ink,to:target}],
              'verify_visible_transport_destination',720+gain*5,test,target);
          }
        }
      }
    }
    if (selection.length && !h.selections[actor.ink]) add([],'verify_transfer_of_control',bestKnown?.contact?80:155);
    if (actor.ink===active.ink) for (const action of inputs) {
      const direction=h.directions.find(d=>isDirectional(d,action));
      const test=JSON.stringify([actor.ink,actor.cell,action,'calibration']);
      if(direction || h.guarded.includes(test)) continue;
      add([{action:command(action),from:actor.cell,actor:actor.ink}],'calibrate_actor_action', (h.directions.length<4?520:0)+(!role?.moved?30:0),test);
    }
  }
  return offers.filter(x=>x.steps.length).sort((a,b)=>b.score-a.score||a.steps.length-b.steps.length)[0];
}


type RelayField = {
  floor: number[]; water: number[]; waterInks: Record<number,number>; plate: number|null; gates: RelayModel['gates']; arms: number[]; goals: number[];
};
const encode=(cell:Cell)=>{const [x,y]=point(cell);return x+y*64;};
const decodeCell=(cell:number)=>key([cell%64,Math.floor(cell/64)]);
const toAxis=([x,y]:Point)=>x+y*64;
const sorted=(cells:number[])=>cells.sort((a,b)=>a-b);

function actorSwitch(scene:Scene,h:History,actor:Actor):Step {
  return {action:address(actor.cell,h.shape!),from:scene.active.cell,actor:scene.active.ink,select:actor.ink};
}

function atOpportunity(scene:Scene,h:History,actor:Actor,steps:Step[],kind:string,score:number,test:string,target:Cell):Offer {
  return {ink:actor.ink,steps:actor.ink===scene.active.ink?steps:[actorSwitch(scene,h,actor),...steps],kind,score,test,target};
}

function reachableCompositions(scene:Scene,h:History) {
  const pending:Offer[]=[];
  for(const actor of scene.actors){
    if(scene.goals.includes(actor.cell))continue;
    if(actor.ink!==scene.active.ink && h.guarded.includes(JSON.stringify([scene.active.ink,scene.active.cell,'ACTION6',actor.ink])))continue;
    for(const {cell,route} of walks(scene,h,actor).values()){
      if(route.length&&scene.plates.includes(cell)&&!scene.tiles.get(cell)?.object){
        const test=JSON.stringify(['plate',cell,scene.tiles.get(cell)?.plateAccent??h.switches[cell]??null]);
        if(!h.guarded.includes(test))pending.push(atOpportunity(scene,h,actor,route,'test_reachable_pressure_composition',60-route.length,test,cell));
      }
      for(const dir of observedDirections(h,actor.ink)){
        const cargo=next(cell,dir.axis), contact=scene.tiles.get(cargo);
        if(!portable(contact)||scene.plates.includes(cargo))continue;
        let last=cargo,n=0;
        const bodyKeys=[];
        while(portable(scene.tiles.get(last))){ bodyKeys.push(tileKey(scene.tiles.get(last)));last=next(last,dir.axis);n++; }
        const landing=scene.tiles.get(last);
        if(background(landing,h.shape!)||landing?.gate&&!landing.gate.open||scene.actors.some(a=>a.cell===last))continue;
        const test=JSON.stringify(['contact',actor.ink,cargo,dir.action,bodyKeys,tileKey(landing)]);
        if(h.guarded.includes(test))continue;
        const proved=h.roles[actor.ink]?.capacity??0;
        const extending=n>1&&n>proved;
        if(extending&&(proved<2||!(landing?.passable||supported(scene,h,last))))continue;
        const kind=extending?'test_extended_chain_capacity':n>1?'test_reachable_chain_composition':'test_reachable_object_composition';
        pending.push(atOpportunity(scene,h,actor,[...route,{action:command(dir.action),from:cell,actor:actor.ink,tile:tileKey(contact)}],
          kind,(n>1?85:35)-route.length,test,cargo));
      }
    }
  }
  return pending.sort((a,b)=>b.score-a.score||a.steps.length-b.steps.length);
}

function relayField(scene:Scene,h:History,o:NativeObservation):RelayField|undefined {
  if(scene.goals.length!==2||!h.trigger)return;
  const mirrors=[...scene.tiles].filter(([,tile])=>tile.mirror);
  if(mirrors.length!==1)return;
  const law=h.transfer?.support;
  const bridge=scene.plates.length===0&&Object.keys(h.gates).length===0&&law
    && [...scene.tiles.values()].some(tile=>tile.uniform&&color(o,tile.pixels[0]!)===law.medium);
  const plate=scene.plates[0]??null;
  let gates:RelayField['gates']=[];
  if(!bridge){
    if(plate===null||scene.plates.length!==1||!h.transfer?.gateReaction)return;
    const ink=h.switches[plate];
    const occupied=scene.actors.some(a=>a.cell===plate)||portable(scene.tiles.get(plate));
    const linked=Object.entries(h.gates).filter(([,gate])=>gate.accent===ink);
    if(!linked.some(([,gate])=>gate.open)||!linked.some(([,gate])=>!gate.open))return;
    gates=linked.map(([cell,gate])=>({cell:encode(cell),closedWhenPressed:gate.open!==occupied}));
  }
  const floor:number[]=[],water:number[]=[];
  const waterInks:Record<number,number>={};
  for(const [cell,tile] of scene.tiles){
    if(background(tile,h.shape!))continue;
    const observedMedium=bridge&&(tile.uniform||tile.preview)
      ?tile.pixels.find(ink=>color(o,ink)===law.medium):undefined;
    const knownSupport=bridge&&law.pattern.length===tile.pixels.length
      && tile.pixels.every((ink,i)=>color(o,ink)===law.pattern[i]);
    if(knownSupport||observedMedium!==undefined){
      const location=encode(cell);
      water.push(location);
      if(observedMedium!==undefined)waterInks[location]=observedMedium;
      if(knownSupport)h.supports[cell]=tileKey(tile);
    } else if(scene.goals.includes(cell)||scene.plates.includes(cell)||tile.gate||portable(tile)||tile.passable
      ||scene.actors.some(a=>a.cell===cell))floor.push(encode(cell));
    else if(tile.uniform&&!bridge){
      const location=encode(cell);
      water.push(location);
      waterInks[location]=tile.pixels[0]!;
    }
  }
  return {floor,water,waterInks,plate:plate===null?null:encode(plate),gates,arms:mirrors[0]![1].mirror!.map(toAxis),goals:scene.goals.map(encode)};
}

function relayPose(scene: Scene,h:History):RelayState|undefined {
  const mirror=[...scene.tiles].find(([,tile])=>tile.mirror);
  if(!mirror||!h.relayField)return;
  const field=h.relayField;
  const actors=h.shape!.inks.map(ink=>encode(scene.actors.find(a=>a.ink===ink)!.cell));
  const loads=sorted([...scene.tiles].filter(([,tile])=>tile.object).map(([cell])=>encode(cell)));
  for(const plate of scene.plates) {
    // The control's corner pixels remain on top of a load, not on top
    // of a bare pressure mark. Rebind using the previously seen load inset.
    const cell=encode(plate), target=scene.tiles.get(plate);
    if(!target||target.plate||target.preview||actors.includes(cell)||encode(mirror[0])===cell||loads.includes(cell))continue;
    const stock=Array.from(scene.tiles.values()).find(tile=>tile.object);
    const center=Math.floor(target.pixels.length/2);
    if(h.relayLoads?.includes(target.pixels[center]!)||stock?.pixels[center]===target.pixels[center])loads.push(cell);
  }
  const supports=field.water.filter(cell=>{
    const id=decodeCell(cell), tile=scene.tiles.get(id);
    return !!tile&&!tile.uniform&&!tile.object&&!tile.preview&&!tile.mirror&&!actors.includes(cell)&&tile.pixels.every(ink=>ink!==field.waterInks[cell])
      ||!!h.supports[id]&&(actors.includes(cell)||loads.includes(cell)||encode(mirror[0])===cell||supported(scene,h,id));
  });
  return {actors,loads:sorted(loads),reflector:encode(mirror[0]),supports:sorted(supports)};
}

const sameRelayPose=(a:RelayState|undefined,b:RelayState)=>!!a&&JSON.stringify(a)===JSON.stringify(b);

function relayAgreement(scene:Scene,h:History,expected:RelayState){
  if(!sameRelayPose(relayPose(scene,h),expected))return false;
  const field=h.relayField!;
  const pressed=field.plate!==null&&(expected.reflector===field.plate||expected.actors.includes(field.plate)||expected.loads.includes(field.plate));
  return field.gates.every(gate=>{
    const seen=scene.tiles.get(decodeCell(gate.cell))?.gate;
    return !seen||seen.open===(gate.closedWhenPressed!==pressed);
  });
}

async function relayOffer(scene:Scene,h:History,remaining:number,execution?:NativeExecution):Promise<Offer|undefined> {
  const field=h.relayField;
  if(!field||!h.trigger)return;
  const pose=relayPose(scene,h);
  if(!pose)return;
  if(h.relay?.length&&!sameRelayPose(pose,h.relay[0]!.before))delete h.relay;
  if(!h.relay?.length){
    const fingerprint=JSON.stringify(pose);
    if(h.relayChecked.includes(fingerprint)||h.relayChecked.length>=4)return;
    const model:RelayModel={...field,floor:new Set(field.floor),water:new Set(field.water),trigger:h.trigger,
      controls:h.shape!.inks.map(ink=>observedDirections(h,ink).map(d=>({action:d.action,axis:toAxis(d.axis)}))),
      capacity:h.shape!.inks.map(ink=>h.roles[ink]?.capacity??0)};
    const route=await findRelayPlan(model,pose,{maxNodes:field.plate===null?150000:75000,yieldControl:execution?.yieldControl??(async()=>{}),signal:execution?.signal});
    if(execution?.signal?.aborted)return;
    h.relayChecked.push(fingerprint);
    if(!route?.length)return;
    h.relay=route;
  }
  const line=h.relay;
  const initial=line[0]!, actor=scene.actors.find(a=>a.ink===h.shape!.inks[initial.actor])!;
  if(scene.active.ink!==actor.ink)return {ink:actor.ink,steps:[actorSwitch(scene,h,actor)],kind:'select_actor_for_relay_plan',score:650};
  const steps:Step[]=[];
  for(const predicted of line){
    if(predicted.actor!==initial.actor||steps.length>=remaining)break;
    const from=decodeCell(predicted.before.actors[predicted.actor]!),to=decodeCell(predicted.after.actors[predicted.actor]!);
    steps.push({action:command(predicted.action),from,actor:actor.ink,to,relay:predicted});
    if(predicted.projected.length)break;
  }
  return {ink:actor.ink,steps,kind:field.plate===null?'compose_reflection_and_support_access':'compose_reflection_and_linked_gate_access',score:800};
}

function fresh(epoch: number): History {
  return {epoch,directions:[],roles:{},selections:{},guarded:[],goals:[],plates:[],supports:{},gates:{},switches:{},relayChecked:[]};
}

function restoreRoles(h: History, shape: Shape, o: NativeObservation) {
  const commands = [...o.available_action_refs].sort().join(',');
  const motif = JSON.stringify([shape.pitch,shape.mask]);
  const previous = h.transfer;
  h.shape=shape;
  if (previous?.interface===commands && previous.motif===motif) {
    const peers=shape.inks.map(ink=>[ink,previous.roles[color(o,ink)]] as const);
    if(peers.every(([,role])=>!!role)) {
      h.roles=Object.fromEntries(peers.map(([ink,role])=>[ink,structuredClone(role!)]));
      h.directions=structuredClone(previous.directions);
      if(previous.trigger&&o.available_action_refs.includes(previous.trigger))h.trigger=previous.trigger;
      if(previous.projectionColor!==undefined){
        const ink=o.palette?o.palette.indexOf(previous.projectionColor):Number(previous.projectionColor);
        if(Number.isInteger(ink)&&ink>=0)h.projectionInk=ink;
      }
    }
  }
  h.transfer={interface:commands,motif,roles:Object.fromEntries(shape.inks.flatMap(ink=>h.roles[ink]?[[color(o,ink),h.roles[ink]!]]:[])), directions:h.directions,...(h.trigger?{trigger:h.trigger}:{}),...(previous?.gateReaction?{gateReaction:previous.gateReaction}:{}),...(previous?.support?{support:previous.support}:{}),...(h.projectionInk!==undefined?{projectionColor:color(o,h.projectionInk)}:{})};
}
function proposed(o: NativeObservation, offer: Offer, steps: (Step & { point_binding?: unknown })[], evidence:string[]) {
  const actions=steps.map(step=>step.action), reason=offer.kind.replaceAll('_',' ');
  const goal={kind:offer.kind,scope:o.observation_ref.split(':revision:',1)[0]!,subjects:[String(offer.ink)],
    parentObjective:'G_official_completion',satisfactionContract:'observe_the_predicted_actor_or_interaction'};
  const needId=sicNeedId(goal);
  const id='actor-composition:'+needId;
  return {status:'proposed',kind:observedActorCompositionId,actions,steps:steps.map(step=>({...step,expected_after:step.to?point(step.to):null})),offer,
    binding:{observation_ref:o.observation_ref,level_epoch:o.level_epoch},
    question:{reason,hypothesis_refs:evidence},route_refs:evidence,
    compositions:[{id,observed:false,open_question:reason,relations:['contributes_to:G_official_completion']}],
    sicSituationCard:{mode:offer.kind.startsWith('bring_')?'solving':'exploration',strategy:offer.kind,need:reason,situation:reason,evidence},
    sicLocalDecision:{strategy:offer.kind,objective:{id,label:reason,parent:'G_official_completion'},need:{...goal,id:needId,status:'assigned',evidence}},
    bundle_template:{operation_key:'OP18',composition_ref:id,objective_ref:'G_official_completion',purpose:reason,
      preconditions:{},preserve_refs:[],evidence,actions,outcome_guard:{path:['value'],contains:id}}};
}

export function createObservedActorComposition(): NativeFamily<Proposal> {
  let h=fresh(-1);
  return {
    id:observedActorCompositionId,
    async propose(o,rows,_,remaining,execution) {
      if (h.epoch!==o.level_epoch) h={...fresh(o.level_epoch),...(h.transfer?{transfer:h.transfer}:{})};
      const shape=h.shape??spotPair(o,rows);
      if (!shape) return null;
      let scene=decode(rows,shape,h);
      if (!scene) return null;
      if(!h.shape){
        restoreRoles(h,shape,o);
        // Read the new scene again with the projection cue learned in the
        // previous room. Otherwise a preview may be mistaken for solid cargo.
        if(h.projectionInk!==undefined)scene=decode(rows,shape,h);
        if(!scene)return null;
      }
      h.goals=scene.goals;
      h.plates=scene.plates;
      for(const [cell,tile] of scene.tiles){
        if(tile.gate)h.gates[cell]=tile.gate;
        if(tile.plateAccent!==null)h.switches[cell]=tile.plateAccent;
      }
      if(!h.relayField){
        const field=relayField(scene,h,o);
        if(field){
          h.relayField=field;
          const marked=Math.floor(shape.pitch*shape.pitch/2);
          h.relayLoads=[...new Set([...scene.tiles.values()].filter(tile=>tile.object).map(tile=>tile.pixels[marked]!))];
        }
      }
      const frontier=reachableCompositions(scene,h);
      const chain=h.relayField&&!h.seenChain?frontier.find(offer=>(offer.kind==='test_reachable_chain_composition'||offer.kind==='test_extended_chain_capacity')):undefined;
      const press=h.relayField&&!h.seenPlate?frontier.find(offer=>offer.kind==='test_reachable_pressure_composition'):undefined;
      const paired=scene.goals.length?pairedTransfer(scene,h,o):undefined;
      const planned=chain??press??paired??await relayOffer(scene,h,remaining,execution);
      const direct=planned?undefined:draft(scene,h,o);
      const offer=planned??(scene.goals.length&&direct&&direct.score>155?direct:frontier[0]??direct);
      if(!offer || remaining<1) return null;
      const roleEvidence=Object.values(h.roles[offer.ink]?.effects??{});
      const evidence=[...new Set([o.observation_ref,...observedDirections(h,offer.ink).map(d=>d.evidence),...Object.values(h.selections),...roleEvidence,...(h.transfer?.gateReaction?[h.transfer.gateReaction]:[]),...(h.transfer?.support?[h.transfer.support.evidence]:[])])];
      const steps=offer.steps.slice(0,Math.min(remaining,16));
      const first=steps[0]!;
      if(first.select!==undefined){
        const locus:Point=[first.action.data.x!,first.action.data.y!];
        return proposed(o,offer,[{...first,point_binding:await ObservedInputDomain.makeLocusWitness(o,rows,locus,{reason:'Test which visible actor the click selects',evidence})}],evidence);
      }
      return proposed(o,offer,steps,evidence);
    },
    before(p,index,packet) {
      const step=p.steps[index]!, scene=h.shape&&decode(packet.frame_rows,h.shape,h);
      const destination=step.contact??step.to??(step.tile&&observedDirections(h,step.actor).find(d=>d.action===step.action.action_ref)
        ?next(step.from,observedDirections(h,step.actor).find(d=>d.action===step.action.action_ref)!.axis):undefined);
      const admitted=!!scene && scene.active.ink===step.actor&&scene.active.cell===step.from
        && (step.tile===undefined||!!destination&&tileKey(scene.tiles.get(destination))===step.tile);
      const modelBound=!step.relay||!!scene&&relayAgreement(scene,h,step.relay.before)
        && step.relay.projected.every(cell=>scene.tiles.get(decodeCell(cell))?.preview
          || step.relay!.before.actors.includes(cell)||step.relay!.before.loads.includes(cell));
      const joint = !step.expectedActors || step.expectedActors.every(actor=>scene?.actors.some(part=>part.ink===actor.ink&&part.cell===actor.from)&&scene.tiles.get(actor.to)?.preview);
      return {admitted:admitted&&joint&&modelBound,reason:admitted&&joint&&modelBound?'observed_actor_and_local_contact_preserved':'actor_or_contact_changed'};
    },
    after(p,index,b,a,first,second) {
      const step=p.steps[index]!;
      const boundary=b.level_epoch!==a.level_epoch||b.levels_completed!==a.levels_completed;
      const scene=h.shape&&decode(second,h.shape,h);
      const moved=scene?.active.cell===step.to && scene?.active.ink===step.actor;
      const selected=scene?.active.ink===step.select && scene?.active.cell!==undefined;
      const joint=step.expectedActors?.every(actor=>scene?.actors.some(part=>part.ink===actor.ink&&part.cell===actor.to));
      const forecast=step.relay&&scene?relayAgreement(scene,h,step.relay.after):undefined;
      const matched=boundary|| (forecast!==undefined?forecast:joint!==undefined?joint:step.select!==undefined?selected:step.to!==undefined?moved:b.frame_hash!==a.frame_hash);
      const sealed=boundary||!matched||step.select!==undefined||step.to===undefined||index===p.steps.length-1;
      return {matched,seal_prefix:sealed,reason:boundary?'official_boundary':matched?'actor_outcome_observed':'actor_outcome_contradicted'};
    },
    record(b,a,action,first,second,p,index) {
      if(!h.shape||b.level_epoch!==a.level_epoch)return {events:[]};
      const before=decode(first,h.shape,h), after=decode(second,h.shape,h), step=p.steps[index]!;
      if(!before||!after) return {events:[]};
      const actor=before.active, observed=after.active;
      const role=h.roles[actor.ink]??={moved:false,contact:false,capacity:0,effects:{}};
      if(step.select!==undefined){
        if(observed.ink===step.select && before.actors.every(part=>after.actors.some(end=>part.ink===end.ink&&part.cell===end.cell))){
          h.selections[observed.ink]=a.observation_ref;
        }else h.guarded.push(JSON.stringify([actor.ink,actor.cell,'ACTION6',step.select]));
      }else if(p.offer.kind==='calibrate_actor_action'){
        const axis=markerAxis(observed.marker,h.shape.pitch), prior=markerAxis(actor.marker,h.shape.pitch);
        const moved=observed.cell!==actor.cell;
        if (axis&&(moved||JSON.stringify(prior)!==JSON.stringify(axis))
          && (moved?next(actor.cell,axis)===observed.cell:true)
          && !h.directions.some(d=>d.action===action.action_ref||key(d.axis)===key(axis))) {
          h.directions.push({action:action.action_ref,axis,evidence:a.observation_ref});
        }
        if(p.offer.test)h.guarded.push(p.offer.test);
      }
      // A shared input map is a starting hypothesis for a new actor. A witnessed
      // single step can contradict that hypothesis without discarding its peers.
      const expectedDirection=observedDirections(h,actor.ink).find(dir=>dir.action===action.action_ref);
      if(expectedDirection&&observed.ink===actor.ink&&distance(actor.cell,observed.cell)===1
        && next(actor.cell,expectedDirection.axis)!==observed.cell){
        const actual=cardinal.find(axis=>next(actor.cell,axis)===observed.cell)!;
        role.controls=[...(role.controls??[]).filter(dir=>dir.action!==action.action_ref&&key(dir.axis)!==key(actual)),
          {action:action.action_ref,axis:actual,evidence:a.observation_ref}];
      }
      if(h.transfer){
        h.transfer.roles[color(a,actor.ink)]=role;
        h.transfer.directions=h.directions;
      }
      if(observed.ink===actor.ink&&observed.cell!==actor.cell) role.moved=true;
      if(step.to&&step.to!==observed.cell){
        h.guarded.push(JSON.stringify([actor.ink,actor.cell,action.action_ref,step.tile??step.to]));
      }
      if((p.offer.kind==='verify_visible_transport_destination'&&step.to===observed.cell)||step.expectedActors?.every(expected=>after.actors.some(actor=>actor.ink===expected.ink&&actor.cell===expected.to))){
        h.trigger=action.action_ref;
        if(h.transfer)h.transfer.trigger=action.action_ref;
        const cue=step.to?before.tiles.get(step.to):undefined;
        if(cue?.preview){
          const ink=cue.pixels[Math.floor(cue.pixels.length/2)]!;
          h.projectionInk=ink;
          if(h.transfer)h.transfer.projectionColor=color(b,ink);
        }

        role.effects[action.action_ref]=a.observation_ref;
      }
      if(p.offer.test && step.select===undefined && (step.expectedActors||p.offer.kind==='verify_gate_release_on_blocking_object')){
        h.guarded.push(p.offer.test);
        if(p.offer.kind==='verify_gate_release_on_blocking_object'&&p.offer.target
          && tileKey(before.tiles.get(p.offer.target))!==tileKey(after.tiles.get(p.offer.target))&&h.transfer)
          h.transfer.gateReaction=a.observation_ref;
      }
      if(step.relay){
        if(relayAgreement(after,h,step.relay.after)){
          for(const support of step.relay.after.supports.filter(cell=>!step.relay!.before.supports.includes(cell))){
            const cell=decodeCell(support);
            h.supports[cell]=tileKey(after.tiles.get(cell));
          }
          h.relay?.shift();
        }
        else delete h.relay;
      }
      if(p.offer.kind==='test_reachable_pressure_composition'&&p.offer.target===step.to&&p.offer.test){
        h.guarded.push(p.offer.test);
        h.seenPlate=observed.cell===step.to;
        if(h.seenPlate&&h.transfer&&!h.transfer.gateReaction
          && [...before.tiles].some(([cell,tile])=>tile.gate&&after.tiles.get(cell)?.gate
            && tile.gate.open!==after.tiles.get(cell)!.gate!.open))
          h.transfer.gateReaction=a.observation_ref;
      }
      if((p.offer.kind==='test_reachable_chain_composition'||p.offer.kind==='test_extended_chain_capacity')&&step.select===undefined&&step.to===undefined)
        h.seenChain=true;
      if(p.offer.test && step.contact && p.offer.target) {
        const delta=tileKey(before.tiles.get(step.contact))!==tileKey(after.tiles.get(step.contact));
        if(delta){ role.contact=true; role.effects[p.offer.kind+':'+action.action_ref]=a.observation_ref; }
        h.guarded.push(p.offer.test);
      } else if(p.offer.test && step.to===undefined && action.action_ref!=='ACTION6' && p.offer.target) {
        const dir=observedDirections(h,actor.ink).find(d=>d.action===action.action_ref), cargo=p.offer.target;
        if(dir&&observed.cell===cargo){
          let cursor=cargo,count=0;
          while(portable(before.tiles.get(cursor))){count++;cursor=next(cursor,dir.axis);}
          delete h.obstruction;
          role.contact=true;
          h.guarded.push(p.offer.test);
          if(p.offer.kind!=='test_extended_chain_capacity'||verifiedExtendedPush(before,after,cargo,dir.axis))
            role.capacity=Math.max(role.capacity,count);
          role.effects[action.action_ref]=a.observation_ref;
          const trail=next(cargo,dir.axis);
          if(after.tiles.get(trail)?.object)h.lastPush={ink:actor.ink,direction:action.action_ref,object:trail};
          const prior=before.tiles.get(cursor), outcome=after.tiles.get(cursor);
          if(prior&&!prior.passable&&outcome&&!outcome.object&&!outcome.uniform){
            h.supports[cursor]=tileKey(outcome);
            if(prior.uniform&&!prior.gate&&!outcome.preview&&h.transfer&&!h.transfer.support)
              h.transfer.support={medium:color(b,prior.pixels[0]!),pattern:outcome.pixels.map(ink=>color(a,ink)),evidence:a.observation_ref};
          }
        }else {
          h.guarded.push(p.offer.test);
          h.obstruction={ink:actor.ink,stance:actor.cell,object:cargo};
        }
      }
      return {events:[]};
    },
    state:()=>h,
    restore(value){ h={...fresh(-1),...structuredClone(value as History)}; },
  };
}
