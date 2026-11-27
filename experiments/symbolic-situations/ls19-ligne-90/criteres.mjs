import { isDeepStrictEqual as equal } from 'node:util';

export function check(spec,turns) {
  const checks=[];
  function verify(name,valid){checks.push({name,ok:Boolean(valid)});}
  verify('tous les retours autorisés sont atteints',turns.length===spec.limit+1);
  const v=turns[2]?.selected;
  verify('aucune offre de bord avant deux mouvements attestés',turns.length>=3 && turns.slice(0,2).every(r=>!r.selected));
  verify('accès typé et garde admis',v?.strategy==='approach_view_edge' && v.authority==='viewAccess' &&
    v.admitted && v.guard==='bound_view_step' && v.facts.edgeAccess===true && v.evidenceCount>0);
  verify('vecteur et surface conditionnelle',equal(v?.vector,spec.vector) && v?.gain===spec.gain);
  verify('commande du premier accès',turns[2]?.command?.actionRef===spec.button);
  const offers=turns.flatMap(r=>r.selected?[r.selected]:[]);
  verify('identité du besoin et rattachement de chaque libération',offers.length>0 &&
    offers.every(x=>x.kind==='observe_view_access' && x.need===v?.need && x.parent==='G_official_completion' &&
      x.objective && x.objective===x.subObjective));
  for(const [i,origin,outcome,pixels] of spec.settlements) {
    const o=turns[i]?.returned?.view;
    verify('retour à '+i+' lié au plan libéré à '+(origin+1),!!o && !!turns[origin]?.selected &&
      o.objective===turns[origin].selected.objective && o.status===outcome && o.newPixels===pixels);
  }
  for(const i of spec.matched??[]) {
    const r=turns[i]?.returned;
    verify('pose confirmée après le geste '+i,r?.matched===true && r.reason==='screen_pose_matched' && r.view===null &&
      turns[i]?.selected?.objective===v?.objective);
  }
  if(spec.after) {
    const [i,a]=spec.after;
    verify('continuation au retour '+i,(turns[i]?.command?.actionRef??null)===a);
  }
  if(spec.obstruction) {
    const [second,confirmation]=spec.obstruction, b=turns[second]?.selected, c=turns[confirmation]?.selected;
    verify('deux nouveaux sous-objectifs sous le même besoin',b?.strategy==='approach_view_edge' &&
      c?.strategy==='confirm_access_obstruction' && c.facts.obstruction===true &&
      new Set([v?.objective,b?.objective,c?.objective]).size===3 && c.admitted);
  }
  return {ok:checks.every(x=>x.ok),checks:checks.length,ecarts:checks.filter(x=>!x.ok).map(x=>x.name)};
}

export const expected={
  vue:{limit:3,vector:[3,0],gain:192,button:'ACTION3',settlements:[[3,2,'expanded',192]]},
  'vue-fixe':{limit:3,vector:[3,0],gain:192,button:'ACTION3',settlements:[[3,2,'no_new_area',0]],after:[3,null]},
  passage:{limit:13,vector:[0,-8],gain:512,button:'ACTION1',matched:[3,4,5],obstruction:[8,12],
    settlements:[[6,2,'no_new_area',0],[12,8,'no_new_area',0],[13,12,'no_new_area',0]],after:[3,'ACTION1']},
  'contact-avance':{limit:3,vector:[0,-8],gain:512,button:'ACTION1',settlements:[[3,2,'no_new_area',0]],after:[3,'ACTION2']},
};
