import {createHash} from 'node:crypto';

export const freeze='d0e7527ca8033bd805a6d7a8bb021eff62e87021';
export const upstream='02032a3d50ba15d7d0d7ff1c74d01165ad7e31f2';
export const criteria='d5e642677e792e921e459189882d94f592a2eee5';
export function parameters(seed){
  if(!/^[a-f0-9]{64}$/.test(seed))throw Error('Graine hexadécimale de 32 octets requise');
  const b=Buffer.from(seed,'hex'), ids=[1,2,3,4,5];
  for(let i=4;i>0;i--){const j=b[i]%(i+1);[ids[i],ids[j]]=[ids[j],ids[i]];}
  const colors=[b[5]%16,(b[5]+1+b[6]%15)%16];
  return {ids:ids.slice(0,2).sort(),colors};
}
export const development={ids:[1,3],colors:[2,7]};
export function cases({ids,colors}){
  const [u,v]=ids;
  // Un index de plateau désigne une projection publique, une occurrence désigne une lecture datée.
  const frameHashes=colors.map(c=>createHash('sha256').update(Buffer.alloc(64*64,c)).digest('hex'));
  const board=(b,ix,domain=ids)=>({observation_ref:'essai:revision:'+ix+':frame:'+frameHashes[b].slice(0,16),
    frame_hash:frameHashes[b],state:'NOT_FINISHED',levels_completed:0,level_epoch:1,available_action_refs:domain.map(id=>'ACTION'+id)});
  const a=board(0,0),b=board(1,0),a1=board(0,1),b1=board(1,1),a2=board(0,2),b2=board(1,2),a3=board(0,3);
  const initial=(name,obs,history=[],afters=[],domain=ids)=>({name,obs,domain,history,afters});
  return [
    initial('Domaine canonique',a),
    initial('Domaine permuté',a,[],[],[v,u]),
    initial('Historique local U',a1,[[a,u,a1]]),
    initial('Historique local V',a1,[[a,v,a1]]),
    initial('Usage distant U',a1,[[b,u,a1]]),
    initial('Usage distant V',a1,[[b,v,a1]]),
    initial('Épuisement et changement de plateau',a,[],[a1,b2]),
    initial('Accès à une question distante',a3,[[a,u,b1],[b1,u,a2],[a2,v,a3]]),
    initial('Aucun accès après épuisement',a3,[[b,u,a1],[a1,u,a2],[a2,v,a3]]),
  ];
}
