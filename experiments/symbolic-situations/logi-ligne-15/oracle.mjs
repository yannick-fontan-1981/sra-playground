import { isDeepStrictEqual as eq } from 'node:util';
import { baseControls,baseReceivers,board,historical,readRow } from './situations.mjs';

const names={coupled_switch:'coupled',inert_decoration:'unchanged',local_switch:'local_only'};
const inside=(c,b)=>c?.actionRef==='ACTION6' && c.data.x>=b[0] && c.data.x<=b[2] && c.data.y>=b[1] && c.data.y<=b[3];
const diff=(a,b)=>a.flatMap((v,i)=>v===b[i]?[]:[i]);
const center=b=>(b[0]+b[2])/2;
function predicted(result) {
  return Object.fromEntries(Object.entries(names).map(([k,v])=>[k,result===null?'unknown':v===result?'matched':'contradicted']));
}

// Pour les questions à froid, puis après un essai attribuable : tous les contrôles encore neufs
// sont candidats ; la distance aux valeurs les plus rares départage ces contrôles.
function nearest(lamps,controls,receivers,ids) {
  const counts=lamps.map(v=>lamps.filter(x=>x===v).length);
  const rare=receivers.filter((_,i)=>counts[i]===Math.min(...counts));
  const dist=ids.map(i=>Math.min(...rare.map(b=>Math.abs(center(controls[i])-center(b)))));
  return ids.filter((_,j)=>dist[j]===Math.min(...dist));
}
export function evaluate(spec,ts) {
  const real=spec===null,g=real?historical:board(spec), controls=g.controls??baseControls,receivers=g.receivers??baseReceivers;
  const checks=[],episodes=[];const test=(name,ok)=>checks.push({name,ok:Boolean(ok)});
  test('préfixe servi en entier',ts.length===g.length+1);
  let obs=g.initial;
  for(let i=0;i<g.length;i++){
    const t=ts[i],q=t?.info,next=ts[i+1],m=next?.measured;
    if(!q || !next || !obs){test('question et retour disponibles '+i,false);break;}
    const before=readRow(obs.frame,controls), rv=readRow(obs.frame,receivers), index=controls.findIndex(b=>inside(t.command,b));
    test('offre et question informative '+i,q.source==='coupled_displays' && q.family==='information_goal' &&
      q.kind==='distinguish_public_hypotheses' && q.released===q.objective && !!q.objective && q.parent==='G_protocol_completion' &&
      eq(q.predictions,names) && q.outcomes===3 && q.considered?.some(k=>k.strategy===q.source && k.result==='selected'));
    test('liaison initiale du contrôle et des récepteurs '+i,index!==-1 && q.control===index && eq(q.controls,controls) &&
      eq(q.receivers,receivers) && eq(q.before,before) && eq(q.lamps,rv) && q.evidence?.includes(q.revision) && q.needEvidence?.includes(q.revision));
    if(!i){
      const allowed=nearest(rv,controls,receivers,[0,1,2]);
      test('question à froid parmi les minima',allowed.includes(index) && q.admissibles===1 && !q.engaged);
    }
    const seen=g.advance(i,t.command);
    if(!seen){test('commande dans le domaine public',false);break;}
    const boundary=seen.levelsCompleted>obs.levelsCompleted;
    const after=boundary?[]:readRow(seen.frame,controls), lamps=boundary?[]:readRow(seen.frame,receivers);
    const local=boundary?[]:diff(before,after), changed=boundary?[]:diff(rv,lamps);
    const result=boundary?null:local.length===1 && local[0]===index ? changed.length?'coupled':'local_only' :
      local.length===0 && changed.length===0?'unchanged':'other';
    test('mesure et trois hypothèses '+i,!!m && m.value===result && eq(m.checks,predicted(result)));
    test('réponse liée au bon essai '+i,!!m?.revision && m.revision!==q.revision && m.evidence===m.revision && m.objective===q.released);
    if(!boundary){
      const following=next.info;
      test('adressage vérifiable après réponse '+i,!!following && following.revision===m?.revision &&
        eq(following.receivers,receivers) && eq(following.lamps,lamps) && eq(diff(q.lamps,following.lamps),changed) && eq(following.before,after));
      if(!i && ['unchanged','local_only','coupled'].includes(result)){
        const eligible=[0,1,2].filter(j=>j!==index), choices=nearest(lamps,controls,receivers,eligible);
        test('question suivante justifiée par la nouvelle observation',choices.includes(following?.control) &&
          choices.some(j=>inside(next.command,controls[j])) && following?.engaged===(result!=='unchanged'));
      }
    }
    if(real){
      test('clic et concurrence historiques '+i,eq(t.command,historical.commands[i]) && q.admissibles===i+1);
      if(boundary)test('nouveau contexte',next.info?.revision!==q.revision);
    }
    episodes.push({index,receivers:changed,result,next:next.info?.control??null});
    obs=seen;
  }
  return {ok:checks.every(c=>c.ok),checks:checks.length,ecarts:checks.filter(c=>!c.ok).map(c=>c.name),episodes};
}
