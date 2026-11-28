import { ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeCommand, NativeExecution, NativeFamily, NativeObservation, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { sicObservedMotionCycle, sicObservedUnplannedMaterialLoss } from '../logos-engine/v6-native-types.ts';
import { findRelayPlan, relayControlOccupied, relayControlWeighted, relayGateClosed, relayPlatformAvailable, type RelayModel, type RelayState, type RelayStep, type RelayPlatform } from './observed-relay-plan.ts';
import { planHydraulicRelay } from './observed-hydraulic-relay.ts';
import { planPlatformRelay, platformAvailable, type PlatformPose, type PlatformRelayModel, type PlatformStep } from './observed-platform-relay.ts';
import { sicNeedId } from './need-identity.ts';

export const observedActorCompositionId = 'sic_observed_actor_composition';

type Point = readonly [number, number];
type Cell = string;
type Actor = { ink: number; cell: Cell; marker: number | null };
type Shape = { pitch: number; phase: Point; mask: number[]; inks: number[]; floor: number; backing: number };
type Direction = { action: string; axis: Point; evidence: string };
// Capacity is the length of a witnessed displacement, a lower bound.
type Role = { moved: boolean; contact: boolean; capacity: number; effects: Record<string, string>; controls?: Direction[]; pull?:string };
type SupportLaw = { medium: string; pattern: string[]; evidence: string };
type RoleTransfer = { interface: string; motif: string; roles: Record<string, Role>; directions: Direction[]; trigger?: string; triggerEvidence?: string; gateReaction?: string; projectionColor?: string; support?: SupportLaw; goalColor?: string };
type History = {
  epoch: number; shape?: Shape; directions: Direction[]; roles: Record<number, Role>; selections: Record<number, string>; transfer?: RoleTransfer;
  guarded: string[]; goals: Cell[]; plates: Cell[]; supports: Record<Cell,string>; trigger?: string; gates: Record<Cell,{accent:number;open:boolean}>; switches: Record<Cell,number>;
  lastPush?: { ink: number; direction: string; object: Cell };
  obstruction?: { ink: number; stance: Cell; object: Cell };
  projectionInk?: number; relayField?: RelayField; relay?: RelayStep[]; relayChecked: string[]; relayLoads?: number[]; seenChain?: boolean; seenPlate?: boolean;
  relaySelectionPriced?: boolean;
  motion?: { last: string; visits: string[]; cycle?: string[] };
  recoveredCycles?: string[][];
  triedPlates?: Cell[];
  cargoPattern?: string;
  releasedControls?: Record<Cell,string>;
  controlTrials?: Record<Cell,{evidence:string;opens:boolean}>;
  goalInk?: number;
  platformField?: PlatformField;
  platformPlan?: PlatformStep[];
  platformChecked?: string[];
  available?: string[];
  arrangements?:Record<string,string>;
  destinationGroups?:Cell[][];
  mirrorPull?:{ink:number;reflector:Cell;stance:Cell;axis:Point};
  circuitTrials?:Record<number,string>;
  circuitTarget?:number;
  linkedGateRules?:Record<Cell,{control:Cell;closedWhenPressed:boolean}>;
  hydraulic?:{bindings:Record<number,PlatformBinding>;platforms:RelayPlatform[]};
  relayPurpose?:string;
  materialLoss?:{evidence:string;choice:string;test?:string};
  rejectedLossChoices?:string[];
};
type Tile = { pixels: number[]; uniform: boolean; passable: boolean; object: boolean; plate: boolean;
  mirror: Point[] | null; preview: boolean; gate: {accent:number;open:boolean}|null; plateAccent: number|null };
type Scene = { actors: Actor[]; active: Actor; tiles: Map<Cell, Tile>; goals: Cell[]; plates: Cell[]; destinationGroups:Cell[][] };
type ObservedObject = { cell:Cell; glyph:string; kind:'actor'|'load'|'reflector'|'undetermined' };
type ControlTransfer = { source: Cell; destination: Cell; reflector: Cell; mark: number; subject: string; gates: Cell[] };
type Step = { action: NativeCommand; from: Cell; actor: number; to?: Cell; tile?: string; select?: number; contact?: Cell; relay?: RelayStep; expectedActors?: {ink:number;from:Cell;to:Cell}[];
  loads?: { from: Cell[]; to: Cell[]; support?: Cell }; reflectorMove?: { from: Cell; to: Cell }; controlTransfer?: ControlTransfer; platform?: PlatformStep; pressureTrial?:Cell;
  roster?: {ink:number;cell:Cell}[]; probeLanding?:{cell:Cell;glyph:string}; circuitTrial?:number; supportAccess?:Cell; clearLinkedObstruction?:Cell; };
type Offer = { ink: number; steps: Step[]; kind: string; score: number; test?: string; target?: Cell; destinations?:Cell[];
  relayCommandEstimate?: { moves: number; selections: number } };
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
const inset = (pixels: number[],pitch:number) => pixels.filter((_,i)=>i%pitch===Math.floor(pitch/2)||Math.floor(i/pitch)===Math.floor(pitch/2)).join(',');
const color = (o: NativeObservation, ink: number) => o.palette?.[ink] ?? String(ink);
const command = (action_ref: string): NativeCommand => ({ action_ref, data: {} });
const isDirectional = (direction: Direction, name: string) => direction.action === name;

function repeatedShortMotion(visits: readonly string[]): readonly string[] | undefined {
  for(let period=2;period<=6;period++){
    const end=visits.length, start=end-period*3-1;
    if(start<0)continue;
    const lap=visits.slice(start,start+period);
    if(new Set(lap).size>1&&visits.slice(start+period).every((pose,i)=>pose===lap[i%period]))return lap;
  }
}

function keepMotionEvidence(h: History,b: NativeObservation,a: NativeObservation,before: Scene,after: Scene) {
  if(b.level_epoch!==a.level_epoch||a.state!=='NOT_FINISHED')return;
  const eligible=after.actors.every(part=>{
    const from=before.actors.find(peer=>peer.ink===part.ink)!;
    return distance(from.cell,part.cell)<=1 && before.goals.includes(from.cell)===after.goals.includes(part.cell);
  });
  const covered=new Set([...before.actors,...after.actors].map(part=>part.cell));
  const change=[...before.tiles].some(([cell,prior])=>{
    if(covered.has(cell))return false;
    const tile=after.tiles.get(cell)!;
    return prior.object!==tile.object&&!prior.preview&&!tile.preview
      || Boolean(prior.mirror)!==Boolean(tile.mirror)||prior.gate?.open!==tile.gate?.open
      || !prior.preview&&!tile.preview&&tileKey(prior)!==tileKey(tile);
  });
  const pose=(scene:Scene)=>scene.actors.map(part=>[part.ink,part.cell]).sort((x,y)=>Number(x[0])-Number(y[0])).join('|');
  const from=pose(before),to=pose(after);
  if(!eligible||change){h.motion={last:a.observation_ref,visits:[to]};return;}
  const visits=h.motion?.last===b.observation_ref?h.motion.visits:[from];
  if(visits.at(-1)!==to)visits.push(to);
  const window=visits.slice(-19), cycle=repeatedShortMotion(window);
  const signature=cycle&&[...new Set(cycle)].sort();
  h.motion={last:a.observation_ref,visits:window,...(signature?{cycle:signature}:{})};
}

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
    !overrides.some(own=>own.action===base.action||key(own.axis)===key(base.axis)))].filter(dir=>!h.available||h.available.includes(dir.action));
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

function compatibleRoles(o:NativeObservation,previous:RoleTransfer) {
  const inputs=o.available_action_refs, known=previous.interface.split(',');
  return [...inputs].sort().join(',')===previous.interface
    ||inputs.every(ref=>known.includes(ref))&&previous.directions.some(dir=>inputs.includes(dir.action));
}

function rebindKnownActors(o:NativeObservation,rows:NativeRows,previous:RoleTransfer|undefined,current?:Shape):Shape|undefined{
  if(!previous||!compatibleRoles(o,previous))return;
  const [pitch,mask]=JSON.parse(previous.motif) as [number,number[]];
  const backing=current?.backing??backingColor(rows);
  const lattices=new Map<string,{shape:Shape;marked:number;known:number}>();
  const stride=current?pitch:1;
  for(let y=current?.phase[1]??0;y+pitch<=rows.length;y+=stride)for(let x=current?.phase[0]??0;x+pitch<=rows[0]!.length;x+=stride){
    const body=motif(readTile(rows,x,y,pitch),mask);
    if(!body||body.floor===backing||body.marker!==null&&!markerAxis(body.marker,pitch))continue;
    const known=!!previous.roles[color(o,body.ink)];
    if(!known&&body.marker===null)continue;
    const phase:Point=[x%pitch,y%pitch], id=JSON.stringify([phase,body.floor]);
    const lattice=lattices.get(id)??{shape:{pitch,phase,mask,inks:[],floor:body.floor,backing},marked:0,known:0};
    lattice.shape.inks.push(body.ink);
    if(body.marker!==null)lattice.marked++;
    if(known)lattice.known++;
    lattices.set(id,lattice);
  }
  const distinct=[...lattices.values()].filter(({shape,known})=>known>0&&new Set(shape.inks).size===shape.inks.length);
  const selected=distinct.filter(({marked})=>marked===1);
  const matches=selected.length?selected:distinct.filter(({shape,marked})=>marked===0&&shape.inks.length===1);
  if(matches.length===1){
    const shape=matches[0]!.shape;
    shape.inks.sort((a,b)=>a-b);
    return shape;
  }
}

function diagonalAperture(pixels: number[], pitch: number, floor: number,
  overlay: readonly number[] = [], pressureInk?:number): Point[] | null {
  for (const side of [-1,1]) for (const reflection of [-1,1]) {
    const groups = [new Set<number>(),new Set<number>(),new Set<number>()];
    for (const [index,value] of pixels.entries()) {
      if(overlay.includes(index))continue;
      const x = index%pitch, y = Math.floor(index/pitch);
      const signed = (reflection===1?x-y:pitch-1-x-y)*side;
      groups[Math.sign(signed)+1]!.add(signed>0&&value===pressureInk?floor:value);
    }
    if (groups.some(group=>group.size!==1) || !groups[2]!.has(floor)
      || groups[0]!.has(floor) || groups[1]!.has(floor) || pressureInk!==undefined&&(groups[0]!.has(pressureInk)||groups[1]!.has(pressureInk))
      || [...groups[0]!].some(x=>groups[1]!.has(x))) continue;
    return [[reflection*side,0],[0,-side]];
  }
  return null;
}

