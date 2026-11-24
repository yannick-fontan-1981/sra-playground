import { ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeCommand, NativeFamily, NativeObservation, NativeRows } from '../logos-engine/v6-native-types.ts';
import { sicNeedId } from './need-identity.ts';

export const observedActorCompositionId = 'sic_observed_actor_composition';

type Point = readonly [number, number];
type Cell = string;
type Actor = { ink: number; cell: Cell; marker: number | null };
type Shape = { pitch: number; phase: Point; mask: number[]; inks: number[]; floor: number; backing: number };
type Direction = { action: string; axis: Point; evidence: string };
type Role = { moved: boolean; contact: boolean; capacity: number; effects: Record<string, string>; controls?: Direction[] };
type RoleTransfer = { interface: string; motif: string; roles: Record<string, Role>; directions: Direction[] };
type History = {
  epoch: number; shape?: Shape; directions: Direction[]; roles: Record<number, Role>; selections: Record<number, string>; transfer?: RoleTransfer;
  guarded: string[]; goals: Cell[]; plates: Cell[]; supports: Record<Cell,string>; trigger?: string;
  lastPush?: { ink: number; direction: string; object: Cell };
  obstruction?: { ink: number; stance: Cell; object: Cell };
};
type Tile = { pixels: number[]; uniform: boolean; passable: boolean; object: boolean; plate: boolean;
  mirror: Point[] | null; preview: boolean };
type Scene = { actors: Actor[]; active: Actor; tiles: Map<Cell, Tile>; goals: Cell[]; plates: Cell[] };
type Step = { action: NativeCommand; from: Cell; actor: number; to?: Cell; tile?: string; select?: number; contact?: Cell };
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
  return h.supports[cell]!==undefined && h.supports[cell]===tileKey(scene.tiles.get(cell));
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

function motif(pixels: number[], mask: number[]) {
  const inside = new Set(mask);
  const outside = pixels.filter((_,i) => !inside.has(i));
  if (!outside.length) return null;
  const floor = outside[0]!;
  if (outside.some(value => value!==floor)) return null;
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
    const cell = key([(x-phase[0])/pitch,(y-phase[1])/pitch]), pixels=readTile(rows,x,y,pitch), body=motif(pixels,mask);
    const uniform=pixels.every(value=>value===pixels[0]);
    if(body && inks.includes(body.ink)) actors.push({ink:body.ink,cell,marker:body.marker});
    const edge = pixels.filter((_,i)=>i%pitch===0 || i%pitch===pitch-1 || i<pitch || i>=pitch*(pitch-1));
    const object=!uniform && edge.every(value=>value===edge[0]) && edge[0]!==floor && pixels[mid]!==edge[0] && pixels[mid]!==floor;
    const mirror=!object&&!uniform ? diagonalAperture(pixels,pitch,floor) : null;
    const onBoard=pixels.filter(value=>value===floor).length;
    const plate=!mirror&&!object && (!body||body.marker===mid) && onBoard>=pixels.length-mask.length
      && mask.every(index=>pixels[index]!==floor)
      && pixels.filter((_,i)=>!mask.includes(i)).every(value=>value===floor);
    const preview=!!(body && !inks.includes(body.ink) && body.marker===null && body.floor===floor);
    tiles.set(cell,{pixels,uniform,
      passable:onBoard>=Math.ceil(pixels.length/2)||preview||plate,object,plate,mirror,preview});
    const outline = edge.every(value => value===edge[0]) && edge[0]!==floor && pixels[mid]===floor;
    if ((uniform||outline) && pixels[0]!==floor && pixels[0]!==shape.backing) {
      const list = solidColors.get(pixels[0]!) ?? [];
      list.push(cell);
      solidColors.set(pixels[0]!,list);
    }
  }
  const active=actors.filter(actor=>actor.marker!==null);
  if(actors.length!==inks.length || active.length!==1 || new Set(actors.map(a=>a.ink)).size!==inks.length) return null;
  const candidateGoals=[...solidColors.values()].filter(cells=>cells.length===actors.length && distance(cells[0]!,cells[1]!)>1);
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

