// Public interchange format. A replay can open the Markdown card on its own.
export function parseCard(text) {
  const lines = text.replaceAll('\r\n', '\n');
  const objects = /^- Les deux cases (\w+) et (\w+) sont vierges\. Les tampons disponibles sont ([\w, ]+)\.$/m.exec(lines);
  if (!objects) throw new Error('Liste des cases ou des tampons illisible');
  const wiring = Object.fromEntries([...lines.matchAll(/^- La sortie (\w+) exige le tampon (\w+) sur les deux cases\.$/gm)]
    .map(([, out, stamp]) => [out, stamp]));
  const model = { stamps: objects[3].split(', '), cells: objects.slice(1, 3), wiring,
    seen: /^- Le cadran indique (\w+)\.$/m.exec(lines)?.[1] ?? null };
  if (publicCard(model) !== lines) throw new Error('La fiche contient des règles ou des observations non reconnues');
  return model;
}

export function publicCard({ stamps, cells, wiring, seen }) {
  const outputs = Object.keys(wiring).sort();
  return [
    '# Situation',
    '',
    '**But.** Obtenir une validation en un minimum d’actions. Le plan doit réussir dans chaque monde compatible avec les observations. On compte les actions dans le pire cas.',
    '',
    '**Observations**',
    '',
    '- Les deux cases ' + cells.join(' et ') + ' sont vierges. Les tampons disponibles sont ' + stamps.join(', ') + '.',
    '- Le cadran désigne une seule sortie, ' + outputs.join(' ou ') + ', qui reste fixe pendant la partie.',
    ...outputs.map(out => '- La sortie ' + out + ' exige le tampon ' + wiring[out] + ' sur les deux cases.'),
    seen === null ? '- La position initiale du cadran est inconnue.' : '- Le cadran indique ' + seen + '.',
    '',
    '**Actions disponibles**',
    '',
    '- `marquer CASE TAMPON` marque une case vierge. Le premier marquage engage ce tampon pour tous les marquages suivants. Une marque est définitive.',
    '- `lire` révèle la sortie désignée, une seule fois par partie, sans changer le cadran ni les marques.',
    '- `valider` termine la partie. La validation réussit si les deux cases portent le tampon exigé par la sortie désignée. Tout autre résultat est un échec.',
    '',
    'Donne un plan et justifie ton premier choix. Si une action fournit une information, précise la suite pour chaque résultat possible.',
    '',
  ].join('\n');
}

export function answerCard({ prefix, branches }, model) {
  const lines = ['# Corrigé', ''];
  if (model.seen === null) {
    const alternatives = branches.map(b => b.output + ' exige ' + b.stamp);
    lines.push('Les mêmes observations initiales sont compatibles avec deux mondes. ' + alternatives.join(' et ') +
      '. Le premier marquage est irréversible. Quel que soit le tampon choisi maintenant, au moins un monde devient insoluble.',
      '', 'Commencer par `' + prefix.join(' → ') + '`. La lecture départage ces mondes.', '');
  } else {
    lines.push('La position observée est ' + model.seen + '. Les règles donnent directement le tampon à engager.', '');
  }
  for (const { output, stamp, plans } of branches) {
    lines.push('**Cadran sur ' + output + '.** La sortie exige ' + stamp +
      ' sur les deux cases. Chacun des ordres suivants convient.', '',
      ...plans.map(plan => '- ' + plan.map(action => '`' + action + '`').join(' → ')), '');
  }
  const cost = prefix.length + branches[0].plans[0].length;
  lines.push('Le minimum garanti est de ' + cost + ' actions. Il faut deux marquages et une validation' +
    (model.seen === null ? ', ainsi qu’une lecture avant de s’engager.' : '.') +
    (branches.length > 1 ? ' L’ordre des cases peut être choisi indépendamment pour chaque résultat de lecture.' : ''), '');
  return lines.join('\n');
}
