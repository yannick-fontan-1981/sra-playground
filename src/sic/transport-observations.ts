import type {NativeRows} from '../logos-engine/v6-native-types.ts';
import type {VisualLayout} from './witnessed-preview-transfer.ts';

export type TransportSide=0|1;
type Grid={pitch:number;left:number;top:number;columns:number;rows:number};
export type TransportReading={subject:[number,number];tiles:string[]};
type Reading=TransportReading;
type Push={side:TransportSide;piece:string;floor:string;ref:string;material?:string;support?:string};
type Exchange={side:TransportSide;piece:string;floor:string;ref:string};
export type TransportMemory={grid:Grid;inks:[number,number];active:TransportSide;selection:string;mark:number;
  motors:Record<string,{dx:number;dy:number;ref:string}>;verified:[boolean,boolean];swap?:Exchange;push?:Push;
  supportRef?:string;partnerExchange?:string;supportSites?:number[];goals?:number[];denied:Record<string,true>;plan?:TransportStep[];planReason?:string;lastOffer?:string};
export type TransportState={subjects:[number,number];pieces:number[];supports:number[];active:TransportSide};
export type TransportStep={state:TransportState;command:string;after:TransportState};
export type TransportForecast={purpose:string;command:string;from:TransportState;expected:TransportState;target:number[];evidence:string[];open:string[];key:string;
  projectedSetup?:{operator:TransportSide;pivot:number;launch:number;landing:number;firstCommand:string};
  releasedAccess?:{phase:'select'|'test';side:TransportSide;held:number;before:number;after:number;ticket:string};
  regionEntry?:{site:number;source:number;objectives:number[];ticket:string};
  motionTest?:{predictions:{law:string;pose:string}[];maximumRemaining:number};
  motionPreparation?:{steps:number;at:string;test:string;predictions:{law:string;pose:string}[]};
  paired?:{laws:string[];radius:number;lesson?:string;scope?:string};
  crossing?:{gate:number;control:number;material:number[];missing:number[];pusher:TransportSide;swapper:TransportSide;heldAfter:boolean};
  coverage?:{controls:number[];gate:number;goals:number[];laws:{kind:string;radius:number}[];contactPreparation?:{side:TransportSide;stand:number;command:string;departed:number[];arrivals:number[]};testPeerPush?:boolean;openBefore:boolean;openAfter:boolean}};
