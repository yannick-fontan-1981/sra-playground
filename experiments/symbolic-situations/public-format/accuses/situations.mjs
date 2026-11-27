import { message as base } from '../reductions/B.mjs';

function permute(card) {
  const entries = Object.entries(card.sources).reverse();
  const remap = new Map(entries.map(([old], i) => [Number(old), i + 1]));
  card.sources = Object.fromEntries(entries.map(([,line], i) => [i + 1, line]));
  for (const row of [card.goal, ...card.observations, ...card.commands, ...card.rules]) {
    row.source = row.source.map(n=>remap.get(n)).reverse();
  }
  card.commands.reverse();
  card.rules.reverse();
}

function nominal(id, {rename=false, reverse=false, front=false, other} = {}) {
  const message = structuredClone(base);
  const verb = rename ? 'caler' : 'indexer';
  const action = verb + ' P';
  const ack = rename ? 'calage enregistré' : 'indexé';
  for (const row of [...message.commands, ...message.rules])
    if (row.command[0] === 'indexer') row.command[0] = verb;

  if (front) {
    message.sources[3] = 'La commande ' + action + ' renvoie exactement « ' + ack +
      ' ». Elle est disponible si P est non indexé et indexe P.';
  } else if (rename) {
    message.sources[3] = message.sources[3].replace('indexer P',action).replace('« indexé »','« '+ack+' »');
  }
  if (other) {
    const op = ['indexer','Q'], ref = ['indexed','Q'];
    message.sources[5] = 'Le poste Q est initialement non indexé.';
    message.sources[6] = 'indexer Q est disponible si Q est non indexé. La commande indexe Q et renvoie exactement « ' + other + ' ».';
    message.observations.push({ref,status:'known',value:false,source:[5]});
    message.commands.push({command:op,source:[6]});
    message.rules.push({command:op,requires:{eq:[ref,false]},source:[6]}, {command:op,effect:{set:[ref,true]},source:[6]});
  }
  if (reverse) permute(message);
  return {id,message,action,ack,other};
}

export function situations() {
  const b0 = nominal('B0'), b5 = nominal('B5',{other:'poste indexé'});
  return [
    b0, nominal('B1',{rename:true}), nominal('B2',{rename:true,reverse:true}),
    nominal('B3',{rename:true,reverse:true,front:true}), nominal('B4',{other:'Q prêt'}),
    b5, nominal('B6',{other:'indexé'}),
    {...b0,id:'N1',down:true,negative:true},
    {...b5,id:'N2',substitution:b5.other,negative:true},
    ...[false,true].map(down=>({...b0,id:'N3',down,substitution:'accusé illisible',negative:true})),
  ];
}

// Le dispositif connaît ses boutons et ses deux postes. Il ne lit aucune règle de la fiche.
export const device = {
  worldId: () => 'départ',
  actions: w => [w.action, ...(w.other ? ['indexer Q'] : []), 'valider'],
  initialState: () => ({P:false,Q:false}),
  step(w, s, action) {
    if (action === 'valider') return {next:null,feedback:s.P ? 'succès' : 'échec'};
    if (action === w.action && !s.P && !w.down) return {next:{...s,P:true},feedback:w.ack};
    if (action === 'indexer Q' && w.other && !s.Q) return {next:{...s,Q:true},feedback:w.other};
    return null;
  },
};
