import {createHash} from 'node:crypto';

export const bras=['doublon','unSeulSansBorne'];
export const empreinte=data=>createHash('sha256').update(data).digest('hex');

function ticket(value){
  if(!value)return null;
  const {command,point,owner,kind,admitted,ref,row,rank,continuation,bundle}=value;
  return {command,point:point??null,owner,kind,admitted:admitted??null,ref,
    row:row??null,rank:rank??null,plan:continuation??null,gabarit:bundle??null};
}
function retour(value){
  if(!value)return null;
  const {owner,ref,matched,sealed,physical,shown,event}=value;
  return {owner,ref,matched:matched??null,sealed:sealed??null,physical,shown,
    preuve:event?{statut:event.status,ref:event.ref,préservée:event.preserved??null,remplie:event.filled??null,
      attendu:event.expected??null,observé:event.observed??null}:null};
}
export function résumer(cases){
  return Object.fromEntries(bras.map(arm=>{
    const {rows,cuts}=cases[arm];
    const journal=cuts[0]?.used?.map(e=>({statut:e.status,ref:e.ref,question:empreinte(e.key??'')}))??null;
    return [arm,{préfixe:rows.slice(0,4).map(r=>({
      tour:r.tour,photo:r.photo,niveau:r.niveau,score:r.score,commande:r.ticket?.command??null,point:r.ticket?.point??null
    })),portée:rows.slice(4,7).map(r=>({
      tour:r.tour,photo:r.photo,niveau:r.niveau,score:r.score,arrêt:r.arrêt,ticket:ticket(r.ticket),retour:retour(r.ret)
    })),journal}];
  }));
}
export function premierÉcart(obtenu,attendu,chemin=[]){
  if(Object.is(obtenu,attendu))return null;
  if(obtenu===null||attendu===null||typeof obtenu!=='object'||typeof attendu!=='object'){
    return {champ:chemin.join('.'),attendu:attendu??null,obtenu:obtenu??null};
  }
  for(const key of new Set([...Object.keys(attendu),...Object.keys(obtenu)])){
    const écart=premierÉcart(obtenu[key],attendu[key],[...chemin,key]);
    if(écart)return écart;
  }
  return null;
}
