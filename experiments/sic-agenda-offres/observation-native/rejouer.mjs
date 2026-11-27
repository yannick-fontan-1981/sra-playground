import { resolve } from 'node:path';
import { cut, events, loadCaps, predict, targets } from './avant.mjs';

const [directory, option] = process.argv.slice(2);
if (!directory || (option && !['--avant', '--json'].includes(option))) {
  throw new Error('Usage : rejouer.mjs DOSSIER_RUN [--avant | --json]');
}
const path = resolve(directory, 'G50T-A.jsonl');
const caps = await loadCaps();
const predictions = [];
for (const target of targets) predictions.push(predict(await cut(events(path), target, caps)));
if (option === '--avant') {
  console.log(JSON.stringify(predictions, null, 2));
} else {
  // Les deux prédictions sont établies avant l'ouverture du lecteur de reçus.
  const { readReceipt, compare } = await import('./apres.mjs');
  const rows = [];
  for (const prediction of predictions) {
    const receipt = await readReceipt(events(path), prediction.target);
    rows.push({ prediction, receipt, ...compare(prediction, receipt) });
  }
  if (option === '--json') console.log(JSON.stringify(rows, null, 2));
  else {
    console.log('| Tour G50T L4 | Hors ligne | Reçu natif (famille / stratégie) | Verdict | Cause |');
    console.log('| --- | --- | --- | --- | --- |');
    for (const { prediction: p, receipt, verdict, cause } of rows) {
      const result = p.selection ? p.selection.family + ' / ' + p.selection.strategy : p.status;
      const actual = receipt ? receipt.selection.family + ' / ' + receipt.selection.strategy : 'indisponible';
      console.log('| ' + [p.target.turn, result, actual, verdict, cause].join(' | ') + ' |');
    }
    for (const verdict of ['accord', 'écart', 'indéterminé']) console.log(verdict + ' : ' + rows.filter(r => r.verdict === verdict).length);
    for (const { prediction: p, contexte } of rows) console.log('Tour', p.target.turn, '· mode', p.context?.mode,
      '· carte', p.context?.card, '· réserve', p.context?.remaining, '· comparaison du contexte', JSON.stringify(contexte));
  }
}
