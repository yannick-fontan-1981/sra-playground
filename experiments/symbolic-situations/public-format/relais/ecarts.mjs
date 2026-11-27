import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { publicCase } from '../reductions/cases.mjs';
import { makeLedger,publish } from '../accuses-publics/contrat.mjs';
import { enumerateFinite } from '../../finite-policies.mjs';
import { measure } from '../operator/measure.mjs';
import { consumer } from '../operator/frozen.mjs';
import { parseArgs } from 'node:util';

// Trois appareils de développement à deux commandes. Seuls les textes publics de B sont repris.
export function reductions() {
  const template=publicCase('B');
  const bit=['indexed','P'], driver=['effort','P'], indication=['indication','P'];
  const index=['indexer','P'];
  const eq=(ref,value)=>({eq:[ref,value]});
  return ['absent','couverture','conjonction'].map(id=>{
    const p=structuredClone(template.message);
    let receipts=[];
    if(id==='absent') {
      p.sources[3]='indexer P est disponible si P est non indexé. La commande indexe P.';
    } else if(id==='couverture') {
      p.sources[3]='indexer P exige P non indexé. Si P est non indexé, le geste indexe P et rend « indexé ».';
      p.rules.find(r=>r.effect?.set).when=eq(bit,false);
      receipts=[{command:index,status:'declared',replies:[{kind:'confirmed',label:'indexé',coverage:'unknown',source:[3]}]}];
    } else {
      p.sources[5]='Le sélecteur fixe est inconnu et vaut R ou S. L’indicateur vaut initialement R et prend ses valeurs dans R ou S.';
      p.sources[6]='Lors du geste indexer P, si P est non indexé et le sélecteur vaut R, l’indicateur passe à R. Si P est non indexé et le sélecteur vaut S, l’indicateur passe à S.';
      p.observations.push({ref:driver,status:'unknown',source:[5]},{ref:indication,status:'known',value:'R',source:[5]});
      p.domains.push({ref:driver,values:['R','S'],stableWhen:true,source:[5]},{ref:indication,values:['R','S'],source:[5]});
      for(const v of ['R','S']) p.rules.push({command:index,when:{all:[eq(bit,false),eq(driver,v)]},
        effect:{set:[indication,v]},source:[6]});
      receipts=[{command:index,status:'declared',replies:[{kind:'confirmed',label:'indexé',source:[3],
        coverage:[{effect:{set:[bit,true]},source:[3]}]}]}];
    }
    const message=publish(p,makeLedger(p,receipts));
    const worlds=id==='conjonction'?['R','S']:['R'];
    const dynamics={worldId:w=>w,actions:()=>['indexer P','valider'],initialState:()=>({indexed:false,indicator:'R'}),
      step(w,s,a){
        if(a==='valider') return {next:null,feedback:s.indexed?'succès':'échec'};
        if(a==='indexer P' && !s.indexed) return {next:{indexed:true,indicator:w},feedback:'indexé'};
        return null;
      }};
    return {id,family:'exemples publics',message,worlds,dynamics};
  });
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  const {values:v}=parseArgs({options:{fiche:{type:'string'},sha:{type:'string'},depot:{type:'string'},
    entree:{type:'string'},dep:{type:'string',multiple:true}}});
  const data=reductions();
  if(v.fiche) {
    const c=data.find(c=>c.id===v.fiche);
    if(!c) throw Error('Fiche inconnue');
    console.log(JSON.stringify(c.message,null,2));
  } else {
    for(const c of data) assert.equal(enumerateFinite(c.worlds,c.dynamics).minimum,2);
    const solver=consumer(v);
    const results=await measure(data,solver);
    for(const r of results.departs) {
      console.log(JSON.stringify({fiche:r.fiche,tours:r.tours,ecart:r.premierEcart}));
      assert.equal(r.admission,'admise');
      assert.equal(r.statut,'arret_solveur');
      assert.equal(r.tours.length,r.fiche==='conjonction'?0:1);
      assert.equal(r.premierEcart.detail,r.fiche==='absent'?'accusé structuré : undeclared':'aucune continuation justifiée dans l’horizon 10');
    }
    // Contrôle équivalent sur tous les états où la commande est exécutable.
    const paired=data.find(c=>c.id==='conjonction'), simple=structuredClone(paired.message);
    simple.sources[6]='À l’indexation, si le sélecteur vaut R, l’indicateur passe à R. Si le sélecteur vaut S, l’indicateur passe à S.';
    for(const rule of simple.rules.filter(r=>r.source.includes(6))) rule.when=rule.when.all[1];
    const check=await measure([{...paired,message:simple}],solver);
    assert.equal(check.bilan.issues.succes,2);
    console.log('Deux gardes simples équivalentes : 2/2 succès en deux gestes.');
  }
}
