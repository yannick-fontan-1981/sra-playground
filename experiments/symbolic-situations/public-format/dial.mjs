import { all, any, distinct, eq, not, set } from './language.mjs';

export function dial(page) {
  const goal = page.one(/^\*\*But\.\*\* Obtenir une validation en un minimum d’actions\. Le plan doit réussir dans chaque monde compatible avec les observations\. On compte les actions dans le pire cas\.$/);
  const inventory = page.one(/^- Les deux cases (\w+) et (\w+) sont vierges\. Les tampons disponibles sont ([\w, ]+)\.$/);
  const position = page.one(/^- Le cadran désigne une seule sortie, (\w+) ou (\w+), qui reste fixe pendant la partie\.$/);
  const wiring = page.many(/^- La sortie (\w+) exige le tampon (\w+) sur les deux cases\.$/);
  const visible = page.one(/^- Le cadran indique (\w+)\.$/, false);
  const hidden = page.one(/^- La position initiale du cadran est inconnue\.$/, false);
  const mark = page.one(/^- `marquer CASE TAMPON` marque une case vierge\. Le premier marquage engage ce tampon pour tous les marquages suivants\. Une marque est définitive\.$/);
  const read = page.one(/^- `lire` révèle la sortie désignée, une seule fois par partie, sans changer le cadran ni les marques\.$/);
  const validate = page.one(/^- `valider` termine la partie\. La validation réussit si les deux cases portent le tampon exigé par la sortie désignée\. Tout autre résultat est un échec\.$/);
  page.one(/^Donne un plan et justifie ton premier choix\. Si une action fournit une information, précise la suite pour chaque résultat possible\.$/, false);

  const cells = inventory.args.slice(0, 2), stamps = inventory.args[2].split(', '), exits = position.args;
  distinct([...cells, ...stamps, ...exits]);
  distinct(wiring.map(row => row.args[0]));
  if ((visible && hidden) || (visible && !exits.includes(visible.args[0]))) throw new Error('Position contradictoire');
  const dialRef = ['dial'];
  page.msg.goal = { command: ['valider'], criterion: 'minimax_actions', source: page.cite([goal, validate]) };
  page.msg.domains.push({ ref: dialRef, values: exits, stableWhen: true, source: page.cite([position]) });
  if (hidden || visible) page.observe(dialRef, visible?.args[0], hidden ?? visible);
  for (const cell of cells) page.observe(['mark', cell], null, inventory);
  for (const stamp of stamps) page.observe(['available_stamp', stamp], true, inventory);
  for (const row of wiring) {
    const [out, stamp] = row.args;
    if (!exits.includes(out) || !stamps.includes(stamp)) throw new Error('Exigence incompatible avec l’inventaire public');
    page.observe(['required_stamp', out], stamp, row);
  }

  for (const cell of cells) {
    const markRef = ['mark', cell];
    const other = ['mark', cells.find(c => c !== cell)];
    for (const stamp of stamps) {
      const command = page.command(['marquer', cell, stamp], mark, inventory);
      page.rule(command, { requires: all(eq(markRef, null), any(eq(other, null), eq(other, stamp))) }, mark, inventory);
      page.rule(command, { effect: set(markRef, stamp) }, mark, inventory);
    }
  }
  const scan = page.command(['lire'], read);
  page.rule(scan, { maxUses: 1 }, read);
  page.rule(scan, { effect: { reveal: dialRef } }, read);
  page.rule(scan, { effect: { keep: dialRef } }, read);
  for (const cell of cells) page.rule(scan, { effect: { keep: ['mark', cell] } }, read, inventory);

  const end = page.command(['valider'], validate);
  // The validation refers to an outlet's requirement even if its value was omitted.
  // No candidate marking action acquires a guard derived from a particular outlet.
  const success = any(...exits.map(out => all(eq(dialRef, out),
    ...cells.map(cell => eq(['mark', cell], { ref: ['required_stamp', out] })))));
  page.rule(end, { when: success, effect: { end: 'success' } }, validate, position, inventory);
  page.rule(end, { when: not(success), effect: { end: 'failure' } }, validate, position, inventory);
  return page.finish();
}
