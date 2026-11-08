/** Exact consumed projections of V5 _slide and advance_patrol_tick.
 * The V6 cavity callers construct one unit actor, ordered slide, WRAP_ANCHOR,
 * no paint or patrol in _slide, and one composite patrol with no capture target.
 * These are explicit caller contracts, not inferred game semantics.
 */
import { supportKey as key }from'./v6-support-measurements.ts';
type R=Record<string,any>;type P=[number,number];
const mod=(a:number,b:number)=>((a%b)+b)%b;
export function advanceCavitySlide(cells:readonly R[],position:P,delta:P,columns:number,rows:number,maximumDepth:number,maximum=65536):R{
 const terrain=new Map<string,R>(cells.map(c=>[key([c.x,c.y]),c]));let current:P=[...position],work=0,terminated=false;const path:P[]=[[...position]],seen=new Set([key(position)]);
 for(let round=0;round<=maximumDepth;round++){
  if(round>=maximumDepth)return {position:current,debt:[],work,bound:true,path};let moved=false;
  if(!terminated){const effort=3*cells.length+4;if(work+effort>maximum)return {position:current,debt:[],work,bound:true,path};work+=effort;const next:P=[mod(current[0]+delta[0],columns),mod(current[1]+delta[1],rows)],cell=terrain.get(key(next));
   if(cell?.terrain!=='BLOCKED'){
    if(!cell||cell.terrain==='UNKNOWN'||cell.evidence_ref==null)return {position:current,debt:['current_complete_slide_support'],work,bound:false,path};
    // Cavity callers never supply paint, additional members, backing seats,
    // hazards or clock events. The source tests each of these as empty.
    const changed=key(next)!==key(current);if(changed&&seen.has(key(next)))terminated=true;else if(changed){current=next;path.push(next);seen.add(key(next));moved=true;}
   }
  }
  if(!moved)break;
 }
 return {position:current,debt:[],work,bound:false,path};
}
/** One source-owned K13 pre-input event. Unknown terrain remains a refusal. */
export function advanceCavityPatrol(body:R,cells:readonly R[],response:'REVERSE_ONLY'|'REVERSE_AND_ATTEMPT',maximum=65536):R{
 const work=3*cells.length+4*body.offsets.length;if(work>maximum)return {completed:false,body,work:0,debt:[],bound:true};const terrain=new Map(cells.map(c=>[key([c.x,c.y]),c]));
 const destination=(dx:number,dy:number):[boolean,boolean]=>{let blocked=false,unknown=false;for(const [x,y]of body.offsets){const c=terrain.get(key([body.x+x+dx,body.y+y+dy]));if(c?.support==='BLOCKED')blocked=true;else if(!c||c.support==='UNKNOWN'||c.evidence_ref==null)unknown=true;}return [blocked,unknown];};
 const [blocked,unknown]=destination(body.dx,body.dy);if(unknown&&!blocked)return {completed:false,body,work,debt:['current_patrol_destination_support'],bound:false};let after={...body};
 if(blocked){after={...after,dx:-body.dx||0,dy:-body.dy||0};if(response==='REVERSE_AND_ATTEMPT'){const [rb,ru]=destination(after.dx,after.dy);if(ru&&!rb)return {completed:false,body,work,debt:['current_reversed_patrol_destination_support'],bound:false};if(!rb)after={...after,x:body.x+after.dx,y:body.y+after.dy};}}
 else after={...after,x:body.x+body.dx,y:body.y+body.dy};after.phase=(body.phase+1)%1;return {completed:true,body:after,work,debt:[],bound:false};
}
