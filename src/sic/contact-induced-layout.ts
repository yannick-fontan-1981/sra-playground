import { connectedJointFloor, exactJointPath, jointSuccessor, type JointScene } from '../logos-engine/v6-joint-transport.ts';
import type { NativeBox, NativeEntity, NativeObservation, NativePoint, NativeRows } from '../logos-engine/v6-native-types.ts';

type Cell = JointScene['player'];
type Groups = Map<string, Map<string, NativeEntity>>;
type Motion = { shape: string; from: NativeBox; to: NativeBox; delta: Cell };
type Motor = { delta: Cell; ref: string; stationary: Record<string,string>; surfaces: number[]; inconsistent?: boolean };
type Site = { cell: string; mask: string; occupants: string[] };
export type ContactBasis = { actor: string; peer: string; scale: number; offset: Cell;
  floor: string[]; targets: string[]; otherActors: string[]; directions: Record<string, Cell>; refs: string[];
  alternatives: string[]; ref: string; surfaces:number[]; targetMask:string };
export type ContactHistory = { controls: Record<string, Record<string, Motor>>; sites: Record<string, Site[]>;
  candidates: ContactBasis[] };
export const newContactHistory = (): ContactHistory => ({ controls: {}, sites: {}, candidates: [] });

const center = (b: NativeBox): Cell => [(b[0]+b[2])/2, (b[1]+b[3])/2];
function gridFor(box: NativeBox, scale: number): Cell {
  return center(box).map(v => ((Math.round(v-(scale-1)/2)%scale)+scale)%scale) as Cell;
}
function cellOf(box: NativeBox, scale: number, offset: NativePoint): Cell {
  const [x,y]=center(box);
  return [Math.round((x-offset[0]-(scale-1)/2)/scale), Math.round((y-offset[1]-(scale-1)/2)/scale)];
}
function groups(o: NativeObservation, area: number): Groups {
  const result: Groups=new Map();
  for(const part of o.entities){
    if(part.area<2 || part.area*12>area)continue;
    const list=result.get(part.signature)??new Map();
    list.set(part.bbox.join(','),part);
    result.set(part.signature,list);
  }
  return result;
}
function changed(before: Groups, after: Groups) {
  const motions: Motion[]=[], stationary: string[]=[];
  for(const [shape,parts] of before){
    const now=after.get(shape);
    if(!now || now.size!==parts.size)continue;
    const from=[...parts].filter(([k])=>!now.has(k));
    if(!from.length){stationary.push(shape);continue;}
    if(from.length!==1)continue;
    const arrived=[...now].find(([k])=>!parts.has(k))?.[1];
    if(!arrived)continue;
    const old=from[0]![1].bbox, dest=arrived.bbox, delta:Cell=[dest[0]-old[0],dest[1]-old[1]];
    const scale=Math.abs(delta[0]||delta[1]);
    if((delta[0]===0)!==(delta[1]===0) && scale>=2 && scale<=16)motions.push({shape,from:old,to:dest,delta});
  }
  return {motions,stationary};
}
function tile(rows: NativeRows, scale: number, offset: NativePoint, [x,y]: NativePoint) {
  const left=offset[0]+x*scale,top=offset[1]+y*scale;
  if(left<0||top<0||top+scale>rows.length||left+scale>rows[0]!.length)return null;
  return rows.slice(top,top+scale).flatMap(row=>row.slice(left,left+scale));
}
function uncoveredGround(body: number[]|null, empty: number[]|null, scale: number): number|undefined {
  if(!body||!empty||!empty.every(v=>v===empty[0])||body.every((v,i)=>v===empty[i]))return;
  const corners=[0,scale-1,scale*(scale-1),scale*scale-1];
  if(corners.filter(i=>body[i]===empty[i]).length>=2)return empty[0];
}
function tileSite(pixels:number[],surfaces:readonly number[],scale:number) {
  const base=pixels[0]!;
  if(!surfaces.includes(base) || [scale-1,scale*(scale-1),scale*scale-1].some(i=>pixels[i]!==base))return;
  const mask:number[]=[];
  for(let i=0;i<pixels.length;i++)if(pixels[i]!==base)mask.push(i);
  return mask.length*2<pixels.length?mask.join(','):undefined;
}
function visitCells(rows:NativeRows,scale:number,offset:NativePoint,fn:(id:string,pixels:number[])=>void){
  for(let y=0;offset[1]+(y+1)*scale<=rows.length;y++)for(let x=0;offset[0]+(x+1)*scale<=rows[0]!.length;x++){
    fn([x,y].join(','),tile(rows,scale,offset,[x,y])!);
  }
}
function initialSites(rows:NativeRows,parts:Groups,scale:number,offset:Cell,surfaces:number[]):Site[] {
  const occupants=new Map<string,string[]>();
  for(const [shape,list] of parts)for(const p of list.values()){
    const key=cellOf(p.bbox,scale,offset).join(',');
    const group=occupants.get(key)??[];group.push(shape);occupants.set(key,group);
  }
  const sites:Site[]=[];
  visitCells(rows,scale,offset,(cell,pixels)=>{
    const mask=tileSite(pixels,surfaces,scale);
    if(mask)sites.push({cell,mask,occupants:occupants.get(cell)??[]});
  });
  return sites;
}
function layouts(actor:Motion,peer:Motion,rows:NativeRows,parts:Groups,memory:ContactHistory,input:string,ref:string):ContactBasis[] {
  const scale=Math.abs(actor.delta[0]||actor.delta[1]), offset=gridFor(actor.to,scale);
  const past=memory.controls[actor.shape];
  if(!past)return [];
  const motors=Object.entries(past).filter(([,m])=>!m.inconsistent&&Math.abs(m.delta[0]||m.delta[1])===scale);
  const independent=motors.filter(([,m])=>m.stationary[peer.shape]);
  const alternatives=independent.filter(([,m])=>m.delta.join(',')!==actor.delta.join(',')).map(([k])=>k);
  const surfaces=[...new Set(independent.flatMap(([,m])=>m.surfaces))];
  if(!alternatives.length||!surfaces.length)return [];
  const find=(shape:string)=>[...parts.get(shape)!.values()].map(p=>cellOf(p.bbox,scale,offset).join(','));
  const player=cellOf(actor.to,scale,offset),id=player.join(','),boxes=new Set(find(peer.shape));
  if(boxes.has(id))return [];
  const floor=new Set([id,...boxes]),targetGroups=new Map<string,Set<string>>();
  const add=(key:string,mask:string)=>{const g=targetGroups.get(mask)??new Set();g.add(key);targetGroups.set(mask,g);};
  visitCells(rows,scale,offset,(key,pixels)=>{
    if(key===id||boxes.has(key))return;
    const mask=tileSite(pixels,surfaces,scale);
    if(mask==='')floor.add(key);
    else if(mask)add(key,mask);
  });
  for(const site of memory.sites[[scale,...offset].join(',')]??[]){
    if((boxes.has(site.cell)||id===site.cell)&&!site.occupants.includes(actor.shape)&&!site.occupants.includes(peer.shape))add(site.cell,site.mask);
  }
  const directions:Record<string,Cell>=Object.fromEntries(motors.map(([k,m])=>[k,[m.delta[0]/scale,m.delta[1]/scale]]));
  directions[input]=[actor.delta[0]/scale,actor.delta[1]/scale];
  const refs=[...new Set([ref,...motors.map(([,m])=>m.ref),...independent.map(([,m])=>m.stationary[peer.shape]!)])];
  const models:ContactBasis[]=[];
  for(const [targetMask,group] of targetGroups){
    const region=connectedJointFloor(new Set([...floor,...group]),player);
    const bodies=[...boxes].filter(k=>region.has(k)),targets=[...group].filter(k=>region.has(k));
    if(!bodies.length||bodies.length>5||bodies.length!==targets.length||region.size>100)continue;
    models.push({actor:actor.shape,peer:peer.shape,scale,offset,floor:[...region],targets,
      otherActors:find(actor.shape).filter(k=>k!==id&&region.has(k)),directions,refs,alternatives,ref,surfaces,targetMask});
  }
  return models;
}
export function observeContact(memory:ContactHistory,b:NativeObservation,a:NativeObservation,input:string,first:NativeRows,second:NativeRows) {
  memory.candidates=[];
  if(!/^ACTION[1-4]$/.test(input)||b.frame_hash===a.frame_hash)return;
  const area=first.length*first[0]!.length,previous=groups(b,area),current=groups(a,area);
  const {motions,stationary}=changed(previous,current);
  const seen=new Set<string>();
  for(const actor of motions)for(const peer of motions){
    if(actor===peer||actor.delta.join(',')!==peer.delta.join(','))continue;
    const scale=Math.abs(actor.delta[0]||actor.delta[1]),off=gridFor(actor.from,scale);
    if(cellOf(actor.to,scale,off).join(',')!==cellOf(peer.from,scale,off).join(','))continue;
    if(cellOf(actor.from,scale,off).join(',')===cellOf(peer.from,scale,off).join(','))continue;
    for(const m of layouts(actor,peer,second,current,memory,input,a.observation_ref)){
      const key=JSON.stringify([m.actor,m.peer,m.floor,m.targets]);
      if(!seen.has(key)&&memory.candidates.length<12){seen.add(key);memory.candidates.push(m);}
    }
  }
  for(const move of motions){
    if(!memory.controls[move.shape]&&Object.keys(memory.controls).length>=48)continue;
    const controls=memory.controls[move.shape]??={}, old=controls[input];
    if(old&&old.delta.join(',')!==move.delta.join(',')){old.inconsistent=true;continue;}
    if(old?.inconsistent)continue;
    const scale=Math.abs(move.delta[0]||move.delta[1]),offset=gridFor(move.from,scale),from=cellOf(move.from,scale,offset),to=cellOf(move.to,scale,offset);
    const motor:Motor=old??{delta:move.delta,ref:a.observation_ref,stationary:{},surfaces:[]};
    const observed=[uncoveredGround(tile(first,scale,offset,from),tile(second,scale,offset,from),scale),
      uncoveredGround(tile(second,scale,offset,to),tile(first,scale,offset,to),scale)].filter((v):v is number=>v!==undefined);
    for(const shape of stationary.slice(0,128))motor.stationary[shape]??=a.observation_ref;
    motor.surfaces=[...new Set([...motor.surfaces,...observed])];controls[input]=motor;
    const grid=[scale,...offset].join(',');
    if(observed.length&&!memory.sites[grid]&&Object.keys(memory.sites).length<6)memory.sites[grid]=initialSites(first,previous,scale,offset,observed);
  }
}
export function contactScene(model:ContactBasis,o:NativeObservation,rows:NativeRows):JointScene|null {
  const floor=new Set(model.floor), fixed=new Set(model.otherActors);
  const cells=(shape:string)=>o.entities.filter(p=>p.signature===shape).map(p=>cellOf(p.bbox,model.scale,model.offset)).filter(p=>floor.has(p.join(',')));
  const actors=cells(model.actor),players=actors.filter(p=>!fixed.has(p.join(','))),boxes=new Set(cells(model.peer).map(p=>p.join(',')));
  if(players.length!==1||actors.length!==fixed.size+1||!model.otherActors.every(k=>actors.some(p=>p.join(',')===k))
    ||boxes.has(players[0]!.join(','))||boxes.size!==model.targets.length)return null;
  const occupied=new Set([...boxes,...actors.map(cell=>cell.join(','))]),targets=new Set(model.targets);
  for(const id of floor){
    if(occupied.has(id))continue;
    const pixels=tile(rows,model.scale,model.offset,id.split(',').map(Number) as Cell);
    if(!pixels||tileSite(pixels,model.surfaces,model.scale)!==(targets.has(id)?model.targetMask:''))return null;
  }
  return {scale:model.scale,offset:model.offset,player:players[0]!,floor,boxes,targets,wall_count:0,sprite_count:1+boxes.size+model.targets.length};
}
export function bestContactPlan(models:ContactBasis[],o:NativeObservation,rows:NativeRows,remaining:number,deadline:number,now:()=>number,confirmed:boolean) {
  type Plan = {model:ContactBasis;scene:JointScene;route:ReturnType<typeof exactJointPath>['path']};
  let best:Plan|null=null;
  for(const model of models){
    if(!confirmed&&model.ref!==o.observation_ref)continue;
    const scene=contactScene(model,o,rows);if(!scene)continue;
    const starts=confirmed?['']:model.alternatives;
    for(const input of starts){
      if(now()>=deadline)return best;
      const step=input?jointSuccessor([scene.player,scene.boxes],model.directions[input]!,scene.floor):null;
      if(input&&(!step||step[1]))continue;
      try{
        const route=exactJointPath(step?{...scene,player:step[0][0]}:scene,model.directions,deadline,now).path;
        if(step)route.unshift([input,false,step[0]]);
        if(route.length&&route.length<=remaining&&(!best||route.length<best.route.length))best={scene,route,model};
      }catch{ /* This disposition or the measured controls do not yield a feasible route. */ }
    }
  }
  return best;
}
