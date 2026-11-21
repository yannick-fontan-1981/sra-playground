import {cellMatches} from './calibrate-spatial-controls.ts';
import {aligned} from './controlled-parts.ts';
import {add,diff,same,type XY} from './access-terrain.ts';
import type {VisualLayout} from './witnessed-preview-transfer.ts';

export type DisplacedDestination={role:string;from:XY;to:XY;stationaryCopies:XY[];partner:XY;ref:string};

export function measureDisplacedDestination(before:VisualLayout,after:VisualLayout,role:string,site:XY,
  actor:string,peer:string,partner:XY,pitch:XY,ref:string):DisplacedDestination|undefined {
  const start=before[actor],end=after[actor],guard=after[peer],old=before[role],fresh=after[role];
  if(start?.length!==1||end?.length!==1||guard?.length!==1||!old?.length||fresh?.length!==old.length)return;
  if(!cellMatches(guard[0]!.at,partner,pitch)||!cellMatches(end[0]!.at,site,pitch))return;
  const a=aligned(start[0]!.at,site,pitch),d=diff(site,a);
  if(!((Math.abs(d[0])===pitch[0]&&d[1]===0)||(Math.abs(d[1])===pitch[1]&&d[0]===0)))return;
  const removed=old.filter(p=>!fresh.some(q=>cellMatches(q.at,p.at,pitch)));
  const added=fresh.filter(p=>!old.some(q=>cellMatches(q.at,p.at,pitch)));
  if(removed.length!==1||added.length!==1||!cellMatches(removed[0]!.at,site,pitch)||
     !cellMatches(added[0]!.at,add(site,d),pitch))return;
  const stationaryCopies=old.filter(p=>p!==removed[0]).map(p=>p.at);
  if(!stationaryCopies.every(p=>fresh.some(q=>same(p,q.at))))return;
  return {role,from:removed[0]!.at,to:added[0]!.at,stationaryCopies,partner,ref};
}
