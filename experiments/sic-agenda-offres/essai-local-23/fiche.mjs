function fields(value, keys) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).length !== keys.length || !keys.every(k => Object.hasOwn(value, k))) {
    throw Error('Champs publics attendus : ' + keys.join(', '));
  }
}
export function board(value) {
  fields(value, ['fond', 'commandes']);
  const { fond, commandes } = value;
  if (!Number.isInteger(fond) || fond < 0 || fond > 15 || !Array.isArray(commandes)
    || !commandes.length || commandes.some(id => !Number.isInteger(id) || id < 1 || id > 5)
    || new Set(commandes).size !== commandes.length) throw Error('Plateau public invalide');
  const frame = Array.from({ length: 64 }, () => Array(64).fill(fond));
  return { gameCode: 'DEMO', frame, frames: [frame], availableActionIds: [...commandes],
    state: 'NOT_FINISHED', level: 1, levelCount: 1, levelsCompleted: 0 };
}
export async function openFixture(start, card, order) {
  fields(card, ['version', 'depart', 'historique']);
  if (card.version !== 'sic.essai-local/1' || !Array.isArray(card.historique) || card.historique.length > 16) {
    throw Error('Version ou historique invalide');
  }
  const past = card.historique.map(board), session = await start(board(card.depart), order), history = [];
  for (const after of past) {
    const decision = await session.decision();
    if (!decision.ticket) throw Error('Historique sans ticket au pas ' + (history.length + 1));
    history.push(await session.advance(decision.ticket.id, after));
  }
  return { session, history, decision: await session.decision() };
}
export function response(value) {
  fields(value, ['ticket', 'retour']);
  if (typeof value.ticket !== 'string' || !value.ticket.length) throw Error('Identifiant de ticket requis');
  return { ticket: value.ticket, after: board(value.retour) };
}
