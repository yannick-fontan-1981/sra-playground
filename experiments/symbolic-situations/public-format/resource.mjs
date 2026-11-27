import { all, distinct, eq, not, set } from './language.mjs';

export function resource(page) {
  const goal = page.one(/^Scelle le poste (\w+) en gardant le clapet de (\w+) ouvert\. Donne des actions qui garantissent la réussite avec le moins de gestes dans le pire cas\. Chaque commande coûte un geste\.$/);
  const [target, source] = goal.args;
  const initial = page.one(/^- La poignée unique se trouve sur (\w+)\. Le clapet est ouvert et sa butée est libre\. Le poste (\w+) est ouvert( et reste à indexer)?\.$/, false);
  const purgeState = page.one(/^- Purge du cycle en cours (terminée|à faire)\.$/, false);
  const archive = page.one(/^- Relevé archivé du cycle précédent (\w+)\. L’effort peut changer entre cycles\.$/, false);
  const current = page.one(/^- Mesure certifiée du cycle en cours (\w+)\.$/, false);
  const codes = page.one(/^Après la purge, l’effort reste fixe et la sonde renvoie (\w+) ou (\w+)\.$/);
  const drop = page.one(/^- Avec le relevé (\w+), retirer la poignée quand la butée est libre laisse retomber le clapet\.$/);
  const jam = page.one(/^- Avec le relevé (\w+), bloquer la butée quand la poignée est en place coince la poignée\.$/);
  const incidents = page.one(/^Ces incidents terminent la partie\. Hors de ces deux conditions, le retrait libère la poignée et le blocage immobilise le clapet ouvert\.$/);
  const purge = page.one(/^- `purger (\w+)` termine la purge si elle reste à faire et si la poignée tient le clapet\.$/);
  const probe = page.one(/^- `sonder (\w+)` donne le relevé du cycle en cours, une fois par partie après la purge\.$/);
  const lock = page.one(/^- `bloquer (\w+)` engage la butée libre après la purge\.$/);
  const remove = page.one(/^- `retirer (\w+)` retire la poignée une fois\. La retirer avant la fin de la purge ferme le clapet et termine la partie\.$/);
  const index = page.one(/^- `indexer (\w+)` règle le poste aval avec la poignée libérée, une fois\.$/, false);
  const seal = page.one(/^- `sceller (\w+)` termine la partie\. Il faut la poignée libérée, la butée bloquée, la purge terminée( et le poste aval indexé)?\.$/);

  distinct([source, target, ...codes.args]);
  if (codes.args.includes('absente')) throw new Error('Code ambigu avec le libellé public de mesure absente');
  if (![purge, probe, lock, remove].every(row => row.args[0] === source) || seal.args[0] !== target ||
    (index && index.args[0] !== target) || (initial && (initial.args[0] !== source || initial.args[1] !== target))) {
    throw new Error('Poste contradictoire');
  }
  if (drop.args[0] === jam.args[0] || ![drop, jam, archive, current].filter(Boolean)
    .every(row => codes.args.includes(row.args[0]) || (row === current && row.args[0] === 'absente'))) {
    throw new Error('Relevé incompatible avec les essais publiés');
  }
  const held = ['held', source], flap = ['flap_open', source], locked = ['locked', source];
  const purged = ['purged', source], indexed = ['indexed', target], effort = ['effort', source];
  page.msg.goal = { command: ['sceller', target], criterion: 'minimax_actions', maintain: [eq(flap, true)],
    source: page.cite([goal, seal]) };
  page.msg.domains.push({ ref: effort, values: codes.args, stableWhen: eq(purged, true), source: page.cite([codes, goal]) });
  if (initial) {
    page.observe(held, true, initial);
    page.observe(flap, true, initial);
    page.observe(locked, false, initial);
    page.observe(['receiver_open', target], true, initial);
    if (initial.args[2]) page.observe(indexed, false, initial);
  }
  if (purgeState) page.observe(purged, purgeState.args[0] === 'terminée', purgeState, goal);
  if (archive) page.observe(['archive', source], archive.args[0], archive, goal);
  if (current) page.observe(effort, current.args[0] === 'absente' ? undefined : current.args[0], current, goal);

  const p = page.command(['purger', source], purge);
  page.rule(p, { requires: all(eq(purged, false), eq(held, true)) }, purge);
  page.rule(p, { effect: set(purged, true) }, purge);
  const s = page.command(['sonder', source], probe);
  page.rule(s, { requires: eq(purged, true) }, probe);
  page.rule(s, { maxUses: 1 }, probe);
  page.rule(s, { effect: { reveal: effort } }, probe);

  const b = page.command(['bloquer', source], lock);
  page.rule(b, { requires: all(eq(locked, false), eq(purged, true)) }, lock);
  const jams = all(eq(effort, jam.args[0]), eq(held, true));
  page.rule(b, { when: jams, effect: { end: 'failure' } }, lock, jam, incidents, goal);
  for (const ref of [locked, flap]) page.rule(b, { when: not(jams), effect: set(ref, true) }, lock, jam, incidents);

  const r = page.command(['retirer', source], remove);
  page.rule(r, { maxUses: 1 }, remove);
  const early = eq(purged, false);
  page.rule(r, { when: early, effect: set(flap, false) }, remove);
  page.rule(r, { when: early, effect: { end: 'failure' } }, remove, goal);
  const drops = all(eq(effort, drop.args[0]), eq(locked, false));
  const fallsAfterPurge = all(eq(purged, true), drops);
  page.rule(r, { when: fallsAfterPurge, effect: set(flap, false) }, remove, codes, drop);
  page.rule(r, { when: fallsAfterPurge, effect: { end: 'failure' } }, remove, codes, drop, incidents, goal);
  page.rule(r, { when: all(eq(purged, true), not(drops)), effect: set(held, false) }, remove, codes, drop, incidents);
  if (index) {
    const i = page.command(['indexer', target], index);
    page.rule(i, { requires: eq(held, false) }, index, goal);
    page.rule(i, { maxUses: 1 }, index);
    page.rule(i, { effect: set(indexed, true) }, index);
  }
  const end = page.command(['sceller', target], seal);
  const needs = [eq(held, false), eq(locked, true), eq(purged, true)];
  if (seal.args[1]) needs.push(eq(indexed, true));
  page.rule(end, { successRequires: all(...needs) }, seal, goal);
  page.rule(end, { effect: { end: 'unspecified' } }, seal);
  return page.finish();
}
