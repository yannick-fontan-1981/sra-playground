import type {NativeObservation} from '../logos-engine/v6-native-types.ts';
import type {LandmarkTrial} from './paired-landmark-placement.ts';
import type {CursorTrial} from './marked-cursor-selection.ts';
import type {VisualLayout} from './witnessed-preview-transfer.ts';
import {observedBodyClick} from './test-partner-preparation.ts';

type Visit={returned:string;times:number;ref:string};
export type PlacementVisits={edges:Record<string,Visit>;tested:Record<string,true>};
const key=(frame:string,p:LandmarkTrial)=>JSON.stringify([frame,p.actor,p.peer,p.home,p.guard,p.command]);
export function recordPlacementVisit(book:PlacementVisits,p:LandmarkTrial,from:string,to:string,ref:string){
  if(p.stage!=='place_before_selection'||!p.selection.contrast)return;
  const k=key(from,p),old=book.edges[k];
  book.edges[k]={returned:to,times:old?.returned===to?old.times+1:1,ref};
}
export function challengePlacement(book:PlacementVisits,p:LandmarkTrial,o:NativeObservation,l:VisualLayout):CursorTrial|undefined{
  if(p.stage!=='place_before_selection'||!p.selection.contrast)return;
  const k=key(o.frame_hash,p),known=book.edges[k];
  if(!known||known.times<2||book.tested[k])return;
  const command=observedBodyClick(l,p.peer,o),a=l[p.actor],b=l[p.peer];
  if(!command||a?.length!==1||b?.length!==1)return;
  const [x,y]=command.slice(8).split(',').map(Number),prior=p.selection;
  const bounds=(box:readonly number[]):typeof prior.source.box=>[box[0]!,box[1]!,box[2]!,box[3]!];
  return {...prior,stage:'select',command,point:[x!,y!],source:{...prior.source,box:bounds(a[0]!.box)},
    target:{...prior.target,box:bounds(b[0]!.box)},
    recurrentPlacement:{key:k,verifiedReturns:known.times,alternative:prior.contrast!.motor,returnedFrame:known.returned},
    evidence:[...new Set([...prior.evidence,known.ref,o.observation_ref])]};
}
