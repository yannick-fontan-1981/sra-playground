// Plan two preparations from the same observation. They differ only in the last
// motion of the first subject. The second subject then receives the same input.
export type RoleSite = readonly [number, number];
export type MeasuredMotor = {input: string; dx: number; dy: number; ref: number};
export type RoleStep = {input: string; site: RoleSite};
export type OccupancyExperiment = {occupied: RoleStep[]; clear: RoleStep[]; test: MeasuredMotor; destination: RoleSite};
const key = (site: RoleSite) => site.join(',');

export function planRoleOccupancy(
  first: RoleSite, second: RoleSite, motors: readonly MeasuredMotor[],
  possible: (site: RoleSite) => boolean, maxSteps: number,
  exclude: ReadonlySet<string> = new Set(),
): OccupancyExperiment | null {
  const secondKey=key(second);
  if (key(first)===secondKey || maxSteps<1) return null;
  let front: {site: RoleSite; path: RoleStep[]}[]=[{site:first,path:[]}];
  const visited=new Set([key(first)]);
  for(let depth=1;depth<=maxSteps && front.length;depth++){
    const next: typeof front=[];
    for(const {site,path} of front){
      const endings:RoleStep[]=[];
      for(const motor of motors){
        const target:RoleSite=[site[0]+motor.dx,site[1]+motor.dy];
        if(key(target)!==secondKey && possible(target)) endings.push({input:motor.input,site:target});
      }
      for(const test of motors){
        const destination:RoleSite=[second[0]+test.dx,second[1]+test.dy];
        const occupied=endings.find(step=>key(step.site)===key(destination));
        if(!occupied)continue;
        for(const clear of endings){
          if(key(clear.site)===key(destination))continue;
          const signature=[key(first),secondKey,...path.map(p=>p.input),occupied.input,clear.input,test.input].join('/');
          if(!exclude.has(signature))return {occupied:[...path,occupied],clear:[...path,clear],test,destination};
        }
      }
      for(const ending of endings)if(!visited.has(key(ending.site))){
        visited.add(key(ending.site));next.push({site:ending.site,path:[...path,ending]});
      }
    }
    front=next;
  }
  return null;
}
