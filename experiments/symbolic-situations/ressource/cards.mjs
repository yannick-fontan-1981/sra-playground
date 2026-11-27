// The public Markdown is the interchange format. No private field is embedded in a card.
export function card(m) {
  const { source, receiver, drop, jam, indexed, purged, current, archive } = m;
  const codes = [drop, jam].sort();
  return [
    '# Situation',
    '',
    'Scelle le poste ' + receiver + ' en gardant le clapet de ' + source + ' ouvert. Donne des actions qui garantissent la réussite avec le moins de gestes dans le pire cas. Chaque commande coûte un geste.',
    '',
    '**État observé**',
    '',
    '- La poignée unique se trouve sur ' + source + '. Le clapet est ouvert et sa butée est libre. Le poste ' + receiver +
      ' est ouvert' + (indexed ? ' et reste à indexer.' : '.'),
    '- Purge du cycle en cours ' + (purged ? 'terminée.' : 'à faire.'),
    '- Relevé archivé du cycle précédent ' + archive + '. L’effort peut changer entre cycles.',
    '- Mesure certifiée du cycle en cours ' + (current ?? 'absente') + '.',
    '',
    '**Essais documentés sur ce montage**',
    '',
    'Après la purge, l’effort reste fixe et la sonde renvoie ' + codes.join(' ou ') + '.', '',
    '- Avec le relevé ' + drop + ', retirer la poignée quand la butée est libre laisse retomber le clapet.',
    '- Avec le relevé ' + jam + ', bloquer la butée quand la poignée est en place coince la poignée.',
    '', 'Ces incidents terminent la partie. Hors de ces deux conditions, le retrait libère la poignée et le blocage immobilise le clapet ouvert.',
    '',
    '**Commandes**',
    '',
    '- `purger ' + source + '` termine la purge si elle reste à faire et si la poignée tient le clapet.',
    '- `sonder ' + source + '` donne le relevé du cycle en cours, une fois par partie après la purge.',
    '- `bloquer ' + source + '` engage la butée libre après la purge.',
    '- `retirer ' + source + '` retire la poignée une fois. La retirer avant la fin de la purge ferme le clapet et termine la partie.',
    ...(indexed ? ['- `indexer ' + receiver + '` règle le poste aval avec la poignée libérée, une fois.'] : []),
    '- `sceller ' + receiver + '` termine la partie. Il faut la poignée libérée, la butée bloquée, la purge terminée' +
      (indexed ? ' et le poste aval indexé.' : '.'),
    '',
  ].join('\n');
}

export function parseCard(text) {
  const page = text.replaceAll('\r\n', '\n');
  function value(pattern) {
    const match = pattern.exec(page);
    if (!match) throw new Error('Fiche publique incomplète');
    return match[1];
  }
  const position = /^Scelle le poste (\w+) en gardant le clapet de (\w+) ouvert\./m.exec(page);
  if (!position) throw new Error('But illisible');
  const current = value(/^- Mesure certifiée du cycle en cours (\w+)\.$/m);
  const model = {
    source: position[2], receiver: position[1],
    drop: value(/^- Avec le relevé (\w+), retirer/m), jam: value(/^- Avec le relevé (\w+), bloquer/m),
    indexed: page.includes('- `indexer '), purged: page.includes('- Purge du cycle en cours terminée.'),
    archive: value(/^- Relevé archivé du cycle précédent (\w+)\./m), current: current === 'absente' ? null : current,
  };
  if (card(model) !== page) throw new Error('Texte public inconnu');
  if (new Set([model.source, model.receiver, model.drop, model.jam]).size !== 4 ||
      ![model.drop, model.jam].includes(model.archive) ||
      (model.current !== null && (!model.purged || ![model.drop, model.jam].includes(model.current)))) {
    throw new Error('Observations incohérentes');
  }
  return model;
}

export function keyPage(m, key) {
  const lines = ['# Corrigé opérateur', ''];
  if (!m.purged) lines.push('La poignée doit rester en place jusqu’à la fin de la purge. Il faut commencer par purger.', '');
  if (m.current === null) {
    lines.push('Le relevé archivé vient d’un autre cycle. Les deux efforts sont compatibles avec les observations. ' +
      'Le retrait et le blocage exposent à deux incidents différents. Après la purge, la mesure est nécessaire pour choisir leur ordre.', '');
  } else {
    lines.push('La mesure certifiée du cycle en cours suffit pour choisir la première opération matérielle.', '');
  }
  for (const [code, plans] of Object.entries(key)) {
    lines.push('**Relevé ' + code + '**', '',
      (code === m.drop ? 'Le clapet retomberait en cas de retrait immédiat. Engager d’abord la butée.' :
        'La poignée se coincerait en cas de blocage immédiat. La retirer d’abord.') +
      (code === m.archive ? ' La mesure corrobore l’archive.' : ' La mesure contredit l’archive et inverse l’ordre à suivre.'),
      '', ...plans.map(plan => '- ' + plan.map(a => '`' + a + '`').join(' → ')), '');
  }
  if (m.indexed) lines.push('L’indexation exige la poignée libérée. Après un retrait en premier, indexation et blocage sont indépendants.', '');
  lines.push('Chaque liste se termine par le scellement avec la même poignée. Tout ordre listé peut être choisi pour son relevé.', '');
  return lines.join('\n');
}
