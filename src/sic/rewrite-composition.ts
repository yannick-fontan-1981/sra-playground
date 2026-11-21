// A hypothesis is a local change produced by a witnessed public command.
// Link two hypotheses only when the first writes a value required by the second.
export type Rewrite = {op:string; changes:[number,number,number][]; guards?:[number,number][]; ref:number; count:number; size:number};
export type Composition = {steps:Rewrite[]; terminalKind:'conserved_colors'|'changed_colors'; continuation?:Rewrite};
function observedFragments(all:Rewrite['changes'],width:number){
  const components:[number,number,number][][]=[];
  const unseen=new Map(all.map(c=>[c[0],c]));
  for(const c of all){
    if(!unseen.delete(c[0]))continue;
    const region=[c];
    for(let i=0;i<region.length;i++){
      const id=region[i]![0],x=id%width;
      for(const neighbor of [x?id-1:-1,x+1<width?id+1:-1,id-width,id+width]){
        const next=unseen.get(neighbor);
        if(next){unseen.delete(neighbor);region.push(next);}
      }
    }
    if(region.length>=2&&region.length<=96)components.push(region.sort((a,b)=>a[0]-b[0]));
  }
  // Keep the joint change when it fits, plus individual spatial effects for a command with several consequences.
  if(components.length===1&&components[0]!.length===all.length)return components;
  return all.length>=2&&all.length<=192?[all,...components]:components;
}
export function learnRewrites(bank:Rewrite[],before:readonly(readonly number[])[],after:readonly(readonly number[])[],op:string,ref:number,withContext=true) {
  const width=before[0]!.length,all:[number,number,number][]=[];
  for(let y=0;y<before.length;y++)for(let x=0;x<width;x++){
    const old=before[y]![x]!,value=after[y]![x]!;
    if(old!==value)all.push([y*width+x,old,value]);
  }
  if(all.length<2||all.length>(withContext?192:640))return;
  const candidates=withContext?[all]:observedFragments(all,width);
  for(const changes of candidates){
    const old=bank.find(v=>v.op===op&&v.changes.length===changes.length&&v.changes[0]![0]===changes[0]![0]&&
      changes.every(([p,from,to],i)=>{const q=v.changes[i]!;return p===q[0]&&from===q[1]&&to===q[2];}));
    if(old){
      old.count++;
      if(old.guards)old.guards=old.guards.filter(([p,v])=>before[Math.floor(p/width)]?.[p%width]===v);
      continue;
    }
    const guards=new Map<number,number>();
    if(withContext){
      const written=new Set(changes.map(([p])=>p));
      for(const [p] of changes){
        const x=p%width,y=Math.floor(p/width);
        for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
          const q=(y+dy)*width+x+dx,value=before[y+dy]?.[x+dx];
          if(value!==undefined&&!written.has(q))guards.set(q,value);
        }
      }
    }
    bank.push({op,changes,...(withContext?{guards:[...guards]}:{}),ref,count:1,size:all.length});
  }
  if(bank.length>128)bank.splice(0,bank.length-128);
}
export function observedRewrite(r:Rewrite,before:readonly(readonly number[])[],after:readonly(readonly number[])[]){
  const width=before[0]!.length;
  return r.changes.every(([p,from,to])=>before[Math.floor(p/width)]?.[p%width]===from&&after[Math.floor(p/width)]?.[p%width]===to);
}
/** Can the same consequence be found elsewhere in the observed transition? */
export function translatedOutcome(rule:Rewrite,before:readonly(readonly number[])[],after:readonly(readonly number[])[]){
  const w=before[0]!.length,[anchor,old,value]=rule.changes[0]!,ax=anchor%w,ay=Math.floor(anchor/w);
  for(let y=0;y<before.length;y++)for(let x=0;x<w;x++){
    if(before[y]![x]!==old||after[y]![x]!==value)continue;
    if(rule.changes.every(([p,a,b])=>{
      const row=y+Math.floor(p/w)-ay,col=x+p%w-ax;
      return before[row]?.[col]===a&&after[row]?.[col]===b;
    }))return true;
  }
  return false;
}
function resultKind(step:Rewrite) {
  const balance=new Map<number,number>();
  for(const [,from,to] of step.changes){balance.set(from,(balance.get(from)??0)-1);balance.set(to,(balance.get(to)??0)+1);}
  return [...balance.values()].some(v=>v!==0)?'changed_colors' as const:'conserved_colors' as const;
}
// These conditions are observations on changed cells. Additional hidden conditions can refute a program.
export type EffectProgram = {steps:Rewrite[]; requires:Map<number,number>; produces:Map<number,number>};
export function primitiveProgram(step:Rewrite):EffectProgram {
  return {steps:[step],requires:new Map([...(step.guards??[]),...step.changes.map(([p,v]):[number,number]=>[p,v])]),produces:new Map(step.changes.map(([p,,v])=>[p,v]))};
}
export function joinPrograms(left:EffectProgram,right:EffectProgram):EffectProgram|null {
  const requires=new Map(left.requires),produces=new Map(left.produces);
  for(const [site,value] of right.requires){
    const supplied=produces.get(site);
    if(supplied!==undefined){if(supplied!==value)return null;}
    else {
      if(requires.has(site)&&requires.get(site)!==value)return null;
      requires.set(site,value);
    }
  }
  for(const [site,value] of right.produces)produces.set(site,value);
  return {steps:[...left.steps,...right.steps],requires,produces};
}
type GoalFact = {site:number;value:number};
export type CompositionCoverage=Record<string,string[]>;
// An order-independent fingerprint allows scoring a predicted layout from its sparse writes.
// It is a preference signal. Execution still checks each measured condition on the real board.
function cellToken(p:number,v:number) {
  let h=Math.imul(p+1,0x9e3779b1)^Math.imul(v+1,0x85ebca77);
  h=Math.imul(h^(h>>>16),0x7feb352d);
  return h^(h>>>15);
}
function boardSignature(values:readonly number[]) {
  let signature=0;
  for(let p=0;p<values.length;p++)signature^=cellToken(p,values[p]!);
  return signature;
}
export function recordCompositionCoverage(coverage:CompositionCoverage,rows:readonly(readonly number[])[],op?:string){
  const k=String(boardSignature(rows.flat()));
  const entry=coverage[k]??=[];
  if(op&&!entry.includes(op))entry.push(op);
}
type Request = {length?:number; limit?:number; target?:GoalFact; targets?:readonly GoalFact[]; preserve?:ReadonlyMap<number,number>;
  verified?:readonly Rewrite[][]; blocked?:ReadonlySet<string>; coverage?:CompositionCoverage;
  requireContinuation?:boolean; completed?:ReadonlySet<string>};
