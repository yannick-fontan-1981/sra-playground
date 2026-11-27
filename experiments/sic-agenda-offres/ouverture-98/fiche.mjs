import { observeOpening } from './sonde.mjs';

function pixel(x) { return Number.isInteger(x) && x >= 0 && x < 64; }
export function validateCard(card) {
  if (!card || Object.keys(card).sort().join(',') !== 'clics,points,version' || card.version !== 'sic.ouverture/1') throw Error('Fiche sic.ouverture/1 attendue');
  for (const [items, colored] of [[card.points,true],[card.clics,false]]) {
    if (!Array.isArray(items) || !items.length || items.length > 256) throw Error('Liste publique invalide');
    const seen = new Set();
    for (const p of items) {
      if (!Array.isArray(p) || p.length !== (colored ? 3 : 2) || !pixel(p[0]) || !pixel(p[1])
        || (colored && (!Number.isInteger(p[2]) || p[2] < 1 || p[2] > 15))) throw Error('Point public invalide');
      const id = p[1]*64+p[0];
      if (seen.has(id)) throw Error('Point répété dans la même liste');
      seen.add(id);
    }
  }
}
export async function prepareFixture(root) {
  const records = observeOpening(root);
  const { measureNativeObservation, publicFrameHash } = await import(new URL('src/logos-engine/v6-native-observer.ts',root));
  const { ObservedFrontier } = await import(new URL('src/logos-engine/v6-observed-frontier.ts',root));
  return async function play(card,mode='active') {
    validateCard(card);
    if (!['active','shadow','absent'].includes(mode)) throw Error('Mode d’ouverture inconnu');
    records.length = 0;
    const rows = Array.from({length:64},()=>Array(64).fill(0));
    for (const [x,y,c] of card.points) rows[y][x] = c;
    const observation = await measureNativeObservation({frame_rows:rows,frame_hash:await publicFrameHash(rows),
      level:1,levels_completed:0,state:'NOT_FINISHED',available_action_refs:['ACTION6']},1,'fixture-ouverture');
    const commands = card.clics.map(([x,y])=>({action_ref:'ACTION6',data:{x,y}}));
    const graph = new ObservedFrontier(1);
    const proposal = await graph.propose(observation,commands,{ sic_agenda:true, sic_frontier:{inputOrder:'least_tried'},
      ...(mode === 'absent' ? {} : {sic_opening_curiosity:mode}) });
    const local = proposal?.sic_frontier_decision;
    return { layer:'fournisseur', mode, slate:records.at(-1) ?? null, command:proposal?.actions[0] ?? null,
      kind:proposal?.kind, question:local?.objective, need:local?.need?.id, opening:local?.openingCuriosity ?? null,
      guard:proposal?.status === 'proposed' ? await graph.guard(proposal,observation,0) : null };
  };
}