export const sameSites=(a:number[],b:number[])=>a.length===b.length&&a.every((v,i)=>v===b[i]);
export const poseId=(s:TransportState)=>[s.active,s.subjects.join(','),s.pieces.join(','),s.supports.join(',')].join('/');
export const sitePoint=(g:Grid,n:number)=>[g.left+(n%g.columns)*g.pitch+Math.floor(g.pitch/2),g.top+Math.floor(n/g.columns)*g.pitch+Math.floor(g.pitch/2)];
const pixels=(key:string)=>key.split(',').map(Number);
const uniform=(key:string)=>key!==''&&new Set(key.split(',')).size===1;
function cells(g:Grid,rows:NativeRows){
  const tiles:string[]=[];
  for(let row=0;row<g.rows;row++)for(let col=0;col<g.columns;col++){
    const x=g.left+col*g.pitch,y=g.top+row*g.pitch,tile:number[]=[];
    for(let j=0;j<g.pitch;j++)for(let i=0;i<g.pitch;i++)tile.push(rows[y+j]![x+i]!);
    tiles.push(tile.join(','));
  }
  return tiles;
}
function read(tiles:string[],inks:[number,number]):Reading|undefined{
  const positions=inks.map(ink=>{const part=','+ink+',';return tiles.flatMap((tile,i)=>(','+tile+',').includes(part)?[i]:[]);});
  if(positions.some(p=>p.length!==1)||positions[0]![0]===positions[1]![0])return;
  return {tiles,subject:[positions[0]![0]!,positions[1]![0]!]};
}
function uniqueInk(a:number[],b:number[],peer:number[]){
  const shared=[...new Set(a)].filter(v=>b.includes(v)&&!peer.includes(v));
  return shared.length===1?shared[0]:undefined;
}
export function detectTransportSelection(l:VisualLayout,rows:NativeRows,next:NativeRows,click:number[],ref:string):TransportMemory|undefined{
  const tried=new Set<string>();
  for(const group of Object.values(l)){
    if(group.length<2)continue;
    const box=group[0]!.box,pitch=box[2]!-box[0]!+1;
    if(pitch<3||pitch%2===0||group.some(p=>p.box[2]!-p.box[0]!+1!==pitch||p.box[3]!-p.box[1]!+1!==pitch))continue;
    const left=box[0]!%pitch,top=box[1]!%pitch,key=[pitch,left,top].join();
    if(tried.has(key))continue;tried.add(key);
    const grid={pitch,left,top,columns:Math.floor((rows[0]!.length-left)/pitch),rows:Math.floor((rows.length-top)/pitch)};
    const first=cells(grid,rows),second=cells(grid,next),changes=first.flatMap((v,i)=>v!==second[i]?[i]:[]);
    const target=Math.floor((click[0]!-left)/pitch)+grid.columns*Math.floor((click[1]!-top)/pitch);
    if(changes.length!==2||!changes.includes(target))continue;
    const prior=changes.find(n=>n!==target)!,a=pixels(first[prior]!),aa=pixels(second[prior]!),b=pixels(first[target]!),bb=pixels(second[target]!);
    const mark=a.filter(v=>!aa.includes(v)&&!b.includes(v)&&bb.includes(v))[0];
    const i=uniqueInk(a,aa,[...b,...bb]),j=uniqueInk(b,bb,[...a,...aa]);
    if(i===undefined||j===undefined||mark===undefined||!read(second,[i,j]))continue;
    return {grid,inks:[i,j],active:1,selection:ref,mark,motors:{},verified:[false,false],denied:{}};
  }
}
export function neighbor(g:Grid,site:number,dx:number,dy:number){
  const x=site%g.columns+dx,y=Math.floor(site/g.columns)+dy;
  return x>=0&&x<g.columns&&y>=0&&y<g.rows?y*g.columns+x:-1;
}
export const tileUniform=uniform;
export function readTransport(m:TransportMemory,rows:NativeRows){return read(cells(m.grid,rows),m.inks);}
export function observeTransport(m:TransportMemory,rows:NativeRows,afterRows:NativeRows,op:string,ref:string,forecast?:TransportForecast){
  const b=readTransport(m,rows),a=readTransport(m,afterRows);if(!b||!a)return;
  if(op.startsWith('ACTION6:')){
    const point=op.slice(8).split(',').map(Number),side=a.subject.findIndex(n=>{const [x,y]=sitePoint(m.grid,n);return Math.max(Math.abs(x!-point[0]!),Math.abs(y!-point[1]!))<=Math.floor(m.grid.pitch/2);});
    if(side>=0&&pixels(a.tiles[a.subject[side as TransportSide]]!).includes(m.mark)&&sameSites(a.subject,b.subject))m.active=side as TransportSide;
  }else if(/^ACTION[1-4]$/.test(op)){
    const side=m.active,peer=side===0?1:0,from=b.subject[side],to=a.subject[side],cols=m.grid.columns;
    const dx=to%cols-from%cols,dy=Math.floor(to/cols)-Math.floor(from/cols);
    if((dx===0)!==(dy===0)){
      const length=Math.abs(dx)+Math.abs(dy),held=b.subject[peer]===a.subject[peer],floor=a.tiles[from]!,piece=b.tiles[to]!;
      if(length===1&&held){m.verified[side]=true;m.motors[op]={dx:Math.sign(dx),dy:Math.sign(dy),ref};}
      if(length>1&&to===b.subject[peer]&&a.subject[peer]===from)m.partnerExchange=ref;
      if(length>1&&held&&!uniform(piece)&&floor===piece&&b.tiles.filter(t=>t===piece).length>1){
        const ground=b.tiles[from]!.split(',').find(x=>x!==String(m.mark)&&!m.inks.includes(Number(x))&&a.tiles[to]!.split(',').includes(x));
        if(ground!==undefined){m.swap={side,piece,floor:Array(m.grid.pitch**2).fill(ground).join(','),ref};m.verified[side]=true;m.motors[op]={dx:Math.sign(dx),dy:Math.sign(dy),ref};}
      }
      if(length===1&&held&&uniform(floor)&&!uniform(piece)&&b.tiles.filter(t=>t===piece).length>1){
        const ahead=neighbor(m.grid,to,dx,dy);if(ahead>=0){
          const old=b.tiles[ahead]!,fresh=a.tiles[ahead]!;
          if(old!==fresh&&(fresh===piece||uniform(old)&&old!==floor&&!uniform(fresh))){
            const previous=m.push?.side===side&&m.push.piece===piece?m.push:undefined;
            m.push={...previous,side,piece,floor,ref,...(fresh!==piece?{material:old,support:fresh}:{})};
            if(fresh!==piece)m.supportSites=[...new Set([...(m.supportSites??[]),ahead])];
          }
        }
      }
      if(m.push?.support&&held&&b.tiles[to]===m.push.support)m.supportRef=ref;
    }
  }
  if(forecast){
    const visible=transportState(m,a),expected=forecast.expected;
    if(!visible||!sameSites(visible.subjects,expected.subjects)||visible.active!==expected.active||
      !sameSites(visible.pieces,expected.pieces)||!sameSites(visible.supports,expected.supports)){
      m.denied[forecast.key]=true;delete m.plan;return 'transport_prediction_refuted';
    }
    if(m.plan?.length&&m.plan[0]!.command===forecast.command)m.plan.shift();
    return 'transport_prediction_verified';
  }
}
export function transportState(m:TransportMemory,r:Reading):TransportState|undefined{
  const piece=m.swap?.piece??m.push?.piece;if(!piece)return;
  const supports=new Set<number>(r.tiles.flatMap((t,i)=>m.push?.support&&t===m.push.support?[i]:[]));
  // A subject or a crate can temporarily obscure an already verified support.
  for(const p of m.supportSites??[])if(r.subject.includes(p)||r.tiles[p]===piece)supports.add(p);
  return {subjects:r.subject,pieces:r.tiles.flatMap((t,i)=>t===piece?[i]:[]),supports:[...supports].sort((a,b)=>a-b),active:m.active};
}