function fresh(epoch: number): History {
  return {epoch,directions:[],roles:{},selections:{},guarded:[],goals:[],plates:[],supports:{}};
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
    }
  }
  h.transfer={interface:commands,motif,roles:{},directions:h.directions};
}
function proposed(o: NativeObservation, offer: Offer, steps: (Step & { point_binding?: unknown })[], evidence:string[]) {
  const actions=steps.map(step=>step.action), reason=offer.kind.replaceAll('_',' ');
  const goal={kind:offer.kind,scope:o.observation_ref.split(':revision:',1)[0]!,subjects:[String(offer.ink)],
    parentObjective:'G_official_completion',satisfactionContract:'observe_the_predicted_actor_or_interaction'};
  const id='actor-composition:'+sicNeedId(goal);
  return {status:'proposed',kind:observedActorCompositionId,actions,steps:steps.map(step=>({...step,expected_after:step.to?point(step.to):null})),offer,
    binding:{observation_ref:o.observation_ref,level_epoch:o.level_epoch},
    question:{reason,hypothesis_refs:evidence},route_refs:evidence,
    compositions:[{id,observed:false,open_question:reason,relations:['contributes_to:G_official_completion']}],
    sicSituationCard:{mode:offer.kind.startsWith('bring_')?'solving':'exploration',strategy:offer.kind,need:reason,situation:reason,evidence},
    sicLocalDecision:{strategy:offer.kind,objective:{id,label:reason,parent:'G_official_completion'},need:{...goal,id,status:'assigned',evidence}},
    bundle_template:{operation_key:'OP18',composition_ref:id,objective_ref:'G_official_completion',purpose:reason,
      preconditions:{},preserve_refs:[],evidence,actions,outcome_guard:{path:['value'],contains:id}}};
}

export function createObservedActorComposition(): NativeFamily<Proposal> {
  let h=fresh(-1);
  return {
    id:observedActorCompositionId,
    async propose(o,rows,_,remaining) {
      if (h.epoch!==o.level_epoch) h={...fresh(o.level_epoch),...(h.transfer?{transfer:h.transfer}:{})};
      const shape=h.shape??spotPair(o,rows);
      if (!shape) return null;
      const scene=decode(rows,shape,h);
      if (!scene || !scene.goals.length) return null;
      if(!h.shape) restoreRoles(h,shape,o);
      h.goals=scene.goals;
      h.plates=scene.plates;
      const offer=draft(scene,h,o);
      if(!offer || remaining<1) return null;
      const evidence=[...new Set([o.observation_ref,...h.directions.map(d=>d.evidence),...Object.values(h.selections)])];
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
      return {admitted,reason:admitted?'observed_actor_and_local_contact_preserved':'actor_or_contact_changed'};
    },
    after(p,index,b,a,first,second) {
      const step=p.steps[index]!;
      const boundary=b.level_epoch!==a.level_epoch||b.levels_completed!==a.levels_completed;
      const scene=h.shape&&decode(second,h.shape,h);
      const moved=scene?.active.cell===step.to && scene?.active.ink===step.actor;
      const selected=scene?.active.ink===step.select && scene?.active.cell!==undefined;
      const matched=boundary|| (step.select!==undefined?selected:step.to!==undefined?moved:b.frame_hash!==a.frame_hash);
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
      if(p.offer.kind==='verify_visible_transport_destination'&&step.to===observed.cell){
        h.trigger=action.action_ref;

        role.effects[action.action_ref]=a.observation_ref;
      }
      if(p.offer.test && step.contact && p.offer.target) {
        const delta=tileKey(before.tiles.get(step.contact))!==tileKey(after.tiles.get(step.contact));
        if(delta){ role.contact=true; role.effects[p.offer.kind+':'+action.action_ref]=a.observation_ref; }
        h.guarded.push(p.offer.test);
      } else if(p.offer.test && step.to===undefined && action.action_ref!=='ACTION6' && p.offer.target) {
        const dir=observedDirections(h,actor.ink).find(d=>d.action===action.action_ref), cargo=p.offer.target;
        if(dir&&observed.cell===cargo){
          let cursor=cargo,count=0;
          while(before.tiles.get(cursor)?.object){count++;cursor=next(cursor,dir.axis);}
          delete h.obstruction;
          role.contact=true;
          h.guarded.push(p.offer.test);
          role.capacity=Math.max(role.capacity,count);
          role.effects[action.action_ref]=a.observation_ref;
          const trail=next(cargo,dir.axis);
          if(after.tiles.get(trail)?.object)h.lastPush={ink:actor.ink,direction:action.action_ref,object:trail};
          const prior=before.tiles.get(cursor), outcome=after.tiles.get(cursor);
          if(prior&&!prior.passable&&outcome&&!outcome.object&&!outcome.uniform) h.supports[cursor]=tileKey(outcome);
        }else {
          h.guarded.push(p.offer.test);
          h.obstruction={ink:actor.ink,stance:actor.cell,object:cargo};
        }
      }
      return {events:[]};
    },
    state:()=>h,
    restore(value){ h=structuredClone(value as History); },
  };
}