export const effectSite=(r:Rewrite)=>r.op+'/'+r.ref;
export function composeRewrites(bank:Rewrite[],rows:readonly(readonly number[])[],history:readonly string[],available:readonly string[],
  exclude:Set<string>=new Set(),request:Request={}):Composition|null {
  const length=request.length??3,limit=request.limit??3500;
  if(!Number.isInteger(length)||length<2||length>limit)return null;
  const values=rows.flat(),allowed=new Set(available),empty=new Map<number,number>();
  const root=request.coverage?boardSignature(values):0;
  // A similar-looking scene may still be new. Allow direct exploration there before a detour.
  if(request.requireContinuation&&!request.coverage?.[String(root)]?.length)return null;
  const known=bank.filter(r=>allowed.has(r.op.split(':')[0]!) && r.changes.every(([p,,v])=>
    !request.preserve?.has(p)||request.preserve.get(p)===v));
  if(request.preserve&&[...request.preserve].some(([site,value])=>values[site]!==value))return null;
  const goals=[...(request.targets??[]),...(request.target?[request.target]:[])];
  if(goals.length&&goals.every(g=>values[g.site]===g.value))return null;
  const programs=known.map(primitiveProgram);
  for(const block of request.verified??[]){
    if(block.length<2||block.length>=length||block.some(step=>!allowed.has(step.op.split(':')[0]!)||
      step.changes.some(([p,,v])=>request.preserve?.has(p)&&request.preserve.get(p)!==v)))continue;
    let composed:EffectProgram|null=primitiveProgram(block[0]!);
    for(const step of block.slice(1)){composed=joinPrograms(composed!,primitiveProgram(step));if(!composed)break;}
    if(composed)programs.unshift(composed);
  }
  function enabled(q:EffectProgram,writes:Map<number,number>){
    for(const [p,v] of q.requires)if((writes.get(p)??values[p])!==v)return false;
    return true;
  }
  const ready=programs.filter(q=>enabled(q,empty)),unready=programs.filter(q=>!enabled(q,empty));
  const prior=new Set(history.slice(length-1).map((_,i)=>history.slice(i,i+length).join('/')));
  const longer=request.coverage?new Set(history.slice(length).map((_,i)=>history.slice(i,i+length+1).join('/'))):null;
  let best:Composition|null=null,bestScore=-Infinity,expanded=0;
  function extend(path:EffectProgram,previous:Map<number,number>){
    const steps=path.steps;
    if(steps.length===length){
      if(goals.some(g=>(path.produces.get(g.site)??values[g.site])!==g.value))return;
      const word=steps.map(s=>s.op).join('/');
      if(prior.has(word)||exclude.has(word)||steps.every((s,i)=>!i||s.ref===steps[i-1]!.ref+1))return;
      const last=steps.at(-1)!;
      let interest=0,continuation:Rewrite|undefined;
      if(request.coverage){
        let predicted=root;
        for(const [p,v] of path.produces)predicted^=cellToken(p,values[p]!)^cellToken(p,v);
        const seen=request.coverage[String(predicted)];
        if(!seen&&predicted!==root)interest+=24;
        const next=unready.find(q=>{
          const action=q.steps[0]!;
          if(q.steps.length!==1 || action.op===last.op || request.completed?.has(effectSite(action))
            || seen?.includes(action.op) || longer?.has(word+'/'+action.op)
            || enabled(q,previous) || !enabled(q,path.produces))return false;
          let destination=predicted;
          for(const [site,from,to] of action.changes)destination^=cellToken(site,from)^cellToken(site,to);
          return destination!==root && !request.coverage![String(destination)];
        });
        if(next){continuation=next.steps[0];interest+=48;}
      }
      if(request.requireContinuation&&!continuation)return;
      const rank=interest + Number(request.blocked?.has(last.op)??false)*64 + new Set(steps.map(s=>s.op)).size*8 + Math.min(4,steps.reduce((a,s)=>a+s.count-1,0))
        + steps.filter(s=>s.size===s.changes.length).length + Math.min(1,last.changes.length/32);
      if(rank>bestScore){bestScore=rank;best={steps,terminalKind:resultKind(last),...(continuation?{continuation}:{})};}
      return;
    }
    for(const next of goals.length?programs:unready){
      if(expanded>=limit)break;
      if(next.steps.length+steps.length>length || !enabled(next,path.produces))continue;
      if(!goals.length && (next.steps[0]!.op===steps.at(-1)!.op || enabled(next,previous)))continue;
      const linked=joinPrograms(path,next);
      if(linked){expanded++;extend(linked,path.produces);}
    }
  }
  for(const start of ready){if(expanded>=limit)break;extend(start,empty);}
  return best;
}