function decode(rows: NativeRows, shape: Shape, history: History): Scene | null {
  const {pitch,phase,mask,floor,inks} = shape, actors: Actor[] = [], tiles = new Map<Cell,Tile>();
  const solidColors = new Map<number,Cell[]>();
  const mid = Math.floor(pitch*pitch/2);
  const pressureCorners=[0,pitch-1,pitch*(pitch-1),pitch*pitch-1];
  for(let y=phase[1];y+pitch<=rows.length;y+=pitch) for(let x=phase[0];x+pitch<=rows[0]!.length;x+=pitch){
    const cell = key([(x-phase[0])/pitch,(y-phase[1])/pitch]), pixels=readTile(rows,x,y,pitch);
    const marked=history.plates.includes(cell)||history.supports[cell]||history.platformField?.bindings[encode(cell)]||history.hydraulic?.bindings[encode(cell)];
    const body=motif(pixels,mask,marked?floor:undefined);
    const uniform=pixels.every(value=>value===pixels[0]);
    if(body && inks.includes(body.ink)) actors.push({ink:body.ink,cell,marker:body.marker});
    const edge = pixels.filter((_,i)=>i%pitch===0 || i%pitch===pitch-1 || i<pitch || i>=pitch*(pitch-1));
    // A preview can cover a switch and retain its original centre pigment.
    const overlay=history.projectionInk!==undefined&&edge.every(value=>value===history.projectionInk);
    const object=!overlay&&!uniform && edge.every(value=>value===edge[0]) && edge[0]!==floor && pixels[mid]!==edge[0] && pixels[mid]!==floor;
    const corners=pressureCorners.map(index=>pixels[index]!);
    const rim=corners.find(ink=>corners.filter(other=>other===ink).length>=3);
    const pressureOverlay=history.plates.includes(cell)&&corners.includes(history.switches[cell]!)
      &&rim!==undefined&&rim!==floor;
    const mirror=!body&&!object&&!uniform
      ?diagonalAperture(pixels,pitch,floor)??(pressureOverlay?diagonalAperture(pixels,pitch,floor,pressureCorners,rim):null):null;
    const onBoard=pixels.filter(value=>value===floor).length;
    const plate=!mirror&&!object && (!body||body.marker===mid) && onBoard>=pixels.length-mask.length
      && mask.every(index=>pixels[index]!==floor)
      && pixels.filter((_,i)=>!mask.includes(i)).every(value=>value===floor);
    const gateProjection=!!history.gates[cell]&&history.projectionInk!==undefined&&mask.every(index=>pixels[index]===history.projectionInk);
    const preview=overlay||gateProjection||!!(body && !inks.includes(body.ink) && body.marker===null && (body.floor===floor||history.goals.includes(cell)));
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
  if(!active.length&&actors.length===1&&inks.length===1)active.push(actors[0]!);
  if(actors.length!==inks.length || active.length!==1 || new Set(actors.map(a=>a.ink)).size!==inks.length) return null;
  const repeated=[...solidColors.values()].filter(cells=>cells.length===actors.length);
  const outlines=repeated.filter(cells=>cells.some(cell=>!tiles.get(cell)?.uniform));
  const soloGoal=history.goalInk===undefined?undefined:solidColors.get(history.goalInk);
  const candidateGoals=actors.length===1?(soloGoal?.length===1?[soloGoal]:[])
    :outlines.length?outlines:repeated.filter(cells=>distance(cells[0]!,cells[1]!)>1);
  const goals=history.goals.length ? history.goals : candidateGoals.length===1 ? candidateGoals[0]! : [];
  const grouped=actors.length===1?candidateGoals:repeated.filter(group=>group.some(cell=>!tiles.get(cell)?.uniform)
    ||distance(group[0]!,group[1]!)>1);
  const destinationGroups=history.destinationGroups??grouped;
  const gateMarks=[...tiles.values()].filter(tile=>tile.gate&&!tile.gate.open)
    .map(tile=>({frame:tile.pixels[0]!,accent:tile.gate!.accent}));
  const corners=[0,pitch-1,pitch*(pitch-1),pitch*pitch-1];
  for(const [cell,tile] of tiles){
    if(tile.uniform||tile.plate||tile.gate||tile.preview||tile.mirror||actors.some(actor=>actor.cell===cell))continue;
    const pigments=corners.map(i=>tile.pixels[i]!);
    const match=gateMarks.find(({frame,accent})=>accent!==frame&&pigments.filter(ink=>ink===frame).length===3&&pigments.includes(accent));
    if(match)tile.plateAccent=match.accent;
  }
  const plates=[...new Set([...history.plates,...[...tiles].filter(([,tile])=>tile.plateAccent!==null).map(([cell])=>cell)])];
  if(history.cargoPattern)for(const cell of plates){
    const tile=tiles.get(cell)!;
    if(!tile.plate&&!tile.preview&&!tile.mirror&&!actors.some(actor=>actor.cell===cell)
      && inset(tile.pixels,pitch)===history.cargoPattern)tile.object=true;
  }
  return {actors,active:active[0]!,tiles,goals,plates,destinationGroups};
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

function walks(scene: Scene, h: History, actor: Actor, bodies?:ReadonlySet<Cell>): Map<Cell,Path> {
  const start = {cell:actor.cell,route:[]};
  const paths = new Map<Cell,Path>([[actor.cell,start]]);
  for (const {cell,route} of paths.values()) for (const direction of observedDirections(h,actor.ink)) {
    const dest=next(cell,direction.axis), tile=scene.tiles.get(dest);
    const rear=next(cell,[-direction.axis[0],-direction.axis[1]]);
    if(h.roles[actor.ink]?.pull&&(bodies?.has(rear)||portable(scene.tiles.get(rear))||scene.actors.some(peer=>peer.ink!==actor.ink&&peer.cell===rear)))continue;
    if (paths.has(dest) || !tile || bodies?.has(dest) || tile.object || tile.mirror || scene.actors.some(a=>a.cell===dest)
      || !tile.plate&&tile.plateAccent!==null
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

function controlRay(scene: Scene,h: History,source: Cell,reflector: Cell,arms: Point[]): Cell | undefined {
  for(const [incoming,outgoing] of [[arms[0]!,arms[1]!],[arms[1]!,arms[0]!]] as const){
    const span=distance(source,reflector);
    if(!span||key([point(reflector)[0]+incoming[0]*span,point(reflector)[1]+incoming[1]*span])!==source)continue;
    const destination=key([point(reflector)[0]+outgoing[0]*span,point(reflector)[1]+outgoing[1]*span]);
    const lane=rays(reflector,source,destination,arms)!;
    if(lane.some(cell=>{
      if(cell===source)return false;
      const tile=scene.tiles.get(cell);
      return background(tile,h.shape!)||portable(tile)||tile?.gate?.open===false||scene.actors.some(actor=>actor.cell===cell)
        || tile?.plateAccent!==null&&!tile?.plate;
    }))continue;
    const target=scene.tiles.get(destination);
    if(target?.passable||target?.uniform||supported(scene,h,destination)||scene.goals.includes(destination))return destination;
  }
}

function observedProjection(scene: Scene,h: History,cell:Cell) {
  const tile=scene.tiles.get(cell);
  // Reflections can outline a non-actor subject while leaving the substrate at the centre.
  return !!tile?.preview&&h.projectionInk!==undefined
    && (tile.pixels[0]===h.projectionInk||tile.pixels[Math.floor(tile.pixels.length/2)]===h.projectionInk);
}

function controlProjectionAgrees(scene: Scene,h: History,transfer: ControlTransfer) {
  return !!scene.tiles.get(transfer.reflector)?.mirror && tileKey(scene.tiles.get(transfer.source))===transfer.subject
    && transfer.gates.every(cell=>scene.tiles.get(cell)?.gate?.open===false)
    && observedProjection(scene,h,transfer.destination)
    && ![...scene.tiles.keys()].some(cell=>cell!==transfer.destination&&observedProjection(scene,h,cell));
}

function releasedPressure(scene: Scene,transfer: ControlTransfer) {
  const source=scene.tiles.get(transfer.source);
  return source?.plate===true&&source.plateAccent===transfer.mark
    && transfer.gates.some(cell=>scene.tiles.get(cell)?.gate?.open===true);
}

function releaseBlockedControl(scene: Scene,h: History): Offer | undefined {
  if(!h.trigger||h.projectionInk===undefined||!h.transfer?.gateReaction)return;
  const reflectors=[...scene.tiles].filter(([,tile])=>tile.mirror);
  if(!reflectors.length)return;
  const offers:Offer[]=[];
  const paths=scene.actors.map(actor=>walks(scene,h,actor));
  for(const [source,tile] of scene.tiles){
    const mark=tile.plateAccent;
    if(mark===null||tile.plate||tile.preview||scene.actors.some(actor=>actor.cell===source))continue;
    const gates=[...scene.tiles].filter(([,t])=>t.gate?.accent===mark&&t.gate.open===false).map(([cell])=>cell);
    if(!gates.length)continue;
    for(const [reflector,mirror] of reflectors){
      const arms=mirror.mirror!,subject=tileKey(tile),destination=controlRay(scene,h,source,reflector,arms);
      if(destination){
        const effect={source,destination,reflector,mark,subject,gates};
        const test=JSON.stringify(['release_control',effect]);
        if(!h.guarded.includes(test)&&controlProjectionAgrees(scene,h,effect)){
          const actor=scene.active;
          offers.push(atOpportunity(scene,h,actor,[{action:command(h.trigger),actor:actor.ink,from:actor.cell,controlTransfer:effect}],
            'transfer_subject_off_linked_control',1000,test,source));
        }
      }
      for(const [index,actor] of scene.actors.entries()){
        if(!(h.roles[actor.ink]?.capacity&&h.roles[actor.ink]!.capacity>=1))continue;
        for(const dir of observedDirections(h,actor.ink)){
          const [dx,dy]=dir.axis, stance=next(reflector,[-dx,-dy]), route=paths[index]!.get(stance)?.route;
          if(!route)continue;
          const pushes:Step[]=[];
          for(let anchor=reflector,from=stance;pushes.length<16;from=anchor,anchor=next(anchor,dir.axis)){
            const landing=next(anchor,dir.axis), target=scene.tiles.get(landing);
            if(!target?.passable||target.plateAccent!==null||target.gate||portable(target)
              ||scene.actors.some(peer=>peer.cell===landing)||scene.goals.includes(landing))break;
            pushes.push({action:command(dir.action),actor:actor.ink,from,to:anchor,reflectorMove:{from:anchor,to:landing}});
            const projected=controlRay(scene,h,source,landing,arms);
            if(!projected)continue;
            const test=JSON.stringify(['align_control',source,subject,reflector,landing]);
            if(h.guarded.includes(test))continue;
            offers.push(atOpportunity(scene,h,actor,[...route,...pushes],'align_reflector_with_occupied_control',
              800-route.length-pushes.length*2,test,source));
            break;
          }
        }
      }
    }
  }
  return offers.sort((a,b)=>b.score-a.score||a.steps.length-b.steps.length)[0];
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
          add(controller,[{...route[0]!,clearLinkedObstruction:blocker}],'verify_gate_release_on_blocking_object',720,test,blocker);
        }
      }
    }
  }
  return offers.sort((a,b)=>b.score-a.score)[0];
}


function loadCells(scene: Scene): Cell[] {
  return [...scene.tiles].filter(([,tile])=>tile.object).map(([cell])=>cell).sort();
}

function matchesSupport(scene:Scene,h:History,o:NativeObservation,cell:Cell) {
  const pattern=h.transfer?.support?.pattern, tile=scene.tiles.get(cell);
  return !!pattern&&!!tile&&pattern.length===tile.pixels.length
    &&tile.pixels.every((ink,i)=>color(o,ink)===pattern[i]);
}

function pressureHeld(scene: Scene, cell: Cell) {
  return scene.actors.some(actor=>actor.cell===cell)||portable(scene.tiles.get(cell));
}

type PressureOutcome = 'actor'|'load'|'either'|'release';
const pressureStepKey=(actor:number,from:Cell,action:string,loads:Cell[],tile:Tile|undefined)=>
  JSON.stringify(['pressure_step',actor,from,action,loads,tileKey(tile)]);

function pressureRoute(scene:Scene,h:History,o:NativeObservation,actor:Actor,target:Cell,
  outcome:PressureOutcome,reserve:readonly Cell[],clear:readonly Cell[]):Step[] | undefined {
  const original=loadCells(scene), peers=new Set(scene.actors.filter(peer=>peer!==actor).map(peer=>peer.cell));
  const directions=observedDirections(h,actor.ink), capacity=h.roles[actor.ink]?.capacity??0;
  const reachable=(cell:Cell,foundations:readonly Cell[])=>{
    const tile=scene.tiles.get(cell);
    return !peers.has(cell) && !tile?.mirror && (!tile?.gate||tile.gate.open)
      && (tile?.passable||original.includes(cell)||scene.goals.includes(cell)||scene.plates.includes(cell)
        ||supported(scene,h,cell)||foundations.includes(cell)||cell===actor.cell);
  };
  const medium=(cell:Cell)=>{
    const tile=scene.tiles.get(cell);
    return tile?.uniform && color(o,tile.pixels[0]!)===h.transfer?.support?.medium;
  };
  const solutions=(allowLoss:boolean)=>{
    const start={at:actor.cell,loads:original,foundations:[] as Cell[],steps:[] as Step[]};
    const queue=[start], known=new Set([JSON.stringify([start.at,start.loads,start.foundations])]);
    for(const {at,loads,foundations,steps} of queue){
      const occupiedByActor=at===target, occupiedByLoad=loads.includes(target);
      const satisfied=outcome==='release'?!occupiedByActor&&!occupiedByLoad
        :outcome!=='load'&&occupiedByActor||outcome!=='actor'&&occupiedByLoad;
      if(steps.length&&satisfied&&clear.every(cell=>at!==cell&&!loads.includes(cell)&&!peers.has(cell)))return steps;
      if(steps.length>=24||queue.length>=2500)continue;
      for(const dir of directions){
        const dest=next(at,dir.axis);
        if(!reachable(dest,foundations))continue;
        if(h.guarded.includes(pressureStepKey(actor.ink,at,dir.action,loads,scene.tiles.get(dest))))continue;
        let shifted=loads;
        let support:Cell|undefined;
        if(loads.includes(dest)){
          const row: Cell[]=[];
          let end=dest;
          while(loads.includes(end)&&row.length<=capacity){row.push(end);end=next(end,dir.axis);}
          if(row.length>capacity||row.some(cell=>reserve.includes(cell))||peers.has(end))continue;
          const sink=!reachable(end,foundations);
          if(sink&&(!allowLoss||!medium(end)||loads.length<=reserve.length))continue;
          if(sink)support=end;
          shifted=loads.filter(cell=>!row.includes(cell));
          shifted.push(...row.map(cell=>next(cell,dir.axis)).filter(cell=>!sink||cell!==end));
          shifted.sort();
        }
        const nextFoundations=support?[...foundations,support].sort():foundations;
        const signature=JSON.stringify([dest,shifted,nextFoundations]);
        if(known.has(signature))continue;
        known.add(signature);
        const step:Step={action:command(dir.action),from:at,to:dest,actor:actor.ink,
          loads:{from:loads,to:shifted,...(support?{support}:{})}};
        queue.push({at:dest,loads:shifted,foundations:nextFoundations,steps:[...steps,step]});
      }
    }
  };
  return solutions(false)??solutions(true);
}

function hasIndependentRelayControls(scene:Scene,h:History) {
  return !!h.trigger&&!!h.transfer?.support&&!!h.transfer.gateReaction&&scene.plates.length>1
    && scene.plates.every(cell=>h.switches[cell]!==undefined)
    && new Set(scene.plates.map(cell=>h.switches[cell])).size===scene.plates.length
    && [...scene.tiles.values()].filter(tile=>tile.mirror).length===1
    && Object.values(h.gates).some(gate=>scene.plates.some(cell=>h.switches[cell]===gate.accent));
}

function prepareRelayControls(scene:Scene,h:History,o:NativeObservation):Offer|undefined{
  if(!hasIndependentRelayControls(scene,h)||h.relayField)return;
  const reserve=scene.plates.filter(cell=>scene.tiles.get(cell)?.object);
  const offers:Offer[]=[];
  for(const cell of scene.plates){
    if(h.releasedControls?.[cell]||reserve.includes(cell))continue;
    const trial=h.controlTrials?.[cell];
    const closed=Object.values(h.gates).some(gate=>gate.accent===h.switches[cell]&&!gate.open);
    if(!closed&&trial&&!pressureHeld(scene,cell))continue;
    for(const actor of scene.actors){
      let route:Step[]|undefined,kind:string,rank:number;
      if(actor.cell===cell){
        route=[...walks(scene,h,actor).values()].filter(path=>path.route.length===1&&!scene.plates.includes(path.cell))
          .sort((a,b)=>Math.min(...scene.goals.map(goal=>distance(a.cell,goal)))-Math.min(...scene.goals.map(goal=>distance(b.cell,goal))))[0]?.route;
        kind='release_tested_relay_control';
        rank=980;
      }else if(pressureHeld(scene,cell)){
        continue;
      }else if(closed&&trial?.opens!==false){
        route=pressureRoute(scene,h,o,actor,cell,'load',reserve,[]);
        kind='hold_relay_gate_with_observed_load';
        rank=920;
      }else if(!trial){
        route=walks(scene,h,actor).get(cell)?.route;
        kind='test_reachable_relay_control';
        rank=850;
      }else continue;
      if(!route?.length)continue;
      const checkpoint=route.findIndex(step=>step.to!==cell&&scene.plates.includes(step.to!)
        ||step.loads?.to.some(load=>load!==cell&&scene.plates.includes(load)&&!step.loads!.from.includes(load)));
      const steps=checkpoint<0?route:route.slice(0,checkpoint+1);
      offers.push(atOpportunity(scene,h,actor,steps,kind,rank-route.length-(scene.active.ink===actor.ink?0:1),JSON.stringify([kind,actor.ink,cell]),cell));
    }
  }
  return offers.sort((a,b)=>b.score-a.score)[0];
}

function openRelayControls(scene:Scene,h:History) {
  if(!hasIndependentRelayControls(scene,h))return;
  const gates=Object.entries(h.gates);
  if(gates.some(([cell,gate])=>!scene.tiles.get(cell)?.gate?.open
    ||!scene.plates.some(plate=>h.switches[plate]===gate.accent)))return;
  const heldLoadControls:number[]=[],unoccupiedControls:number[]=[];
  for(const cell of scene.plates){
    const tile=scene.tiles.get(cell);
    if(tile?.object&&h.controlTrials?.[cell]?.opens)heldLoadControls.push(encode(cell));
    else if(tile?.plate&&(h.controlTrials?.[cell]||h.releasedControls?.[cell]))unoccupiedControls.push(encode(cell));
    else return;
  }
  return {heldLoadControls,unoccupiedControls};
}

function linkedTransport(scene:Scene,h:History,o:NativeObservation):Offer|undefined{
  if(!h.transfer?.gateReaction||!h.trigger||scene.goals.length!==scene.actors.length)return;
  const mirrors=[...scene.tiles].filter(([,tile])=>tile.mirror);
  if(mirrors.length<2)return;
  const groups=new Map<number,Cell[]>();
  for(const cell of scene.plates){
    const accent=h.switches[cell];
    if(accent===undefined)continue;
    const group=groups.get(accent)??[];
    group.push(cell);
    groups.set(accent,group);
  }
  for(const [accent,plates] of groups){
    const barriers=Object.entries(h.gates).filter(([,gate])=>gate.accent===accent).map(([cell])=>cell);
    if(plates.length<scene.actors.length||barriers.length<scene.actors.length)continue;
    const region=new Set(scene.goals);
    for(const cell of region)for(const axis of cardinal){
      const dest=next(cell,axis),tile=scene.tiles.get(dest);
      if(!tile||region.has(dest)||barriers.includes(dest)||tile.mirror
        || !(tile.passable||tile.gate||tile.object||supported(scene,h,dest)||scene.actors.some(actor=>actor.cell===dest)))continue;
      region.add(dest);
    }
    if(scene.actors.every(actor=>region.has(actor.cell)))continue;
    const onExitSide=(actor:Actor)=>region.has(actor.cell);
    const choices=mirrors.map(([mirror,tile])=>plates.flatMap(stance=>[...region].flatMap(destination=>{
      const ray=rays(mirror,stance,destination,tile.mirror!);
      if(!ray||!ray.some(cell=>barriers.includes(cell))||ray.some(cell=>background(scene.tiles.get(cell),h.shape!)))return [];
      return [{stance,destination,ray}];
    })));
    const pairs=choices.flatMap((one,i)=>choices.slice(i+1).flatMap(two=>
      one.flatMap(a=>two.filter(b=>b.stance!==a.stance&&b.destination!==a.destination).map(b=>[a,b]))));
    const offers:Offer[]=[];
    const reserve=plates.filter(cell=>scene.tiles.get(cell)?.object);
    const add=(actor:Actor,target:Cell,kind:string,score:number,outcome:PressureOutcome,clear:Cell[]=[]):boolean=>{
      if(outcome==='release'&&!scene.tiles.get(target)?.object&&actor.cell!==target)return false;
      const route=pressureRoute(scene,h,o,actor,target,outcome,reserve,clear);
      if(!route?.length)return false;
      // Close the prefix where a different circuit could have changed the topology.
      const waypoints=new Set(scene.plates.filter(cell=>cell!==target));
      const firstChange=route.findIndex(step=>waypoints.has(step.from)||waypoints.has(step.to!)
        ||step.loads?.to.some(cell=>waypoints.has(cell)&&!step.loads!.from.includes(cell)));
      const steps=firstChange<0?route:route.slice(0,firstChange+1);
      offers.push(atOpportunity(scene,h,actor,steps,kind,score-route.length,JSON.stringify([kind,actor.ink,target]),target));
      return true;
    };
    const joint=pairs.flatMap(pair=>[pair,[...pair].reverse()]).sort((a,b)=>
      scene.actors.reduce((total,actor,i)=>total+distance(actor.cell,a[i]!.stance)-distance(actor.cell,b[i]!.stance),0))[0];
    const spare=joint?plates.filter(cell=>!joint.some(stage=>stage.stance===cell)):plates;
    for(const actor of scene.actors.filter(actor=>!onExitSide(actor))){
      for(const cell of spare.filter(cell=>!pressureHeld(scene,cell))){
        // With the alignment still occluded, commit only a nearby persistent weight.
        if(joint||distance(actor.cell,cell)<=2)add(actor,cell,'place_weight_for_shared_gate',900,'load');
      }
      for(const cell of scene.plates.filter(cell=>!plates.includes(cell)&&!pressureHeld(scene,cell)&&!h.triedPlates?.includes(cell))){
        add(actor,cell,'test_independent_pressure_before_transport',850,'either');
      }
    }
    if(joint){
      const auxiliaryGates=joint.flatMap(stage=>stage.ray).map(cell=>scene.tiles.get(cell)?.gate)
        .filter(gate=>gate&&!gate.open&&gate.accent!==accent);
      const release=[...new Set(auxiliaryGates.flatMap(gate=>groups.get(gate!.accent)??[]))].filter(cell=>pressureHeld(scene,cell));
      const expectedActors=scene.actors.map((actor,i)=>({ink:actor.ink,from:joint[i]!.stance,to:joint[i]!.destination}));
      if(expectedActors.every(effect=>scene.actors.some(actor=>actor.ink===effect.ink&&actor.cell===effect.from)
          && scene.tiles.get(effect.to)?.preview)){
        return {ink:scene.active.ink,steps:[{action:command(h.trigger),actor:scene.active.ink,from:scene.active.cell,expectedActors}],
          kind:'execute_joint_transport_through_observed_open_gates',score:1100};
      }
      for(const [index,actor] of scene.actors.entries()){
        if(onExitSide(actor)||actor.cell===joint[index]!.stance)continue;
        const local=release.filter(cell=>pressureHeld(scene,cell)&&!scene.actors.some(peer=>peer!==actor&&peer.cell===cell)
          && distance(cell,actor.cell)<distance(cell,scene.actors.find(peer=>peer!==actor)!.cell));
        if(!add(actor,joint[index]!.stance,'prepare_actor_and_load_path_to_linked_control',800,'actor',local))
          for(const cell of local)add(actor,cell,'release_auxiliary_control_blocking_transfer',750,'release');
      }
    }
    const offer=offers.sort((a,b)=>b.score-a.score)[0];
    if(offer)return offer;
  }
}

const arrangementKey=(roster:readonly {ink:number;cell:Cell}[])=>
  JSON.stringify([...roster].sort((a,b)=>a.ink-b.ink).map(actor=>[actor.ink,actor.cell]));

function arrangeActors(scene:Scene,h:History):Offer|undefined{
  const candidates=scene.destinationGroups.filter(group=>group.length===scene.actors.length);
  if(scene.actors.length<2||!candidates.length||scene.actors.some(actor=>!observedDirections(h,actor.ink).length))return;
  const goals=new Set(candidates.flat()), occupants=new Set(scene.actors.map(actor=>actor.cell));
  const floor=(cell:Cell)=>{
    const tile=scene.tiles.get(cell);
    return !!tile&&!portable(tile)&&tile.gate?.open!==false
      &&(tile.passable||goals.has(cell)||occupants.has(cell)||supported(scene,h,cell));
  };
  const roster=scene.actors.map(({ink,cell})=>({ink,cell}));
  type Placement={roster:typeof roster;active:number;steps:Step[]};
  const pending:Placement[][]=[[{roster,active:scene.active.ink,steps:[]}]];
  const stateKey=(positions:typeof roster,active:number)=>JSON.stringify([arrangementKey(positions),active]);
  const seen=new Map([[stateKey(roster,scene.active.ink),0]]);
  let inspected=0;
  for(let cost=0;cost<pending.length&&inspected<6400;cost++)for(const current of pending[cost]??[]){
    if(seen.get(stateKey(current.roster,current.active))!==cost)continue;
    if(++inspected>6400)return;
    const group=candidates.find(cells=>current.roster.every(actor=>cells.includes(actor.cell)));
    if(current.steps.length&&group&&!h.arrangements?.[arrangementKey(current.roster)]){
      const ink=current.steps[0]!.actor;
      const actor=scene.actors.find(part=>part.ink===ink)!;
      const boundary=current.steps.findIndex(step=>step.actor!==ink);
      const steps=boundary<0?current.steps:current.steps.slice(0,boundary);
      return {...atOpportunity(scene,h,actor,steps,'test_complete_destination_arrangement',960-steps.length,
        arrangementKey(current.roster),steps.at(-1)!.to!),destinations:group};
    }
    for(const [index,actor] of current.roster.entries())for(const motor of observedDirections(h,actor.ink)){
      const to=next(actor.cell,motor.axis);
      if(!floor(to)||current.roster.some(peer=>peer.cell===to))continue;
      if(h.roles[actor.ink]?.pull){
        const rear=next(actor.cell,[-motor.axis[0],-motor.axis[1]]);
        if(portable(scene.tiles.get(rear))||current.roster.some(peer=>peer.cell===rear))continue;
      }
      const moved=current.roster.map((part,id)=>id===index?{ink:part.ink,cell:to}:part);
      const key=stateKey(moved,actor.ink), nextCost=cost+1+Number(actor.ink!==current.active);
      if((seen.get(key)??Infinity)<=nextCost)continue;
      seen.set(key,nextCost);
      (pending[nextCost]??=[]).push({roster:moved,active:actor.ink,steps:[...current.steps,
        {action:command(motor.action),actor:actor.ink,from:actor.cell,to,roster:current.roster}]});
    }
  }
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
        const knownMedium=medium&&isKnownMedium(landing,h,o);
        const supportAccess=knownMedium&&bestKnown&&bestKnown.capacity>=count
          &&opensAccessByPush(scene,h,actor,cargo,end)?end:undefined;
        if(knownMedium&&!supportAccess)continue;
        const continues=h.lastPush?.ink===actor.ink&&h.lastPush.direction===direction.action&&h.lastPush.object===cargo;
        const probe=!bestKnown?.contact;
        const guide=aim(cargo)-aim(end);
        if(!probe && !pressure && !medium && !continues && guide<=0) continue;
        const relevance=probe?90:0;
        add([...route,{action:command(direction.action),from:cell,actor:actor.ink,tile:tileKey(tile),
          ...(supportAccess?{supportAccess,to:cargo,probeLanding:{cell:end,glyph:tileKey(landing)}}:{})}],
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
          const stalledStance=[actor.ink,cell].join(',');
          if(h.recoveredCycles?.some(cycle=>cycle.some(pose=>pose.split('|').includes(stalledStance))))continue;
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
  floor: number[]; water: number[]; waterInks: Record<number,number>; plate: number|null; gates: RelayModel['gates']; arms: number[][]; goals: number[];
  unoccupiedControls?: number[];
  heldLoadControls?: number[];
  finishAtPlate?:boolean;
  learnedMobility?:boolean;
  linkedControls?:boolean;
  subjectPatterns?:{glyph:string;interior:string}[];
  settleSubjectOnControl?:boolean;
  keepSubjectOnControl?:boolean;
  experimentControls?:number[];
  platforms?:RelayPlatform[];
};
const encode=(cell:Cell)=>{const [x,y]=point(cell);return x+y*64;};
const decodeCell=(cell:number)=>key([cell%64,Math.floor(cell/64)]);
const toAxis=([x,y]:Point)=>x+y*64;
const sorted=(cells:number[])=>cells.sort((a,b)=>a-b);

function relayReflectors(scene:Scene){
  return [...scene.tiles].flatMap(([cell,tile])=>tile.mirror?[{cell:encode(cell),arms:tile.mirror.map(toAxis)}]:[])
    .sort((a,b)=>a.arms[0]!-b.arms[0]!||a.arms[1]!-b.arms[1]!||a.cell-b.cell);
}

function observedObjects(scene:Scene,h:History,o:NativeObservation):ObservedObject[]{
  const {floor,backing}=h.shape!,surface=h.transfer?.support;
  const substrate=new Set([color(o,floor),color(o,backing),surface?.medium]);
  const actors=new Set(scene.actors.map(actor=>actor.cell));
  const objects:ObservedObject[]=[];
  for(const [cell,tile] of scene.tiles){
    const glyph=tileKey(tile);
    if(actors.has(cell)){objects.push({cell,glyph,kind:'actor'});continue;}
    if(tile.gate||tile.plate||observedProjection(scene,h,cell)||supported(scene,h,cell)
      ||surface&&tile.pixels.every((ink,index)=>color(o,ink)===surface.pattern[index]))continue;
    if(tile.mirror||tile.object){objects.push({cell,glyph,kind:tile.mirror?'reflector':'load'});continue;}
    if(tile.pixels.some(ink=>!substrate.has(color(o,ink))))objects.push({cell,glyph,kind:'undetermined'});
  }
  return objects;
}

function isRelaySubject(scene:Scene,field:Pick<RelayField,'subjectPatterns'>,cell:Cell,tile:Tile,pitch:number){
  if(tile.preview||tile.gate||tile.plate||tile.mirror||scene.actors.some(actor=>actor.cell===cell))return false;
  return field.subjectPatterns?.some(pattern=>pattern.glyph===tileKey(tile)
    ||scene.plates.includes(cell)&&pattern.interior===inset(tile.pixels,pitch))??false;
}

type PlatformBinding = {frame:number;accent:number;active:boolean};
type PlatformField = Omit<PlatformRelayModel,'floor'|'water'> & {
  floor:number[]; water:number[]; bindings:Record<number,PlatformBinding>;
};

function platformGlyph(tile:Tile|undefined,pitch:number,medium:number,accent:number):PlatformBinding|undefined{
  if(!tile||tile.preview||tile.pixels[Math.floor(tile.pixels.length/2)]!==accent)return;
  const corners=[0,pitch-1,pitch*(pitch-1),pitch*pitch-1],frame=tile.pixels[0]!;
  if(frame===accent||frame===medium||corners.some(index=>tile.pixels[index]!==frame))return;
  const mid=Math.floor(tile.pixels.length/2);
  const sides=tile.pixels.filter((_,index)=>index!==mid&&!corners.includes(index));
  if(sides.every(color=>color===medium))return {frame,accent,active:false};
  if(sides.every(color=>color===frame))return {frame,accent,active:true};
}

function mediumInk(h:History,o:NativeObservation):number|undefined{
  const stored=h.transfer?.support?.medium;
  if(stored===undefined)return;
  const ink=o.palette?o.palette.indexOf(stored):Number(stored);
  return Number.isInteger(ink)&&ink>=0?ink:undefined;
}

function isKnownMedium(tile:Tile|undefined,h:History,o:NativeObservation){
  return !!tile?.uniform&&tile.pixels[0]===mediumInk(h,o);
}

const materialChoice=(o:NativeObservation,action:NativeCommand)=>JSON.stringify([o.frame_hash,action.action_ref,action.data]);

function supportOpensObjective(scene:Scene,h:History,newSupports:readonly Cell[],required:Cell){
  const points=[...scene.goals,...scene.plates];
  const mirrors=[...scene.tiles].filter(([,tile])=>tile.mirror);
  const supports={...h.supports};
  for(const cell of newSupports)supports[cell]=tileKey(scene.tiles.get(cell));
  const projected={...h,supports};
  for(const actor of scene.actors){
    const axes=observedDirections(h,actor.ink).map(direction=>direction.axis);
    const opportunities=[...points,...mirrors.flatMap(([cell])=>axes.map(axis=>next(cell,axis)))];
    const withSupport=walks(scene,projected,actor);
    if(!withSupport.has(required))continue;
    const withoutSupport=walks(scene,projected,actor,new Set([required]));
    for(const cell of withSupport.keys()){
      if(cell===required||withoutSupport.has(cell))continue;
      if(opportunities.includes(cell))return true;
      if(mirrors.some(([mirror,tile])=>{
        const landing=transferTarget(scene,cell,mirror,tile.mirror!);
        return landing&&(scene.goals.includes(landing)||scene.tiles.get(landing)?.passable||supported(scene,projected,landing));
      }))return true;
    }
  }
  return false;
}

function opensAccessByPush(scene:Scene,h:History,actor:Actor,cargo:Cell,destination:Cell){
  const tiles=new Map(scene.tiles);
  tiles.set(cargo,{...tiles.get(cargo)!,object:false,passable:true});
  const actors=scene.actors.map(peer=>peer.ink===actor.ink?{...peer,cell:cargo}:peer);
  return supportOpensObjective({...scene,tiles,actors},h,[destination],destination);
}

function unplannedMaterialLoss(h:History,step:Step,before:Scene,after:Scene,b:NativeObservation,a:NativeObservation){
  if(!h.transfer?.support)return false;
  const expected=step.relay?.after.supports??[];
  const unexpected=[...after.tiles.keys()].filter(cell=>{
    const at=encode(cell);
    return cell!==step.loads?.support&&cell!==step.supportAccess&&!expected.includes(at)
      &&(isKnownMedium(before.tiles.get(cell),h,b)||!!h.hydraulic?.bindings[at])
      &&!matchesSupport(before,h,b,cell)&&matchesSupport(after,h,a,cell);
  });
  if(!unexpected.length)return false;
  const prior=relayPose(before,h)?.loads.length??loadCells(before).length;
  const remaining=relayPose(after,h)?.loads.length??loadCells(after).length;
  if(remaining>=prior)return false;
  const obstruction=step.clearLinkedObstruction;
  if(obstruction&&unexpected.length===1&&prior-remaining===1&&distance(obstruction,unexpected[0]!)===1
    &&portable(before.tiles.get(obstruction))&&after.tiles.get(obstruction)?.gate
    &&pressureHeld(before,step.from)&&!pressureHeld(after,step.from))return false;
  // A controlled experiment may move a load remotely. Keep its new footing
  // only when it demonstrably opens an approach to another usable object or goal.
  const testedControl=step.circuitTrial!==undefined||step.pressureTrial!==undefined;
  return !testedControl||unexpected.some(cell=>!supportOpensObjective(after,h,unexpected,cell));
}

function observedPlatforms(scene:Scene,h:History,o:NativeObservation){
  const medium=mediumInk(h,o);
  if(medium===undefined)return;
  const marks=scene.plates.filter(cell=>h.switches[cell]!==undefined);
  if(new Set(marks.map(cell=>h.switches[cell])).size!==marks.length)return;
  const bindings:PlatformField['bindings']={}, platforms:PlatformField['platforms']=[];
  const candidates=marks.flatMap(control=>[...scene.tiles].flatMap(([cell,tile])=>{
    if(cell===control||scene.plates.includes(cell))return [];
    const glyph=platformGlyph(tile,h.shape!.pitch,medium,h.switches[control]!);
    return glyph?[{cell,control,glyph}]:[];
  }));
  const frames=new Set(candidates.filter(candidate=>!candidate.glyph.active).map(candidate=>candidate.glyph.frame));
  for(const {cell,control,glyph} of candidates){
    if(!frames.has(glyph.frame))continue;
    const id=encode(cell);
    if(bindings[id])return;
    bindings[id]=glyph;
    platforms.push({cell:id,control:encode(control),activeWhenPressed:glyph.active===pressureHeld(scene,control)});
  }
  if(!platforms.length)return;
  return {bindings,platforms,medium};
}

function fieldWithPlatforms(scene:Scene,h:History,o:NativeObservation):{field:PlatformField;pose:PlatformPose}|undefined{
  if(scene.actors.length!==1||scene.goals.length!==1||!h.trigger||!h.transfer?.gateReaction)return;
  const observed=observedPlatforms(scene,h,o);
  if(!observed)return;
  const {bindings,platforms,medium}=observed;
  const floor:number[]=[],water:number[]=[],loads:number[]=[],reflectors:number[]=[],arms:number[][]=[];
  for(const [cell,tile] of scene.tiles){
    const id=encode(cell);
    if(bindings[id]){water.push(id);continue;}
    if(background(tile,h.shape!))continue;
    if(tile.object&&!tile.gate){
      loads.push(id);
      // An active platform can have the same outline as a load. Learn from
      // the remaining tiles once the linked platform marks have been bound.
      if(!h.cargoPattern)h.cargoPattern=inset(tile.pixels,h.shape!.pitch);
    }
    if(tile.mirror){reflectors.push(id);arms.push(tile.mirror.map(toAxis));}
    if(matchesSupport(scene,h,o,cell)){
      h.supports[cell]=tileKey(tile);
      floor.push(id);
    }else if(tile.uniform&&tile.pixels[0]===medium||tile.preview&&tile.pixels[Math.floor(tile.pixels.length/2)]===medium){
      water.push(id);
    }else if(!tile.gate&&(tile.passable||portable(tile)||scene.plates.includes(cell)||scene.goals.includes(cell)||scene.active.cell===cell)){
      floor.push(id);
    }
  }
  if(!reflectors.length)return;
  const pose={actor:encode(scene.active.cell),loads:sorted(loads),reflectors};
  const field={floor,water,platforms,arms,bindings,trigger:h.trigger,goal:encode(scene.goals[0]!),
    capacity:h.roles[scene.active.ink]?.capacity??0,
    moves:observedDirections(h,scene.active.ink).map(dir=>({action:dir.action,axis:toAxis(dir.axis)}))};
  return {field,pose};
}

function platformAgreement(scene:Scene,h:History,o:NativeObservation,field:PlatformField,pose:PlatformPose) {
  if(encode(scene.active.cell)!==pose.actor)return false;
  const loads:number[]=[],reflectors:Cell[]=[];
  for(const [cell,tile] of scene.tiles){
    const encoded=encode(cell);
    if(tile.object&&encoded!==pose.actor&&!field.bindings[encoded])loads.push(encoded);
    if(tile.mirror)reflectors.push(cell);
  }
  if(JSON.stringify(sorted(loads))!==JSON.stringify(pose.loads)||reflectors.length!==pose.reflectors.length)return false;
  if(!pose.reflectors.every((cell,i)=>{
    const arms=scene.tiles.get(decodeCell(cell))?.mirror;
    return arms&&arms.map(toAxis).every(axis=>field.arms[i]!.includes(axis));
  }))return false;
  const medium=mediumInk(h,o);
  if(medium===undefined)return false;
  return field.platforms.every(mark=>{
    if(mark.cell===pose.actor||pose.loads.includes(mark.cell)||pose.reflectors.includes(mark.cell))return true;
    const tile=scene.tiles.get(decodeCell(mark.cell)),bind=field.bindings[mark.cell]!;
    const glyph=platformGlyph(tile,h.shape!.pitch,medium,bind.accent);
    return glyph?.frame===bind.frame&&glyph.active===platformAvailable(mark,pose)
      || !!tile?.preview&&observedProjection(scene,h,decodeCell(mark.cell));
  });
}

async function platformOffer(scene:Scene,h:History,o:NativeObservation,remaining:number,execution?:NativeExecution):Promise<Offer|undefined>{
  if(scene.actors.length!==1)return;
  if(h.platformPlan?.length&&h.platformField&&!platformAgreement(scene,h,o,h.platformField,h.platformPlan[0]!.before)){
    delete h.platformPlan;
    delete h.platformField;
  }
  if(!h.platformPlan?.length){
    const current=fieldWithPlatforms(scene,h,o);
    if(!current)return;
    const {field,pose}=current;
    const position=JSON.stringify([pose,field.platforms]);
    if(h.platformChecked?.includes(position)||(h.platformChecked?.length??0)>=4)return;
    const model={...field,floor:new Set(field.floor),water:new Set(field.water)};
    const path=await planPlatformRelay(model,pose,{yieldControl:execution?.yieldControl??(async()=>{}),signal:execution?.signal});
    if(execution?.signal?.aborted)return;
    (h.platformChecked??=[]).push(position);
    if(!path?.length)return;
    h.platformPlan=path;
    h.platformField=field;
  }
  const steps:Step[]=[];
  for(const phase of h.platformPlan.slice(0,Math.min(16,remaining))){
    steps.push({action:command(phase.action),actor:scene.active.ink,from:decodeCell(phase.before.actor),
      to:decodeCell(phase.after.actor),platform:phase});
    if(phase.projected.length)break;
  }
  if(!steps.length)return;
  const effect=steps.at(-1)!.platform!;
  const loadsControl=effect.projected.some(cell=>h.platformField!.platforms.some(mark=>mark.control===cell&&effect.after.loads.includes(cell)));
  return {ink:scene.active.ink,steps,score:900,kind:loadsControl?'reflect_loads_onto_linked_controls':'compose_reflection_and_conditional_platform_access'};
}

function actorSwitch(scene:Scene,h:History,actor:Actor):Step {
  return {action:address(actor.cell,h.shape!),from:scene.active.cell,actor:scene.active.ink,select:actor.ink};
}

function atOpportunity(scene:Scene,h:History,actor:Actor,steps:Step[],kind:string,score:number,test:string,target:Cell):Offer {
  return {ink:actor.ink,steps:actor.ink===scene.active.ink?steps:[actorSwitch(scene,h,actor),...steps],kind,score,test,target};
}

function testObservedObjects(scene:Scene,h:History,o:NativeObservation,objects:readonly ObservedObject[]):Offer|undefined{
  const opportunities:Offer[]=[];
  const occupied=new Set(objects.map(object=>object.cell));
  const commands=h.available?.filter(ref=>ref!=='ACTION6')??[];
  for(const actor of scene.actors){
    if(actor.ink!==scene.active.ink&&h.guarded.includes(JSON.stringify([scene.active.ink,scene.active.cell,'ACTION6',actor.ink])))continue;
    const reachable=walks(scene,h,actor,occupied);
    const directions=observedDirections(h,actor.ink);
    for(const object of objects){
      if(object.cell===actor.cell)continue;
      for(const axis of cardinal){
        const stance=next(object.cell,axis), approach=reachable.get(stance);
        if(!approach)continue;
        for(const ref of commands){
          const motion=directions.find(dir=>dir.action===ref)?.axis;
          const toward=motion&&next(stance,motion)===object.cell;
          const away=motion&&next(stance,motion)===next(stance,axis);
          if(motion&&!toward&&!away)continue;
          const landing=motion?next(toward?object.cell:stance,motion):undefined;
          const tile=landing?scene.tiles.get(landing):undefined;
          if(motion&&(!landing||!tile||background(tile,h.shape!)||tile.gate?.open===false||occupied.has(landing)
            ||toward&&isKnownMedium(tile,h,o)||away&&!tile.passable&&!supported(scene,h,landing)))continue;
          const probeLanding=landing?{cell:landing,glyph:tileKey(tile)}:undefined;
          const test=JSON.stringify(['object_interaction',object.cell,object.glyph,actor.ink,stance,ref,probeLanding?.glyph??null]);
          if(h.guarded.includes(test))continue;
          const contact={action:command(ref),actor:actor.ink,from:stance,contact:object.cell,tile:object.glyph,
            ...(probeLanding?{probeLanding}:{})};
          opportunities.push(atOpportunity(scene,h,actor,[...approach.route,contact],'test_observed_object_interaction',
            45+(object.kind==='undetermined'?20:0)-approach.route.length,test,object.cell));
        }
      }
    }
  }
  return opportunities.sort((a,b)=>b.score-a.score||a.steps.length-b.steps.length)[0];
}

function reachableCompositions(scene:Scene,h:History,o:NativeObservation) {
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
        if(background(landing,h.shape!)||landing?.gate&&!landing.gate.open||isKnownMedium(landing,h,o)||scene.actors.some(a=>a.cell===last))continue;
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

function relayField(scene:Scene,h:History,o:NativeObservation,objects:readonly ObservedObject[]):RelayField|undefined {
  const traction=scene.actors.some(actor=>h.roles[actor.ink]?.pull);
  const pressureTrial=traction&&scene.plates.length===1;
  if(scene.goals.length!==2||!h.trigger&&!pressureTrial)return;
  const mirrors=relayReflectors(scene);
  if(!mirrors.length)return;
  const law=h.transfer?.support;
  const hydraulic=h.hydraulic;
  const observedGates=Object.entries(h.gates);
  const linkedControls=mirrors.length>1;
  if(linkedControls&&(!traction||!h.trigger||!h.transfer?.gateReaction||!law||!observedGates.length))return;
  const controlConstraints=openRelayControls(scene,h);
  const released=scene.plates.length>0&&observedGates.length>0&&scene.plates.every(cell=>h.releasedControls?.[cell])
    && observedGates.every(([cell,gate])=>scene.tiles.get(cell)?.gate?.open&&scene.plates.some(plate=>h.switches[plate]===gate.accent));
  const bridge=law&&(released||controlConstraints||scene.plates.length===0&&observedGates.length===0)
    && [...scene.tiles.values()].some(tile=>tile.uniform&&color(o,tile.pixels[0]!)===law.medium);
  const plate=hydraulic?decodeCell(hydraulic.platforms[0]!.control):bridge||linkedControls?null:scene.plates[0]??null;
  let gates:RelayField['gates']=[];
  if(linkedControls||hydraulic){
    for(const [cell,gate] of observedGates){
      const controls=scene.plates.filter(plate=>h.switches[plate]===gate.accent);
      const control=controls[0];
      if(controls.length!==1||control===undefined)return;
      const visible=scene.tiles.get(cell)?.gate;
      const prior=h.linkedGateRules?.[cell];
      const hidden=observedProjection(scene,h,cell)||scene.actors.some(actor=>actor.cell===cell)||portable(scene.tiles.get(cell));
      if(!visible&&(!hidden||prior?.control!==control)){
        if(hydraulic)continue;
        return;
      }
      const closedWhenPressed=visible?visible.open!==pressureHeld(scene,control):prior!.closedWhenPressed;
      (h.linkedGateRules??={})[cell]={control,closedWhenPressed};
      gates.push({cell:encode(cell),control:encode(control),closedWhenPressed});
    }
  }else if(pressureTrial&&plate!==null){
    const ink=h.switches[plate];
    const occupied=pressureHeld(scene,plate);
    gates=observedGates.filter(([,gate])=>gate.accent===ink)
      .map(([cell,gate])=>({cell:encode(cell),closedWhenPressed:gate.open!==occupied}));
  }else if((released||controlConstraints)&&bridge){
    gates=observedGates.map(([cell])=>({cell:encode(cell),closedWhenPressed:true}));
  }else if(!bridge){
    if(plate===null||scene.plates.length!==1||!h.transfer?.gateReaction)return;
    const ink=h.switches[plate];
    const occupied=scene.actors.some(a=>a.cell===plate)||portable(scene.tiles.get(plate));
    const linked=Object.entries(h.gates).filter(([,gate])=>gate.accent===ink);
    if(!linked.some(([,gate])=>gate.open)||!linked.some(([,gate])=>!gate.open))return;
    gates=linked.map(([cell,gate])=>({cell:encode(cell),closedWhenPressed:gate.open!==occupied}));
  }
  const floor:number[]=[],water:number[]=[];
  const waterInks:Record<number,number>={};
  const subjectPatterns=!hydraulic&&(linkedControls||plate!==null&&gates.some(gate=>!gate.closedWhenPressed))&&traction&&h.trigger
    ?[...new Map(objects.filter(object=>object.kind==='undetermined'&&!scene.goals.includes(object.cell)&&!scene.plates.includes(object.cell))
      .map(object=>[object.glyph,{glyph:object.glyph,interior:inset(scene.tiles.get(object.cell)!.pixels,h.shape!.pitch)}])).values()]:[];
  const experimentControls=linkedControls&&(subjectPatterns.length||h.circuitTrials)
    ?[...new Set(gates.flatMap(gate=>gate.control===undefined?[]:[gate.control]))]:[];
  for(const [cell,tile] of scene.tiles){
    const id=encode(cell);
    if(hydraulic?.bindings[id]){
      water.push(id);waterInks[id]=mediumInk(h,o)!;
      continue;
    }
    if(background(tile,h.shape!))continue;
    const observedMedium=(bridge||traction)&&law&&(tile.uniform||tile.preview)
      ?tile.pixels.find(ink=>color(o,ink)===law.medium):undefined;
    const knownSupport=(bridge||traction)&&law&&law.pattern.length===tile.pixels.length
      && tile.pixels.every((ink,i)=>color(o,ink)===law.pattern[i]);
    if(knownSupport||observedMedium!==undefined){
      const location=encode(cell);
      water.push(location);
      if(observedMedium!==undefined)waterInks[location]=observedMedium;
      if(knownSupport)h.supports[cell]=tileKey(tile);
    } else if(scene.goals.includes(cell)||scene.plates.includes(cell)||tile.gate||portable(tile)||tile.passable
      ||isRelaySubject(scene,{subjectPatterns},cell,tile,h.shape!.pitch)
      ||scene.actors.some(a=>a.cell===cell))floor.push(encode(cell));
    else if(tile.uniform&&!bridge){
      const location=encode(cell);
      water.push(location);
      waterInks[location]=tile.pixels[0]!;
    }
  }
  return {floor,water,waterInks,plate:plate===null?null:encode(plate),gates,arms:mirrors.map(mirror=>mirror.arms),goals:scene.goals.map(encode),
    ...(hydraulic?{platforms:hydraulic.platforms}:{}),
    ...(linkedControls?{linkedControls:true}:{}),
    ...(traction?{learnedMobility:true,...(!linkedControls&&pressureTrial&&!h.seenPlate&&!subjectPatterns.length?{finishAtPlate:true}:{})}:{}),
    ...(subjectPatterns.length?{subjectPatterns,...(plate!==null?{settleSubjectOnControl:true}:{})}:{}),
    ...(experimentControls.length?{experimentControls}:{}),
    ...(bridge&&controlConstraints?controlConstraints:released&&bridge?{unoccupiedControls:scene.plates.map(encode)}:{})};
}

function relayPose(scene: Scene,h:History):RelayState|undefined {
  if(!h.relayField)return;
  const field=h.relayField;
  const mirrors=relayReflectors(scene);
  if(mirrors.length!==field.arms.length||mirrors.some((mirror,i)=>mirror.arms.join(',')!==field.arms[i]!.join(',')))return;
  const reflectors=mirrors.map(mirror=>mirror.cell);
  const actors=h.shape!.inks.map(ink=>encode(scene.actors.find(a=>a.ink===ink)!.cell));
  const subjects=field.subjectPatterns?sorted([...scene.tiles].flatMap(([cell,tile])=>
    isRelaySubject(scene,field,cell,tile,h.shape!.pitch)?[encode(cell)]:[])):undefined;
  const loads=sorted([...scene.tiles].filter(([cell,tile])=>{
    const id=encode(cell),binding=h.hydraulic?.bindings[id];
    return tile.object&&!subjects?.includes(id)&&(!binding||!platformGlyph(tile,h.shape!.pitch,field.waterInks[id]!,binding.accent));
  }).map(([cell])=>encode(cell)));
  for(const plate of scene.plates) {
    // The control's corner pixels remain on top of a load, not on top
    // of a bare pressure mark. Rebind using the previously seen load inset.
    const cell=encode(plate), target=scene.tiles.get(plate);
    if(!target||target.plate||target.preview||actors.includes(cell)||reflectors.includes(cell)||loads.includes(cell)||subjects?.includes(cell))continue;
    const stock=Array.from(scene.tiles.values()).find(tile=>tile.object);
    const center=Math.floor(target.pixels.length/2);
    if(h.relayLoads?.includes(target.pixels[center]!)||stock?.pixels[center]===target.pixels[center])loads.push(cell);
  }
  const supports=field.water.filter(cell=>{
    const id=decodeCell(cell), tile=scene.tiles.get(id);
    return !!tile&&!tile.uniform&&!tile.object&&!tile.preview&&!tile.mirror&&!actors.includes(cell)&&!subjects?.includes(cell)&&tile.pixels.every(ink=>ink!==field.waterInks[cell])
      ||!!h.supports[id]&&(actors.includes(cell)||loads.includes(cell)||reflectors.includes(cell)||supported(scene,h,id));
  });
  return {actors,loads:sorted(loads),reflectors,supports:sorted(supports),...(subjects?{subjects}:{})};
}

const relayPoseKey=(pose:RelayState)=>JSON.stringify([pose.actors,pose.loads,pose.reflectors,pose.supports,pose.subjects??[]]);
const sameRelayPose=(a:RelayState|undefined,b:RelayState)=>!!a&&relayPoseKey(a)===relayPoseKey(b);

function relayAgreement(scene:Scene,h:History,expected:RelayState){
  if(!sameRelayPose(relayPose(scene,h),expected))return false;
  const field=h.relayField!;
  const platformsAgree=field.platforms?.every(mark=>{
    if(relayControlOccupied(expected,mark.cell)||expected.supports.includes(mark.cell))return true;
    const cell=decodeCell(mark.cell),tile=scene.tiles.get(cell),binding=h.hydraulic!.bindings[mark.cell]!;
    const glyph=platformGlyph(tile,h.shape!.pitch,field.waterInks[mark.cell]!,binding.accent);
    return glyph?.frame===binding.frame&&glyph.active===relayPlatformAvailable(mark,expected)||observedProjection(scene,h,cell);
  });
  return platformsAgree!==false&&field.gates.every(gate=>{
    const seen=scene.tiles.get(decodeCell(gate.cell))?.gate;
    if(seen)return seen.open!==relayGateClosed(gate,expected,field.plate);
    return !field.linkedControls&&!field.subjectPatterns||!relayGateClosed(gate,expected,field.plate)
      && (expected.actors.includes(gate.cell)||expected.reflectors.includes(gate.cell)||expected.loads.includes(gate.cell)
        ||scene.tiles.get(decodeCell(gate.cell))?.preview);
  });
}

async function relayOffer(scene:Scene,h:History,remaining:number,execution?:NativeExecution,preferSelectionCost=false):Promise<Offer|undefined> {
  const field=h.relayField;
  if(!field||!h.trigger&&!field.learnedMobility)return;
  const pose=relayPose(scene,h);
  if(!pose)return;
  if(h.relay?.length&&!sameRelayPose(pose,h.relay[0]!.before))delete h.relay;
  if(!h.relay?.length){
    const fingerprint=JSON.stringify([relayPoseKey(pose),scene.active.ink]);
    if(h.relayChecked.includes(fingerprint)||h.relayChecked.length>=4)return;
    const spare=h.available?.filter(ref=>ref!=='ACTION6'&&!h.directions.some(direction=>direction.action===ref))??[];
    const priceSelection = preferSelectionCost && h.available?.includes('ACTION6')
      && h.shape!.inks.every(ink => !!h.selections[ink]);
    const activeActor = h.shape!.inks.indexOf(scene.active.ink);
    const model:RelayModel={...field,floor:new Set(field.floor),water:new Set(field.water),trigger:h.trigger??(spare.length===1?spare[0]!:'') ,
      controls:h.shape!.inks.map(ink=>observedDirections(h,ink).map(d=>({action:d.action,axis:toAxis(d.axis)}))),
      capacity:h.shape!.inks.map(ink=>h.roles[ink]?.capacity||(field.learnedMobility&&!h.roles[ink]?.pull?1:0)),
      ...(field.learnedMobility?{pull:h.shape!.inks.map(ink=>!!h.roles[ink]?.pull),nearestReflection:true,
        ...(field.plate===null||field.subjectPatterns||field.platforms?{activeActor}:{})}: {}),
      ...(priceSelection ? { activeActor } : {})};
    const search={yieldControl:execution?.yieldControl??(async()=>{}),signal:execution?.signal};
    let route:RelayStep[]|undefined;
    delete h.circuitTarget;
    delete h.relayPurpose;
    if(field.platforms){
      const untested=scene.plates.map(encode).filter(cell=>cell!==field.plate&&!h.circuitTrials?.[cell]);
      const plan=await planHydraulicRelay(model,pose,untested,search);
      if(plan){
        route=plan.steps;
        h.relayPurpose=plan.purpose;
        if(plan.trial!==undefined)h.circuitTarget=plan.trial;
      }
    }
    const pending=route?.length?[]:field.experimentControls?.filter(control=>!relayControlWeighted(pose,control))??[];
    for(const control of pending){
      route=await findRelayPlan({...model,trialControl:control,trialWeightOnly:true},pose,{...search,maxNodes:2500});
      if(!route?.length&&!h.circuitTrials?.[control]&&!relayControlOccupied(pose,control))
        route=await findRelayPlan({...model,trialControl:control},pose,{...search,maxNodes:2000});
      if(execution?.signal?.aborted)return;
      if(route?.length){h.circuitTarget=control;break;}
    }
    if(!route?.length&&!field.platforms){
      const maxNodes=field.experimentControls?9000:field.settleSubjectOnControl?15000:field.plate===null?150000:75000;
      route=await findRelayPlan(field.experimentControls?{...model,guidingControls:field.experimentControls}:model,pose,{...search,maxNodes});
    }
    if(execution?.signal?.aborted)return;
    h.relayChecked.push(fingerprint);
    if(!route?.length)return;
    h.relay=route;
    h.relaySelectionPriced=priceSelection;
  }
  const line=h.relay;
  const cost = h.relaySelectionPriced ? { relayCommandEstimate: { moves:line.length,
    selections:line.filter((step,i)=>step.actor!==(i===0?h.shape!.inks.indexOf(scene.active.ink):line[i-1]!.actor)).length } } : {};
  const initial=line[0]!, actor=scene.actors.find(a=>a.ink===h.shape!.inks[initial.actor])!;
  if(scene.active.ink!==actor.ink)return {ink:actor.ink,steps:[actorSwitch(scene,h,actor)],kind:'select_actor_for_relay_plan',score:650,
    ...cost,
    ...(field.learnedMobility?{destinations:scene.goals}:{})};
  const steps:Step[]=[];
  for(const predicted of line){
    if(predicted.actor!==initial.actor||steps.length>=remaining)break;
    const from=decodeCell(predicted.before.actors[predicted.actor]!),to=decodeCell(predicted.after.actors[predicted.actor]!);
    const pressure=field.finishAtPlate&&predicted.after.actors.includes(field.plate!);
    const circuitTrial=h.circuitTarget!==undefined&&relayControlOccupied(predicted.after,h.circuitTarget)
      &&(!relayControlOccupied(predicted.before,h.circuitTarget)||predicted===line.at(-1))?h.circuitTarget:undefined;
    steps.push({action:command(predicted.action),from,actor:actor.ink,to,relay:predicted,...(pressure?{pressureTrial:to}:{}),
      ...(circuitTrial!==undefined?{circuitTrial}:{})});
    if(predicted.projected.length||pressure||circuitTrial!==undefined)break;
  }
  return {ink:actor.ink,steps,kind:h.relayPurpose??(h.circuitTarget!==undefined?'test_linked_control_effect':field.settleSubjectOnControl?'compose_subject_with_linked_control':field.finishAtPlate?'prepare_access_to_test_linked_control'
    :field.learnedMobility?'compose_group_destination_after_access'
    :field.plate===null?'compose_reflection_and_support_access':'compose_reflection_and_linked_gate_access'),score:800,
    ...cost,
    ...(field.learnedMobility?{destinations:scene.goals}:{})};
}

function observeMirrorTraction(h:History,before:Scene,after:Scene,o:NativeObservation,action:string) {
  const remember=(ink:number,effect:string)=>{
    const role=h.roles[ink];
    if(!role)return;
    role.effects[effect]=o.observation_ref;
    if(h.transfer)h.transfer.roles[color(o,ink)]=role;
  };
  const attached=h.mirrorPull;
  if(attached){
    const prior=before.actors.find(peer=>peer.ink===attached.ink);
    const actor=after.actors.find(peer=>peer.ink===attached.ink);
    const bound=prior?.cell===attached.stance&&!!before.tiles.get(attached.reflector)?.mirror;
    const stays=!!after.tiles.get(attached.reflector)?.mirror;
    if(bound&&stays&&actor&&actor.cell!==attached.stance){
      const from=point(attached.stance),to=point(actor.cell);
      if(action===h.trigger)remember(attached.ink,'leave_reflector_in_place_by_transfer');
      else if(before.active.ink===attached.ink&&observedDirections(h,attached.ink).some(dir=>dir.action===action
        &&next(attached.stance,dir.axis)===actor.cell)
        &&(to[0]-from[0])*attached.axis[0]+(to[1]-from[1])*attached.axis[1]===0)
        remember(attached.ink,'leave_reflector_in_place_by_turning');
    }
    if(!bound||!stays||!actor||actor.cell!==attached.stance)delete h.mirrorPull;
  }
  const actor=before.active, moved=after.active;
  const direction=observedDirections(h,actor.ink).find(dir=>dir.action===action);
  if(!h.roles[actor.ink]?.pull||!direction||moved.ink!==actor.ink||moved.cell!==next(actor.cell,direction.axis))return;
  const rear=next(actor.cell,[-direction.axis[0],-direction.axis[1]]);
  if(!before.tiles.get(rear)?.mirror||after.tiles.get(rear)?.mirror||!after.tiles.get(actor.cell)?.mirror)return;
  h.mirrorPull={ink:actor.ink,reflector:actor.cell,stance:moved.cell,axis:direction.axis};
  remember(actor.ink,'move_reflector_by_withdrawal');
}

function fresh(epoch: number): History {
  return {epoch,directions:[],roles:{},selections:{},guarded:[],goals:[],plates:[],supports:{},gates:{},switches:{},relayChecked:[]};
}

function restoreRoles(h: History, shape: Shape, o: NativeObservation) {
  const commands = [...o.available_action_refs].sort().join(',');
  const motif = JSON.stringify([shape.pitch,shape.mask]);
  const previous = h.transfer;
  h.shape=shape;
  const compatible=!!previous&&previous.motif===motif&&compatibleRoles(o,previous);
  if (compatible) {
    const peers=shape.inks.map(ink=>[ink,previous.roles[color(o,ink)]] as const).filter(([,role])=>!!role);
    if(peers.length) {
      h.roles=Object.fromEntries(peers.map(([ink,role])=>[ink,structuredClone(role!)]));
      h.directions=structuredClone(previous.directions);
      if(previous.trigger&&o.available_action_refs.includes(previous.trigger))h.trigger=previous.trigger;
      if(previous.projectionColor!==undefined){
        const ink=o.palette?o.palette.indexOf(previous.projectionColor):Number(previous.projectionColor);
        if(Number.isInteger(ink)&&ink>=0)h.projectionInk=ink;
      }
    }
  }
  const roles=Object.fromEntries(shape.inks.flatMap(ink=>h.roles[ink]?[[color(o,ink),h.roles[ink]!]]:[]));
  const rememberedTrigger=h.trigger??(compatible?previous.trigger:undefined);
  h.transfer={interface:compatible?previous.interface:commands,motif,
    roles:compatible?{...previous.roles,...roles}:roles,directions:h.directions,
    ...(rememberedTrigger?{trigger:rememberedTrigger,...(previous?.triggerEvidence?{triggerEvidence:previous.triggerEvidence}:{})}:{}),
    ...(previous?.gateReaction?{gateReaction:previous.gateReaction}:{}),...(previous?.support?{support:previous.support}:{}),
    ...(compatible&&previous.goalColor?{goalColor:previous.goalColor}:{}),
    ...(h.projectionInk!==undefined?{projectionColor:color(o,h.projectionInk)}:{})};
}
function proposed(o: NativeObservation, offer: Offer, steps: (Step & { point_binding?: unknown })[], evidence:string[]) {
  const actions=steps.map(step=>step.action), reason=offer.kind.replaceAll('_',' ');
  const objectTest=offer.kind==='test_observed_object_interaction'&&offer.target!==undefined;
  const goal={kind:offer.kind,scope:o.observation_ref.split(':revision:',1)[0]!,
    subjects:offer.destinations?.map(cell=>'destination@'+cell)??(objectTest?[String(offer.ink),'object@'+offer.target]:[String(offer.ink)]),
    parentObjective:'G_official_completion',satisfactionContract:offer.destinations
      ?'observe_all_matching_destinations_occupied_together_and_check_official_outcome'
      :objectTest?'execute_contact_with_the_observed_instance_and_measure_its_return':'observe_the_predicted_actor_or_interaction'};
  const needId=sicNeedId(goal);
  const id='actor-composition:'+needId;
  return {status:'proposed',kind:observedActorCompositionId,actions,steps:steps.map(step=>({...step,expected_after:step.to?point(step.to):null})),offer,
    binding:{observation_ref:o.observation_ref,level_epoch:o.level_epoch},
    question:{reason,hypothesis_refs:evidence},route_refs:evidence,
    compositions:[{id,observed:false,open_question:reason,relations:['contributes_to:G_official_completion']}],
    sicSituationCard:{mode:offer.kind.startsWith('bring_')?'solving':'exploration',strategy:offer.kind,need:reason,situation:reason,evidence,
      ...(offer.relayCommandEstimate?{relayCommandEstimate:offer.relayCommandEstimate}:{})},
    sicLocalDecision:{strategy:offer.kind,objective:{id,label:reason,parent:'G_official_completion'},need:{...goal,id:needId,status:'assigned',evidence}},
    bundle_template:{operation_key:'OP18',composition_ref:id,objective_ref:'G_official_completion',purpose:reason,
      preconditions:{},preserve_refs:[],evidence,actions,outcome_guard:{path:['value'],contains:id}}};
}

export function createObservedActorComposition(preferSelectionCost = false): NativeFamily<Proposal> {
  let h=fresh(-1);
  return {
    id:observedActorCompositionId,
    async propose(o,rows,_,remaining,execution) {
      if (h.epoch!==o.level_epoch) h={...fresh(o.level_epoch),...(h.transfer?{transfer:h.transfer}:{})};
      h.available=[...o.available_action_refs];
      if(h.trigger&&!h.available.includes(h.trigger))delete h.trigger;
      if(!h.trigger&&h.shape&&h.transfer?.trigger&&compatibleRoles(o,h.transfer)
        && h.available.includes(h.transfer.trigger))h.trigger=h.transfer.trigger;
      let shape=h.shape??spotPair(o,rows)??rebindKnownActors(o,rows,h.transfer);
      if (!shape) return null;
      if(shape.inks.length===1&&h.transfer?.goalColor!==undefined){
        const ink=o.palette?o.palette.indexOf(h.transfer.goalColor):Number(h.transfer.goalColor);
        if(Number.isInteger(ink)&&ink>=0)h.goalInk=ink;
      }
      let scene=decode(rows,shape,h);
      if(h.shape&&o.state==='NOT_FINISHED'&&(!scene||Object.keys(h.transfer?.roles??{}).length>shape.inks.length)){
        const rebound=rebindKnownActors(o,rows,h.transfer,h.shape);
        if(rebound&&rebound.inks.join(',')!==shape.inks.join(',')){
          shape=rebound;
          scene=decode(rows,shape,h);
          if(scene){
            restoreRoles(h,shape,o);
            delete h.relay;
            delete h.relayField;
            delete h.platformPlan;
            delete h.platformField;
          }
        }
      }
      if (!scene) return null;
      if(!h.shape){
        restoreRoles(h,shape,o);
        // Read the new scene again with the projection cue learned in the
        // previous room. Otherwise a preview may be mistaken for solid cargo.
        if(h.projectionInk!==undefined)scene=decode(rows,shape,h);
        if(!scene)return null;
      }
      h.goals=scene.goals;
      if(scene.destinationGroups.length)h.destinationGroups=scene.destinationGroups;
      if(h.transfer&&scene.goals.length>0&&!h.transfer.goalColor){
        const shades=new Set(scene.goals.map(cell=>scene.tiles.get(cell)!.pixels[0]!));
        if(shades.size===1)h.transfer.goalColor=color(o,[...shades][0]!);
      }
      h.plates=scene.plates;
      const cargo=[...scene.tiles.values()].find(tile=>tile.object&&!tile.gate);
      if(scene.actors.length>1&&!h.cargoPattern&&cargo)h.cargoPattern=inset(cargo.pixels,shape.pitch);
      for(const [cell,tile] of scene.tiles){
        if(tile.gate)h.gates[cell]=tile.gate;
        if(tile.plateAccent!==null)h.switches[cell]=tile.plateAccent;
      }
      if(!h.hydraulic&&scene.actors.length>1&&h.trigger&&h.transfer?.support&&h.transfer.gateReaction){
        const observed=observedPlatforms(scene,h,o);
        if(observed)h.hydraulic={bindings:observed.bindings,platforms:observed.platforms};
      }
      const objects=observedObjects(scene,h,o);
      if(!h.relayField){
        const field=relayField(scene,h,o,objects);
        if(field){
          h.relayField=field;
          const marked=Math.floor(shape.pitch*shape.pitch/2);
          h.relayLoads=[...new Set([...scene.tiles.values()].filter(tile=>tile.object).map(tile=>tile.pixels[marked]!))];
        }
      }
      const frontier=reachableCompositions(scene,h,o);
      const learningRelay=h.relayField&&!h.relayField.unoccupiedControls&&!h.relayField.learnedMobility;
      const chain=learningRelay&&!h.seenChain?frontier.find(offer=>(offer.kind==='test_reachable_chain_composition'||offer.kind==='test_extended_chain_capacity')):undefined;
      const press=learningRelay&&!h.seenPlate?frontier.find(offer=>offer.kind==='test_reachable_pressure_composition'):undefined;
      const paired=scene.goals.length?pairedTransfer(scene,h,o):undefined;
      const relay=h.relayField?.linkedControls||h.relayField?.platforms?await relayOffer(scene,h,remaining,execution,preferSelectionCost):undefined;
      const planned=await platformOffer(scene,h,o,remaining,execution)??relay??releaseBlockedControl(scene,h)??prepareRelayControls(scene,h,o)
        ??chain??press??linkedTransport(scene,h,o)??paired??await relayOffer(scene,h,remaining,execution,preferSelectionCost)??arrangeActors(scene,h);
      const direct=planned?undefined:draft(scene,h,o);
      const directed=scene.goals.length&&direct&&direct.score>155?direct:undefined;
      const generic=!planned&&!directed&&h.directions.length>=4?testObservedObjects(scene,h,o,objects):undefined;
      const interaction=generic&&(!frontier[0]||generic.score>frontier[0].score)?generic:frontier[0];
      const offer=[planned,directed,interaction,...frontier,direct].find(candidate=>candidate
        &&!h.rejectedLossChoices?.includes(materialChoice(o,candidate.steps[0]!.action)));
      if(!offer || remaining<1) return null;
      const roleEvidence=Object.values(h.roles[offer.ink]?.effects??{});
      const evidence=[...new Set([o.observation_ref,...observedDirections(h,offer.ink).map(d=>d.evidence),...Object.values(h.selections),...roleEvidence,
        ...Object.values(h.roles).flatMap(role=>role.pull?[role.pull]:[]),
        ...Object.values(h.releasedControls??{}),...Object.values(h.circuitTrials??{}),...Object.values(h.controlTrials??{}).map(trial=>trial.evidence),...(h.transfer?.triggerEvidence?[h.transfer.triggerEvidence]:[]),
        ...(h.transfer?.gateReaction?[h.transfer.gateReaction]:[]),...(h.transfer?.support?[h.transfer.support.evidence]:[])])];
      const steps=offer.steps.slice(0,Math.min(remaining,16));
      const first=steps[0]!;
      if(first.select!==undefined){
        const locus:Point=[first.action.data.x!,first.action.data.y!];
        return proposed(o,offer,[{...first,point_binding:await ObservedInputDomain.makeLocusWitness(o,rows,locus,{reason:'Test which visible actor the click selects',evidence})}],evidence);
      }
      return proposed(o,offer,steps,evidence);
    },
    before(p,index,packet,o) {
      const step=p.steps[index]!, scene=h.shape&&decode(packet.frame_rows,h.shape,h);
      const destination=step.contact??step.to??(step.tile&&observedDirections(h,step.actor).find(d=>d.action===step.action.action_ref)
        ?next(step.from,observedDirections(h,step.actor).find(d=>d.action===step.action.action_ref)!.axis):undefined);
      const admitted=!!scene && !h.rejectedLossChoices?.includes(materialChoice(o,step.action))
        && scene.active.ink===step.actor&&scene.active.cell===step.from
        && (step.tile===undefined||!!destination&&tileKey(scene.tiles.get(destination))===step.tile)
        && (!step.probeLanding||tileKey(scene.tiles.get(step.probeLanding.cell))===step.probeLanding.glyph
          &&!scene.actors.some(actor=>actor.cell===step.probeLanding!.cell))
        && (!step.loads||scene.tiles.get(step.to!)?.gate?.open!==false
          && JSON.stringify(loadCells(scene))===JSON.stringify(step.loads.from));
      const modelBound=!step.relay||!!scene&&relayAgreement(scene,h,step.relay.before)
        && step.relay.projected.every(cell=>scene.tiles.get(decodeCell(cell))?.preview
          || step.relay!.before.actors.includes(cell)||step.relay!.before.loads.includes(cell));
      const joint = !step.expectedActors || step.expectedActors.every(actor=>scene?.actors.some(part=>part.ink===actor.ink&&part.cell===actor.from)&&scene.tiles.get(actor.to)?.preview);
      const reflector=step.reflectorMove,transfer=step.controlTransfer;
      const contactBound=!reflector||!!scene?.tiles.get(reflector.from)?.mirror
        && !!scene.tiles.get(reflector.to)?.passable&&!portable(scene.tiles.get(reflector.to))
        && !scene.actors.some(actor=>actor.cell===reflector.to);
      const projectionBound=!transfer||!!scene&&controlProjectionAgrees(scene,h,transfer);
      const platform=step.platform;
      const obstruction=step.clearLinkedObstruction;
      const linkedEffectBound=!obstruction||!!scene&&portable(scene.tiles.get(obstruction))
        &&pressureHeld(scene,step.from)&&h.gates[obstruction]?.accent===h.switches[step.from];
      const rosterBound=!step.roster||step.roster.every(actor=>scene?.actors.some(part=>part.ink===actor.ink&&part.cell===actor.cell));
      const platformBound=!platform||!!scene&&!!h.platformField&&platformAgreement(scene,h,o,h.platformField,platform.before)
        && (!platform.projected.length||[...scene.tiles.keys()].filter(cell=>observedProjection(scene,h,cell)).map(encode).sort((a,b)=>a-b).join(',')===platform.projected.join(','));
      const valid=admitted&&joint&&modelBound&&contactBound&&projectionBound&&platformBound&&rosterBound&&linkedEffectBound;
      return {admitted:valid,reason:valid?'observed_actor_and_local_contact_preserved':'actor_or_contact_changed'};
    },
    after(p,index,b,a,first,second) {
      const step=p.steps[index]!;
      const boundary=b.level_epoch!==a.level_epoch||b.levels_completed!==a.levels_completed;
      const scene=h.shape&&decode(second,h.shape,h);
      const prior=!boundary&&scene&&h.shape&&decode(first,h.shape,h);
      if(prior&&scene&&unplannedMaterialLoss(h,step,prior,scene,b,a))return {matched:false,seal_prefix:true,reason:sicObservedUnplannedMaterialLoss};
      const moved=scene?.active.cell===step.to && scene?.active.ink===step.actor
        && (!step.supportAccess||matchesSupport(scene,h,a,step.supportAccess))
        && (!step.loads||JSON.stringify(loadCells(scene))===JSON.stringify(step.loads.to)
          && (!step.loads.support||matchesSupport(scene,h,a,step.loads.support)))
        && (!step.reflectorMove||!!scene.tiles.get(step.reflectorMove.to)?.mirror&&!scene.tiles.get(step.reflectorMove.from)?.mirror);
      const selected=scene?.active.ink===step.select && scene?.active.cell!==undefined;
      const joint=step.expectedActors?.every(actor=>scene?.actors.some(part=>part.ink===actor.ink&&part.cell===actor.to));
      const forecast=step.relay&&scene?relayAgreement(scene,h,step.relay.after):undefined;
      const control=step.controlTransfer;
      const platform=step.platform;
      const othersStayed=!step.roster||step.roster.every(actor=>actor.ink===step.actor
        ||scene?.actors.some(part=>part.ink===actor.ink&&part.cell===actor.cell));
      const circuitPressed=step.circuitTrial!==undefined&&scene&&step.relay
        &&step.relay.after.actors.every((cell,index)=>scene.actors.some(actor=>actor.ink===h.shape!.inks[index]&&encode(actor.cell)===cell))
        &&(pressureHeld(scene,decodeCell(step.circuitTrial))||!!relayPose(scene,h)?.subjects?.includes(step.circuitTrial));
      const matched=boundary|| (step.circuitTrial!==undefined?!!circuitPressed:step.pressureTrial?!!moved
        :platform?!!scene&&!!h.platformField&&platformAgreement(scene,h,a,h.platformField,platform.after)
        :control?!!scene&&releasedPressure(scene,control)
        :forecast!==undefined?forecast:joint!==undefined?joint:step.select!==undefined?selected:step.to!==undefined?moved&&othersStayed:b.frame_hash!==a.frame_hash);
      const sealed=boundary||!matched||!!step.pressureTrial||step.circuitTrial!==undefined||step.select!==undefined||step.to===undefined||index===p.steps.length-1;
      return {matched,seal_prefix:sealed,reason:boundary?'official_boundary':matched?'actor_outcome_observed':'actor_outcome_contradicted'};
    },
    record(b,a,action,first,second,p,index) {
      if(!h.shape||b.level_epoch!==a.level_epoch)return {events:[]};
      const before=decode(first,h.shape,h), after=decode(second,h.shape,h), step=p.steps[index]!;
      if(!before||!after) return {events:[]};
      if(unplannedMaterialLoss(h,step,before,after,b,a)){
        h.materialLoss={evidence:a.observation_ref,choice:materialChoice(b,action),...(p.offer.test?{test:p.offer.test}:{})};
        return {events:[]};
      }
      keepMotionEvidence(h,b,a,before,after);
      const actor=before.active, observed=after.active;
      const role=h.roles[actor.ink]??={moved:false,contact:false,capacity:0,effects:{}};
      if(p.offer.destinations&&p.offer.destinations.every(cell=>after.actors.some(part=>part.cell===cell)))
        (h.arrangements??={})[arrangementKey(after.actors)]=a.observation_ref;
      const control=step.controlTransfer,reflector=step.reflectorMove;
      if(step.platform){
        if(h.platformField&&platformAgreement(after,h,a,h.platformField,step.platform.after))h.platformPlan?.shift();
        else {delete h.platformPlan;delete h.platformField;}
      }
      if(control){
        if(p.offer.test)h.guarded.push(p.offer.test);
        if(releasedPressure(after,control))(h.releasedControls??={})[control.source]=a.observation_ref;
      }
      if(reflector&&p.offer.test&&(observed.cell!==step.to||!after.tiles.get(reflector.to)?.mirror))h.guarded.push(p.offer.test);
      for(const cell of after.plates){
        if(!pressureHeld(after,cell)||pressureHeld(before,cell))continue;
        if(!h.triedPlates?.includes(cell))(h.triedPlates??=[]).push(cell);
        if(hasIndependentRelayControls(before,h)){
          const opens=[...before.tiles].some(([gate,tile])=>tile.gate?.open===false&&tile.gate.accent===h.switches[cell]
            && after.tiles.get(gate)?.gate?.open===true);
          (h.controlTrials??={})[cell]={evidence:a.observation_ref,opens};
        }
      }
      const foundation=step.loads?.support??step.supportAccess;
      if(foundation&&matchesSupport(after,h,a,foundation))h.supports[foundation]=tileKey(after.tiles.get(foundation));
      if(step.loads&&(observed.cell!==step.to||JSON.stringify(loadCells(after))!==JSON.stringify(step.loads.to)
        || foundation&&!matchesSupport(after,h,a,foundation)))
        h.guarded.push(pressureStepKey(actor.ink,actor.cell,action.action_ref,step.loads.from,before.tiles.get(step.to!)));
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
        if(h.transfer){
          if(h.transfer.trigger!==action.action_ref||!h.transfer.triggerEvidence)h.transfer.triggerEvidence=a.observation_ref;
          h.transfer.trigger=action.action_ref;
        }
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
      if(step.circuitTrial!==undefined){
        (h.circuitTrials??={})[step.circuitTrial]=a.observation_ref;
        if(h.transfer&&[...after.tiles].some(([cell,tile])=>tile.gate&&tile.gate.open!==before.tiles.get(cell)?.gate?.open))
          h.transfer.gateReaction=a.observation_ref;
        delete h.relay;
        delete h.relayField;
        delete h.circuitTarget;
        h.relayChecked=[];
      }else if(step.pressureTrial&&observed.cell===step.pressureTrial){
        h.seenPlate=true;
        delete h.relay;
        delete h.relayField;
        h.relayChecked=[];
        if(h.transfer&&[...after.tiles].some(([cell,tile])=>tile.gate&&tile.gate.open!==before.tiles.get(cell)?.gate?.open))
          h.transfer.gateReaction=a.observation_ref;
      }else if(step.relay){
        if(relayAgreement(after,h,step.relay.after)){
          for(const support of step.relay.after.supports.filter(cell=>!step.relay!.before.supports.includes(cell))){
            const cell=decodeCell(support);
            h.supports[cell]=tileKey(after.tiles.get(cell));
            const substrate=before.tiles.get(cell),surface=after.tiles.get(cell);
            if(h.transfer&&!h.transfer.support&&substrate?.uniform&&surface)
              h.transfer.support={medium:color(b,substrate.pixels[0]!),pattern:surface.pixels.map(ink=>color(a,ink)),evidence:a.observation_ref};
          }
          if(step.relay.projected.length&&h.relayField?.learnedMobility){
            h.trigger=action.action_ref;
            if(h.transfer){
              h.transfer.trigger=h.trigger;
              h.transfer.triggerEvidence??=a.observation_ref;
              if(h.projectionInk===undefined){
                const projection=step.relay.projected.map(cell=>before.tiles.get(decodeCell(cell))).find(tile=>tile?.preview);
                if(projection){
                  h.projectionInk=projection.pixels[Math.floor(projection.pixels.length/2)]!;
                  h.transfer.projectionColor=color(b,h.projectionInk);
                }
              }
            }
          }
          h.relay?.shift();
          const field=h.relayField;
          if(field?.settleSubjectOnControl&&field.plate!==null&&step.relay.after.subjects?.includes(field.plate)){
            const prior=step.relay.before;
            delete field.settleSubjectOnControl;
            field.keepSubjectOnControl=true;
            h.relayChecked=[];
            h.seenPlate=true;
            if(h.transfer&&field.gates.some(gate=>relayGateClosed(gate,prior,field.plate)
              &&after.tiles.get(decodeCell(gate.cell))?.gate?.open))h.transfer.gateReaction=a.observation_ref;
          }
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
      if(p.offer.kind==='test_observed_object_interaction'&&step.contact&&p.offer.test){
        h.guarded.push(p.offer.test);
      }else if(p.offer.test && step.contact && p.offer.target) {
        const delta=tileKey(before.tiles.get(step.contact))!==tileKey(after.tiles.get(step.contact));
        if(delta){ role.contact=true; role.effects[p.offer.kind+':'+action.action_ref]=a.observation_ref; }
        if(delta&&p.offer.kind==='test_displacement_on_withdrawal'&&actor.cell!==observed.cell
          && tileKey(after.tiles.get(actor.cell))===tileKey(before.tiles.get(step.contact)))role.pull=a.observation_ref;
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
      observeMirrorTraction(h,before,after,a,action.action_ref);
      return {events:[]};
    },
    observePublicOutcome(b,a,_command,first,second) {
      if(h.epoch!==b.level_epoch||!h.shape||b.level_epoch!==a.level_epoch)return;
      const before=decode(first,h.shape,h),after=decode(second,h.shape,h);
      if(before&&after)keepMotionEvidence(h,b,a,before,after);
    },
    requestedStopReason(o) {
      if(h.materialLoss?.evidence===o.observation_ref)return sicObservedUnplannedMaterialLoss;
      const cycle=h.motion?.cycle;
      if(h.epoch===o.level_epoch&&h.motion?.last===o.observation_ref&&cycle
        && (h.recoveredCycles?.length??0)<2&&!h.recoveredCycles?.some(prior=>JSON.stringify(prior)===JSON.stringify(cycle)))return sicObservedMotionCycle;
      return null;
    },
    stateAfterLevelReset(o,_rows,_entry,cause) {
      if(cause===sicObservedUnplannedMaterialLoss&&h.materialLoss){
        return {...fresh(o.level_epoch),...(h.transfer?{transfer:h.transfer}:{}),
          rejectedLossChoices:[...new Set([...(h.rejectedLossChoices??[]),h.materialLoss.choice])]};
      }
      if(cause!==sicObservedMotionCycle||!h.motion?.cycle)return;
      return {...fresh(o.level_epoch),...(h.transfer?{transfer:h.transfer}:{}),
        recoveredCycles:[...(h.recoveredCycles??[]),h.motion.cycle]};
    },
    stateAfterActionUndo(entry){
      if(!h.materialLoss)return;
      const recovered=structuredClone(entry as unknown as History);
      recovered.rejectedLossChoices=[...new Set([...(h.rejectedLossChoices??[]),h.materialLoss.choice])];
      if(h.materialLoss.test)recovered.guarded.push(h.materialLoss.test);
      delete recovered.relay;
      recovered.relayChecked=[];
      return recovered as unknown as NativeRecord;
    },
    state:()=>h,
    restore(value){ h={...fresh(-1),...structuredClone(value as History)}; },
  };
}
