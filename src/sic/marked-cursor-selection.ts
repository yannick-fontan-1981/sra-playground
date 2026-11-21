import { fallbackPalette } from '../runtime/display-palette.ts';
import type {NativeBox,NativeEntity,NativeObservation,NativePoint,NativeRows} from '../logos-engine/v6-native-types.ts';

type Part = {box:NativeBox; ink:number};
type Motion = {box:NativeBox; form:string; command:string; ref:string; dx:number; dy:number; entry?:string};
type Mark = {source:Part; target:Part; point:NativePoint; offsets:NativePoint[]; ink:number; shape:string};
type ProjectedMove = {command:string; delta:NativePoint; evidence:string};
export type CursorTrial = Mark & { stage:'select'|'verify'; command:string; evidence:string[]; feedback?:boolean; triedMotors?:string[]; passive?:boolean; projectedMove?:ProjectedMove; binding?:string };
export type CursorMemory = {
  motions:Motion[]; tried:string[]; refuted?:string[]; established?:string[]; motorSites?:Record<string,true>; returns?:number; blocked?:string[];
  pending?:CursorTrial; verified?:{shape:string;mark?:number;refs:string[]};
};
export const newCursorMemory=():CursorMemory=>({motions:[],tried:[]});
const tag=(b:NativeBox)=>b.join(',');
const at=(x:number,y:number,b:NativeBox)=>x>=b[0]&&x<=b[2]&&y>=b[1]&&y<=b[3];
const inside=(a:NativeBox,b:NativeBox)=>at(a[0],a[1],b)&&at(a[2],a[3],b);
const disjoint=(a:NativeBox,b:NativeBox)=>a[2]<b[0]||b[2]<a[0]||a[3]<b[1]||b[3]<a[1];
const center=(b:NativeBox):NativePoint=>[Math.floor((b[0]+b[2])/2),Math.floor((b[1]+b[3])/2)];
function clickPoint(peer:NativeEntity):NativePoint {
  const [cx,cy]=center(peer.bbox);
  return peer.mask.map(([x,y]):NativePoint=>[peer.bbox[0]+x,peer.bbox[1]+y]).reduce((best,p)=>
    Math.abs(p[0]-cx)+Math.abs(p[1]-cy)<Math.abs(best[0]-cx)+Math.abs(best[1]-cy)?p:best);
}
const signature=(m:Mark)=>[m.shape,m.ink,m.target.ink,tag(m.target.box)].join('/');
const hypothesis=(m:Mark)=>[m.shape,m.ink,m.source.ink,m.target.ink,JSON.stringify(m.offsets)].join('/');
function bodyAfterClick(part:Part,b:NativeObservation,a:NativeObservation,rows:NativeRows,next:NativeRows):Part|undefined {
  let body=0,retained=0;
  for(let y=part.box[1];y<=part.box[3];y++)for(let x=part.box[0];x<=part.box[2];x++){
    if(rows[y]?.[x]!==part.ink)continue;
    body++;if(next[y]?.[x]===part.ink)retained++;
  }
  if(retained*2>body)return part;
  const box=tag(part.box),before=b.entities.find(e=>e.palette_value===part.ink&&tag(e.bbox)===box);
  if(!before)return;
  const after=a.entities.find(e=>e.area===before.area&&tag(e.bbox)===box&&JSON.stringify(e.mask)===JSON.stringify(before.mask));
  if(after)return {box:part.box,ink:after.palette_value};
}
function refute(m:CursorMemory,t:CursorTrial){
  const refuted=m.refuted??=[];const key=hypothesis(t);
  if(!refuted.includes(key))refuted.push(key);
}
const brightnessCache=new Map<string,number[]>();
function rgb(value:string|undefined) {
  if(!value||!/^#(?:[a-f\d]{3}|[a-f\d]{6})$/i.test(value))return;
  let channels=brightnessCache.get(value);
  if(!channels){
    const h=value.length===4?[...value.slice(1)].map(c=>c+c).join(''):value.slice(1);
    channels=[0,2,4].map(i=>parseInt(h.slice(i,i+2),16));
    if(brightnessCache.size<256)brightnessCache.set(value,channels);
  }
  return channels;
}
function brightAccent(accent:number,body:number,palette:readonly string[]) {
  const a=rgb(palette[accent]),b=rgb(palette[body]);if(!a||!b)return false;
  const high=Math.max(...a),chroma=high-Math.min(...a);
  return high>=168 && (0.213*a[0]!+0.715*a[1]!+0.072*a[2]!>=145||chroma>=80)
    && Math.max(...a.map((v,i)=>Math.abs(v-b[i]!)))>=52;
}
// Pixels newly covered by a translated box are visible before the movement.
function entrySurface(rows:NativeRows,[l,t,r,b]:NativeBox,dx:number,dy:number) {
  if((dx===0)===(dy===0)||Math.abs(dx)>2*(r-l+1)||Math.abs(dy)>2*(b-t+1))return;
  const pixels:number[]=[];
  for(let y=t+dy;y<=b+dy;y++)for(let x=l+dx;x<=r+dx;x++){
    if(l<=x&&x<=r&&t<=y&&y<=b)continue;
    const value=rows[y]?.[x];if(value===undefined)return;
    pixels.push(value);
  }
  return pixels.join(',');
}
function translations(b:NativeObservation,a:NativeObservation,input:string,rows:NativeRows):Motion[] {
  const group=(o:NativeObservation)=>{
    const g=new Map<string,NativeEntity[]>();
    for(const e of o.entities){const list=g.get(e.signature)??[];list.push(e);g.set(e.signature,list);}
    return g;
  };
  const old=group(b),current=group(a),found:Motion[]=[];
  for(const [form,past] of old){
    const now=current.get(form);
    if(!now||now.length!==past.length)continue;
    const prior=new Set(past.map(e=>tag(e.bbox))),present=new Set(now.map(e=>tag(e.bbox)));
    const from=past.filter(e=>!present.has(tag(e.bbox))),to=now.filter(e=>!prior.has(tag(e.bbox)));
    if(from.length!==1||to.length!==1)continue;
    const box=to[0]!.bbox,dx=box[0]-from[0]!.bbox[0],dy=box[1]-from[0]!.bbox[1];
    const entry=entrySurface(rows,from[0]!.bbox,dx,dy);
    found.push({box,form,dx,dy,command:input,ref:a.observation_ref,...(entry?{entry}:{})});
  }
  return found;
}
function compare(rows:NativeRows,box:NativeBox,base:NativeEntity,peer:NativeEntity,accents:NativeEntity[],palette:readonly string[]):Mark|undefined {
  let ink:number|undefined,common=0;
  const offsets:NativePoint[]=[];
  for(let y=0;y<=box[3]-box[1];y++)for(let x=0;x<=box[2]-box[0];x++){
    const first=rows[box[1]+y]?.[box[0]+x],other=rows[peer.bbox[1]+y]?.[peer.bbox[0]+x];
    if(first===undefined||other===undefined)return;
    if(first===base.palette_value && other===peer.palette_value){common++;continue;}
    if(first===other && first!==base.palette_value && other!==peer.palette_value)continue;
    if(first===base.palette_value || (ink!==undefined && first!==ink))return;
    ink=first;offsets.push([x,y]);
  }
  if(ink===undefined || offsets.length>common || common<2 || !brightAccent(ink,base.palette_value,palette))return;
  // Exclude a window onto the background. The complete accent must belong to the sprite.
  const pixels=new Set(offsets.map(([x,y])=>[box[0]+x,box[1]+y].join(',')));
  const mark=accents.find(e=>e.palette_value===ink && e.area===offsets.length && inside(e.bbox,box) &&
    e.mask.every(([x,y])=>pixels.has([e.bbox[0]+x,e.bbox[1]+y].join(','))));
  if(!mark)return;
  return {source:{box,ink:base.palette_value},target:{box:peer.bbox,ink:peer.palette_value},point:clickPoint(peer),offsets,ink,
    shape:JSON.stringify([box[2]-box[0]+1,box[3]-box[1]+1,peer.mask])};
}
function adjacentMark(base:NativeEntity,peer:NativeEntity,accent:NativeEntity,rows:NativeRows):Mark|undefined {
  if(!disjoint(base.bbox,accent.bbox)||base.area!==peer.area||base.area<2*accent.area ||
      JSON.stringify(base.mask)!==JSON.stringify(peer.mask))return;
  const basePixels=new Set(base.mask.map(p=>p.join(',')));
  const offsets:NativePoint[]=accent.mask.map(([x,y])=>[x+accent.bbox[0]-base.bbox[0],y+accent.bbox[1]-base.bbox[1]]);
  if(!offsets.some(([x,y])=>[[x-1,y],[x+1,y],[x,y-1],[x,y+1]].some(p=>basePixels.has(p.join(',')))))return;
  if(offsets.some(([x,y])=>rows[y+peer.bbox[1]]?.[x+peer.bbox[0]]===undefined ||
      rows[y+peer.bbox[1]]?.[x+peer.bbox[0]]===accent.palette_value))return;
  return {source:{box:base.bbox,ink:base.palette_value},target:{box:peer.bbox,ink:peer.palette_value},
    point:clickPoint(peer),offsets,ink:accent.palette_value,shape:JSON.stringify([peer.bbox[2]-peer.bbox[0]+1,peer.bbox[3]-peer.bbox[1]+1,peer.mask])};
}
function findMarks(o:NativeObservation,rows:NativeRows,m:CursorMemory):Mark[] {
  const max=rows.length*(rows[0]?.length??0)/12;
  const parts=o.entities.filter(e=>e.area>=2 && e.area<=max);
  const marks:Mark[]=[];
  for(const base of parts){
    // The controlled piece or its mark must have moved after a public command.
    if(m.motions.length && !m.motions.some(v=>inside(v.box,base.bbox)||inside(base.bbox,v.box)))continue;
    const margin:NativeBox=[base.bbox[0]-1,base.bbox[1]-1,base.bbox[2]+1,base.bbox[3]+1];
    const accents=o.entities.filter(e=>e.area<=base.area && e.palette_value!==base.palette_value &&
        !disjoint(e.bbox,margin) && brightAccent(e.palette_value,base.palette_value,o.palette??fallbackPalette));
    if(!accents.length)continue;
    for(const peer of parts){
      if(!disjoint(base.bbox,peer.bbox))continue;
      const w=peer.bbox[2]-peer.bbox[0]+1,h=peer.bbox[3]-peer.bbox[1]+1;
      const dw=w-(base.bbox[2]-base.bbox[0]+1),dh=h-(base.bbox[3]-base.bbox[1]+1);
      if(dw<0||dh<0||dw>Math.ceil(w/2)||dh>Math.ceil(h/2)||peer.area<base.area/2)continue;
      if(!dw&&!dh)for(const accent of accents){
        const external=adjacentMark(base,peer,accent,rows);
        if(external)marks.push(external);
      }
      for(let oy=0;oy<=dh;oy++)for(let ox=0;ox<=dw;ox++){
        const x=base.bbox[0]-ox,y=base.bbox[1]-oy,box:NativeBox=[x,y,x+w-1,y+h-1];
        if(!disjoint(box,peer.bbox))continue;
        const mark=compare(rows,box,base,peer,accents,o.palette??fallbackPalette);
        if(mark && (!m.motions.length || m.motions.some(v=>inside(v.box,box))))marks.push(mark);
      }
    }
  }
  return marks;
}
function sharedSurroundings(rows:NativeRows,m:Mark) {
  const [x,y,r,b]=m.source.box,[u,v]=m.target.box;let same=0,total=0;
  for(let j=-1;j<=b-y+1;j++)for(let i=-1;i<=r-x+1;i++){
    if(i>=0&&j>=0&&i<=r-x&&j<=b-y)continue;
    const first=rows[y+j]?.[x+i],second=rows[v+j]?.[u+i];
    if(first!==undefined&&second!==undefined){total++;if(first===second)same++;}
  }
  return total?same/total:0;
}
function cursorCandidates(o:NativeObservation,rows:NativeRows,m:CursorMemory) {
  const marks=findMarks(o,rows,m);
  if(new Set(marks.map(v=>tag(v.source.box))).size!==1)return [];
  // A previously witnessed role or a matching body provides more evidence than
  // an isolated icon of the same size. Color is a priority, not a prerequisite.
  const rank=(t:Mark)=>Number(t.source.ink===t.target.ink)+sharedSurroundings(rows,t);
  return marks.sort((a,b)=>rank(b)-rank(a));
}
function possibleMove(m:CursorMemory,mark:Mark,rows:NativeRows) {
  const body=m.motions.find(v=>v.entry&&tag(v.box)===tag(mark.source.box)
    && entrySurface(rows,mark.target.box,v.dx,v.dy)===v.entry);
  if(body)return {command:body.command,delta:[body.dx,body.dy] as NativePoint,evidence:body.ref};
}
export function offerCursorTrial(m:CursorMemory|undefined,o:NativeObservation,rows:NativeRows,allowStatic=false,requireProjection=false):CursorTrial|null {
  if(!m || !o.available_action_refs.includes('ACTION6'))return null;
  if(m.pending)return !m.pending.passive && o.available_action_refs.includes(m.pending.command)?m.pending:null;
  if(!m.motions.length&&!allowStatic)return null;
  const choices=cursorCandidates(o,rows,m).map(mark=>({mark,projectedMove:possibleMove(m,mark,rows)}));
  choices.sort((a,b)=>Number(!!b.projectedMove)-Number(!!a.projectedMove));
  for(const {mark,projectedMove} of choices){
    if(requireProjection&&!projectedMove)continue;
    const familiar=m.established?.includes(hypothesis(mark));
    if(m.tried.includes(signature(mark)) || (!projectedMove && (familiar || m.refuted?.includes(hypothesis(mark)))))continue;
    if(m.verified && mark.source.ink!==mark.target.ink && sharedSurroundings(rows,mark)<0.5)continue;
    const [x,y]=mark.point;
    const evidence=[...new Set(m.motions.filter(v=>inside(v.box,mark.source.box)).map(v=>v.ref))];
    if(m.verified?.shape===mark.shape && m.verified.mark===mark.ink)evidence.push(...m.verified.refs);
    return {...mark,stage:'select',command:'ACTION6:'+x+','+y,evidence,...(projectedMove?{projectedMove}:{})};
  }
  return null;
}
export function recordCursorTrial(m:CursorMemory,b:NativeObservation,a:NativeObservation,rows:NativeRows,next:NativeRows,
  input:string,trial?:CursorTrial) {
  if(b.level_epoch!==a.level_epoch || b.state!==a.state || b.levels_completed!==a.levels_completed){delete m.pending;return;}
  if(!trial && m.pending && (m.pending.command===input || m.pending.passive && /^ACTION[1-4]$/.test(input)))
    trial={...m.pending,command:input};
  if(!trial && input.startsWith('ACTION6:') && m.motions.length && b.frame_hash!==a.frame_hash) {
    const [x,y]=input.slice(8).split(',').map(Number);
    const observed=cursorCandidates(b,rows,m).find(t=>at(x!,y!,t.target.box));
    if(observed)trial={...observed,stage:'select',command:input,evidence:[b.observation_ref],passive:true};
  }
  const moves=/^ACTION[1-4]$/.test(input) && b.frame_hash!==a.frame_hash ? translations(b,a,input,rows):[];
  if(/^ACTION[1-4]$/.test(input)){
    if(moves.length){
      const sites=m.motorSites??={},fresh=moves.some(v=>!sites[v.form+'/'+tag(v.box)]);
      for(const v of moves)sites[v.form+'/'+tag(v.box)]=true;
      m.returns=fresh?0:(m.returns??0)+1;m.blocked=[];
    }else if(b.frame_hash===a.frame_hash && m.motions.length){
      const blocked=m.blocked??=[];if(!blocked.includes(input))blocked.push(input);
    }
  }
  if(trial?.stage==='select'){
    m.tried.push(signature(trial));
    const {source,target,offsets,ink}=trial;
    const marked=(r:NativeRows,p:Part)=>offsets.every(([x,y])=>r[p.box[1]+y]?.[p.box[0]+x]===ink);
    const transfer=marked(rows,source)&&!marked(rows,target)&&!marked(next,source)&&marked(next,target);
    const forecastMotor=trial.projectedMove?.command;
    const motor=forecastMotor&&a.available_action_refs.includes(forecastMotor)?forecastMotor:m.motions.find(v=>inside(v.box,source.box)&&a.available_action_refs.includes(v.command))?.command ??
      (transfer?a.available_action_refs.find(ref=>/^ACTION[1-4]$/.test(ref)):undefined);
    if(motor){
      const sourceNow=transfer?source:bodyAfterClick(source,b,a,rows,next);
      const targetNow=transfer?target:bodyAfterClick(target,b,a,rows,next);
      if(sourceNow&&targetNow)m.pending={...trial,source:sourceNow,target:targetNow,stage:'verify',command:motor,
        binding:hypothesis(trial),passive:!!trial.passive && targetNow.ink===target.ink,
        feedback:transfer,evidence:[...trial.evidence,a.observation_ref]};
    }
    if(!transfer&&!m.pending)refute(m,trial);
    m.motions=[];m.blocked=[];m.returns=0;
    return transfer?'cursor_mark_transferred':b.frame_hash===a.frame_hash?'cursor_click_visually_unchanged':'cursor_mark_prediction_refuted';
  }
  if(trial?.stage==='verify'){
    delete m.pending;
    const oldStill=rows.slice(trial.source.box[1],trial.source.box[3]+1).every((row,i)=>
      row.slice(trial.source.box[0],trial.source.box[2]+1).every((v,j)=>next[trial.source.box[1]+i]?.[trial.source.box[0]+j]===v));
    const target=trial.target;
    const moved=moves.some(v=>{
      if(!inside([v.box[0]-v.dx,v.box[1]-v.dy,v.box[2]-v.dx,v.box[3]-v.dy],target.box))return false;
      let vacated=false,body=0;
      for(let y=target.box[1];y<=target.box[3];y++)for(let x=target.box[0];x<=target.box[2];x++){
        const ink=rows[y]?.[x];if(ink!==target.ink && !(trial.feedback && ink===trial.ink))continue;
        if(next[y+v.dy]?.[x+v.dx]!==ink)return false;
        if(ink===target.ink)body++;
        if(next[y]?.[x]!==ink)vacated=true;
      }
      return vacated && body>0;
    });
    m.motions=moves;
    if(oldStill&&moved){
      m.verified={shape:trial.shape,...(trial.feedback?{mark:trial.ink}:{}),refs:[...trial.evidence,a.observation_ref]};
      const established=m.established??=[],binding=trial.binding??hypothesis(trial);
      if(!established.includes(binding))established.push(binding);
      m.tried.push(signature({...trial,target:trial.source}));
      return 'new_cursor_moved_while_previous_cursor_stayed';
    }
    const triedMotors=[...(trial.triedMotors??[]),input];
    const alternative=a.available_action_refs.find(ref=>/^ACTION[1-4]$/.test(ref)&&!triedMotors.includes(ref));
    if(b.frame_hash===a.frame_hash && alternative){
      m.pending={...trial,command:alternative,triedMotors,evidence:[...trial.evidence,a.observation_ref]};
      return 'cursor_move_blocked_try_another_direction';
    }
    if(!trial.feedback && moves.length)refute(m,trial);
    return 'cursor_control_unconfirmed';
  }
  if(m.pending && b.frame_hash!==a.frame_hash)delete m.pending;
  if(moves.length)m.motions=moves;
  else if(b.frame_hash!==a.frame_hash)m.motions=[];
}
