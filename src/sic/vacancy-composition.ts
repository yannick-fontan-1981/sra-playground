import {referencePopulationCellKey as key,referencePopulationPaths, type ReferencePopulationCell as Cell} from '../logos-engine/v6-reference-population-observation.ts';

export type VacancyMove = {from:Cell; to:Cell; input:string; select:boolean};
type Controls=Record<string,{delta:Cell}>;

// Move the nearest piece into the last empty cell on the path. This opens a
// place for the next piece. Internal cells recover their original occupancy.
export function composeVacancyMoves(floor: Cell[], bodies: Cell[], goals: Cell[], controls: Controls, deadline=Infinity): VacancyMove[]|null {
  const wanted=new Set(goals.map(key)), occupied=new Map(bodies.map(p=>[key(p),p]));
  if(wanted.size!==goals.length || occupied.size!==bodies.length || goals.length!==bodies.length)return null;
  const moves:VacancyMove[]=[], paths=new Map<string,ReturnType<typeof referencePopulationPaths>>();
  while(true){
    const missing=goals.filter(p=>!occupied.has(key(p)));
    if(!missing.length)return moves;
    let preferred:VacancyMove[]|null=null, cost=Infinity;
    for(const [source,cell] of occupied){
      if(wanted.has(source))continue;
      if(performance.now()>=deadline)return null;
      let reachable=paths.get(source);
      if(!reachable){reachable=referencePopulationPaths(cell,floor,[],controls);paths.set(source,reachable);}
      for(const goal of missing){
        const route=reachable.get(key(goal));
        if(!route)continue;
        const [inputs,sites]=route, sequence:VacancyMove[]=[];let hole=sites.length-1,selections=0;
        for(let start=hole-1;start>=0;start--){
          if(!occupied.has(key(sites[start]!)))continue;
          selections++;
          for(let i=start;i<hole;i++)sequence.push({from:sites[i]!,to:sites[i+1]!,input:inputs[i]!.action_ref,select:i===start});
          hole=start;
        }
        if(hole===0 && sequence.length+selections<cost){preferred=sequence;cost=sequence.length+selections;}
      }
    }
    if(!preferred)return null;
    for(const move of preferred){
      occupied.delete(key(move.from));occupied.set(key(move.to),move.to);
      moves.push(move);
    }
  }
}
