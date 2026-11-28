import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync,writeFileSync } from 'node:fs';
import { dirname,join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { mount } from '../ls19-ligne-90/montage.mjs';

const [sha,group,vendor,out,selection,nominal]=process.argv.slice(2);
const base='d0e7527ca8033bd805a6d7a8bb021eff62e87021', candidate='484f3f0d066b7c00a3e2ad68c983ad556be3a3ac';
assert.ok([base,candidate].includes(sha));
const catalog=gestes=>({version:'sic.as66/1',limite:16,gestes,examiner:[]});
const coverage=gestes=>({...catalog(gestes),limite:null});
const specs={
  nominal:[['catalogue',catalog(16)],['couverture',coverage(19)]],
  développement:[
    ['sansAccès',{...catalog(6),intervention:{geste:5,type:'retirer_acces'}}],
    ['sansDirection',{...catalog(6),intervention:{geste:5,type:'direction'}}],
    ['sansHorloge',{...coverage(15),intervention:{geste:14,type:'retirer_horloge'}}],
    ['mêmeCommande',{...coverage(15),intervention:{geste:14,type:'mêmeCommande'}}],
  ],
};
let eligible;
if(group==='réserve'){
  const bytes=readFileSync(selection);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),'36aafe97c2b95275d02626f61def14953f9316a7aa362d13652726ead732efe5');
  const seed=Buffer.from(JSON.parse(bytes).seed,'hex');
  const data=JSON.parse(readFileSync(nominal));
  assert.equal(data.sha,sha);assert.equal(data.group,'nominal');
  const steps=data.results.couverture.steps;
  eligible=steps.filter((s,i)=>s.before.type==='clocked_cavity_access' && s.before.arretPrevu &&
    s.after.accord===true && s.after.physique!==s.before.image && steps[i+1]?.before.indice===s.before.indice+1).map(s=>s.geste);
  assert.ok(eligible.length);
  const n=eligible[seed[0]%eligible.length];
  specs.réserve=[
    ['stationnaire84',{...catalog(6),inspectOnlyAt:6,intervention:{geste:5,type:'stationnaire84'}}],
    ['stationnaire97',{...coverage(n+1),inspectOnlyAt:n+1,intervention:{geste:n,type:'stationnaire97'}}],
  ];
}
assert.ok(specs[group]);
const work=mount(sha,'.');
try {
  const repo=execFileSync('git',['rev-parse','--show-toplevel'],{encoding:'utf8'}).trim();
  const tar=join(work.program,'operator.tar'), exp='experiments/sic-agenda-offres/';
  execFileSync('git',['-C',repo,'archive','--output='+tar,candidate,exp+'evaluateur-jeu.mjs',exp+'frontiere-22-23/game.mjs',
    exp+'moteur-reference.mjs',exp+'as66-84-97','public/python']);
  execFileSync('tar',['-xf',tar,'-C',work.program]);
  const source=join(work.program,exp,'as66-84-97','operateur.mjs');
  let code=readFileSync(source,'utf8');
  function replace(anchor,substitution){
    assert.equal(code.split(anchor).length,2,anchor);code=code.replace(anchor,substitution);
  }
  // Apply evidence edits only inside the live proposal call. Compare the real ticket and return.
  replace('const p=await propose.apply(this,args);',`let p;
    const savedDirections=this.directions,savedPhases=this.clock.measurements;
    try {
      if(intervention()==='direction'){this.directions={...savedDirections};delete this.directions.ACTION2;}
      if(intervention()==='mêmeCommande'){
        assert.ok(savedPhases.length>=2);
        this.clock.measurements=savedPhases.slice();
        this.clock.measurements[this.clock.measurements.length-1]={...savedPhases.at(-1),action:savedPhases.at(-2).action};
      }
      pre.directionsServies={...this.directions};
      pre.phaseServie=this.clock.measurements.slice(-2).map(phase);
      p=await propose.apply(this,args);
    } finally {if(intervention()==='direction')this.directions=savedDirections;
      if(intervention()==='mêmeCommande')this.clock.measurements=savedPhases;}`);
  replace('const before={niveau:board.level,ref','const before={niveau:board.level,image:digest(board.frame),ref');
  replace('const next=await game.step(Number(ticket.actionRef.slice(6)),ticket.data);',
    `if(i===card.inspectOnlyAt)return {budgets,coupure:card.gestes,etat:result.kind,steps,choixSuivant:before};
      const next=await game.step(Number(ticket.actionRef.slice(6)),ticket.data);`);
  replace('const physical=digest(next.frame);','const physical=digest(next.frame), physicalLevel=next.level, physicalScore=next.levelsCompleted;');
  replace("if(intervention()==='plateau_precedent'){next.frame=board.frame;next.frames=[board.frame];}",
    `if(['stationnaire84','stationnaire97'].includes(intervention())){
        next.frame=board.frame;next.frames=next.frames.map(()=>board.frame);
        if(intervention()==='stationnaire84')for(const key of ['level','levelsCompleted','state','availableActionIds'])next[key]=board[key];
      }`);
  replace('const after={ref:outcome?.observation_ref','const after={ticket:ticket.id,famille:outcome?.family,niveauPhysique:physicalLevel,scorePhysique:physicalScore,ref:outcome?.observation_ref');
  const adapted=join(dirname(source),'observations-operateur.mjs');
  writeFileSync(adapted,code);
  const {play}=await import(pathToFileURL(adapted));
  const engine=pathToFileURL(work.program+'/').href, results={};
  for(const [name,card] of specs[group])results[name]=await play(engine,card,vendor);
  writeFileSync(out,JSON.stringify({sha,group,eligible,results})+'\n',{flag:'wx'});
} finally {work.close();}
